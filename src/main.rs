use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
};
use evdev::{AbsInfo, AttributeSet, InputId, Key, UinputAbsSetup, uinput::VirtualDeviceBuilder};
use serde::Deserialize;
use std::net::SocketAddr;
use tower_http::services::ServeDir;

#[derive(Deserialize, Debug)]
struct ControllerInput {
    // "btn" for buttons, "axis" for joysticks
    kind: String,
    // Key code (e.g., 304 for A) or Axis code (e.g., 0 for X)
    code: u16,
    // 1/0 for buttons, -32767 to 32767 for axes
    value: i32,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Serve the "static" folder at the root "/"
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .nest_service("/", ServeDir::new("static"));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Listening on http://{}:3000", addr.ip());

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Upgrade HTTP connection to WebSocket
async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

fn create_virtual_device() -> Result<evdev::uinput::VirtualDevice, std::io::Error> {
    let mut keys = AttributeSet::<Key>::new();
    keys.insert(Key::BTN_SOUTH); // A
    keys.insert(Key::BTN_EAST); // B
    keys.insert(Key::BTN_NORTH); // X
    keys.insert(Key::BTN_WEST); // Y
    keys.insert(Key::BTN_START);
    keys.insert(Key::BTN_SELECT);

    // joysticks
    let abs_setup_x = UinputAbsSetup::new(
        evdev::AbsoluteAxisType::ABS_X,
        AbsInfo::new(0, -32768, 32767, 16, 128, 0),
    );
    let abs_setup_y = UinputAbsSetup::new(
        evdev::AbsoluteAxisType::ABS_Y,
        AbsInfo::new(0, -32768, 32767, 16, 128, 0),
    );

    VirtualDeviceBuilder::new()?
        .name("Rust Web Controller")
        .input_id(InputId::new(
            // Xbox 360 IDs
            evdev::BusType::BUS_USB,
            0x045e,
            0x028e,
            0x0110,
        ))
        .with_keys(&keys)?
        .with_absolute_axis(&abs_setup_x)?
        .with_absolute_axis(&abs_setup_y)?
        .build()
}

async fn handle_socket(mut socket: WebSocket) {
    println!("New client connected - creating virtual device...");
    let mut virtual_device = match create_virtual_device() {
        Ok(d) => d,
        Err(e) => {
            eprintln!(
                "Failed to create uinput device: {}. (Did you run with sudo?)",
                e
            );
            let _ = socket
                .send(Message::Text("Error: uinput permission denied".into()))
                .await;
            return;
        }
    };

    println!("Virtual device created successfully via uinput!");

    while let Some(msg) = socket.recv().await {
        if let Ok(Message::Text(text)) = msg {
            // Parse JSON from web client
            if let Ok(input) = serde_json::from_str::<ControllerInput>(&text) {
                let res = match input.kind.as_str() {
                    "btn" => {
                        // Convert raw u16 to Key type
                        let key = Key::new(input.code);
                        // Emit event (Type, Code, Value)
                        virtual_device.emit(&[evdev::InputEvent::new(
                            evdev::EventType::KEY,
                            key.0,
                            input.value,
                        )])
                    }
                    "axis" => {
                        let axis = evdev::AbsoluteAxisType(input.code);
                        virtual_device.emit(&[evdev::InputEvent::new(
                            evdev::EventType::ABSOLUTE,
                            axis.0,
                            input.value,
                        )])
                    }
                    _ => Ok(()),
                };

                if let Err(e) = res {
                    eprintln!("Failed to write event to kernel: {}", e);
                }
            }
        }
    }

    println!("Client disconnected - removing virtual device.");
}
