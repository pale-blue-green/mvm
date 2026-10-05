//! ディレクトリ単位のファイル監視。
//!
//! 多くのエディタは一時ファイルへ書き込んでから rename で保存する。
//! ファイル単位で監視すると inode が変わった時点で通知が途絶えるため、
//! 親ディレクトリを監視し、イベントのパスから登録済みファイルを判定する。
//! 同じディレクトリを複数の用途 (開いたファイルの親、監視パターン) で監視するときは
//! 参照カウントで watch を共有し、再帰指定が1つでもあれば再帰監視にする。

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

type FileDebouncer = Debouncer<RecommendedWatcher, RecommendedCache>;

struct Entry {
    count: usize,
    recursive: bool,
}

pub struct DirWatcher {
    inner: Mutex<Inner>,
}

struct Inner {
    debouncer: FileDebouncer,
    entries: HashMap<PathBuf, Entry>,
}

fn mode(recursive: bool) -> RecursiveMode {
    if recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    }
}

impl DirWatcher {
    /// `on_changed` にはデバウンス済みのイベントのパス一覧が渡される。
    /// 呼び出し元のスレッドはデバウンサ内部のため、重い処理は別スレッドへ渡すこと。
    pub fn new(on_changed: impl Fn(Vec<PathBuf>) + Send + 'static) -> notify::Result<Self> {
        let debouncer = new_debouncer(
            Duration::from_millis(100),
            None,
            move |result: DebounceEventResult| {
                if let Ok(events) = result {
                    let paths: Vec<PathBuf> = events
                        .into_iter()
                        .filter(|event| !event.kind.is_access())
                        .flat_map(|event| event.paths.clone())
                        .collect();
                    if !paths.is_empty() {
                        on_changed(paths);
                    }
                }
            },
        )?;
        Ok(Self {
            inner: Mutex::new(Inner {
                debouncer,
                entries: HashMap::new(),
            }),
        })
    }

    pub fn watch_dir(&self, dir: &Path, recursive: bool) -> notify::Result<()> {
        let mut inner = self.inner.lock().unwrap();
        if let Some(entry) = inner.entries.get_mut(dir) {
            entry.count += 1;
            if recursive && !entry.recursive {
                entry.recursive = true;
                inner.debouncer.watch(dir, RecursiveMode::Recursive)?;
            }
            return Ok(());
        }
        inner.debouncer.watch(dir, mode(recursive))?;
        inner.entries.insert(
            dir.to_path_buf(),
            Entry {
                count: 1,
                recursive,
            },
        );
        Ok(())
    }

    pub fn unwatch_dir(&self, dir: &Path) {
        let mut inner = self.inner.lock().unwrap();
        let Some(entry) = inner.entries.get_mut(dir) else {
            return;
        };
        entry.count -= 1;
        if entry.count == 0 {
            inner.entries.remove(dir);
            let _ = inner.debouncer.unwatch(dir);
        }
    }

    pub fn watch_file(&self, file: &Path) -> notify::Result<()> {
        match file.parent() {
            Some(dir) => self.watch_dir(dir, false),
            None => Ok(()),
        }
    }

    pub fn unwatch_file(&self, file: &Path) {
        if let Some(dir) = file.parent() {
            self.unwatch_dir(dir);
        }
    }
}
