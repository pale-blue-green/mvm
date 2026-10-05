import rehypeShiki from "@shikijs/rehype";
import type { Root as HastRoot } from "hast";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// @shikijs/rehype は非同期プラグインのため、同期の react-markdown ではなく run() で変換する。
// 生 HTML を通すため sanitize は必須。Shiki の出力 (style 属性) は sanitize の後段で付与する。
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, defaultSchema)
  .use(rehypeSlug)
  .use(rehypeShiki, { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, fallbackLanguage: "text" });

export const markdownToHast = async (content: string): Promise<HastRoot> => {
  const tree = await processor.run(processor.parse(content));
  return tree as HastRoot;
};
