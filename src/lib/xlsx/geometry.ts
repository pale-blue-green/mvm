/** プリセット図形 (a:prstGeom) を、図形のローカル座標 (0,0)-(w,h) の SVG パスにする。 */
export type PathSpec = { d: string; fill: boolean; stroke: boolean };
export type TextRect = { l: number; t: number; r: number; b: number };
export type Geometry = { paths: PathSpec[]; textRect: TextRect; connector: boolean; known: boolean };

const f = (n: number): string => String(Math.round(n * 100) / 100);
const poly = (pts: [number, number][]): string => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" L")} Z`;
const open = (pts: [number, number][]): string => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" L")}`;

const adjOf = (adj: Record<string, number>, name: string, fallback: number): number => adj[name] ?? fallback;

/** wedgeRectCallout / wedgeRoundRectCallout の外形 (吹き出しの尾を、近い辺に付ける)。 */
const callout = (w: number, h: number, a1: number, a2: number, radius: number): string => {
  const dx = (w * a1) / 100000;
  const dy = (h * a2) / 100000;
  const px = w / 2 + dx;
  const py = h / 2 + dy;
  const vertical = Math.abs(dy) > Math.abs((dx * h) / (w || 1));
  const r = Math.min(radius, w / 2, h / 2);
  // 時計回りに辺をたどり、尾のある辺だけ途中に頂点 (px,py) を挟む
  const top: string[] = [];
  const right: string[] = [];
  const bottom: string[] = [];
  const left: string[] = [];
  if (vertical && dy < 0) { const x1 = dx > 0 ? (w * 7) / 12 : (w * 2) / 12; const x2 = dx > 0 ? (w * 10) / 12 : (w * 5) / 12; top.push(`L${f(x1)},0`, `L${f(px)},${f(py)}`, `L${f(x2)},0`); }
  if (vertical && dy >= 0) { const x1 = dx > 0 ? (w * 10) / 12 : (w * 5) / 12; const x2 = dx > 0 ? (w * 7) / 12 : (w * 2) / 12; bottom.push(`L${f(x1)},${f(h)}`, `L${f(px)},${f(py)}`, `L${f(x2)},${f(h)}`); }
  if (!vertical && dx > 0) { const y1 = dy > 0 ? (h * 7) / 12 : (h * 2) / 12; const y2 = dy > 0 ? (h * 10) / 12 : (h * 5) / 12; right.push(`L${f(w)},${f(y1)}`, `L${f(px)},${f(py)}`, `L${f(w)},${f(y2)}`); }
  if (!vertical && dx <= 0) { const y1 = dy > 0 ? (h * 10) / 12 : (h * 5) / 12; const y2 = dy > 0 ? (h * 7) / 12 : (h * 2) / 12; left.push(`L0,${f(y1)}`, `L${f(px)},${f(py)}`, `L0,${f(y2)}`); }
  const corner = (x: number, y: number) => (r > 0 ? `A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y)}` : `L${f(x)},${f(y)}`);
  return [`M${f(r)},0`, ...top, `L${f(w - r)},0`, corner(w, r), ...right, `L${f(w)},${f(h - r)}`, corner(w - r, h), ...bottom, `L${f(r)},${f(h)}`, corner(0, h - r), ...left, `L0,${f(r)}`, corner(r, 0), "Z"].join(" ");
};

