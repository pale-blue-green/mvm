import { describe, expect, it } from "vitest";
import { isRestored } from "./scrollMemory";

describe("isRestored", () => {
  it("目標が 0 のときは先頭にあれば到達済み", () => {
    expect(isRestored(0, 0, 100, 500)).toBe(true);
    expect(isRestored(30, 0, 1000, 500)).toBe(false);
  });

  it("内容が短くて目標に届かない間は未到達", () => {
    expect(isRestored(100, 800, 600, 500)).toBe(false);
    // 内容が増えて届くようになった
    expect(isRestored(800, 800, 1500, 500)).toBe(true);
  });

  it("端数の誤差(1px 未満)は到達済みとみなす", () => {
    expect(isRestored(799.6, 800, 2000, 500)).toBe(true);
    expect(isRestored(798, 800, 2000, 500)).toBe(false);
  });
});
