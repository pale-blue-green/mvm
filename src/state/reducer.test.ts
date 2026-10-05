import { describe, expect, it } from "vitest";
import { type FileId, type OpenedFile } from "../domain/types";
import { initialState, reducer } from "./reducer";

const file = (name: string): OpenedFile => ({ id: name as FileId, path: `/d/${name}`, name });

describe("reducer", () => {
  it("ファイルを開くと loading で追加され、最後のファイルが選択される", () => {
    const state = reducer(initialState, { type: "filesOpened", files: [file("a"), file("b")] });
    expect(state.tabs[0]?.fileIds).toEqual(["a", "b"]);
    expect(state.tabs[0]?.activeFileId).toBe("b");
    expect(state.files["a" as FileId]?.status).toBe("loading");
  });

  it("既に開いているファイルは内容を保持し、重複して追加しない", () => {
    let state = reducer(initialState, { type: "filesOpened", files: [file("a"), file("b")] });
    state = reducer(state, { type: "fileLoaded", id: "a" as FileId, content: "# a" });
    state = reducer(state, { type: "filesOpened", files: [file("a")] });
    expect(state.tabs[0]?.fileIds).toEqual(["a", "b"]);
    expect(state.tabs[0]?.activeFileId).toBe("a");
    expect(state.files["a" as FileId]).toMatchObject({ status: "loaded", content: "# a" });
  });

  it("読み込み結果で状態が遷移する", () => {
    let state = reducer(initialState, { type: "filesOpened", files: [file("a")] });
    const id = "a" as FileId;
    state = reducer(state, { type: "fileLoaded", id, content: "x" });
    expect(state.files[id]?.status).toBe("loaded");
    state = reducer(state, { type: "fileMissing", id });
    expect(state.files[id]?.status).toBe("missing");
    state = reducer(state, { type: "fileFailed", id, message: "boom" });
    expect(state.files[id]).toMatchObject({ status: "error", message: "boom" });
    state = reducer(state, { type: "fileLoaded", id, content: "y" });
    expect(state.files[id]).toMatchObject({ status: "loaded", content: "y" });
  });

  it("未登録のファイルへの結果は無視する", () => {
    const state = reducer(initialState, { type: "fileLoaded", id: "zzz" as FileId, content: "x" });
    expect(state).toBe(initialState);
  });

  it("閉じると隣のファイルが選択され、どのタブにも属さない実体は破棄される", () => {
    let state = reducer(initialState, { type: "filesOpened", files: [file("a"), file("b"), file("c")] });
    state = reducer(state, { type: "fileSelected", id: "b" as FileId });
    state = reducer(state, { type: "fileClosed", id: "b" as FileId });
    expect(state.tabs[0]?.fileIds).toEqual(["a", "c"]);
    expect(state.tabs[0]?.activeFileId).toBe("c");
    expect("b" in state.files).toBe(false);
    state = reducer(state, { type: "fileClosed", id: "c" as FileId });
    state = reducer(state, { type: "fileClosed", id: "a" as FileId });
    expect(state.tabs[0]?.activeFileId).toBeNull();
    expect(state.files).toEqual({});
  });
});
