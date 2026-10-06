import { describe, expect, it } from "vitest";
import { resolveDrawingColor, resolveStyleColor, toCss } from "./color";
import { parseXml } from "./xml";

const theme = { dk1: "000000", lt1: "FFFFFF", dk2: "44546A", lt2: "E7E6E6", accent1: "4472C4" };
const el = (xml: string) => parseXml(`<root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${xml}</root>`).firstChild as unknown as Element;

describe("resolveDrawingColor", () => {
  it("srgbClr と、tx1/bg1 のテーマ別名を解決する", () => {
    expect(toCss(resolveDrawingColor(el('<a:srgbClr val="B60005"/>'), theme)!)).toBe("rgb(182 0 5)");
    expect(toCss(resolveDrawingColor(el('<a:schemeClr val="tx1"/>'), theme)!)).toBe("rgb(0 0 0)");
    expect(toCss(resolveDrawingColor(el('<a:schemeClr val="bg1"/>'), theme)!)).toBe("rgb(255 255 255)");
  });

  it("sysClr は lastClr を使う", () => {
    expect(toCss(resolveDrawingColor(el('<a:sysClr val="windowText" lastClr="000000"/>'), theme)!)).toBe("rgb(0 0 0)");
  });

  it("shade は暗く、tint は明るく、alpha は透明度になる", () => {
    expect(toCss(resolveDrawingColor(el('<a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr>'), theme)!)).toBe("rgb(34 57 98)");
    const tinted = resolveDrawingColor(el('<a:srgbClr val="000000"><a:tint val="50000"/></a:srgbClr>'), theme)!;
    expect(tinted.r).toBeGreaterThan(120);
    expect(resolveDrawingColor(el('<a:srgbClr val="FF0000"><a:alpha val="40000"/></a:srgbClr>'), theme)!.a).toBeCloseTo(0.4);
  });

  it("lumMod / lumOff は明度を変える (白の 85% = 灰色)", () => {
    const c = resolveDrawingColor(el('<a:schemeClr val="bg1"><a:lumMod val="85000"/></a:schemeClr>'), theme)!;
    expect(c.r).toBe(c.g);
    expect(c.r).toBeGreaterThan(210);
    expect(c.r).toBeLessThan(220);
  });

  it("phClr はスタイル参照の色で置き換える", () => {
    const ph = { r: 10, g: 20, b: 30, a: 1 };
    expect(toCss(resolveDrawingColor(el('<a:schemeClr val="phClr"/>'), theme, ph)!)).toBe("rgb(10 20 30)");
    expect(resolveDrawingColor(el('<a:schemeClr val="phClr"/>'), theme)).toBeNull();
  });
});

describe("resolveStyleColor", () => {
  it("rgb (ARGB) / theme 番号 / tint", () => {
    expect(resolveStyleColor(el('<color rgb="FF112233"/>'), theme)).toBe("rgb(17 34 51)");
    expect(resolveStyleColor(el('<color theme="1"/>'), theme)).toBe("rgb(0 0 0)"); // dk1
    expect(resolveStyleColor(el('<color theme="0" tint="-0.15"/>'), theme)).toMatch(/^rgb\(2[01]\d 2[01]\d 2[01]\d\)$/); // 白の -15%
  });
});
