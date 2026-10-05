import type { Element, Nodes } from "hast";
import { describe, expect, it } from "vitest";
import { markdownToHast } from "./pipeline";

const collect = (node: Nodes, found: Element[] = []): Element[] => {
  if (node.type === "element") found.push(node);
  if ("children" in node) for (const child of node.children) collect(child, found);
  return found;
};

const render = async (markdown: string) => collect(await markdownToHast(markdown));
const tags = (elements: Element[]) => elements.map((element) => element.tagName);

describe("markdownToHast", () => {
  it("script 要素とイベントハンドラ属性を除去する", async () => {
    const elements = await render('<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n<a href="javascript:alert(3)">x</a>');
    expect(tags(elements)).not.toContain("script");
    for (const element of elements) {
      expect(Object.keys(element.properties)).not.toContain("onError");
    }
    const link = elements.find((element) => element.tagName === "a");
    expect(link?.properties.href).toBeUndefined();
  });

  it("GFM の表とタスクリストを変換する", async () => {
    const elements = await render("| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n");
    expect(tags(elements)).toContain("table");
    expect(elements.filter((element) => element.tagName === "input")).toHaveLength(2);
  });

  it("コードブロックを Shiki でハイライトし、未知の言語でも失敗しない", async () => {
    const known = await render("```ts\nconst x = 1;\n```");
    expect(known.some((element) => element.tagName === "pre" && String(element.properties.class).includes("shiki"))).toBe(true);
    const unknown = await render("```not-a-language\nfoo\n```");
    expect(tags(unknown)).toContain("pre");
  });

  it("見出しに id を付与する", async () => {
    const elements = await render("## 下の見出し");
    expect(elements.find((element) => element.tagName === "h2")?.properties.id).toBe("下の見出し");
  });
});
