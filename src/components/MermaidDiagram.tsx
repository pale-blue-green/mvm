import { useEffect, useId, useState } from "react";
import { useIsDark } from "../lib/theme";

type State = { status: "pending" } | { status: "ready"; svg: string } | { status: "failed"; message: string };

/** Mermaid 本体は大きいため、最初の図を描画するときに読み込む。 */
export const MermaidDiagram = ({ source, onZoom }: { source: string; onZoom: (svg: string) => void }) => {
  const dark = useIsDark();
  const id = `mermaid-${useId().replace(/:/g, "")}`;
  const [state, setState] = useState<State>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        // securityLevel "strict" は図中の HTML とクリックイベントを無効にする
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setState({ status: "ready", svg });
      } catch (error) {
        // 構文エラー時に mermaid が body 直下へ残す要素を片付ける
        document.getElementById(`d${id}`)?.remove();
        if (!cancelled) setState({ status: "failed", message: error instanceof Error ? error.message : String(error) });
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [source, dark, id]);

  switch (state.status) {
    case "pending":
      return <div className="my-4 text-sm text-neutral-500">図を描画中…</div>;
    case "failed":
      return (
        <div className="my-4 rounded border border-red-300 p-3 text-sm dark:border-red-800">
          <p className="text-red-600 dark:text-red-400">{`Mermaid を描画できません: ${state.message}`}</p>
          <pre className="mt-2 overflow-x-auto">{source}</pre>
        </div>
      );
    case "ready":
      // SVG は mermaid が strict モードで生成・サニタイズしたもの
      return (
        <div
          role="button"
          tabIndex={0}
          aria-label="図を拡大表示"
          className="mermaid-diagram my-4 flex justify-center overflow-x-auto"
          onClick={() => onZoom(state.svg)}
          onKeyDown={(event) => event.key === "Enter" && onZoom(state.svg)}
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      );
  }
};
