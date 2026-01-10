use axum::{Router, routing::get};
use std::{net::SocketAddr, sync::Arc};
use tower_http::services::ServeDir;

use crate::socket::SocketController;

mod controller;
mod socket;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // global state
    let socket_controller = Arc::new(SocketController::new());
    socket_controller.clone().start_cleanup_task();

    // Serve the "static" folder at the root "/"
    let app = Router::new()
        .route("/ws", get(SocketController::handle_upgrade))
        .nest_service("/", ServeDir::new("static"))
        .with_state(socket_controller);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Listening on http://{}:3000", addr.ip());

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
