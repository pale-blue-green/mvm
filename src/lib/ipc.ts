import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileId, OpenedFile, TabId } from "../domain/types";

export type ReadResult =
  | { kind: "ok"; content: string }
  | { kind: "missing" }
  | { kind: "failed"; message: string };

type ReadErrorPayload = { kind: "missing" } | { kind: "failed"; message: string };

export const takeInitialFiles = (): Promise<OpenedFile[]> => invoke("take_initial_files");

export const openPaths = (baseDir: string, paths: string[]): Promise<OpenedFile[]> =>
  invoke("open_paths", { baseDir, paths });

export const closeFile = (id: FileId): Promise<void> => invoke("close_file", { id });

export const readMarkdown = async (id: FileId): Promise<ReadResult> => {
  try {
    return { kind: "ok", content: await invoke<string>("read_markdown", { id }) };
  } catch (error) {
    const payload = error as ReadErrorPayload;
    return payload.kind === "missing" ? { kind: "missing" } : { kind: "failed", message: payload.message ?? String(error) };
  }
};

export type OpenFilesEvent = { files: OpenedFile[]; tabId?: TabId };

export const onOpenFiles = (handler: (event: OpenFilesEvent) => void): Promise<UnlistenFn> =>
  listen<OpenFilesEvent>("open-files", (event) => handler(event.payload));

export const onFileChanged = (handler: (id: FileId) => void): Promise<UnlistenFn> =>
  listen<{ id: FileId }>("file-changed", (event) => handler(event.payload.id));