export const buildGeometry = (prst: string, w: number, h: number, adj: Record<string, number>): Geometry => {
  const full: TextRect = { l: 0, t: 0, r: w, b: h };
  const shape = (d: string, textRect: TextRect = full, extra: PathSpec[] = []): Geometry => ({ paths: [{ d, fill: true, stroke: true }, ...extra], textRect, connector: false, known: true });
  const connector = (d: string): Geometry => ({ paths: [{ d, fill: false, stroke: true }], textRect: full, connector: true, known: true });

  switch (prst) {
    case "rect":
      return shape(poly([[0, 0], [w, 0], [w, h], [0, h]]));
    case "roundRect": {
      const r = (Math.min(w, h) * adjOf(adj, "adj", 16667)) / 100000;
      return shape(`M${f(r)},0 L${f(w - r)},0 A${f(r)},${f(r)} 0 0 1 ${f(w)},${f(r)} L${f(w)},${f(h - r)} A${f(r)},${f(r)} 0 0 1 ${f(w - r)},${f(h)} L${f(r)},${f(h)} A${f(r)},${f(r)} 0 0 1 0,${f(h - r)} L0,${f(r)} A${f(r)},${f(r)} 0 0 1 ${f(r)},0 Z`);
    }
    case "ellipse":
      return shape(`M0,${f(h / 2)} A${f(w / 2)},${f(h / 2)} 0 1 1 ${f(w)},${f(h / 2)} A${f(w / 2)},${f(h / 2)} 0 1 1 0,${f(h / 2)} Z`, { l: w * 0.146, t: h * 0.146, r: w * 0.854, b: h * 0.854 });
    case "triangle": {
      const x = (w * adjOf(adj, "adj", 50000)) / 100000;
      return shape(poly([[0, h], [x, 0], [w, h]]), { l: x / 2, t: h / 2, r: (x + w) / 2, b: h });
    }
    case "diamond":
      return shape(poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]), { l: w / 4, t: h / 4, r: (w * 3) / 4, b: (h * 3) / 4 });
    case "flowChartInputOutput":
      return shape(poly([[0, h], [w / 5, 0], [w, 0], [(w * 4) / 5, h]]), { l: w / 5, t: 0, r: (w * 4) / 5, b: h });
    case "flowChartDocument": {
      const y = (h * 17322) / 21600;
      return shape(`M0,0 L${f(w)},0 L${f(w)},${f(y)} C${f(w / 2)},${f(y)} ${f(w / 2)},${f((h * 23922) / 21600)} 0,${f((h * 20172) / 21600)} Z`, { l: 0, t: 0, r: w, b: (h * 20172) / 21600 });
    }
    case "flowChartMagneticDisk": {
      const y1 = h / 6;
      return shape(
        `M0,${f(y1)} A${f(w / 2)},${f(y1)} 0 0 1 ${f(w)},${f(y1)} L${f(w)},${f(h - y1)} A${f(w / 2)},${f(y1)} 0 0 1 0,${f(h - y1)} Z`,
        { l: 0, t: h / 3, r: w, b: (h * 5) / 6 },
        [{ d: `M0,${f(y1)} A${f(w / 2)},${f(y1)} 0 0 0 ${f(w)},${f(y1)}`, fill: false, stroke: true }],
      );
    }
    case "foldedCorner": {
      const dy2 = (Math.min(w, h) * adjOf(adj, "adj", 16667)) / 100000;
      const dy1 = dy2 / 5;
      const x1 = w - dy2;
      const y2 = h - dy2;
      return shape(`M0,0 L${f(w)},0 L${f(w)},${f(y2)} L${f(x1)},${f(h)} L0,${f(h)} Z`, { l: 0, t: 0, r: w, b: y2 }, [{ d: `M${f(x1)},${f(h)} L${f(x1 + dy1)},${f(y2 + dy1)} L${f(w)},${f(y2)}`, fill: false, stroke: true }]);
    }
    case "wedgeRectCallout":
      return shape(callout(w, h, adjOf(adj, "adj1", -20833), adjOf(adj, "adj2", 62500), 0));
    case "wedgeRoundRectCallout":
      return shape(callout(w, h, adjOf(adj, "adj1", -20833), adjOf(adj, "adj2", 62500), (Math.min(w, h) * adjOf(adj, "adj3", 16667)) / 100000));
    case "arc": {
      const toRad = (a: number) => ((a / 60000) * Math.PI) / 180;
      const st = toRad(adjOf(adj, "adj1", 16200000));
      const en = toRad(adjOf(adj, "adj2", 0));
      const rx = w / 2;
      const ry = h / 2;
      const sweep = (((en - st) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const d = `M${f(rx + rx * Math.cos(st))},${f(ry + ry * Math.sin(st))} A${f(rx)},${f(ry)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${f(rx + rx * Math.cos(en))},${f(ry + ry * Math.sin(en))}`;
      return { paths: [{ d, fill: false, stroke: true }], textRect: full, connector: true, known: true };
    }
    case "line":
    case "straightConnector1":
      return connector(open([[0, 0], [w, h]]));
    case "bentConnector2":
      return connector(open([[0, 0], [w, 0], [w, h]]));
    case "bentConnector3": {
      const x1 = (w * adjOf(adj, "adj1", 50000)) / 100000;
      return connector(open([[0, 0], [x1, 0], [x1, h], [w, h]]));
    }
    case "bentConnector4": {
      const x1 = (w * adjOf(adj, "adj1", 50000)) / 100000;
      const y2 = (h * adjOf(adj, "adj2", 50000)) / 100000;
      return connector(open([[0, 0], [x1, 0], [x1, y2], [w, y2], [w, h]]));
    }
    case "bentConnector5": {
      const x1 = (w * adjOf(adj, "adj1", 50000)) / 100000;
      const y2 = (h * adjOf(adj, "adj2", 50000)) / 100000;
      const x3 = (w * adjOf(adj, "adj3", 50000)) / 100000;
      return connector(open([[0, 0], [x1, 0], [x1, y2], [x3, y2], [x3, h], [w, h]]));
    }
    default: {
      // 未対応の図形は外接する矩形で代用する
      const g = shape(poly([[0, 0], [w, 0], [w, h], [0, h]]));
      return { ...g, known: false };
    }
  }
};
