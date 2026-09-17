use crate::db::Db;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

// Se toma de la variable de entorno SERVER_URL al compilar. Como este
// proyecto es para un solo kiosko, no vale la pena una pantalla de
// configuración en runtime: si el día de mañana cambia la dirección del
// servidor, se recompila una vez con el nuevo valor.
const SERVER_URL: &str = match option_env!("SERVER_URL") {
    Some(url) => url,
    None => "http://127.0.0.1:3000",
};

// Se toma de la variable de entorno KIOSK_API_KEY al compilar (no se
// commitea el valor real: el repo es público). Para desarrollo local usa el
// valor de repuesto, que debe coincidir con KIOSK_API_KEY en server/.env.
const KIOSK_API_KEY: &str = match option_env!("KIOSK_API_KEY") {
    Some(key) => key,
    None => "dev-only-key-change-me",
};

// Evita que la sincronización periódica y la inmediata (tras votar)
// corran en paralelo y dupliquen intentos sobre las mismas filas.
static SYNC_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

pub fn spawn_sync_loop(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
        loop {
            interval.tick().await;
            sync_pending(&app_handle).await;
        }
    });
}

pub async fn sync_pending(app_handle: &tauri::AppHandle) {
    if SYNC_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }
    struct ResetOnDrop;
    impl Drop for ResetOnDrop {
        fn drop(&mut self) {
            SYNC_IN_PROGRESS.store(false, Ordering::SeqCst);
        }
    }
    let _guard = ResetOnDrop;

    let state = app_handle.state::<Db>();
    let pending: Vec<(String, String, String, Option<String>, String, String)> = {
        let conn = state.0.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, kiosk_id, satisfaction, quick_comment, photo_path, created_at
                 FROM votes WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5",
            )
            .unwrap();
        stmt.query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })
        .unwrap()
        .filter_map(Result::ok)
        .collect()
    };

    if pending.is_empty() {
        return;
    }

    let client = reqwest::Client::new();

    for (id, kiosk_id, satisfaction, quick_comment, photo_path, created_at) in pending {
        let vote_result = client
            .post(format!("{SERVER_URL}/votes"))
            .header("x-kiosk-key", KIOSK_API_KEY)
            .json(&json!({
                "id": id,
                "kiosk_id": kiosk_id,
                "satisfaction": satisfaction,
                "attention_or_food": quick_comment,
                "created_at": created_at,
            }))
            .send()
            .await;

        let vote_ok = matches!(vote_result, Ok(resp) if resp.status().is_success());
        if !vote_ok {
            mark_retry(app_handle, &id);
            continue;
        }

        let photo_ok = upload_photo(&client, &id, &PathBuf::from(&photo_path)).await;
        if photo_ok {
            mark_synced(app_handle, &id, &photo_path);
        } else {
            mark_retry(app_handle, &id);
        }
    }
}

async fn upload_photo(client: &reqwest::Client, vote_id: &str, photo_path: &PathBuf) -> bool {
    let bytes = match tokio::fs::read(photo_path).await {
        Ok(b) => b,
        Err(_) => return false,
    };

    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name("photo.jpg")
        .mime_str("image/jpeg")
        .unwrap();
    let form = reqwest::multipart::Form::new().part("photo", part);

    client
        .post(format!("{SERVER_URL}/votes/{vote_id}/photo"))
        .header("x-kiosk-key", KIOSK_API_KEY)
        .multipart(form)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

fn mark_synced(app_handle: &tauri::AppHandle, id: &str, photo_path: &str) {
    let state = app_handle.state::<Db>();
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE votes SET status = 'synced' WHERE id = ?1",
        [id],
    )
    .ok();
    let _ = std::fs::remove_file(photo_path);
}

fn mark_retry(app_handle: &tauri::AppHandle, id: &str) {
    let state = app_handle.state::<Db>();
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE votes SET retry_count = retry_count + 1 WHERE id = ?1",
        [id],
    )
    .ok();
}
