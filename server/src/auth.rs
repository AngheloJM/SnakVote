use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::{FromRequestParts, State};
use axum::http::{request::Parts, StatusCode};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
}

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .to_string();
    Ok(hash)
}

pub fn verify_password(hash: &str, password: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

pub fn create_token(user_id: Uuid, email: &str, secret: &str) -> anyhow::Result<String> {
    let exp = (Utc::now() + Duration::hours(12)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

fn validate_token(token: &str, secret: &str) -> Option<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .ok()
    .map(|d| d.claims)
}

fn token_from_parts(parts: &Parts) -> Option<String> {
    if let Some(auth) = parts.headers.get(axum::http::header::AUTHORIZATION) {
        if let Ok(value) = auth.to_str() {
            if let Some(token) = value.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }
    // El navegador no puede mandar headers custom al abrir un WebSocket,
    // así que el panel admin pasa el token como query param en ese caso.
    parts.uri.query().and_then(|q| {
        q.split('&')
            .find_map(|pair| pair.strip_prefix("token=").map(|t| t.to_string()))
    })
}

pub struct AdminAuth {
    pub email: String,
}

impl FromRequestParts<Arc<AppState>> for AdminAuth {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let token = token_from_parts(parts).ok_or(StatusCode::UNAUTHORIZED)?;
        let claims = validate_token(&token, &state.jwt_secret).ok_or(StatusCode::UNAUTHORIZED)?;
        Ok(AdminAuth { email: claims.email })
    }
}

pub struct KioskAuth;

impl FromRequestParts<Arc<AppState>> for KioskAuth {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let key = parts
            .headers
            .get("x-kiosk-key")
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;
        if key == state.kiosk_api_key {
            Ok(KioskAuth)
        } else {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<LoginRequest>,
) -> Result<axum::Json<LoginResponse>, StatusCode> {
    let row: Option<(Uuid, String, String)> =
        sqlx::query_as("SELECT id, email, password_hash FROM users WHERE email = $1")
            .bind(&payload.email)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (id, email, password_hash) = row.ok_or(StatusCode::UNAUTHORIZED)?;

    if !verify_password(&password_hash, &payload.password) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = create_token(id, &email, &state.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(axum::Json(LoginResponse { token }))
}

pub async fn seed_admin_user(db: &sqlx::PgPool) -> anyhow::Result<()> {
    let (email, password) = match (
        std::env::var("ADMIN_EMAIL"),
        std::env::var("ADMIN_PASSWORD"),
    ) {
        (Ok(e), Ok(p)) => (e, p),
        _ => {
            tracing::warn!("ADMIN_EMAIL/ADMIN_PASSWORD no configurados, no se creó/actualizó ningún usuario");
            return Ok(());
        }
    };

    let hash = hash_password(&password)?;

    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&email)
    .bind(&hash)
    .execute(db)
    .await?;

    tracing::info!("usuario admin listo: {email}");
    Ok(())
}
