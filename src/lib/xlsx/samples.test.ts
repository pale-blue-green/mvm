import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DrawNode } from "./types";
import { loadWorkbook } from "./workbook";

// 実在の xlsx (非公開の資料) を使う確認用。XLSX_SAMPLES にフォルダを指定したときだけ実行する。
//   XLSX_SAMPLES=~/Documents/... pnpm exec vitest run src/lib/xlsx/samples.test.ts
const dir = process.env.XLSX_SAMPLES;

const count = (nodes: DrawNode[]): number => nodes.reduce((n, node) => n + 1 + (node.kind === "group" ? count(node.children) : 0), 0);

describe.skipIf(!dir || !existsSync(dir))("実ファイルの読み込み", () => {
  const files = dir && existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$")) : [];
  it.each(files)("%s を全シート解析できる", (file) => {
    const wb = loadWorkbook(new Uint8Array(readFileSync(join(dir!, file))));
    const stats = wb.sheets.map((_, i) => {
      const s = wb.sheet(i);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
      return { shapes: count(s.nodes), cells: s.cells.length, unsupported: s.unsupported };
    });
    const total = stats.reduce((n, s) => n + s.shapes, 0);
    const unsupported = stats.flatMap((s) => Object.entries(s.unsupported));
    console.log(`${file}: sheets=${wb.sheets.length} nodes=${total} unsupported=${JSON.stringify(Object.fromEntries(unsupported))}`);
    expect(total).toBeGreaterThan(0);
  });
});
