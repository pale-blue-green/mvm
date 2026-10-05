import { describe, expect, it } from "vitest";
import type { FileId, OpenedFile } from "../domain/types";
import { buildTree } from "./tree";

const file = (path: string): OpenedFile => ({ id: path as FileId, path, name: path.split("/").at(-1) ?? path });

describe("buildTree", () => {
  it("共通の親ディレクトリを根にし、ディレクトリを先に並べる", () => {
    const tree = buildTree([file("/d/docs/b.md"), file("/d/docs/a.md"), file("/d/docs/sub/c.md"), file("/d/docs/sub/deep/e.md")]);
    expect(tree).toEqual([
      {
        kind: "dir",
        name: "sub",
        path: "/sub",
        children: [
          { kind: "dir", name: "deep", path: "/sub/deep", children: [{ kind: "file", id: "/d/docs/sub/deep/e.md", name: "e.md" }] },
          { kind: "file", id: "/d/docs/sub/c.md", name: "c.md" },
        ],
      },
      { kind: "file", id: "/d/docs/a.md", name: "a.md" },
      { kind: "file", id: "/d/docs/b.md", name: "b.md" },
    ]);
  });

  it("ファイルを持たない単一の子ディレクトリは連結して表示する", () => {
    const tree = buildTree([file("/r/a.md"), file("/r/x/y/z/b.md")]);
    expect(tree[0]).toMatchObject({ kind: "dir", name: "x/y/z" });
  });

  it("単一ファイルや空配列でも失敗しない", () => {
    expect(buildTree([file("/r/a.md")])).toEqual([{ kind: "file", id: "/r/a.md", name: "a.md" }]);
    expect(buildTree([])).toEqual([]);
  });

  it("Windows 形式のパスを扱う", () => {
    const tree = buildTree([{ id: "1" as FileId, path: "C:\\d\\a.md", name: "a.md" }, { id: "2" as FileId, path: "C:\\d\\s\\b.md", name: "b.md" }]);
    expect(tree.map((node) => node.name)).toEqual(["s", "a.md"]);
  });
});
