import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileId, OpenedFile, Startup, TabId } from "../domain/types";
import type { SessionPayload } from "./session";

export type ReadResult =
  | { kind: "ok"; content: string }
  | { kind: "missing" }
  | { kind: "failed"; message: string };

type ReadErrorPayload = { kind: "missing" } | { kind: "failed"; message: string };

export const getStartup = (): Promise<Startup> => invoke("get_startup");

/** `recursive` はディレクトリを Markdown ファイルに展開するときの再帰指定 */
export const openPaths = (baseDir: string, paths: string[], recursive: boolean): Promise<OpenedFile[]> =>
  invoke("open_paths", { baseDir, paths, recursive });

export const closeFile = (id: FileId): Promise<void> => invoke("close_file", { id });

export const saveSession = (session: SessionPayload): Promise<void> => invoke("save_session", { ...session });

export const readMarkdown = async (id: FileId): Promise<ReadResult> => {
  try {
    return { kind: "ok", content: await invoke<string>("read_markdown", { id }) };
  } catch (error) {
    const payload = error as ReadErrorPayload;
    return payload.kind === "missing" ? { kind: "missing" } : { kind: "failed", message: payload.message ?? String(error) };
  }
};

export type OpenFilesEvent = { files: OpenedFile[]; tabId?: TabId; select: boolean };

export type ReadBytesResult = { kind: "ok"; bytes: Uint8Array } | { kind: "missing" } | { kind: "failed"; message: string };

export const readBytes = async (id: FileId): Promise<ReadBytesResult> => {
  try {
    return { kind: "ok", bytes: new Uint8Array(await invoke<ArrayBuffer>("read_bytes", { id })) };
  } catch (error) {
    const payload = error as ReadErrorPayload;
    return payload.kind === "missing" ? { kind: "missing" } : { kind: "failed", message: payload.message ?? String(error) };
  }
};

export const onOpenFiles = (handler: (event: OpenFilesEvent) => void): Promise<UnlistenFn> =>
  listen<OpenFilesEvent>("open-files", (event) => handler(event.payload));

export const onFileChanged = (handler: (id: FileId) => void): Promise<UnlistenFn> =>
  listen<{ id: FileId }>("file-changed", (event) => handler(event.payload.id));
