// ==========================================
// Aether Terminal — Ollama Proxy (Rust)
// Makes HTTP requests to the local Ollama
// server entirely from Rust, bypassing
// WebKit's hardcoded 60-second fetch timeout.
// Streams tokens back via Tauri events.
// ==========================================

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

/// A single message in the Ollama chat format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

/// Options for the Ollama /api/chat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_predict: Option<i32>,
}

/// Request body for Ollama /api/chat
#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    options: OllamaOptions,
    keep_alive: String,
}

/// Each line of the streaming response from Ollama
#[derive(Debug, Deserialize)]
struct OllamaStreamChunk {
    #[serde(default)]
    message: Option<OllamaChunkMessage>,
    #[serde(default)]
    done: bool,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaChunkMessage {
    #[serde(default)]
    content: String,
}

/// Payload emitted to the frontend for each token
#[derive(Debug, Clone, Serialize)]
struct ChunkPayload {
    content: String,
}

/// Streams a chat response from a local Ollama server.
///
/// Makes an HTTP POST to http://localhost:11434/api/chat entirely
/// from Rust (via reqwest). Each token is emitted to the frontend
/// as a `ollama-chunk-{session_id}` event. When done, emits
/// `ollama-done-{session_id}` with the full response.
///
/// Returns the complete response string on success.
#[tauri::command]
pub async fn ollama_chat(
    app: AppHandle,
    session_id: String,
    model: String,
    messages: Vec<OllamaMessage>,
    temperature: f64,
    num_ctx: Option<u32>,
    num_predict: Option<i32>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600)) // 10 minute timeout
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let request_body = OllamaChatRequest {
        model,
        messages,
        stream: true,
        options: OllamaOptions {
            temperature: Some(temperature),
            num_ctx: Some(num_ctx.unwrap_or(4096)),
            num_predict: Some(num_predict.unwrap_or(1024)),
        },
        keep_alive: "10m".to_string(),
    };

    let response = client
        .post("http://localhost:11434/api/chat")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned HTTP {}: {}", status, body));
    }

    // Stream the response line by line
    let chunk_event = format!("ollama-chunk-{}", session_id);
    let done_event = format!("ollama-done-{}", session_id);
    let mut full_response = String::new();
    let mut buffer = String::new();

    use futures_util::StreamExt;
    let mut byte_stream = response.bytes_stream();

    while let Some(chunk_result) = byte_stream.next().await {
        let bytes = chunk_result
            .map_err(|e| format!("Stream read error: {}", e))?;

        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        // Process complete lines (Ollama sends newline-delimited JSON)
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            match serde_json::from_str::<OllamaStreamChunk>(&line) {
                Ok(chunk) => {
                    // Check for Ollama-level errors
                    if let Some(err) = chunk.error {
                        let _ = app.emit(&done_event, &full_response);
                        return Err(format!("Ollama error: {}", err));
                    }

                    // Extract content token and emit to frontend
                    if let Some(msg) = &chunk.message {
                        if !msg.content.is_empty() {
                            full_response.push_str(&msg.content);
                            let _ = app.emit(
                                &chunk_event,
                                ChunkPayload {
                                    content: msg.content.clone(),
                                },
                            );
                        }
                    }

                    if chunk.done {
                        break;
                    }
                }
                Err(e) => {
                    log::warn!("Failed to parse Ollama chunk: {} — line: {}", e, line);
                }
            }
        }
    }

    let _ = app.emit(&done_event, &full_response);
    Ok(full_response)
}
