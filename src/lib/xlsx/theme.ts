import type { ThemeColors } from "./color";
import { attr, kid, kids, num, parseXml } from "./xml";

export type Theme = {
  colors: ThemeColors;
  minorLatin: string;
  minorEa: string;
  /** a:lnStyleLst の線幅 (EMU)。インデックスは lnRef idx - 1 */
  lineWidths: number[];
};

const DEFAULT: Theme = {
  colors: { dk1: "000000", lt1: "FFFFFF", dk2: "44546A", lt2: "E7E6E6", accent1: "4472C4", accent2: "ED7D31", accent3: "A5A5A5", accent4: "FFC000", accent5: "5B9BD5", accent6: "70AD47", hlink: "0563C1", folHlink: "954F72" },
  minorLatin: "Calibri",
  minorEa: "",
  lineWidths: [6350, 12700, 19050],
};

export const parseTheme = (xml: string | null): Theme => {
  if (!xml) return DEFAULT;
  const root = parseXml(xml);
  const elements = kid(root, "themeElements");
  const colors: ThemeColors = { ...DEFAULT.colors };
  for (const c of kids(kid(elements, "clrScheme"))) {
    const v = kids(c)[0];
    const hex = attr(v, "srgbClr") ?? attr(v, "lastClr") ?? attr(v, "val");
    if (v && hex) colors[c.localName] = hex;
  }
  const minor = kid(kid(elements, "fontScheme"), "minorFont");
  const jpan = kids(minor, "font").find((f) => attr(f, "script") === "Jpan");
  const lineWidths = kids(kid(kid(elements, "fmtScheme"), "lnStyleLst"), "ln").map((ln) => num(ln, "w", 12700));
  return {
    colors,
    minorLatin: attr(kid(minor, "latin"), "typeface") || DEFAULT.minorLatin,
    minorEa: attr(kid(minor, "ea"), "typeface") || attr(jpan, "typeface") || "",
    lineWidths: lineWidths.length > 0 ? lineWidths : DEFAULT.lineWidths,
  };
};
