//! 開いたファイルの登録と、CLI 引数からのパス解決。

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// フロントの `OpenedFile` と対応する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct OpenedFile {
    pub id: String,
    pub path: String,
    pub name: String,
}

/// 絶対パスの SHA-256 先頭8桁。再起動後も同じ値になる。
pub fn file_id(path: &Path) -> String {
    let digest = Sha256::digest(path.to_string_lossy().as_bytes());
    digest.iter().take(4).map(|b| format!("{b:02x}")).collect()
}

pub fn opened_file(path: &Path) -> OpenedFile {
    OpenedFile {
        id: file_id(path),
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
    }
}

/// argv (先頭はプログラム名) から、存在する通常ファイルの正規化済み絶対パスを返す。
/// 相対パスは `cwd` 基準で解決する。フラグ、存在しないパス、ディレクトリは無視する。
pub fn resolve_args(args: &[String], cwd: &Path) -> Vec<PathBuf> {
    args.iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| resolve_path(arg, cwd))
        .collect()
}

pub fn resolve_path(arg: &str, cwd: &Path) -> Option<PathBuf> {
    let candidate = cwd.join(arg); // 絶対パスなら arg がそのまま採用される
    let canonical = candidate.canonicalize().ok()?;
    canonical.is_file().then_some(canonical)
}

/// id と実パスの対応表。フロントは id だけを渡し、任意パスの読み取りはできない。
#[derive(Default)]
pub struct Registry {
    files: Mutex<HashMap<String, PathBuf>>,
}

impl Registry {
    pub fn insert(&self, path: &Path) -> OpenedFile {
        let file = opened_file(path);
        self.files
            .lock()
            .unwrap()
            .insert(file.id.clone(), path.to_path_buf());
        file
    }

    pub fn get(&self, id: &str) -> Option<PathBuf> {
        self.files.lock().unwrap().get(id).cloned()
    }

    pub fn remove(&self, id: &str) -> Option<PathBuf> {
        self.files.lock().unwrap().remove(id)
    }

    /// 登録済みパスと一致する id を返す。
    pub fn ids_for_paths<'a>(&self, paths: impl IntoIterator<Item = &'a Path>) -> Vec<String> {
        let files = self.files.lock().unwrap();
        let mut ids: Vec<String> = Vec::new();
        for path in paths {
            if let Some((id, _)) = files.iter().find(|(_, p)| p.as_path() == path) {
                if !ids.contains(id) {
                    ids.push(id.clone());
                }
            }
        }
        ids
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn file_id_is_stable_8_hex_digits() {
        let id = file_id(Path::new("/tmp/a.md"));
        assert_eq!(id.len(), 8);
        assert_eq!(id, file_id(Path::new("/tmp/a.md")));
        assert_ne!(id, file_id(Path::new("/tmp/b.md")));
    }

    #[test]
    fn resolve_args_handles_relative_flags_and_missing() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = dir.path().canonicalize().unwrap();
        fs::write(cwd.join("a.md"), "# a").unwrap();
        fs::create_dir(cwd.join("sub")).unwrap();
        fs::write(cwd.join("sub").join("b.md"), "# b").unwrap();

        let args: Vec<String> = [
            "mvm",
            "--flag",
            "a.md",
            "sub/../sub/b.md",
            "missing.md",
            "sub",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let resolved = resolve_args(&args, &cwd);

        assert_eq!(
            resolved,
            vec![cwd.join("a.md"), cwd.join("sub").join("b.md")]
        );
    }

    #[test]
    fn resolve_args_accepts_absolute_path() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = dir.path().canonicalize().unwrap();
        let file = cwd.join("a.md");
        fs::write(&file, "x").unwrap();
        let args = vec!["mvm".to_string(), file.to_string_lossy().into_owned()];

        assert_eq!(resolve_args(&args, Path::new("/nonexistent")), vec![file]);
    }

    #[test]
    fn registry_maps_paths_to_ids() {
        let registry = Registry::default();
        let file = registry.insert(Path::new("/tmp/a.md"));
        assert_eq!(registry.get(&file.id), Some(PathBuf::from("/tmp/a.md")));
        assert_eq!(
            registry.ids_for_paths([Path::new("/tmp/a.md"), Path::new("/tmp/x.md")]),
            vec![file.id.clone()]
        );
        assert!(registry.remove(&file.id).is_some());
        assert!(registry.get(&file.id).is_none());
    }
}
