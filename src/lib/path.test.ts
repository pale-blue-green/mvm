import { describe, expect, it } from "vitest";
import { dirname, isRelativeReference, resolveRelative, splitFragment } from "./path";

describe("resolveRelative", () => {
  it("POSIX の相対パスを解決する", () => {
    expect(resolveRelative("/home/u/docs", "img/a.png")).toBe("/home/u/docs/img/a.png");
    expect(resolveRelative("/home/u/docs", "./img/a.png")).toBe("/home/u/docs/img/a.png");
    expect(resolveRelative("/home/u/docs", "../assets/a.png")).toBe("/home/u/assets/a.png");
  });
  it("Windows のパスは区切りを維持する", () => {
    expect(resolveRelative("C:\\Users\\u\\docs", "img/a.png")).toBe("C:\\Users\\u\\docs\\img\\a.png");
    expect(resolveRelative("C:\\Users\\u\\docs", "..\\a.png")).toBe("C:\\Users\\u\\a.png");
  });
  it("ルートを越える .. はルートで止まる", () => {
    expect(resolveRelative("/a", "../../b.png")).toBe("/b.png");
  });
});

describe("dirname", () => {
  it("両方の区切りに対応する", () => {
    expect(dirname("/home/u/a.md")).toBe("/home/u");
    expect(dirname("C:\\u\\a.md")).toBe("C:\\u");
    expect(dirname("/a.md")).toBe("/");
  });
});

describe("isRelativeReference", () => {
  it.each([
    ["a.png", true],
    ["./a.png", true],
    ["../a.png", true],
    ["https://example.com/a.png", false],
    ["data:image/png;base64,xx", false],
    ["mailto:a@example.com", false],
    ["#section", false],
    ["/abs/a.png", false],
    ["//cdn.example.com/a.png", false],
  ])("%s -> %s", (reference, expected) => {
    expect(isRelativeReference(reference)).toBe(expected);
  });
});

describe("splitFragment", () => {
  it("フラグメントを分離する", () => {
    expect(splitFragment("a.md#intro")).toEqual({ path: "a.md", fragment: "#intro" });
    expect(splitFragment("a.md")).toEqual({ path: "a.md", fragment: "" });
  });
});
