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

pub async fn upload_photo(object_key: &str, bytes: &[u8]) -> anyhow::Result<()> {
    // Fallback de desarrollo: guarda en disco local bajo ./uploads.
    // TODO: reemplazar por un PUT real a R2 (credenciales con scope
    // restringido al bucket) manteniendo la misma firma de función.
    let path = std::path::Path::new("uploads").join(object_key);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, bytes).await?;
    Ok(())
}
