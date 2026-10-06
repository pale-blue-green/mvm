import { describe, expect, it } from "vitest";
import { unrotatedRect } from "./drawing";
import { parseXml } from "./xml";

const xfrm = (rot: number, cx: number, cy: number) =>
  parseXml(`<a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" rot="${rot}"><a:off x="0" y="0"/><a:ext cx="${cx * 9525}" cy="${cy * 9525}"/></a:xfrm>`);

describe("unrotatedRect", () => {
  it("回転なしはアンカーのまま", () => {
    const anchor = { x: 10, y: 20, w: 100, h: 50 };
    expect(unrotatedRect(anchor, xfrm(0, 100, 50))).toBe(anchor);
  });

  it("270° 回転: アンカー (146x1) から、回転前の 1x146 を同じ中心に復元する", () => {
    const r = unrotatedRect({ x: 100, y: 200, w: 146, h: 1 }, xfrm(16200000, 1, 146));
    expect(r.w).toBeCloseTo(1, 5);
    expect(r.h).toBeCloseTo(146, 5);
    expect(r.x + r.w / 2).toBeCloseTo(173, 5);
    expect(r.y + r.h / 2).toBeCloseTo(200.5, 5);
  });

  it("90° 回転で外接矩形がずれて保存されていても、比率で補正する", () => {
    // 回転前 100x40 → 外接は 40x100。アンカーが 2 倍 (80x200) なら、回転前は 200x80
    const r = unrotatedRect({ x: 0, y: 0, w: 80, h: 200 }, xfrm(5400000, 100, 40));
    expect(r.w).toBeCloseTo(200, 5);
    expect(r.h).toBeCloseTo(80, 5);
  });
});
