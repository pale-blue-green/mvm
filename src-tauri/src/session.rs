//! セッション (開いているファイルとタブ) の永続化。

use crate::pattern::WatchPattern;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionTab {
    pub id: String,
    pub title: String,
    pub files: Vec<PathBuf>,
    pub active_file: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionFile {
    pub version: u32,
    pub tabs: Vec<SessionTab>,
    pub active_tab_id: String,
    pub patterns: Vec<WatchPattern>,
    /// ユーザーが閉じたファイル。監視パターンによる自動追加の対象から外す
    #[serde(default)]
    pub closed: Vec<PathBuf>,
}

impl SessionFile {
    pub fn new(
        tabs: Vec<SessionTab>,
        active_tab_id: String,
        patterns: Vec<WatchPattern>,
        closed: Vec<PathBuf>,
    ) -> Self {
        Self {
            version: VERSION,
            tabs,
            active_tab_id,
            patterns,
            closed,
        }
    }
}

/// ファイルが無い・壊れている・バージョン不一致のときは None (セッションなしで起動する)。
pub fn load(path: &Path) -> Option<SessionFile> {
    let text = fs::read_to_string(path).ok()?;
    let session: SessionFile = serde_json::from_str(&text).ok()?;
    (session.version == VERSION).then_some(session)
}

/// 一時ファイルへ書いてから rename し、書き込み途中の破損を避ける。
pub fn save(path: &Path, session: &SessionFile) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(session)?)?;
    fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> SessionFile {
        SessionFile::new(
            vec![SessionTab {
                id: "main".into(),
                title: "main".into(),
                files: vec![PathBuf::from("/d/a.md"), PathBuf::from("/d/b.md")],
                active_file: Some(PathBuf::from("/d/b.md")),
            }],
            "main".into(),
            vec![WatchPattern {
                base: PathBuf::from("/d"),
                recursive: true,
                glob: None,
            }],
            vec![PathBuf::from("/d/closed.md")],
        )
    }

    #[test]
    fn roundtrip_preserves_session() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/session.json");
        save(&path, &sample()).unwrap();
        assert_eq!(load(&path), Some(sample()));
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn missing_corrupt_or_old_version_yields_none() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.json");
        assert_eq!(load(&path), None);
        fs::write(&path, "{ not json").unwrap();
        assert_eq!(load(&path), None);
        let mut old = sample();
        old.version = 0;
        fs::write(&path, serde_json::to_vec(&old).unwrap()).unwrap();
        assert_eq!(load(&path), None);
    }

    #[test]
    fn uses_camel_case_keys_for_the_frontend() {
        let text = serde_json::to_string(&sample()).unwrap();
        assert!(text.contains("activeTabId") && text.contains("activeFile"));
    }
}
