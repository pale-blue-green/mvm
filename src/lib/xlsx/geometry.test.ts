import { describe, expect, it } from "vitest";
import { buildGeometry } from "./geometry";

describe("buildGeometry", () => {
  it("矩形は4頂点のパスで、テキスト領域は全体", () => {
    const g = buildGeometry("rect", 100, 50, {});
    expect(g.paths[0]?.d).toBe("M0,0 L100,0 L100,50 L0,50 Z");
    expect(g.textRect).toEqual({ l: 0, t: 0, r: 100, b: 50 });
    expect(g.connector).toBe(false);
    expect(g.known).toBe(true);
  });

  it("円柱 (flowChartMagneticDisk) は本体と手前の弧の2パスを持つ", () => {
    const g = buildGeometry("flowChartMagneticDisk", 60, 60, {});
    expect(g.paths).toHaveLength(2);
    expect(g.paths[1]).toMatchObject({ fill: false, stroke: true });
    expect(g.textRect).toEqual({ l: 0, t: 20, r: 60, b: 50 });
  });

  it("折れ線コネクタは調整値で折れ位置が変わり、塗りを持たない", () => {
    expect(buildGeometry("bentConnector3", 100, 40, {}).paths[0]?.d).toBe("M0,0 L50,0 L50,40 L100,40");
    expect(buildGeometry("bentConnector3", 100, 40, { adj1: 25000 }).paths[0]?.d).toBe("M0,0 L25,0 L25,40 L100,40");
    const bent4 = buildGeometry("bentConnector4", 100, 40, { adj1: 20000, adj2: 75000 });
    expect(bent4.paths[0]?.d).toBe("M0,0 L20,0 L20,30 L100,30 L100,40");
    expect(bent4.paths[0]?.fill).toBe(false);
    expect(bent4.connector).toBe(true);
  });

  it("三角形の頂点位置は adj に従う", () => {
    expect(buildGeometry("triangle", 100, 50, {}).paths[0]?.d).toBe("M0,50 L50,0 L100,50 Z");
    expect(buildGeometry("triangle", 100, 50, { adj: 0 }).paths[0]?.d).toBe("M0,50 L0,0 L100,50 Z");
  });

  it("吹き出しは、尾の向きに応じた辺に頂点を挟む", () => {
    const below = buildGeometry("wedgeRectCallout", 120, 60, { adj1: -20833, adj2: 62500 }).paths[0]!.d;
    expect(below).toContain("L35,67.5"); // 尾の先端 (w/2 + dx, h/2 + dy)
    const left = buildGeometry("wedgeRectCallout", 120, 60, { adj1: -80000, adj2: 0 }).paths[0]!.d;
    expect(left).toContain("L-36,30");
  });

  it("未対応のプリセットは矩形で代用し、known=false", () => {
    const g = buildGeometry("star5", 10, 10, {});
    expect(g.known).toBe(false);
    expect(g.paths[0]?.d).toBe("M0,0 L10,0 L10,10 L0,10 Z");
  });
});
