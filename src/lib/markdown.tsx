import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Root as HastRoot } from "hast";
import { type Components, toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { JSX, MouseEvent } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { MermaidDiagram } from "../components/MermaidDiagram";
import { MERMAID_TAG } from "./pipeline";
import { isRelativeReference, resolveRelative, safeDecode, splitFragment } from "./path";

const EXTERNAL_PROTOCOLS = /^(https?|mailto):/i;

const scrollToFragment = (fragment: string) => {
  document.getElementById(safeDecode(fragment.slice(1)))?.scrollIntoView();
};

type Props = {
  tree: HastRoot;
  /** Markdown のあるディレクトリの絶対パス。相対パスの解決基準 */
  baseDir: string;
  /** Markdown 内の相対リンクで別ファイルを開く */
  onOpenRelative: (path: string) => void;
};

export const MarkdownBody = ({ tree, baseDir, onOpenRelative }: Props) => {
  const components: Components = {
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
    [MERMAID_TAG]: ({ "data-source": source }: { "data-source"?: string }) => <MermaidDiagram source={source ?? ""} />,
  };

  return toJsxRuntime(tree, { Fragment, jsx: jsx as never, jsxs: jsxs as never, components });
};
