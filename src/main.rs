use axum::{Router, routing::get};
use std::{net::SocketAddr, sync::Arc};

use crate::socket::SocketController;

mod controller;
mod socket;

// Serve static files when running in release mode.
#[cfg(not(debug_assertions))]
mod static_files {
    use axum::{
        body::Body,
        http::{StatusCode, Uri, header},
        response::{IntoResponse, Response},
    };
    use rust_embed::RustEmbed;

    #[derive(RustEmbed)]
    #[folder = "frontend/dist"]
    struct Assets;

    pub async fn static_handler(uri: Uri) -> impl IntoResponse {
        let path = uri.path().trim_start_matches('/');
        match Assets::get(path) {
            Some(content) => {
                let mime = mime_guess::from_path(path).first_or_octet_stream();
                ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn index_handler() -> impl IntoResponse {
        static_handler(Uri::from_static("/index.html")).await
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // global state
    let socket_controller = Arc::new(SocketController::new());
    socket_controller.clone().start_cleanup_task();

    // Serve the "static" folder at the root "/"
    #[allow(unused_mut)]
    let mut app = Router::new()
        .route("/ws", get(SocketController::handle_upgrade))
        .with_state(socket_controller);

    // In debug, connect via VITE dev server
    // it will proxy the /ws requests to here
    #[cfg(not(debug_assertions))]
    {
        app = app
            .route("/", get(static_files::index_handler))
            .route("/*file", get(static_files::static_handler));
    }

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Listening on http://{}:3000", addr.ip());

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
