use serverless_redis::create_app;
use serverless_redis::models::AppState;
use std::env;
use std::net::SocketAddr;
use std::time::Duration;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    // Load .env file if present
    dotenvy::dotenv().ok();

    let url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    println!("Connecting to Redis at: {}", url);
    
    let client = redis::Client::open(url.clone()).expect("Failed to create Redis client");
    
    // Add timeout for connection with clear error message
    let conn = match tokio::time::timeout(
        Duration::from_secs(5),
        client.get_connection_manager()
    ).await {
        Ok(Ok(conn)) => {
            println!("✓ Connected to Redis successfully");
            conn
        }
        Ok(Err(e)) => {
            eprintln!("✗ Failed to connect to Redis: {}", e);
            eprintln!("  Make sure Redis is running at: {}", url);
            std::process::exit(1);
        }
        Err(_) => {
            eprintln!("✗ Timeout connecting to Redis (5s)");
            eprintln!("  Make sure Redis is running at: {}", url);
            std::process::exit(1);
        }
    };
    
    let token = env::var("SR_TOKEN").unwrap_or_default();
    if token.is_empty() {
        println!("⚠ Warning: SR_TOKEN not set - authentication disabled");
    } else {
        println!("✓ Bearer token authentication enabled");
    }
    
    let state = AppState { conn, redis_url: url };
    let app = create_app(state, token);

    let port = env::var("PORT").unwrap_or_else(|_| "3000".into());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().expect("valid address");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("✓ Listening on http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}
