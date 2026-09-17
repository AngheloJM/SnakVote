mod db;
mod sync;

use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use db::Db;
use tauri::Manager;
use uuid::Uuid;

#[tauri::command]
fn cast_vote(
    app_handle: tauri::AppHandle,
    kiosk_id: String,
    satisfaction: String,
    quick_comment: String,
    photo_base64: String,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();

    let photo_bytes = STANDARD
        .decode(photo_base64)
        .map_err(|e| format!("foto inválida: {e}"))?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let photos_dir = app_data_dir.join("photos");
    std::fs::create_dir_all(&photos_dir).map_err(|e| e.to_string())?;
    let photo_path = photos_dir.join(format!("{id}.jpg"));
    std::fs::write(&photo_path, &photo_bytes).map_err(|e| e.to_string())?;

    let state = app_handle.state::<Db>();
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO votes (id, kiosk_id, satisfaction, quick_comment, photo_path, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                id,
                kiosk_id,
                satisfaction,
                quick_comment,
                photo_path.to_string_lossy().to_string(),
                created_at
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        sync::sync_pending(&handle).await;
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            app.manage(db::init(&app_data_dir));
            sync::spawn_sync_loop(app.handle().clone());

            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{PermissionRequestExt, WebViewExt};
                if let Some(window) = app.get_webview_window("main") {
                    window.with_webview(|webview| {
                        webview.inner().connect_permission_request(|_, request| {
                            request.allow();
                            true
                        });
                    })?;
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![cast_vote])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
