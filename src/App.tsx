import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Sidebar } from "./components/Sidebar";
import { VIEWER_SCROLL_ID } from "./components/TocPanel";
import { Viewer } from "./components/Viewer";
import type { FileId, OpenedFile } from "./domain/types";
import { closeFile, getStartup, onFileChanged, onOpenFiles, openPaths, readBytes, readMarkdown, saveSession } from "./lib/ipc";
import { toSessionPayload } from "./lib/session";
import { useScrollMemory } from "./lib/scrollMemory";
import { useSettings } from "./lib/settings";
import { useTheme } from "./lib/theme";
import { initialState, reducer } from "./state/reducer";

const THEME_LABEL = { system: "自動", light: "ライト", dark: "ダーク" } as const;
const SESSION_SAVE_DELAY_MS = 300;

export const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { mode, cycle } = useTheme();
  const { settings, update: updateSettings } = useSettings();
  const [raw, setRaw] = useState(false);
  const [restored, setRestored] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // ファイルごとにスクロール位置を覚える (フック呼び出しは早期 return より前に置く)
  useScrollMemory(scrollRef, contentRef, state.tabs.find((candidate) => candidate.id === state.activeTabId)?.activeFileId ?? null);
  // 同一ファイルの読み込みが重なったとき、最後に発行した結果だけを採用する
  const latestRequest = useRef(new Map<FileId, number>());
  const requestSeq = useRef(0);

  // xlsx はバイト列で読み、それ以外 (Markdown) は文字列で読む
  const binaryIds = useRef(new Set<FileId>());
  const track = useCallback((files: OpenedFile[]) => {
    for (const file of files) {
      if (/\.xlsx$/i.test(file.name)) binaryIds.current.add(file.id);
      else binaryIds.current.delete(file.id);
    }
  }, []);

  const load = useCallback(async (id: FileId) => {
    const seq = ++requestSeq.current;
    latestRequest.current.set(id, seq);
    const binary = binaryIds.current.has(id);
    const result = binary ? await readBytes(id) : await readMarkdown(id);
    if (latestRequest.current.get(id) !== seq) return;
    switch (result.kind) {
      case "ok":
        if ("bytes" in result) dispatch({ type: "fileLoadedBinary", id, bytes: result.bytes });
        else dispatch({ type: "fileLoaded", id, content: result.content });
        break;
      case "missing":
        dispatch({ type: "fileMissing", id });
        break;
      case "failed":
        dispatch({ type: "fileFailed", id, message: result.message });
        break;
    }
  }, []);

  const openFiles = useCallback(
    (files: OpenedFile[]) => {
      if (files.length === 0) return;
      track(files);
      dispatch({ type: "filesOpened", files });
      for (const file of files) void load(file.id);
    },
    [load, track],
  );

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const unlistenOpen = await onOpenFiles((event) => {
        track(event.files);
        dispatch({ type: "filesOpened", files: event.files, tabId: event.tabId, select: event.select });
        for (const file of event.files) void load(file.id);
      });
      const unlistenChanged = await onFileChanged((id) => void load(id));
      const unlistenDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
        switch (event.payload.type) {
          case "enter":
          case "over":
            setDragging(true);
            break;
          case "leave":
            setDragging(false);
            break;
          case "drop": {
            setDragging(false);
            // ディレクトリのドロップは配下の Markdown を再帰的に開く
            openFiles(await openPaths("/", event.payload.paths, true));
            break;
          }
        }
      });
      if (disposed) {
        unlistenOpen();
        unlistenChanged();
        unlistenDrop();
        return;
      }
      unlisteners.push(unlistenOpen, unlistenChanged, unlistenDrop);

      // リスナー登録後に取得する。起動引数のファイルを取りこぼさない。
      // StrictMode の再マウントで2回呼ばれても、Rust は同じ内容を返す
      const startup = await getStartup();
      track(startup.files);
      dispatch({ type: "sessionRestored", tabs: startup.tabs, activeTabId: startup.activeTabId, files: startup.files });
      for (const file of startup.files) void load(file.id);
      openFiles(startup.cliFiles);
      setRestored(true);
    };
    void setup();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [load, openFiles, track]);

  // 復元が終わる前に保存すると、保存済みセッションを空の状態で上書きしてしまう
  const lastSaved = useRef("");
  useEffect(() => {
    if (!restored) return;
    const payload = toSessionPayload(state);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = serialized;
      void saveSession(payload);
    }, SESSION_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, restored]);

  const openRelative = useCallback(
    async (baseDir: string, path: string) => openFiles(await openPaths(baseDir, [path], false)),
    [openFiles],
  );

  const pickAndOpen = useCallback(
    async (directory: boolean) => {
      const selected = await open({
        multiple: !directory,
        directory,
        filters: directory ? undefined : [{ name: "Markdown / Excel", extensions: ["md", "markdown", "mdown", "mkd", "xlsx"] }],
      });
      if (selected === null) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      openFiles(await openPaths("/", paths, true));
    },
    [openFiles],
  );

  const toggleSidebar = useCallback(() => updateSettings((current) => ({ ...current, sidebarOpen: !current.sidebarOpen })), [updateSettings]);
  const showSidebar = useCallback(() => updateSettings((current) => (current.sidebarOpen ? current : { ...current, sidebarOpen: true })), [updateSettings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const close = useCallback(async (id: FileId) => {
    dispatch({ type: "fileClosed", id });
    await closeFile(id);
  }, []);

  const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId) ?? state.tabs[0];
  if (tab === undefined) return null;
  const activeEntry = tab.activeFileId === null ? null : (state.files[tab.activeFileId] ?? null);

  return (
    <div className="relative flex h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar
        tab={tab}
        files={state.files}
        onSelect={(id) => dispatch({ type: "fileSelected", id })}
        onClose={(id) => void close(id)}
        onOpenFiles={() => void pickAndOpen(false)}
        onOpenFolder={() => void pickAndOpen(true)}
        open={settings.sidebarOpen}
        onRequestOpen={showSidebar}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
          <div className="mr-4 flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-pressed={settings.sidebarOpen}
              aria-label="サイドバーを表示"
              title="サイドバーの表示/非表示 (Ctrl+B)"
              className="shrink-0 rounded px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              ☰
            </button>
            <span className="truncate text-neutral-500" title={activeEntry?.file.path}>
              {activeEntry?.file.path ?? ""}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DocumentToolbar
              settings={settings}
              onChangeSettings={updateSettings}
              raw={raw}
              onToggleRaw={() => setRaw((current) => !current)}
              markdown={activeEntry?.status === "loaded" ? activeEntry.content : null}
            />
            <button type="button" onClick={cycle} className="rounded px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800">
              テーマ: {THEME_LABEL[mode]}
            </button>
          </div>
        </header>
        <main ref={scrollRef} id={VIEWER_SCROLL_ID} className="min-h-0 flex-1 overflow-y-auto">
          <div ref={contentRef} className="h-full">
            <ErrorBoundary resetKey={tab.activeFileId ?? ""}>
              <Viewer entry={activeEntry} settings={settings} raw={raw} onOpenRelative={(baseDir, path) => void openRelative(baseDir, path)} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-4 border-dashed border-blue-500 bg-blue-500/10 text-xl text-blue-600 dark:text-blue-400">
          ここにドロップして開く
        </div>
      )}
    </div>
  );
};
