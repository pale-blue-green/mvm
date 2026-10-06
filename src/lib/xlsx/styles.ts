import { type ThemeColors, resolveStyleColor } from "./color";
import { builtinFormat } from "./numfmt";
import { attr, flag, kid, kids, num, parseXml } from "./xml";

export type Edge = { style: string; color: string };
export type CellStyle = {
  font: { name: string; size: number; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null };
  fill: string | null;
  border: { left?: Edge; right?: Edge; top?: Edge; bottom?: Edge };
  horizontal: string | null;
  vertical: string;
  wrap: boolean;
  indent: number;
  numFmt: string | undefined;
};

export type Styles = { xfs: CellStyle[]; defaultFont: { name: string; size: number } };

const edge = (el: Element | null, theme: ThemeColors): Edge | undefined => {
  const style = attr(el, "style");
  if (!el || !style) return undefined;
  return { style, color: resolveStyleColor(kid(el, "color"), theme) ?? "rgb(0 0 0)" };
};

export const parseStyles = (xml: string, theme: ThemeColors): Styles => {
  const root = parseXml(xml);
  const numFmts = new Map<number, string>();
  for (const f of kids(kid(root, "numFmts"), "numFmt")) numFmts.set(num(f, "numFmtId", -1), attr(f, "formatCode") ?? "General");

  const fonts = kids(kid(root, "fonts"), "font").map((f) => ({
    name: attr(kid(f, "name"), "val") ?? "Calibri",
    size: num(kid(f, "sz"), "val", 11),
    bold: kid(f, "b") !== null && attr(kid(f, "b"), "val") !== "0",
    italic: kid(f, "i") !== null && attr(kid(f, "i"), "val") !== "0",
    underline: kid(f, "u") !== null && attr(kid(f, "u"), "val") !== "none",
    strike: kid(f, "strike") !== null && attr(kid(f, "strike"), "val") !== "0",
    color: resolveStyleColor(kid(f, "color"), theme),
  }));

  const fills = kids(kid(root, "fills"), "fill").map((f) => {
    const pattern = kid(f, "patternFill");
    if (pattern && attr(pattern, "patternType") === "solid") return resolveStyleColor(kid(pattern, "fgColor"), theme);
    const stops = kids(kid(kid(f, "gradientFill"), "stop") ? kid(f, "gradientFill") : null, "stop");
    return stops.length > 0 ? resolveStyleColor(kid(stops[0], "color"), theme) : null;
  });

  const borders = kids(kid(root, "borders"), "border").map((b) => ({
    left: edge(kid(b, "left") ?? kid(b, "start"), theme),
    right: edge(kid(b, "right") ?? kid(b, "end"), theme),
    top: edge(kid(b, "top"), theme),
    bottom: edge(kid(b, "bottom"), theme),
  }));

  const fallbackFont = { name: "Calibri", size: 11, bold: false, italic: false, underline: false, strike: false, color: null };
  const xfs = kids(kid(root, "cellXfs"), "xf").map((xf): CellStyle => {
    const align = kid(xf, "alignment");
    const numFmtId = num(xf, "numFmtId", 0);
    return {
      font: fonts[num(xf, "fontId", 0)] ?? fonts[0] ?? fallbackFont,
      fill: fills[num(xf, "fillId", 0)] ?? null,
      border: borders[num(xf, "borderId", 0)] ?? {},
      horizontal: attr(align, "horizontal"),
      vertical: attr(align, "vertical") ?? "bottom",
      wrap: flag(align, "wrapText"),
      indent: num(align, "indent", 0),
      numFmt: numFmts.get(numFmtId) ?? builtinFormat(numFmtId),
    };
  });
  const base = fonts[0] ?? fallbackFont;
  return { xfs: xfs.length > 0 ? xfs : [{ font: base, fill: null, border: {}, horizontal: null, vertical: "bottom", wrap: false, indent: 0, numFmt: undefined }], defaultFont: { name: base.name, size: base.size } };
};
