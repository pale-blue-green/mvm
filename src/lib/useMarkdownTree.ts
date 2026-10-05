import type { Root as HastRoot } from "hast";
import { useEffect, useState } from "react";
import type { Heading } from "../domain/types";
import { extractHeadings, markdownToHast } from "./pipeline";

export type RenderedMarkdown =
  | { status: "pending" }
  | { status: "ready"; tree: HastRoot; headings: Heading[] }
  | { status: "failed"; message: string };

/** 変換中は直前の結果を保持し、live reload で表示が空にならないようにする。 */
export const useMarkdownTree = (content: string): RenderedMarkdown => {
  const [rendered, setRendered] = useState<RenderedMarkdown>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const tree = await markdownToHast(content);
        if (!cancelled) setRendered({ status: "ready", tree, headings: extractHeadings(tree) });
      } catch (error) {
        if (!cancelled) setRendered({ status: "failed", message: error instanceof Error ? error.message : String(error) });
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [content]);

  return rendered;
};
