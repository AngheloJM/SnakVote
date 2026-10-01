use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::{ConnectInfo, FromRequestParts, State};
use axum::http::{request::Parts, HeaderMap, StatusCode};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration as StdDuration, Instant};
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

const MAX_FAILED_LOGINS: u32 = 5;
const LOGIN_BLOCK_WINDOW: StdDuration = StdDuration::from_secs(15 * 60);

/// Bloquea por 15 minutos una IP tras 5 intentos de login fallidos, para
/// frenar ataques de fuerza bruta contra la contraseña del panel.
#[derive(Default)]
pub struct LoginLimiter {
    failures: Mutex<HashMap<IpAddr, (u32, Instant)>>,
}

impl LoginLimiter {
    fn is_blocked(&self, ip: IpAddr) -> bool {
        let mut map = self.failures.lock().unwrap();
        map.retain(|_, (_, since)| since.elapsed() < LOGIN_BLOCK_WINDOW);
        map.get(&ip).is_some_and(|(count, _)| *count >= MAX_FAILED_LOGINS)
    }

    fn record_failure(&self, ip: IpAddr) {
        let mut map = self.failures.lock().unwrap();
        let entry = map.entry(ip).or_insert((0, Instant::now()));
        entry.0 += 1;
        entry.1 = Instant::now();
    }

    fn reset(&self, ip: IpAddr) {
        self.failures.lock().unwrap().remove(&ip);
    }
}

/// IP real del cliente. Detrás de IIS la conexión siempre viene de
/// 127.0.0.1, así que en ese caso se usa la última IP de X-Forwarded-For
/// (la que agrega ARR). Solo se confía en esa cabecera si la conexión es
/// local, para que un cliente externo no pueda falsificarla.
fn client_ip(peer: SocketAddr, headers: &HeaderMap) -> IpAddr {
    if !peer.ip().is_loopback() {
        return peer.ip();
    }
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit(',').next())
        .map(str::trim)
        .and_then(|last| {
            last.parse::<SocketAddr>()
                .map(|a| a.ip())
                .or_else(|_| last.trim_matches(['[', ']']).parse::<IpAddr>())
                .ok()
        })
        .unwrap_or(peer.ip())
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    axum::Json(payload): axum::Json<LoginRequest>,
) -> Result<axum::Json<LoginResponse>, StatusCode> {
    let ip = client_ip(peer, &headers);
    if state.login_limiter.is_blocked(ip) {
        tracing::warn!("login bloqueado temporalmente para {ip} por intentos fallidos");
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let row: Option<(Uuid, String, String)> =
        sqlx::query_as("SELECT id, email, password_hash FROM users WHERE email = $1")
            .bind(&payload.email)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((id, email, _)) = row
        .filter(|(_, _, hash)| verify_password(hash, &payload.password))
    else {
        state.login_limiter.record_failure(ip);
        return Err(StatusCode::UNAUTHORIZED);
    };
    state.login_limiter.reset(ip);

    let token = create_token(id, &email, &state.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(axum::Json(LoginResponse { token }))
}

/// Crea el usuario de `ADMIN_EMAIL`/`ADMIN_PASSWORD` solo si todavía no
/// existe (primer arranque). Nunca sobrescribe una contraseña existente: para
/// cambiarla se usa `server crear-admin <correo>`.
pub async fn seed_admin_user(db: &sqlx::PgPool) -> anyhow::Result<()> {
    let (email, password) = match (
        std::env::var("ADMIN_EMAIL"),
        std::env::var("ADMIN_PASSWORD"),
    ) {
        (Ok(e), Ok(p)) => (e, p),
        _ => return Ok(()),
    };

    let hash = hash_password(&password)?;
    let created = sqlx::query(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
    )
    .bind(Uuid::new_v4())
    .bind(&email)
    .bind(&hash)
    .execute(db)
    .await?
    .rows_affected()
        > 0;

    if created {
        tracing::info!("usuario admin creado: {email}");
    }
    tracing::warn!(
        "ADMIN_PASSWORD sigue en .env: ya no es necesaria, conviene borrarla \
         (para cambiar contraseñas usar `server crear-admin <correo>`)"
    );
    Ok(())
}

const MIN_PASSWORD_LEN: usize = 12;

pub async fn create_admin_interactive(db: &sqlx::PgPool, email: &str) -> anyhow::Result<()> {
    let email = email.trim();
    if !email.contains('@') {
        anyhow::bail!("correo inválido: {email}");
    }

    let password = rpassword::prompt_password(format!("Contraseña para {email}: "))?;
    if password.chars().count() < MIN_PASSWORD_LEN {
        anyhow::bail!("la contraseña debe tener al menos {MIN_PASSWORD_LEN} caracteres");
    }
    if rpassword::prompt_password("Repetir contraseña: ")? != password {
        anyhow::bail!("las contraseñas no coinciden");
    }

    let hash = hash_password(&password)?;
    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(&hash)
    .execute(db)
    .await?;

    println!("Usuario {email} listo. Ya puede iniciar sesión en el panel.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(xff: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert("x-forwarded-for", xff.parse().unwrap());
        h
    }

    #[test]
    fn client_ip_usa_x_forwarded_for_solo_desde_localhost() {
        let local: SocketAddr = "127.0.0.1:5000".parse().unwrap();
        let remoto: SocketAddr = "200.1.2.3:5000".parse().unwrap();
        // ARR agrega la IP real (con puerto) al final.
        assert_eq!(client_ip(local, &headers("1.1.1.1, 190.5.6.7:51234")), "190.5.6.7".parse::<IpAddr>().unwrap());
        assert_eq!(client_ip(local, &headers("190.5.6.7")), "190.5.6.7".parse::<IpAddr>().unwrap());
        assert_eq!(client_ip(local, &headers("[2800::1]:443")), "2800::1".parse::<IpAddr>().unwrap());
        // Desde fuera no se confía en la cabecera.
        assert_eq!(client_ip(remoto, &headers("9.9.9.9")), remoto.ip());
        assert_eq!(client_ip(local, &HeaderMap::new()), local.ip());
    }

    #[test]
    fn limiter_bloquea_tras_intentos_fallidos_y_se_reinicia() {
        let l = LoginLimiter::default();
        let ip: IpAddr = "190.5.6.7".parse().unwrap();
        for _ in 0..MAX_FAILED_LOGINS - 1 {
            l.record_failure(ip);
        }
        assert!(!l.is_blocked(ip));
        l.record_failure(ip);
        assert!(l.is_blocked(ip));
        l.reset(ip);
        assert!(!l.is_blocked(ip));
    }
}
