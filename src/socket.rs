use std::sync::Arc;

use axum::{
    extract::{
        Query, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::IntoResponse,
};
use dashmap::DashMap;
use evdev::{AbsoluteAxisType, Key};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::controller::VirtualGamepad;

static HEARTBEAT_TIMEOUT_SECS: u64 = 300; // 5 minutes
static HEARTBEAT_CHECK_INTERVAL_SECS: u64 = 60; // 1 minute

// TODO: will need to keep a better count of clients, rather than relying on the map's len()
// since
static MAXIMUM_CLIENTS: usize = 15;

#[derive(Deserialize, Debug)]
pub struct WsConnectionRequest {
    client_id: String,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum ClientMessage {
    Ping,
    Btn { code: u16, value: i32 },
    Axis { code: u16, value: i32 },
}

trait WebSocketJson {
    async fn send_json<T: Serialize>(&mut self, value: &T) -> Result<(), axum::Error>;
}

impl WebSocketJson for WebSocket {
    async fn send_json<T: Serialize>(&mut self, value: &T) -> Result<(), axum::Error> {
        let json_string = serde_json::to_string(value).unwrap_or_default();
        self.send(Message::Text(json_string)).await
    }
}

pub struct SocketController {
    clients: DashMap<Uuid, Arc<Mutex<VirtualGamepad>>>,
}

impl SocketController {
    pub fn new() -> Self {
        Self {
            clients: DashMap::new(),
        }
    }

    /// starts a scheduled task to remove inactive clients periodically
    pub fn start_cleanup_task(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
                HEARTBEAT_CHECK_INTERVAL_SECS,
            ));
            loop {
                interval.tick().await;
                self.remove_inactive_clients();
            }
        });
    }

    /// Removes all inactive clients that have not sent a heartbeat within the specified duration.
    fn remove_inactive_clients(&self) {
        let now = tokio::time::Instant::now();
        let timeout_duration = tokio::time::Duration::from_secs(HEARTBEAT_TIMEOUT_SECS);

        self.clients.retain(|_, client| -> bool {
            match client.try_lock() {
                Ok(guard) => now.duration_since(guard.last_heartbeat) < timeout_duration,
                Err(_) => true, // keep the client if we can't acquire the lock, assume it's active
            }
        });
    }

    /// Handles a websocket session
    pub async fn handle_upgrade(
        State(state): State<Arc<Self>>,
        Query(params): Query<WsConnectionRequest>,
        ws: WebSocketUpgrade,
    ) -> impl IntoResponse {
        ws.on_upgrade(move |mut socket| async move {
            println!("New connection from client: {}", params.client_id);

            // create or get the virtual gamepad for this client
            let client_id = match Uuid::parse_str(&params.client_id) {
                Ok(id) => id,
                Err(_) => {
                    eprintln!("Invalid client_id provided: {}", params.client_id);
                    let _ = socket
                        .send_json(&json!({
                            "error": "invalid client_id"
                        }))
                        .await;

                    return;
                }
            };

            let virtual_device = {
                if state.clients.len() >= MAXIMUM_CLIENTS && !state.clients.contains_key(&client_id)
                {
                    eprintln!("Maximum client limit reached.");
                    let _ = socket
                        .send_json(&json!({
                            "error": "maximum client limit reached"
                        }))
                        .await;
                    return;
                }

                state
                    .clients
                    .entry(client_id)
                    .or_insert_with(|| {
                        Arc::new(Mutex::new(
                            VirtualGamepad::new(client_id)
                                .expect("Failed to create VirtualGamepad"),
                        ))
                    })
                    .clone()
            };

            // Handle incoming messages
            while let Some(msg) = socket.recv().await {
                if let Ok(Message::Text(text)) = msg {
                    match serde_json::from_str::<ClientMessage>(&text) {
                        Ok(ClientMessage::Ping) => {
                            let _ = socket.send_json(&json!({"kind": "pong"})).await;
                            virtual_device.lock().await.update_heartbeat();
                        }

                        Ok(ClientMessage::Axis { code, value }) => {
                            let res = virtual_device
                                .lock()
                                .await
                                .send_axis_event(AbsoluteAxisType(code), value);
                            if let Err(e) = res {
                                eprintln!("Failed to write axis event to kernel: {}", e);
                            }
                        }

                        Ok(ClientMessage::Btn { code, value }) => {
                            let res = virtual_device
                                .lock()
                                .await
                                .send_keypad_event(Key::new(code), value);
                            if let Err(e) = res {
                                eprintln!("Failed to write button event to kernel: {}", e);
                            }
                        }

                        Err(e) => {
                            eprintln!("Failed to parse client message: {}", e);
                        }
                    }
                }
            }
        })
    }
}
