import type { FileEntry, FileId } from "../domain/types";

export type SearchHit = {
  id: FileId;
  nameMatch: boolean;
  lines: { line: number; text: string }[];
};

const MAX_LINES_PER_FILE = 3;
const SNIPPET_RADIUS = 60;

const snippet = (line: string, index: number, length: number): string => {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(line.length, index + length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${line.slice(start, end).trim()}${end < line.length ? "…" : ""}`;
};

/** ファイル名 (パス) と、読み込み済みの本文を大文字小文字を区別せず検索する。 */
export const searchFiles = (query: string, entries: FileEntry[]): SearchHit[] => {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const nameMatch = entry.file.path.toLowerCase().includes(needle);
    const lines: SearchHit["lines"] = [];
    if (entry.status === "loaded") {
      const contentLines = entry.content.split(/\r?\n/);
      for (let i = 0; i < contentLines.length && lines.length < MAX_LINES_PER_FILE; i++) {
        const text = contentLines[i] ?? "";
        const index = text.toLowerCase().indexOf(needle);
        if (index >= 0) lines.push({ line: i + 1, text: snippet(text, index, needle.length) });
      }
    }
    if (nameMatch || lines.length > 0) hits.push({ id: entry.file.id, nameMatch, lines });
  }
  return hits;
};
