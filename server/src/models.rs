use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Vote {
    pub id: Uuid,
    pub kiosk_id: String,
    pub satisfaction: String,
    pub attention_or_food: Option<String>,
    pub photo_key: Option<String>,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct NewVote {
    pub id: Uuid,
    pub kiosk_id: String,
    pub satisfaction: String,
    pub attention_or_food: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReason {
    pub reason: String,
}
