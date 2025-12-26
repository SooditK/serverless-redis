use crate::models::{AppState, EnvResp};
use crate::redis_client::{do_call, execute_pipeline};
use crate::utils::write_resp;
use axum::{extract::State, http::HeaderMap, response::Response, Json};

pub async fn post_root(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Response {
    let enc = headers
        .get("upstash-encoding")
        .and_then(|v| v.to_str().ok())
        == Some("base64");
    let arr = body.as_array();
    if arr.is_none() {
        return write_resp(
            EnvResp {
                status: "malformed_data".into(),
                result: None,
                result_list: None,
                error: Some(
                    "Invalid command array. Expected a string array at root of the command and its arguments.".into(),
                ),
                message: None,
            },
            enc,
        );
    }

    let mut cmd = Vec::with_capacity(arr.unwrap().len());
    for v in arr.unwrap() {
        let arg = match v {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "".to_string(),
            _ => {
                return write_resp(
                    EnvResp {
                        status: "malformed_data".into(),
                        result: None,
                        result_list: None,
                        error: Some(
                            "Invalid command array. Expected strings, numbers, or booleans.".into(),
                        ),
                        message: None,
                    },
                    enc,
                );
            }
        };
        cmd.push(arg);
    }

    let mut conn = state.conn.clone();
    match do_call(&mut conn, cmd).await {
        Ok(v) => write_resp(
            EnvResp {
                status: "ok".into(),
                result: Some(v),
                result_list: None,
                error: None,
                message: None,
            },
            enc,
        ),
        Err(e) => write_resp(
            EnvResp {
                status: "error".into(),
                result: None,
                result_list: None,
                error: Some(e.to_string()),
                message: None,
            },
            enc,
        ),
    }
}

pub async fn post_pipeline(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Response {
    let enc = headers
        .get("upstash-encoding")
        .and_then(|v| v.to_str().ok())
        == Some("base64");
    let outer = body.as_array();
    if outer.is_none() {
        return write_resp(
            EnvResp {
                status: "malformed_data".into(),
                result: None,
                result_list: None,
                error: Some(
                    "Invalid command array. Expected an array of string arrays at root.".into(),
                ),
                message: None,
            },
            enc,
        );
    }

    let mut cmds = Vec::with_capacity(outer.unwrap().len());
    for item in outer.unwrap() {
        let arr = item.as_array();
        if arr.is_none() {
            return write_resp(
                EnvResp {
                    status: "malformed_data".into(),
                    result: None,
                    result_list: None,
                    error: Some(
                        "Invalid command array. Expected an array of string arrays at root.".into(),
                    ),
                    message: None,
                },
                enc,
            );
        }
        let mut cmd = Vec::with_capacity(arr.unwrap().len());
        for v in arr.unwrap() {
            let arg = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "".to_string(),
                _ => {
                    return write_resp(
                        EnvResp {
                            status: "malformed_data".into(),
                            result: None,
                            result_list: None,
                            error: Some(
                                "Invalid command array. Expected strings, numbers, or booleans."
                                    .into(),
                            ),
                            message: None,
                        },
                        enc,
                    );
                }
            };
            cmd.push(arg);
        }
        cmds.push(cmd);
    }

    let mut conn = state.conn.clone();
    match execute_pipeline(&mut conn, cmds).await {
        Ok(results) => {
            let out: Vec<serde_json::Value> = results
                .into_iter()
                .map(|v| serde_json::json!({"status": "ok", "result": v}))
                .collect();
            write_resp(
                EnvResp {
                    status: "ok".into(),
                    result: Some(serde_json::Value::Array(out)),
                    result_list: None,
                    error: None,
                    message: None,
                },
                enc,
            )
        }
        Err(e) => write_resp(
            EnvResp {
                status: "error".into(),
                result: None,
                result_list: None,
                error: Some(e.to_string()),
                message: None,
            },
            enc,
        ),
    }
}

pub async fn post_multi_exec(
    state: State<AppState>,
    headers: HeaderMap,
    body: Json<serde_json::Value>,
) -> Response {
    post_pipeline(state, headers, body).await
}

use crate::pubsub::{
    create_pubsub_connection, format_sse_message, parse_redis_message, subscribe_to_channels,
    psubscribe_to_patterns, PubSubMessage,
};
use axum::{
    extract::Path,
    response::sse::{Event, KeepAlive, Sse},
};
use futures::stream::Stream;
use std::convert::Infallible;
use tokio_stream::StreamExt;

pub async fn get_subscribe(
    State(state): State<AppState>,
    Path(channels): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, Response> {
    // Parse channels from path - they come as a comma-separated or slash-separated string
    let channel_list: Vec<String> = channels
        .split('/')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    if channel_list.is_empty() {
        return Err(write_resp(
            EnvResp {
                status: "malformed_data".into(),
                result: None,
                result_list: None,
                error: Some("No channels specified".into()),
                message: None,
            },
            false,
        ));
    }

    // Create a dedicated Pub/Sub connection
    let mut pubsub = match create_pubsub_connection(&state.redis_url).await {
        Ok(ps) => ps,
        Err(e) => {
            return Err(write_resp(
                EnvResp {
                    status: "connection_error".into(),
                    result: None,
                    result_list: None,
                    error: Some(format!("Failed to create pubsub connection: {}", e)),
                    message: None,
                },
                false,
            ));
        }
    };

    // Subscribe to channels
    let count = match subscribe_to_channels(&mut pubsub, &channel_list).await {
        Ok(c) => c,
        Err(e) => {
            return Err(write_resp(
                EnvResp {
                    status: "error".into(),
                    result: None,
                    result_list: None,
                    error: Some(format!("Failed to subscribe: {}", e)),
                    message: None,
                },
                false,
            ));
        }
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        // Send initial subscribe event
        let subscribe_msg = PubSubMessage::Subscribe { count };
        yield Ok(Event::default().data(format_sse_message(&subscribe_msg)));

        // Stream messages
        let mut message_stream = pubsub.on_message();
        while let Some(msg) = message_stream.next().await {
            if let Some(parsed) = parse_redis_message(&msg) {
                let sse_data = format_sse_message(&parsed);
                yield Ok(Event::default().data(sse_data));
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

pub async fn get_psubscribe(
    State(state): State<AppState>,
    Path(patterns): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, Response> {
    // Parse patterns from path
    let pattern_list: Vec<String> = patterns
        .split('/')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    if pattern_list.is_empty() {
        return Err(write_resp(
            EnvResp {
                status: "malformed_data".into(),
                result: None,
                result_list: None,
                error: Some("No patterns specified".into()),
                message: None,
            },
            false,
        ));
    }

    // Create a dedicated Pub/Sub connection
    let mut pubsub = match create_pubsub_connection(&state.redis_url).await {
        Ok(ps) => ps,
        Err(e) => {
            return Err(write_resp(
                EnvResp {
                    status: "connection_error".into(),
                    result: None,
                    result_list: None,
                    error: Some(format!("Failed to create pubsub connection: {}", e)),
                    message: None,
                },
                false,
            ));
        }
    };

    // Subscribe to patterns
    let count = match psubscribe_to_patterns(&mut pubsub, &pattern_list).await {
        Ok(c) => c,
        Err(e) => {
            return Err(write_resp(
                EnvResp {
                    status: "error".into(),
                    result: None,
                    result_list: None,
                    error: Some(format!("Failed to psubscribe: {}", e)),
                    message: None,
                },
                false,
            ));
        }
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        // Send initial psubscribe event
        let psubscribe_msg = PubSubMessage::PSubscribe { count };
        yield Ok(Event::default().data(format_sse_message(&psubscribe_msg)));

        // Stream messages
        let mut message_stream = pubsub.on_message();
        while let Some(msg) = message_stream.next().await {
            if let Some(parsed) = parse_redis_message(&msg) {
                let sse_data = format_sse_message(&parsed);
                yield Ok(Event::default().data(sse_data));
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
