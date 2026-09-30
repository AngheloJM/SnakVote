use chrono::Utc;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use uuid::Uuid;

pub fn build_object_key(kiosk_id: &str, vote_id: &Uuid) -> String {
    let date = Utc::now().format("%Y-%m-%d");
    format!("{kiosk_id}/{date}/{vote_id}.jpg")
}

/// Fotos en una carpeta del propio servidor, definida por `PHOTOS_DIR`.
#[derive(Clone)]
pub struct PhotoStorage {
    root: PathBuf,
}

impl PhotoStorage {
    pub fn from_env() -> anyhow::Result<Self> {
        let root = std::env::var("PHOTOS_DIR")
            .map_err(|_| anyhow::anyhow!("PHOTOS_DIR debe estar configurado (ver .env.example)"))?;
        let root = PathBuf::from(root);
        std::fs::create_dir_all(&root).map_err(|e| {
            anyhow::anyhow!("no se pudo crear PHOTOS_DIR {}: {e}", root.display())
        })?;
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Convierte la clave en una ruta dentro de `root`, rechazando cualquier
    /// cosa que pueda salirse de la carpeta (`..`, rutas absolutas, `\`, etc.).
    fn resolve(&self, object_key: &str) -> anyhow::Result<PathBuf> {
        let mut path = self.root.clone();
        for segment in object_key.split('/') {
            let valid = !segment.is_empty()
                && segment != "."
                && segment != ".."
                && segment
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
            if !valid {
                anyhow::bail!("clave de foto inválida: {object_key}");
            }
            path.push(segment);
        }
        Ok(path)
    }

    pub async fn upload_photo(&self, object_key: &str, bytes: &[u8]) -> anyhow::Result<()> {
        let path = self.resolve(object_key)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        // Escribir a un temporal y renombrar, para no dejar fotos a medio escribir.
        let tmp = path.with_extension("jpg.tmp");
        tokio::fs::write(&tmp, bytes).await?;
        tokio::fs::rename(&tmp, &path).await?;
        Ok(())
    }

    pub async fn fetch_photo(&self, object_key: &str) -> anyhow::Result<Vec<u8>> {
        let path = self.resolve(object_key)?;
        Ok(tokio::fs::read(path).await?)
    }
}

/// Borra las fotos más viejas que `retention`. Corre una vez al día.
pub fn spawn_retention(storage: PhotoStorage, retention: Duration) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            let root = storage.root().to_path_buf();
            let result =
                tokio::task::spawn_blocking(move || purge_older_than(&root, retention)).await;
            match result {
                Ok(Ok(removed)) => tracing::info!("retención de fotos: {removed} archivos borrados"),
                Ok(Err(e)) => tracing::error!("retención de fotos falló: {e}"),
                Err(e) => tracing::error!("retención de fotos falló: {e}"),
            }
        }
    });
}

fn purge_older_than(dir: &Path, retention: Duration) -> std::io::Result<usize> {
    let cutoff = SystemTime::now() - retention;
    let mut removed = 0;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            removed += purge_older_than(&path, retention)?;
            // Quitar carpetas de días que quedaron vacías.
            let _ = std::fs::remove_dir(&path);
        } else if file_type.is_file() && entry.metadata()?.modified()? < cutoff {
            std::fs::remove_file(&path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_rechaza_rutas_fuera_de_la_carpeta() {
        let s = PhotoStorage { root: PathBuf::from("uploads") };
        assert!(s.resolve("kiosko-1/2026-09-17/abc.jpg").is_ok());
        for bad in ["../etc/passwd", "a/../../x.jpg", "/abs.jpg", "a//b.jpg", "a\\..\\b.jpg", "a/b c.jpg", ""] {
            assert!(s.resolve(bad).is_err(), "debería rechazar {bad:?}");
        }
    }
}
