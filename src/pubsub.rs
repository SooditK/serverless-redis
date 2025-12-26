use redis::{aio::PubSub, Client, Msg};

/// Creates a dedicated Pub/Sub connection
pub async fn create_pubsub_connection(redis_url: &str) -> anyhow::Result<PubSub> {
    let client = Client::open(redis_url)?;
    let pubsub = client.get_async_pubsub().await?;
    Ok(pubsub)
}

/// Subscribe to multiple channels
pub async fn subscribe_to_channels(
    pubsub: &mut PubSub,
    channels: &[String],
) -> anyhow::Result<usize> {
    for channel in channels {
        pubsub.subscribe(channel).await?;
    }
    Ok(channels.len())
}

/// Subscribe to multiple patterns
pub async fn psubscribe_to_patterns(
    pubsub: &mut PubSub,
    patterns: &[String],
) -> anyhow::Result<usize> {
    for pattern in patterns {
        pubsub.psubscribe(pattern).await?;
    }
    Ok(patterns.len())
}

/// Message types for Pub/Sub
#[derive(Debug)]
pub enum PubSubMessage {
    Message { channel: String, payload: String },
    PMessage { pattern: String, channel: String, payload: String },
    Subscribe { count: usize },
    Unsubscribe { count: usize },
    PSubscribe { count: usize },
    PUnsubscribe { count: usize },
}

/// Format a Pub/Sub message into SSE format
/// Format: "<type>,<fields>" (without "data: " prefix as that's added by SSE Event)
pub fn format_sse_message(msg: &PubSubMessage) -> String {
    match msg {
        PubSubMessage::Message { channel, payload } => {
            format!("message,{},{}", channel, payload)
        }
        PubSubMessage::PMessage { pattern, channel, payload } => {
            format!("pmessage,{},{},{}", pattern, channel, payload)
        }
        PubSubMessage::Subscribe { count } => {
            format!("subscribe,{}", count)
        }
        PubSubMessage::Unsubscribe { count } => {
            format!("unsubscribe,{}", count)
        }
        PubSubMessage::PSubscribe { count } => {
            format!("psubscribe,{}", count)
        }
        PubSubMessage::PUnsubscribe { count } => {
            format!("punsubscribe,{}", count)
        }
    }
}

/// Convert Redis message payload to JSON string
pub fn payload_to_json_string(payload: &[u8]) -> String {
    match std::str::from_utf8(payload) {
        Ok(s) => {
            // Try to parse as JSON to see if it's already JSON
            if serde_json::from_str::<serde_json::Value>(s).is_ok() {
                s.to_string()
            } else {
                // If not JSON, wrap it as a JSON string
                serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s))
            }
        }
        Err(_) => {
            // If not valid UTF-8, encode as base64 and wrap as JSON string
            let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, payload);
            serde_json::to_string(&encoded).unwrap_or_else(|_| format!("\"{}\"", encoded))
        }
    }
}

/// Parse Redis Pub/Sub message into our PubSubMessage type
pub fn parse_redis_message(msg: &Msg) -> Option<PubSubMessage> {
    let channel = msg.get_channel_name().to_string();
    let payload_bytes: Vec<u8> = msg.get_payload().ok()?;
    let payload = payload_to_json_string(&payload_bytes);

    // Check if this is a pattern message
    if let Ok(pattern) = msg.get_pattern::<String>() {
        Some(PubSubMessage::PMessage {
            pattern,
            channel,
            payload,
        })
    } else {
        Some(PubSubMessage::Message { channel, payload })
    }
}

