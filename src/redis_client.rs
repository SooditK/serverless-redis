use redis::{aio::ConnectionManager, Cmd, Pipeline, Value};
use std::time::Duration;
use tokio::time::timeout;

fn redis_to_json(v: Value) -> serde_json::Value {
    match v {
        Value::Nil => serde_json::Value::Null,
        Value::Int(i) => serde_json::Value::String(i.to_string()),
        Value::BulkString(bs) => {
            match std::str::from_utf8(&bs) {
                Ok(s) => serde_json::Value::String(s.to_string()),
                Err(_) => serde_json::Value::String(String::from_utf8_lossy(&bs).to_string()),
            }
        },
        Value::SimpleString(s) => serde_json::Value::String(s),
        Value::Array(arr) => serde_json::Value::Array(arr.into_iter().map(redis_to_json).collect()),
        Value::Okay => serde_json::Value::String("OK".to_string()),
        Value::Double(f) => serde_json::json!(f),
        Value::Boolean(b) => serde_json::json!(b),
        Value::BigNumber(n) => serde_json::Value::String(n.to_string()),
        Value::Map(m) => {
            let mut map = serde_json::Map::new();
            for (k, v) in m {
                let key_str = match k {
                    Value::SimpleString(s) => Some(s),
                    Value::BulkString(bs) => String::from_utf8(bs).ok(),
                    _ => None,
                };
                if let Some(ks) = key_str {
                    map.insert(ks, redis_to_json(v));
                }
            }
            serde_json::Value::Object(map)
        }
        Value::Set(s) => serde_json::Value::Array(s.into_iter().map(redis_to_json).collect()),
        Value::Push { data, .. } => {
            serde_json::Value::Array(data.into_iter().map(redis_to_json).collect())
        }
        Value::Attribute { data, .. } => redis_to_json(*data),
        Value::VerbatimString { format: _, text } => serde_json::Value::String(text),
        Value::ServerError(e) => serde_json::json!({"error": format!("{:?}", e)}),
    }
}

pub async fn do_call(
    conn: &mut ConnectionManager,
    cmd: Vec<String>,
) -> anyhow::Result<serde_json::Value> {
    if cmd.is_empty() {
        anyhow::bail!("empty command")
    }
    let mut redis_cmd = Cmd::new();
    for a in cmd {
        redis_cmd.arg(a);
    }
    let v: Value = timeout(Duration::from_secs(3), redis_cmd.query_async(conn)).await??;
    Ok(redis_to_json(v))
}

pub async fn execute_pipeline(
    conn: &mut ConnectionManager,
    cmds: Vec<Vec<String>>,
) -> anyhow::Result<Vec<serde_json::Value>> {
    if cmds.is_empty() {
        return Ok(vec![]);
    }
    let mut pipe = Pipeline::new();
    for cmd_args in cmds {
        if cmd_args.is_empty() {
            continue;
        }
        let mut c = Cmd::new();
        for arg in cmd_args {
            c.arg(arg);
        }
        pipe.add_command(c);
    }

    let results: Vec<Value> = timeout(Duration::from_secs(10), pipe.query_async(conn)).await??;
    Ok(results.into_iter().map(redis_to_json).collect())
}
