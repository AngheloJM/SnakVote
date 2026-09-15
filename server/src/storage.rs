// Cliente para Cloudflare R2 (compatible con S3).
// TODO: implementar con aws-sdk-s3 (endpoint apuntando a R2) una vez definidas
// las credenciales. Por ahora solo construye el object_key para dejar el
// modelo de datos funcionando de punta a punta.

use chrono::Utc;
use uuid::Uuid;

pub fn build_object_key(kiosk_id: &str, vote_id: &Uuid) -> String {
    let date = Utc::now().format("%Y-%m-%d");
    format!("{kiosk_id}/{date}/{vote_id}.jpg")
}

pub async fn upload_photo(_object_key: &str, _bytes: &[u8]) -> anyhow::Result<()> {
    // TODO: PUT a R2 usando credenciales con scope restringido al bucket.
    Ok(())
}
