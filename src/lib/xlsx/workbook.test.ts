import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { GroupNode, PicNode, ShapeNode } from "./types";
import { loadWorkbook, resolvePath } from "./workbook";

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const XDR = 'xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const anchor = (from: [number, number], to: [number, number], body: string, toOff = "0") =>
  `<xdr:twoCellAnchor><xdr:from><xdr:col>${from[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${from[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${to[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${to[1]}</xdr:row><xdr:rowOff>${toOff}</xdr:rowOff></xdr:to>${body}<xdr:clientData/></xdr:twoCellAnchor>`;

const spXml = (prst: string, extra = "", xfrm = '<a:off x="0" y="0"/><a:ext cx="100" cy="100"/>') =>
  `<xdr:sp><xdr:nvSpPr><xdr:cNvPr id="2" name="s"/><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:xfrm>${xfrm}</a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${extra}</xdr:spPr></xdr:sp>`;

const build = (): Uint8Array => {
  const drawing = `<xdr:wsDr ${XDR}>
${anchor([1, 1], [3, 3], spXml("rect", '<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill><a:prstDash val="dash"/></a:ln>'))}
${anchor([1, 1], [3, 1], `<xdr:cxnSp><xdr:nvCxnSpPr><xdr:cNvPr id="3" name="c"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr><xdr:spPr><a:xfrm rot="16200000"><a:off x="0" y="0"/><a:ext cx="12700" cy="1524000"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></xdr:spPr></xdr:cxnSp>`, "12700")}
${anchor([0, 0], [2, 2], `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="4" name="g"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr><xdr:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1524000" cy="381000"/><a:chOff x="1000000" y="1000000"/><a:chExt cx="3048000" cy="762000"/></a:xfrm></xdr:grpSpPr>${spXml("ellipse", '<a:noFill/>', '<a:off x="2524000" y="1381000"/><a:ext cx="1524000" cy="381000"/>')}</xdr:grpSp>`)}
${anchor([4, 4], [5, 5], `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="5" name="p"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></xdr:spPr></xdr:pic>`)}
${anchor([0, 5], [1, 6], spXml("star5"))}
</xdr:wsDr>`;
  const sheet = `<worksheet ${NS}><sheetViews><sheetView showGridLines="0" zoomScale="80"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="3" width="10" customWidth="1"/></cols><sheetData>
<row r="1"><c r="A1" s="1" t="s"><v>0</v></c><c r="B1" s="1"/><c r="C1" s="2"><v>1234.5</v></c></row>
<row r="2" ht="30"><c r="A2" t="inlineStr"><is><t>inline</t></is></c><c r="B2" t="b"><v>1</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells><drawing r:id="rId1"/></worksheet>`;
  const styles = `<styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Meiryo UI"/></font><font><b/><sz val="12"/><color rgb="FFFF0000"/><name val="Meiryo UI"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF000000"/></left></border></borders><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="1"><alignment horizontal="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook ${NS}><sheets><sheet name="データ" sheetId="1" r:id="rId1"/><sheet name="隠し" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/worksheets/sheet2.xml": strToU8(`<worksheet ${NS}><sheetData/></worksheet>`),
    "xl/worksheets/_rels/sheet1.xml.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="../drawings/drawing1.xml"/></Relationships>'),
    "xl/drawings/drawing1.xml": strToU8(drawing),
    "xl/drawings/_rels/drawing1.xml.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>'),
    "xl/media/image1.png": new Uint8Array([137, 80, 78, 71]),
    "xl/sharedStrings.xml": strToU8(`<sst ${NS}><si><t>見出し</t></si></sst>`),
    "xl/styles.xml": strToU8(styles),
  });
};

describe("resolvePath", () => {
  it("相対パスを解決する", () => {
    expect(resolvePath("xl/worksheets/sheet1.xml", "../drawings/drawing1.xml")).toBe("xl/drawings/drawing1.xml");
    expect(resolvePath("xl/workbook.xml", "worksheets/sheet1.xml")).toBe("xl/worksheets/sheet1.xml");
    expect(resolvePath("xl/workbook.xml", "/xl/styles.xml")).toBe("xl/styles.xml");
  });
});

