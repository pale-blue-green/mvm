import { describe, expect, it } from "vitest";
import type { FileEntry, FileId } from "../domain/types";
import { searchFiles } from "./search";

const loaded = (name: string, content: string): FileEntry => ({
  status: "loaded",
  file: { id: name as FileId, path: `/d/${name}`, name },
  content,
});

describe("searchFiles", () => {
  it("空のクエリは何も返さない", () => {
    expect(searchFiles("  ", [loaded("a.md", "x")])).toEqual([]);
  });

  it("ファイル名と本文を大文字小文字を区別せず検索する", () => {
    const hits = searchFiles("Hello", [loaded("hello.md", "no match"), loaded("b.md", "line1\nsay HELLO world\nline3"), loaded("c.md", "none")]);
    expect(hits).toEqual([
      { id: "hello.md", nameMatch: true, lines: [] },
      { id: "b.md", nameMatch: false, lines: [{ line: 2, text: "say HELLO world" }] },
    ]);
  });

  it("1ファイルあたりの行数を制限し、長い行は前後を省略する", () => {
    const content = Array.from({ length: 10 }, () => "x needle y").join("\n");
    expect(searchFiles("needle", [loaded("a.md", content)])[0]?.lines).toHaveLength(3);
    const long = `${"a".repeat(200)}needle${"b".repeat(200)}`;
    const text = searchFiles("needle", [loaded("a.md", long)])[0]?.lines[0]?.text ?? "";
    expect(text.startsWith("…") && text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan(150);
  });

  it("読み込み前のファイルは名前だけが対象", () => {
    const loading: FileEntry = { status: "loading", file: { id: "a" as FileId, path: "/d/a.md", name: "a.md" } };
    expect(searchFiles("a.md", [loading])).toEqual([{ id: "a", nameMatch: true, lines: [] }]);
    expect(searchFiles("zzz", [loading])).toEqual([]);
  });
});
