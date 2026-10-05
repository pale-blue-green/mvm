//! 親ディレクトリ単位のファイル監視。
//!
//! 多くのエディタは一時ファイルへ書き込んでから rename で保存する。
//! ファイル単位で監視すると inode が変わった時点で通知が途絶えるため、
//! 親ディレクトリを監視し、イベントのパスが登録済みファイルと一致したものだけ通知する。
//! 同じディレクトリのファイルが複数あるときは参照カウントで watch を共有する。

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

type FileDebouncer = Debouncer<RecommendedWatcher, RecommendedCache>;

pub struct DirWatcher {
    inner: Mutex<Inner>,
}

struct Inner {
    debouncer: FileDebouncer,
    ref_counts: HashMap<PathBuf, usize>,
}

impl DirWatcher {
    /// `on_changed` にはデバウンス済みのイベントのパス一覧が渡される。
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
                ref_counts: HashMap::new(),
            }),
        })
    }

    pub fn watch_file(&self, file: &Path) -> notify::Result<()> {
        let Some(dir) = file.parent() else {
            return Ok(());
        };
        let mut inner = self.inner.lock().unwrap();
        if let Some(count) = inner.ref_counts.get_mut(dir) {
            *count += 1;
            return Ok(());
        }
        inner.debouncer.watch(dir, RecursiveMode::NonRecursive)?;
        inner.ref_counts.insert(dir.to_path_buf(), 1);
        Ok(())
    }

    pub fn unwatch_file(&self, file: &Path) {
        let Some(dir) = file.parent() else {
            return;
        };
        let mut inner = self.inner.lock().unwrap();
        let Some(count) = inner.ref_counts.get_mut(dir) else {
            return;
        };
        *count -= 1;
        if *count == 0 {
            inner.ref_counts.remove(dir);
            let _ = inner.debouncer.unwatch(dir);
        }
    }
}
