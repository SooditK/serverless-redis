use serverless_redis::create_app;
use serverless_redis::models::AppState;
use std::env;
use std::net::SocketAddr;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    let client = redis::Client::open(url.clone()).expect("redis client");
    let conn = client
        .get_connection_manager()
        .await
        .expect("redis connection");
    let token = env::var("SR_TOKEN").unwrap_or_default();
    let state = AppState { conn, redis_url: url };

    let app = create_app(state, token);

    let port = env::var("PORT").unwrap_or_else(|_| "3000".into());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().expect("valid address");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("Listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}
