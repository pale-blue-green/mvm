import { describe, expect, it } from "vitest";
import type { FileId, OpenedFile } from "../domain/types";
import { initialState, reducer } from "../state/reducer";
import { toSessionPayload } from "./session";

const file = (name: string): OpenedFile => ({ id: name as FileId, path: `/d/${name}`, name });

describe("toSessionPayload", () => {
  it("ファイルを id ではなくパスで保存する", () => {
    let state = reducer(initialState, { type: "filesOpened", files: [file("a.md"), file("b.md")] });
    state = reducer(state, { type: "fileSelected", id: "a.md" as FileId });
    expect(toSessionPayload(state)).toEqual({
      activeTabId: "main",
      tabs: [{ id: "main", title: "main", files: ["/d/a.md", "/d/b.md"], activeFile: "/d/a.md" }],
    });
  });

  it("ファイルがないときは activeFile が null", () => {
    expect(toSessionPayload(initialState).tabs[0]?.activeFile).toBeNull();
  });
});
