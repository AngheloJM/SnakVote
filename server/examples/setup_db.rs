// Uso único: crea la base de datos y el usuario de la app en un Postgres
// nuevo, usando credenciales de admin solo para este paso. No se ejecuta en
// producción ni se registra en el binario del servidor.
use sqlx::postgres::PgConnectOptions;
use sqlx::{ConnectOptions, Executor};
use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let admin_url = env::var("ADMIN_DATABASE_URL")?;
    let app_db = env::var("NEW_DB_NAME")?;
    let app_user = env::var("NEW_DB_USER")?;
    let app_password = env::var("NEW_DB_PASSWORD")?;

    let opts: PgConnectOptions = admin_url.parse()?;
    let mut conn = opts.connect().await?;

    conn.execute(format!("CREATE ROLE {app_user} LOGIN PASSWORD '{app_password}'").as_str())
        .await?;
    println!("Rol {app_user} creado");

    conn.execute(format!("CREATE DATABASE {app_db} OWNER {app_user}").as_str())
        .await?;
    println!("Base {app_db} creada, dueño: {app_user}");

    Ok(())
}
