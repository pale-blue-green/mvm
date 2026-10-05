import type { AppState } from "../domain/types";

/** Rust の `SessionTab` と対応。ファイルは id ではなくパスで保存する */
export type SessionTabPayload = {
  id: string;
  title: string;
  files: string[];
  activeFile: string | null;
};

export type SessionPayload = { tabs: SessionTabPayload[]; activeTabId: string };

export const toSessionPayload = (state: AppState): SessionPayload => ({
  activeTabId: state.activeTabId,
  tabs: state.tabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    files: tab.fileIds.flatMap((id) => {
      const entry = state.files[id];
      return entry === undefined ? [] : [entry.file.path];
    }),
    activeFile: tab.activeFileId === null ? null : (state.files[tab.activeFileId]?.file.path ?? null),
  })),
});
