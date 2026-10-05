declare const fileIdBrand: unique symbol;
declare const tabIdBrand: unique symbol;

/** 絶対パスの SHA-256 先頭8桁 (Rust 側 `file_id` と同じ値) */
export type FileId = string & { readonly [fileIdBrand]: true };
export type TabId = string & { readonly [tabIdBrand]: true };

/** Rust の `OpenedFile` と対応 */
export type OpenedFile = {
  id: FileId;
  path: string;
  name: string;
};

export type FileEntry =
  | { status: "loading"; file: OpenedFile }
  | { status: "loaded"; file: OpenedFile; content: string }
  | { status: "missing"; file: OpenedFile }
  | { status: "error"; file: OpenedFile; message: string };

/**
 * M1 では tabs は常に1要素。
 * ファイルの実体は AppState.files に1つだけ持ち、タブは FileId の並びだけを持つ。
 */
export type Tab = {
  id: TabId;
  title: string;
  fileIds: FileId[];
  activeFileId: FileId | null;
};

export type AppState = {
  tabs: Tab[];
  activeTabId: TabId;
  files: Record<FileId, FileEntry>;
};

export const DEFAULT_TAB_ID = "main" as TabId;

export const assertNever = (value: never): never => {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
};
