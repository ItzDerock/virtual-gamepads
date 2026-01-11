use std::env;
use std::fs;
use std::process::Command;

fn main() {
    // Rerun script if frontend source changes
    println!("cargo:rerun-if-changed=frontend/src");
    println!("cargo:rerun-if-changed=frontend/package.json");
    println!("cargo:rerun-if-changed=frontend/pnpm-lock.yaml");

    let profile = env::var("PROFILE").unwrap();
    let current_dir = env::current_dir().unwrap();
    let frontend_dir = current_dir.join("frontend");
    let dist_dir = frontend_dir.join("dist");

    // Build the frontned only in release mode
    if profile == "release" {
        println!("cargo:warning=Building frontend with pnpm...");

        // Install dependencies
        let install_status = Command::new("pnpm")
            .arg("install")
            .current_dir(&frontend_dir)
            .status()
            .expect("Failed to run 'pnpm install'. Is pnpm installed?");

        if !install_status.success() {
            panic!("'pnpm install' failed");
        }

        // Build for production
        let build_status = Command::new("pnpm")
            .args(["run", "build"])
            .current_dir(&frontend_dir)
            .status()
            .expect("Failed to run 'pnpm run build'");

        if !build_status.success() {
            panic!("'pnpm run build' failed");
        }
    }
    // In debug mode, just ensure the dist directory exists
    else {
        if !dist_dir.exists() {
            fs::create_dir_all(&dist_dir).unwrap();
            fs::write(
                dist_dir.join("index.html"),
                "<h1>Dev Mode</h1><p>Run 'pnpm dev' in frontend/ directory.</p>",
            )
            .unwrap();
        }
    }
}
