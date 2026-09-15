mod models;
mod storage;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    routing::{get, patch, post},
    Json, Router,
};
use models::{NewVote, UpdateReason, Vote};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    votes_tx: broadcast::Sender<Vote>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")?;
    let db = PgPool::connect(&database_url).await?;
    sqlx::migrate!().run(&db).await?;

    let (votes_tx, _) = broadcast::channel(100);
    let state = Arc::new(AppState { db, votes_tx });

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/votes", post(create_vote).get(list_votes))
        .route("/votes/{id}/reason", patch(update_reason))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn create_vote(
    State(state): State<Arc<AppState>>,
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

async fn list_votes(State(state): State<Arc<AppState>>) -> Json<Vec<Vote>> {
    let votes = sqlx::query_as::<_, Vote>(
        "SELECT id, kiosk_id, satisfaction, attention_or_food, photo_key, reason, created_at, synced_at FROM votes ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .expect("list votes");

    Json(votes)
}

async fn update_reason(
    State(state): State<Arc<AppState>>,
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

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> axum::response::Response {
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
