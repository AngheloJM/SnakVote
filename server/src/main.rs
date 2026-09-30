mod auth;
mod models;
mod storage;

use auth::{AdminAuth, KioskAuth};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        FromRequestParts, Multipart, Path, Query, Request, State,
    },
    http::StatusCode,
    middleware::{self, Next},
    response::Response,
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use models::{NewVote, UpdateReason, Vote};
use serde::Deserialize;
use sqlx::PgPool;
use std::sync::Arc;
use storage::PhotoStorage;
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use uuid::Uuid;

struct AppState {
    db: PgPool,
    votes_tx: broadcast::Sender<Vote>,
    jwt_secret: String,
    kiosk_api_key: String,
    photos: PhotoStorage,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")?;
    let db = PgPool::connect(&database_url).await?;
    sqlx::migrate!().run(&db).await?;
    auth::seed_admin_user(&db).await?;

    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET debe estar configurado (ver .env.example)");
    let kiosk_api_key = std::env::var("KIOSK_API_KEY")
        .expect("KIOSK_API_KEY debe estar configurado (ver .env.example)");
    let photos = PhotoStorage::from_env()?;
    let retention_days: u64 = std::env::var("PHOTO_RETENTION_DAYS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(90);
    tracing::info!(
        "fotos en {}, retención {retention_days} días",
        photos.root().display()
    );
    storage::spawn_retention(
        photos.clone(),
        std::time::Duration::from_secs(retention_days * 24 * 60 * 60),
    );

    let (votes_tx, _) = broadcast::channel(100);
    let state = Arc::new(AppState {
        db,
        votes_tx,
        jwt_secret,
        kiosk_api_key,
        photos,
    });

    let photo_routes = Router::new()
        .route("/uploads/{*key}", get(get_photo))
        .layer(middleware::from_fn_with_state(state.clone(), require_admin));

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/login", post(auth::login))
        .route("/votes", post(create_vote).get(list_votes))
        .route("/votes/{id}/reason", patch(update_reason))
        .route("/votes/{id}/photo", post(upload_photo))
        .route("/ws", get(ws_handler))
        .merge(photo_routes)
        .layer(cors_from_env())
        .with_state(state);

    // En producción detrás de IIS usar 127.0.0.1:<puerto> para no exponerlo a la red.
    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3000".into());
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn require_admin(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let (mut parts, body) = request.into_parts();
    AdminAuth::from_request_parts(&mut parts, &state).await?;
    let request = Request::from_parts(parts, body);
    Ok(next.run(request).await)
}

async fn create_vote(
    State(state): State<Arc<AppState>>,
    _auth: KioskAuth,
    Json(payload): Json<NewVote>,
) -> Json<Vote> {
    let vote = sqlx::query_as::<_, Vote>(
        r#"
        INSERT INTO votes (id, kiosk_id, satisfaction, attention_or_food, created_at, synced_at)
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING id, kiosk_id, satisfaction, attention_or_food, photo_key, reason, created_at, synced_at
        "#,
    )
    .bind(payload.id)
    .bind(payload.kiosk_id)
    .bind(payload.satisfaction)
    .bind(payload.attention_or_food)
    .bind(payload.created_at)
    .fetch_one(&state.db)
    .await
    .expect("insert vote");

    let _ = state.votes_tx.send(vote.clone());
    Json(vote)
}

#[derive(Deserialize)]
struct VotesQuery {
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
}

async fn list_votes(
    State(state): State<Arc<AppState>>,
    _auth: AdminAuth,
    Query(q): Query<VotesQuery>,
) -> Json<Vec<Vote>> {
    let votes = sqlx::query_as::<_, Vote>(
        r#"
        SELECT id, kiosk_id, satisfaction, attention_or_food, photo_key, reason, created_at, synced_at
        FROM votes
        WHERE ($1::timestamptz IS NULL OR created_at >= $1)
          AND ($2::timestamptz IS NULL OR created_at <= $2)
        ORDER BY created_at DESC
        "#,
    )
    .bind(q.from)
    .bind(q.to)
    .fetch_all(&state.db)
    .await
    .expect("list votes");

    Json(votes)
}

async fn update_reason(
    State(state): State<Arc<AppState>>,
    _auth: AdminAuth,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateReason>,
) -> Json<Vote> {
    let vote = sqlx::query_as::<_, Vote>(
        r#"
        UPDATE votes SET reason = $1 WHERE id = $2
        RETURNING id, kiosk_id, satisfaction, attention_or_food, photo_key, reason, created_at, synced_at
        "#,
    )
    .bind(payload.reason)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .expect("update reason");

    Json(vote)
}

async fn upload_photo(
    State(state): State<Arc<AppState>>,
    _auth: KioskAuth,
    Path(id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<Vote>, StatusCode> {
    let kiosk_id: Option<String> = sqlx::query_scalar("SELECT kiosk_id FROM votes WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let kiosk_id = kiosk_id.ok_or(StatusCode::NOT_FOUND)?;

    let field = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
        .ok_or(StatusCode::BAD_REQUEST)?;
    let bytes = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;

    let object_key = storage::build_object_key(&kiosk_id, &id);
    state
        .photos
        .upload_photo(&object_key, &bytes)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let vote = sqlx::query_as::<_, Vote>(
        r#"
        UPDATE votes SET photo_key = $1 WHERE id = $2
        RETURNING id, kiosk_id, satisfaction, attention_or_food, photo_key, reason, created_at, synced_at
        "#,
    )
    .bind(&object_key)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = state.votes_tx.send(vote.clone());
    Ok(Json(vote))
}

async fn get_photo(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> Result<([(axum::http::header::HeaderName, &'static str); 1], Vec<u8>), StatusCode> {
    let bytes = state
        .photos
        .fetch_photo(&key)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    Ok(([(axum::http::header::CONTENT_TYPE, "image/jpeg")], bytes))
}

async fn ws_handler(
    _auth: AdminAuth,
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.votes_tx.subscribe();
    while let Ok(vote) = rx.recv().await {
        let payload = serde_json::to_string(&vote).unwrap_or_default();
        if socket.send(Message::Text(payload.into())).await.is_err() {
            break;
        }
    }
}

/// Orígenes permitidos para llamar a la API desde un navegador, separados por
/// coma en `CORS_ORIGINS`. En producción el panel se sirve desde el mismo
/// dominio que la API, así que puede quedar vacío (sin CORS). El kiosko no
/// pasa por el navegador y no lo necesita.
fn cors_from_env() -> CorsLayer {
    let origins: Vec<axum::http::HeaderValue> = std::env::var("CORS_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|o| !o.is_empty())
        .filter_map(|o| o.parse().ok())
        .collect();
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PATCH,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ])
}
