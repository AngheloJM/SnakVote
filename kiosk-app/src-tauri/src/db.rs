use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

pub fn init(app_data_dir: &PathBuf) -> Db {
    std::fs::create_dir_all(app_data_dir).expect("create app data dir");
    let db_path = app_data_dir.join("votes.sqlite");
    let conn = Connection::open(db_path).expect("open local sqlite db");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS votes (
            id TEXT PRIMARY KEY,
            kiosk_id TEXT NOT NULL,
            satisfaction TEXT NOT NULL,
            quick_comment TEXT,
            photo_path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )
    .expect("create votes table");

    Db(Mutex::new(conn))
}
