import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

describe("parseSettings", () => {
  it("保存値がなければ既定値", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
  it("有効な値を復元する", () => {
    expect(parseSettings('{"fontSize":3,"width":"wide","sidebarOpen":false}')).toEqual({ fontSize: 3, width: "wide", sidebarOpen: false });
  });
  it("不正な値は項目ごとに既定値へ戻す", () => {
    expect(parseSettings('{"fontSize":9,"width":"wide"}')).toEqual({ ...DEFAULT_SETTINGS, width: "wide" });
    expect(parseSettings('{"fontSize":"2","width":1}')).toEqual(DEFAULT_SETTINGS);
  });
  it("サイドバーの開閉は真偽値のみ受け付け、旧形式の保存値では表示状態になる", () => {
    expect(parseSettings('{"sidebarOpen":"no"}').sidebarOpen).toBe(true);
    expect(parseSettings('{"fontSize":2,"width":"narrow"}').sidebarOpen).toBe(true);
  });
  it("壊れた JSON は既定値", () => {
    expect(parseSettings("{oops")).toEqual(DEFAULT_SETTINGS);
  });
});
