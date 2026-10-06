mod files;
mod pattern;
mod scan;
mod session;
mod watcher;

use files::{file_id, resolve_path, OpenedFile, Registry};
use pattern::WatchPattern;
use scan::{expand, parse_args, scan_pattern, CliOptions};
use serde::Serialize;
use session::{SessionFile, SessionTab};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use watcher::DirWatcher;

const DEFAULT_TAB_ID: &str = "main";

struct AppState {
    registry: Registry,
    watcher: DirWatcher,
    patterns: Mutex<Vec<WatchPattern>>,
    /// ユーザーが閉じたファイル。監視パターンが再度開かないようにする
    closed: Mutex<HashSet<PathBuf>>,
    session_path: PathBuf,
    /// 起動時の状態。React の StrictMode は開発時に初期化を2回実行するため、取り出さずに複製して返す
    startup: Mutex<Option<Startup>>,
}

#[derive(Serialize, Clone)]
struct OpenFilesPayload {
    files: Vec<OpenedFile>,
    /// 先頭のファイルを選択するか。監視パターンによる自動追加では表示中のファイルを維持する
    select: bool,
}

#[derive(Serialize, Clone)]
struct FileChangedPayload {
    id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RestoredTab {
    id: String,
    title: String,
    file_ids: Vec<String>,
    active_file_id: Option<String>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct Startup {
    tabs: Vec<RestoredTab>,
    active_tab_id: String,
    /// `tabs` が参照するファイル
    files: Vec<OpenedFile>,
    /// 起動引数で渡されたファイル。復元後に開いて選択する
    cli_files: Vec<OpenedFile>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum ReadError {
    Missing,
    Failed { message: String },
}

/// ファイルを登録し、親ディレクトリの監視と asset protocol のスコープ追加を行う。
/// 明示的に開かれたものとして扱うため、閉じた履歴からは外す。
fn register_file(app: &AppHandle, path: &Path) -> OpenedFile {
    let state = app.state::<AppState>();
    state.closed.lock().unwrap().remove(path);
    if state.registry.contains_path(path) {
        return state.registry.insert(path); // 監視は登録済み。参照カウントを増やさない
    }
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

fn add_patterns(app: &AppHandle, patterns: Vec<WatchPattern>) {
    let state = app.state::<AppState>();
    for pattern in patterns {
        let mut registered = state.patterns.lock().unwrap();
        if registered.contains(&pattern) {
            continue;
        }
        registered.push(pattern.clone());
        drop(registered);
        if let Err(err) = state.watcher.watch_dir(&pattern.base, pattern.recursive) {
            eprintln!("watch failed: {}: {err}", pattern.base.display());
        }
    }
}

/// ファイル変更の通知と、監視パターンに一致する新規ファイルの自動追加。
fn on_fs_event(app: &AppHandle, paths: Vec<PathBuf>) {
    let state = app.state::<AppState>();
    for id in state
        .registry
        .ids_for_paths(paths.iter().map(PathBuf::as_path))
    {
        let _ = app.emit("file-changed", FileChangedPayload { id });
    }

    let patterns = state.patterns.lock().unwrap().clone();
    if patterns.is_empty() {
        return;
    }
    let mut new_paths: Vec<PathBuf> = Vec::new();
    for path in paths {
        let is_new = !state.registry.contains_path(&path)
            && !state.closed.lock().unwrap().contains(&path)
            && !new_paths.contains(&path)
            && path.is_file()
            && patterns.iter().any(|pattern| pattern.matches(&path));
        if is_new {
            new_paths.push(path);
        }
    }
    if !new_paths.is_empty() {
        let files = register_all(app, new_paths);
        let _ = app.emit(
            "open-files",
            OpenFilesPayload {
                files,
                select: false,
            },
        );
    }
}

/// 保存済みセッション、監視パターンの再走査、起動引数から起動時の状態を組み立てる。
fn build_startup(app: &AppHandle, args: &[String], cwd: &Path) -> Startup {
    let state = app.state::<AppState>();
    let mut files: Vec<OpenedFile> = Vec::new();
    let mut tabs: Vec<RestoredTab> = Vec::new();
    let mut active_tab_id = DEFAULT_TAB_ID.to_string();

    if let Some(saved) = session::load(&state.session_path) {
        state.closed.lock().unwrap().extend(saved.closed);
        add_patterns(app, saved.patterns);
        active_tab_id = saved.active_tab_id;
        for tab in saved.tabs {
            let mut file_ids = Vec::new();
            for path in tab.files.iter().filter(|path| path.is_file()) {
                let file = register_file(app, path);
                file_ids.push(file.id.clone());
                files.push(file);
            }
            tabs.push(RestoredTab {
                id: tab.id,
                title: tab.title,
                file_ids,
                active_file_id: tab
                    .active_file
                    .filter(|path| path.is_file())
                    .map(|path| file_id(&path)),
            });
        }
    }
    if !tabs.iter().any(|tab| tab.id == active_tab_id) {
        if tabs.is_empty() {
            tabs.push(RestoredTab {
                id: DEFAULT_TAB_ID.to_string(),
                title: DEFAULT_TAB_ID.to_string(),
                file_ids: Vec::new(),
                active_file_id: None,
            });
        }
        active_tab_id = tabs[0].id.clone();
    }

    // 前回終了後に監視パターンへ追加されたファイルを、アクティブなタブへ加える
    let patterns = state.patterns.lock().unwrap().clone();
    for pattern in patterns {
        for path in scan_pattern(&pattern) {
            if state.registry.contains_path(&path) || state.closed.lock().unwrap().contains(&path) {
                continue;
            }
            let file = register_file(app, &path);
            if let Some(tab) = tabs.iter_mut().find(|tab| tab.id == active_tab_id) {
                tab.file_ids.push(file.id.clone());
            }
            files.push(file);
        }
    }

    let parsed = parse_args(args);
    let expansion = expand(&parsed.targets, cwd, parsed.options);
    let cli_files = register_all(app, expansion.files);
    if parsed.options.watch {
        add_patterns(app, expansion.patterns);
    }

    Startup {
        tabs,
        active_tab_id,
        files,
        cli_files,
    }
}

#[tauri::command]
fn get_startup(state: State<'_, AppState>) -> Startup {
    state.startup.lock().unwrap().clone().unwrap_or_default()
}

/// ドラッグ&ドロップ、ダイアログ、相対リンクで開くパスを登録する。
/// `base_dir` 基準で解決し、ディレクトリは Markdown ファイルに展開する。存在しないものは除外する。
#[tauri::command]
fn open_paths(
    app: AppHandle,
    base_dir: String,
    paths: Vec<String>,
    recursive: bool,
) -> Vec<OpenedFile> {
    let base = Path::new(&base_dir);
    let mut resolved: Vec<PathBuf> = Vec::new();
    for path in &paths {
        // 括弧などを含む実在のファイル名を glob として解釈しないよう、先にリテラルで解決する
        let expanded = match resolve_path(path, base) {
            Some(file) => vec![file],
            None => {
                expand(
                    std::slice::from_ref(path),
                    base,
                    CliOptions {
                        recursive,
                        watch: false,
                    },
                )
                .files
            }
        };
        for file in expanded {
            if !resolved.contains(&file) {
                resolved.push(file);
            }
        }
    }
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

/// Excel などバイナリのファイルを、そのままのバイト列で返す (JSON の数値配列にしない)。
#[tauri::command]
fn read_bytes(state: State<'_, AppState>, id: String) -> Result<tauri::ipc::Response, ReadError> {
    let path = state.registry.get(&id).ok_or(ReadError::Missing)?;
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|err| match err.kind() {
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
        state.closed.lock().unwrap().insert(path);
    }
}

#[tauri::command]
fn save_session(
    state: State<'_, AppState>,
    tabs: Vec<SessionTab>,
    active_tab_id: String,
) -> Result<(), String> {
    let patterns = state.patterns.lock().unwrap().clone();
    let closed: Vec<PathBuf> = state.closed.lock().unwrap().iter().cloned().collect();
    let session = SessionFile::new(tabs, active_tab_id, patterns, closed);
    session::save(&state.session_path, &session).map_err(|err| err.to_string())
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
            let parsed = parse_args(&argv);
            let expansion = expand(&parsed.targets, Path::new(&cwd), parsed.options);
            let files = register_all(app, expansion.files);
            if parsed.options.watch {
                add_patterns(app, expansion.patterns);
            }
            if !files.is_empty() {
                let _ = app.emit(
                    "open-files",
                    OpenFilesPayload {
                        files,
                        select: true,
                    },
                );
            }
            focus_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // デバウンサのスレッドで重い処理をしないよう、イベントは別スレッドへ渡す
            let (sender, receiver) = mpsc::channel::<Vec<PathBuf>>();
            let watcher = DirWatcher::new(move |paths| {
                let _ = sender.send(paths);
            })?;
            let session_path = app.path().app_data_dir()?.join("session.json");
            app.manage(AppState {
                registry: Registry::default(),
                watcher,
                patterns: Mutex::new(Vec::new()),
                closed: Mutex::new(HashSet::new()),
                session_path,
                startup: Mutex::new(None),
            });

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                for paths in receiver {
                    on_fs_event(&handle, paths);
                }
            });

            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir()?;
            let startup = build_startup(app.handle(), &args, &cwd);
            *app.state::<AppState>().startup.lock().unwrap() = Some(startup);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_startup,
            open_paths,
            read_markdown,
            read_bytes,
            close_file,
            save_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running mvm");
}
