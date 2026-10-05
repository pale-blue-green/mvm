mod files;
mod watcher;

use files::{resolve_args, resolve_path, OpenedFile, Registry};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use watcher::DirWatcher;

struct AppState {
    registry: Registry,
    watcher: DirWatcher,
    /// 起動引数で渡されたファイル。フロントが `take_initial_files` で1回だけ受け取る。
    initial_files: Mutex<Vec<OpenedFile>>,
}

#[derive(Serialize, Clone)]
struct OpenFilesPayload {
    files: Vec<OpenedFile>,
}

#[derive(Serialize, Clone)]
struct FileChangedPayload {
    id: String,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum ReadError {
    Missing,
    Failed { message: String },
}

/// ファイルを登録し、親ディレクトリの監視と asset protocol のスコープ追加を行う。
fn register_file(app: &AppHandle, path: &Path) -> OpenedFile {
    let state = app.state::<AppState>();
    let file = state.registry.insert(path);
    if let Err(err) = state.watcher.watch_file(path) {
        eprintln!("watch failed: {}: {err}", path.display());
    }
    if let Some(dir) = path.parent() {
        // 相対パス画像を表示するため、開いたファイルのディレクトリ配下だけ許可する
        if let Err(err) = app.asset_protocol_scope().allow_directory(dir, true) {
            eprintln!("asset scope failed: {}: {err}", dir.display());
        }
    }
    file
}

fn register_all(app: &AppHandle, paths: Vec<PathBuf>) -> Vec<OpenedFile> {
    paths.iter().map(|path| register_file(app, path)).collect()
}

#[tauri::command]
fn take_initial_files(state: State<'_, AppState>) -> Vec<OpenedFile> {
    std::mem::take(&mut *state.initial_files.lock().unwrap())
}

/// 相対リンクなどでアプリ内から開くパスを登録する。`base_dir` 基準で解決し、存在しないものは除外する。
#[tauri::command]
fn open_paths(app: AppHandle, base_dir: String, paths: Vec<String>) -> Vec<OpenedFile> {
    let base = Path::new(&base_dir);
    let resolved = paths
        .iter()
        .filter_map(|path| resolve_path(path, base))
        .collect();
    register_all(&app, resolved)
}

#[tauri::command]
fn read_markdown(state: State<'_, AppState>, id: String) -> Result<String, ReadError> {
    let path = state.registry.get(&id).ok_or(ReadError::Missing)?;
    std::fs::read_to_string(&path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => ReadError::Missing,
        _ => ReadError::Failed {
            message: err.to_string(),
        },
    })
}

#[tauri::command]
fn close_file(state: State<'_, AppState>, id: String) {
    if let Some(path) = state.registry.remove(&id) {
        state.watcher.unwatch_file(&path);
    }
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // single-instance は他のプラグインより先に登録する必要がある
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let files = register_all(app, resolve_args(&argv, Path::new(&cwd)));
            if !files.is_empty() {
                let _ = app.emit("open-files", OpenFilesPayload { files });
            }
            focus_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let watcher = DirWatcher::new(move |paths| {
                let state = handle.state::<AppState>();
                let ids = state
                    .registry
                    .ids_for_paths(paths.iter().map(PathBuf::as_path));
                for id in ids {
                    let _ = handle.emit("file-changed", FileChangedPayload { id });
                }
            })?;
            app.manage(AppState {
                registry: Registry::default(),
                watcher,
                initial_files: Mutex::new(Vec::new()),
            });

            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir()?;
            let files = register_all(app.handle(), resolve_args(&args, &cwd));
            *app.state::<AppState>().initial_files.lock().unwrap() = files;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            take_initial_files,
            open_paths,
            read_markdown,
            close_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running mvm");
}
