import { useCallback, useEffect, useReducer, useRef } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { Viewer } from "./components/Viewer";
import type { FileId } from "./domain/types";
import { closeFile, onFileChanged, onOpenFiles, openPaths, readMarkdown, takeInitialFiles } from "./lib/ipc";
import { useTheme } from "./lib/theme";
import { initialState, reducer } from "./state/reducer";

const THEME_LABEL = { system: "自動", light: "ライト", dark: "ダーク" } as const;

export const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { mode, cycle } = useTheme();
  // 同一ファイルの読み込みが重なったとき、最後に発行した結果だけを採用する
  const latestRequest = useRef(new Map<FileId, number>());
  const requestSeq = useRef(0);

  const load = useCallback(async (id: FileId) => {
    const seq = ++requestSeq.current;
    latestRequest.current.set(id, seq);
    const result = await readMarkdown(id);
    if (latestRequest.current.get(id) !== seq) return;
    switch (result.kind) {
      case "ok":
        dispatch({ type: "fileLoaded", id, content: result.content });
        break;
      case "missing":
        dispatch({ type: "fileMissing", id });
        break;
      case "failed":
        dispatch({ type: "fileFailed", id, message: result.message });
        break;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const unlistenOpen = await onOpenFiles((event) => {
        dispatch({ type: "filesOpened", files: event.files, tabId: event.tabId });
        for (const file of event.files) void load(file.id);
      });
      const unlistenChanged = await onFileChanged((id) => void load(id));
      if (disposed) {
        unlistenOpen();
        unlistenChanged();
        return;
      }
      unlisteners.push(unlistenOpen, unlistenChanged);

      // リスナー登録後に取得する。起動引数のファイルを取りこぼさない
      // StrictMode の再マウントでも、1回しか取得できない初期ファイルを捨てないよう disposed は見ない
      const initial = await takeInitialFiles();
      dispatch({ type: "filesOpened", files: initial });
      for (const file of initial) void load(file.id);
    };
    void setup();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [load]);

  const openRelative = useCallback(
    async (baseDir: string, path: string) => {
      const files = await openPaths(baseDir, [path]);
      if (files.length === 0) return;
      dispatch({ type: "filesOpened", files });
      for (const file of files) void load(file.id);
    },
    [load],
  );

  const close = useCallback(async (id: FileId) => {
    dispatch({ type: "fileClosed", id });
    await closeFile(id);
  }, []);

  const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId) ?? state.tabs[0];
  if (tab === undefined) return null;
  const activeEntry = tab.activeFileId === null ? null : (state.files[tab.activeFileId] ?? null);

  return (
    <div className="flex h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar tab={tab} files={state.files} onSelect={(id) => dispatch({ type: "fileSelected", id })} onClose={(id) => void close(id)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
          <span className="truncate text-neutral-500" title={activeEntry?.file.path}>
            {activeEntry?.file.path ?? ""}
          </span>
          <button type="button" onClick={cycle} className="shrink-0 rounded px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800">
            テーマ: {THEME_LABEL[mode]}
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <ErrorBoundary resetKey={tab.activeFileId ?? ""}>
            <Viewer entry={activeEntry} onOpenRelative={(baseDir, path) => void openRelative(baseDir, path)} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
