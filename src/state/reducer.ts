import { type AppState, type FileEntry, type FileId, type OpenedFile, type Tab, type TabId, DEFAULT_TAB_ID } from "../domain/types";

export type Action =
  | { type: "filesOpened"; files: OpenedFile[]; tabId?: TabId }
  | { type: "fileLoaded"; id: FileId; content: string }
  | { type: "fileMissing"; id: FileId }
  | { type: "fileFailed"; id: FileId; message: string }
  | { type: "fileSelected"; id: FileId }
  | { type: "fileClosed"; id: FileId };

export const initialState: AppState = {
  tabs: [{ id: DEFAULT_TAB_ID, title: "main", fileIds: [], activeFileId: null }],
  activeTabId: DEFAULT_TAB_ID,
  files: {},
};

const updateTab = (state: AppState, tabId: TabId, update: (tab: Tab) => Tab): AppState => ({
  ...state,
  tabs: state.tabs.map((tab) => (tab.id === tabId ? update(tab) : tab)),
});

const updateFile = (state: AppState, id: FileId, entry: FileEntry): AppState =>
  id in state.files ? { ...state, files: { ...state.files, [id]: entry } } : state;

export const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "filesOpened": {
      const tabId = action.tabId ?? state.activeTabId;
      const files = { ...state.files };
      for (const file of action.files) {
        // 既に開いているファイルは内容を保持し、選択だけ切り替える
        files[file.id] ??= { status: "loading", file };
      }
      const added = action.files.map((file) => file.id);
      const next = updateTab({ ...state, files }, tabId, (tab) => ({
        ...tab,
        fileIds: [...tab.fileIds, ...added.filter((id) => !tab.fileIds.includes(id))],
        activeFileId: added.at(-1) ?? tab.activeFileId,
      }));
      return next;
    }
    case "fileLoaded": {
      const entry = state.files[action.id];
      return entry === undefined ? state : updateFile(state, action.id, { status: "loaded", file: entry.file, content: action.content });
    }
    case "fileMissing": {
      const entry = state.files[action.id];
      return entry === undefined ? state : updateFile(state, action.id, { status: "missing", file: entry.file });
    }
    case "fileFailed": {
      const entry = state.files[action.id];
      return entry === undefined ? state : updateFile(state, action.id, { status: "error", file: entry.file, message: action.message });
    }
    case "fileSelected":
      return updateTab(state, state.activeTabId, (tab) => (tab.fileIds.includes(action.id) ? { ...tab, activeFileId: action.id } : tab));
    case "fileClosed": {
      const tabs = state.tabs.map((tab) => {
        const index = tab.fileIds.indexOf(action.id);
        if (index < 0) return tab;
        const fileIds = tab.fileIds.filter((id) => id !== action.id);
        const activeFileId = tab.activeFileId === action.id ? (fileIds[Math.min(index, fileIds.length - 1)] ?? null) : tab.activeFileId;
        return { ...tab, fileIds, activeFileId };
      });
      // どのタブにも属さなくなったファイルは破棄する (監視解除は呼び出し側)
      const referenced = new Set(tabs.flatMap((tab) => tab.fileIds));
      const files = Object.fromEntries(Object.entries(state.files).filter(([id]) => referenced.has(id as FileId))) as AppState["files"];
      return { ...state, tabs, files };
    }
  }
};
