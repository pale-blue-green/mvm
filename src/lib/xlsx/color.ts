import { attr, kid, kids, num } from "./xml";

export type ThemeColors = Record<string, string>; // dk1, lt1, dk2, lt2, accent1..6, hlink, folHlink (RRGGBB)

type Rgb = { r: number; g: number; b: number };
export type Color = Rgb & { a: number };

const clamp = (v: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, v));

const parseHex = (hex: string): Rgb => {
  const h = hex.replace(/^#/, "").slice(-6).padStart(6, "0");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};

const toHsl = ({ r, g, b }: Rgb): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: h / 6, s, l };
};

const fromHsl = ({ h, s, l }: { h: number; s: number; l: number }): Rgb => {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return { r: Math.round(hue(h + 1 / 3) * 255), g: Math.round(hue(h) * 255), b: Math.round(hue(h - 1 / 3) * 255) };
};

export const toCss = (c: Color): string => (c.a >= 1 ? `rgb(${c.r} ${c.g} ${c.b})` : `rgb(${c.r} ${c.g} ${c.b} / ${Number(c.a.toFixed(3))})`);

const SCHEME_ALIAS: Record<string, string> = { tx1: "dk1", tx2: "dk2", bg1: "lt1", bg2: "lt2" };
const SYS: Record<string, string> = { windowText: "000000", window: "FFFFFF" };
const PRESET: Record<string, string> = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", grey: "808080" };

/**
 * DrawingML の色要素 (srgbClr / schemeClr / sysClr / prstClr) を解決する。
 * 子の変換 (lumMod, lumOff, tint, shade, alpha) は文書順に適用する。
 * `phClr` は、スタイル参照 (lnRef / fillRef) の色で置き換える。
 */
export const resolveDrawingColor = (el: Element | null, theme: ThemeColors, phClr?: Color | null): Color | null => {
  if (!el) return null;
  let rgb: Rgb;
  switch (el.localName) {
    case "srgbClr":
      rgb = parseHex(attr(el, "val") ?? "000000");
      break;
    case "sysClr":
      rgb = parseHex(attr(el, "lastClr") ?? SYS[attr(el, "val") ?? ""] ?? "000000");
      break;
    case "prstClr":
      rgb = parseHex(PRESET[attr(el, "val") ?? ""] ?? "000000");
      break;
    case "schemeClr": {
      const val = attr(el, "val") ?? "tx1";
      if (val === "phClr") {
        if (!phClr) return null;
        rgb = { r: phClr.r, g: phClr.g, b: phClr.b };
      } else {
        rgb = parseHex(theme[SCHEME_ALIAS[val] ?? val] ?? "000000");
      }
      break;
    }
    default:
      return null;
  }
  let alpha = 1;
  for (const t of kids(el)) {
    const v = num(t, "val", 100000) / 100000;
    switch (t.localName) {
      case "lumMod": {
        const hsl = toHsl(rgb);
        rgb = fromHsl({ ...hsl, l: clamp(hsl.l * v, 0, 1) });
        break;
      }
      case "lumOff": {
        const hsl = toHsl(rgb);
        rgb = fromHsl({ ...hsl, l: clamp(hsl.l + v, 0, 1) });
        break;
      }
      case "tint":
        rgb = { r: Math.round(rgb.r * v + 255 * (1 - v)), g: Math.round(rgb.g * v + 255 * (1 - v)), b: Math.round(rgb.b * v + 255 * (1 - v)) };
        break;
      case "shade":
        rgb = { r: Math.round(rgb.r * v), g: Math.round(rgb.g * v), b: Math.round(rgb.b * v) };
        break;
      case "alpha":
        alpha = v;
        break;
      default:
        break;
    }
  }
  return { ...rgb, a: alpha };
};

/** 塗り要素 (solidFill) の中の色を解決する。 */
export const resolveSolidFill = (fill: Element | null, theme: ThemeColors, phClr?: Color | null): Color | null =>
  fill ? resolveDrawingColor(kids(fill)[0] ?? null, theme, phClr) : null;

// SpreadsheetML の theme 番号 (0=lt1, 1=dk1, 2=lt2, 3=dk2, 4-9=accent1-6, 10=hlink, 11=folHlink)
const THEME_INDEX = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const INDEXED = ["000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080"];

/** スタイル (styles.xml) の色要素 (`<color rgb|theme|indexed tint>`) を CSS 色にする。 */
export const resolveStyleColor = (el: Element | null, theme: ThemeColors): string | null => {
  if (!el) return null;
  let rgb: Rgb | null = null;
  const argb = attr(el, "rgb");
  const themeIdx = attr(el, "theme");
  const indexed = attr(el, "indexed");
  if (argb) rgb = parseHex(argb);
  else if (themeIdx !== null) rgb = parseHex(theme[THEME_INDEX[Number(themeIdx)] ?? "dk1"] ?? "000000");
  else if (indexed !== null) rgb = parseHex(INDEXED[Number(indexed)] ?? "000000");
  else if (attr(el, "auto") !== null) rgb = { r: 0, g: 0, b: 0 };
  if (!rgb) return null;
  const tint = num(el, "tint", 0);
  if (tint !== 0) {
    const hsl = toHsl(rgb);
    rgb = fromHsl({ ...hsl, l: tint < 0 ? hsl.l * (1 + tint) : hsl.l * (1 - tint) + tint });
  }
  return toCss({ ...rgb, a: 1 });
};

export const parseCssColorHex = (hex: string): Color => ({ ...parseHex(hex), a: 1 });
export const findChild = kid;
