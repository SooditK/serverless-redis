use redis::{aio::ConnectionManager, Cmd, Pipeline, Value};
use std::time::Duration;
use tokio::time::timeout;

/// Convert Redis Value to JSON, preserving type semantics for Upstash compatibility
fn redis_to_json(v: Value) -> serde_json::Value {
    redis_to_json_with_context(v, ConversionContext::Default)
}

#[derive(Clone, Copy)]
enum ConversionContext {
    Default,
    InsideMap,
}

/// Convert Redis values with context awareness for proper type handling
fn redis_to_json_with_context(v: Value, ctx: ConversionContext) -> serde_json::Value {
    match v {
        Value::Nil => serde_json::Value::Null,
        Value::Int(i) => serde_json::json!(i),
        Value::BulkString(bs) => {
            if let Ok(s) = std::str::from_utf8(&bs) {
                // Only convert numeric strings to numbers when inside maps (like FUNCTION STATS)
                // Keep cursors and IDs as strings in arrays (like SCAN results)
                if matches!(ctx, ConversionContext::InsideMap) && !s.is_empty() {
                    if let Ok(num) = s.parse::<i64>() {
                        return serde_json::json!(num);
                    }
                    if let Ok(num) = s.parse::<f64>() {
                        return serde_json::json!(num);
                    }
                }
                serde_json::Value::String(s.to_string())
            } else {
                serde_json::Value::String(String::from_utf8_lossy(&bs).to_string())
            }
        }
        Value::SimpleString(s) => serde_json::Value::String(s),
        Value::Array(arr) => serde_json::Value::Array(
            arr.into_iter().map(|v| redis_to_json_with_context(v, ConversionContext::Default)).collect()
        ),
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
                    // Use InsideMap context to enable numeric string conversion in map values
                    map.insert(ks, redis_to_json_with_context(v, ConversionContext::InsideMap));
                }
            }
            serde_json::Value::Object(map)
        }
        Value::Set(s) => serde_json::Value::Array(
            s.into_iter().map(|v| redis_to_json_with_context(v, ConversionContext::Default)).collect()
        ),
        Value::Push { data, .. } => {
            serde_json::Value::Array(
                data.into_iter().map(|v| redis_to_json_with_context(v, ConversionContext::Default)).collect()
            )
        }
        Value::Attribute { data, .. } => redis_to_json_with_context(*data, ctx),
        Value::VerbatimString { format: _, text } => serde_json::Value::String(text),
        Value::ServerError(e) => serde_json::json!({"error": format!("{:?}", e)}),
        _ => serde_json::Value::Null,
    }
}

fn normalize_command(cmd: &mut [String]) {
    if cmd.is_empty() {
        return;
    }

    let name = cmd[0].to_ascii_lowercase();
    
    // Handle FUNCTION LOAD - strip leading whitespace from script code
    if name == "function" && cmd.len() >= 3 && cmd[1].to_ascii_lowercase() == "load" {
        // Find the code argument (last argument)
        let code_idx = cmd.len() - 1;
        let code = &cmd[code_idx];
        
        // Strip leading whitespace/newlines before shebang
        if let Some(shebang_pos) = code.find("#!") {
            let trimmed = &code[shebang_pos..];
            cmd[code_idx] = trimmed.to_string();
        }
    }
    
    // Handle read-only command variants
    let base = name
        .strip_suffix("_ro")
        .or_else(|| name.strip_suffix("ro"))
        .unwrap_or(name.as_str());

    // Commands that have read-only variants that should fall back to base command
    const RO_FALLBACKS: &[&str] = &["eval", "evalsha", "fcall"];
    if RO_FALLBACKS.contains(&base) {
        cmd[0] = base.to_string();
    }
}

pub async fn do_call(
    conn: &mut ConnectionManager,
    cmd: Vec<String>,
) -> anyhow::Result<serde_json::Value> {
    if cmd.is_empty() {
        anyhow::bail!("empty command")
    }
    let mut cmd = cmd;
    normalize_command(&mut cmd);
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
    for mut cmd_args in cmds {
        if cmd_args.is_empty() {
            continue;
        }
        normalize_command(&mut cmd_args);
        let mut c = Cmd::new();
        for arg in cmd_args {
            c.arg(arg);
        }
        pipe.add_command(c);
    }

    let results: Vec<Value> = timeout(Duration::from_secs(10), pipe.query_async(conn)).await??;
    Ok(results.into_iter().map(redis_to_json).collect())
}
