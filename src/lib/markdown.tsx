import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Root as HastRoot } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { type JSX, type MouseEvent, useEffect, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { markdownToHast } from "./pipeline";
import { isRelativeReference, resolveRelative, safeDecode, splitFragment } from "./path";

const EXTERNAL_PROTOCOLS = /^(https?|mailto):/i;

const scrollToFragment = (fragment: string) => {
  document.getElementById(safeDecode(fragment.slice(1)))?.scrollIntoView();
};

type Props = {
  content: string;
  /** Markdown のあるディレクトリの絶対パス。相対パスの解決基準 */
  baseDir: string;
  /** Markdown 内の相対リンクで別ファイルを開く */
  onOpenRelative: (path: string) => void;
};

type Rendered = { status: "pending" } | { status: "ready"; tree: HastRoot } | { status: "failed"; message: string };

export const MarkdownView = ({ content, baseDir, onOpenRelative }: Props) => {
  const [rendered, setRendered] = useState<Rendered>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const tree = await markdownToHast(content);
        if (!cancelled) setRendered({ status: "ready", tree });
      } catch (error) {
        if (!cancelled) setRendered({ status: "failed", message: error instanceof Error ? error.message : String(error) });
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [content]);

  switch (rendered.status) {
    case "pending":
      return null; // 再描画中は直前の表示を残さず空にするが、ローカル変換は短時間で終わる
    case "failed":
      return <p className="text-red-600 dark:text-red-400">{`Markdown を変換できません: ${rendered.message}`}</p>;
    case "ready":
      return toJsxRuntime(rendered.tree, {
        Fragment,
        jsx: jsx as never,
        jsxs: jsxs as never,
        components: {
          img: ({ src, alt, title }: JSX.IntrinsicElements["img"]) => {
            if (typeof src !== "string") return null;
            const resolved = isRelativeReference(src) ? convertFileSrc(resolveRelative(baseDir, safeDecode(splitFragment(src).path))) : src;
            return <img src={resolved} alt={alt ?? ""} title={title} />;
          },
          a: ({ href, children }: JSX.IntrinsicElements["a"]) => {
            const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
              // WebView 内で遷移させない
              event.preventDefault();
              if (href === undefined) return;
              if (href.startsWith("#")) scrollToFragment(href);
              else if (EXTERNAL_PROTOCOLS.test(href)) void openUrl(href);
              else if (isRelativeReference(href)) onOpenRelative(safeDecode(splitFragment(href).path));
            };
            return (
              <a href={href} onClick={onClick}>
                {children}
              </a>
            );
          },
        },
      });
  }
};