describe("loadWorkbook", () => {
  const wb = loadWorkbook(build());
  const sheet = wb.sheet(0);

  it("シート名と非表示を読む", () => {
    expect(wb.sheets).toEqual([{ name: "データ", hidden: false }, { name: "隠し", hidden: true }]);
  });

  it("xlsx でないデータはわかりやすいエラーにする", () => {
    expect(() => loadWorkbook(zipSync({ "a.txt": strToU8("x") }))).toThrow("xlsx ではありません");
  });

  it("セルの値 (共有文字列・インライン・真偽値) と数値書式を読む", () => {
    const text = Object.fromEntries(sheet.cells.map((c) => [`${c.r},${c.c}`, c.text]));
    expect(text["0,0"]).toBe("見出し");
    expect(text["0,2"]).toBe("1,235");
    expect(text["1,0"]).toBe("inline");
    expect(text["1,1"]).toBe("TRUE");
    expect(sheet.cells.find((c) => c.r === 0 && c.c === 2)?.isNumber).toBe(true);
  });

  it("結合・グリッド・倍率・列の座標 (桁幅 8px × 10 = 80px) を読む", () => {
    expect(sheet.merges).toEqual([{ r1: 0, c1: 0, r2: 0, c2: 1 }]);
    expect(sheet.showGrid).toBe(false);
    expect(sheet.zoom).toBe(80);
    expect(sheet.colX.slice(0, 4)).toEqual([0, 80, 160, 240]);
    expect(sheet.rowY.slice(0, 3)).toEqual([0, 20, 60]); // 既定 15pt = 20px、2行目は 30pt = 40px
  });

  it("図形: アンカーから矩形を求め、塗り・線・破線を解決する", () => {
    const rect = sheet.nodes[0] as ShapeNode;
    expect(rect.kind).toBe("shape");
    expect(rect.rect).toEqual({ x: 80, y: 20, w: 160, h: 60 }); // 行2は 30pt = 40px のため、行1-3 の高さは 20+40
    expect(rect.fill).toEqual({ kind: "solid", color: "rgb(255 0 0)" });
    expect(rect.stroke?.color).toBe("rgb(0 0 255)");
    expect(rect.stroke?.width).toBeCloseTo(2, 5);
    expect(rect.stroke?.dash).toEqual([8, 6]); // dash = [4,3] × 線幅 2
  });

  it("回転したコネクタは、回転前の大きさ (1.33 x 160) を同じ中心に復元し、矢印の端点を持つ", () => {
    const line = sheet.nodes[1] as ShapeNode;
    expect(line.rot).toBe(270);
    expect(line.rect.w).toBeCloseTo(1.333, 2);
    expect(line.rect.h).toBeCloseTo(160, 1);
    expect(line.stroke?.tail?.type).toBe("triangle");
    expect(line.fill).toEqual({ kind: "none" });
  });

  it("グループの子は、chOff / chExt の座標系から絶対座標に変換する", () => {
    const group = sheet.nodes[2] as GroupNode;
    expect(group.kind).toBe("group");
    expect(group.rect).toEqual({ x: 0, y: 0, w: 160, h: 60 });
    const child = group.children[0] as ShapeNode;
    // 横は 160/320 = 0.5 倍、縦は 60/80 = 0.75 倍
    expect(child.rect).toEqual({ x: 80, y: 30, w: 80, h: 30 });
    expect(child.fill).toEqual({ kind: "none" });
  });

  it("画像は data URI にする", () => {
    const pic = sheet.nodes[3] as PicNode;
    expect(pic.kind).toBe("pic");
    expect(pic.href).toBe("data:image/png;base64,iVBORw==");
  });

  it("未対応の図形は矩形で代用し、種類と個数を報告する", () => {
    expect(sheet.unsupported).toEqual({ star5: 1 });
    expect((sheet.nodes[4] as ShapeNode).geom).toBe("star5");
  });
});
