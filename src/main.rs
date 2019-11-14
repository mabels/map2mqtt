// mod router;
mod core_service;

// use std::thread;
// use std::time;

fn main() {
    env_logger::init();
    let core_service_thread = core_service::start("127.0.0.1:4799".to_string()).unwrap();
    core_service_thread.join().unwrap();
}
