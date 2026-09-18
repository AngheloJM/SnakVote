// Utilidad de diagnóstico: prueba una conexión a Postgres usando la URL en
// TEST_DATABASE_URL. Útil para aislar problemas de red/autenticación antes
// de tocar el server real.
use sqlx::postgres::PgConnectOptions;
use sqlx::ConnectOptions;
use std::env;

#[tokio::main]
async fn main() {
    let url = env::var("TEST_DATABASE_URL").unwrap();
    let opts: PgConnectOptions = url.parse().unwrap();
    match opts.connect().await {
        Ok(_) => println!("CONEXION OK"),
        Err(e) => println!("ERROR: {:?}", e),
    }
}
