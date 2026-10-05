import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import { FONT_SIZE_LABELS, type FontSizeIndex, type Settings } from "../lib/settings";

export const ARTICLE_ID = "document-article";

type CopyKind = "markdown" | "text" | "html";

type Props = {
  settings: Settings;
  onChangeSettings: (change: (current: Settings) => Settings) => void;
  raw: boolean;
  onToggleRaw: () => void;
  /** 読み込み済みの本文。ファイルが開かれていない・読み込み中は null */
  markdown: string | null;
};

const buttonClass = "rounded px-2 py-1 hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-neutral-800";

export const DocumentToolbar = ({ settings, onChangeSettings, raw, onToggleRaw, markdown }: Props) => {
  const [message, setMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => setMessage(null), 1500);
    return () => clearTimeout(timer);
  }, [message]);

  const stepFont = (delta: 1 | -1) =>
    onChangeSettings((current) => ({ ...current, fontSize: Math.min(3, Math.max(0, current.fontSize + delta)) as FontSizeIndex }));

  const copy = async (kind: CopyKind) => {
    if (menuRef.current !== null) menuRef.current.open = false;
    const article = document.getElementById(ARTICLE_ID);
    const text = kind === "markdown" ? markdown : kind === "text" ? (article?.innerText ?? null) : (article?.innerHTML ?? null);
    if (text === null) {
      setMessage("コピーできる内容がありません");
      return;
    }
    setMessage((await copyText(text)) ? "コピーしました" : "コピーできませんでした");
  };

  const hasDocument = markdown !== null;
  return (
    <div className="flex shrink-0 items-center gap-1 text-sm">
      {message !== null && (
        <span role="status" className="mr-2 text-neutral-500">
          {message}
        </span>
      )}
      <button type="button" className={buttonClass} aria-label="文字を小さくする" disabled={settings.fontSize === 0} onClick={() => stepFont(-1)}>
        A−
      </button>
      <span className="w-8 text-center text-xs text-neutral-500" title="文字サイズ">
        {FONT_SIZE_LABELS[settings.fontSize]}
      </span>
      <button type="button" className={buttonClass} aria-label="文字を大きくする" disabled={settings.fontSize === 3} onClick={() => stepFont(1)}>
        A＋
      </button>
      <button
        type="button"
        className={buttonClass}
        aria-pressed={settings.width === "wide"}
        title="本文の幅"
        onClick={() => onChangeSettings((current) => ({ ...current, width: current.width === "wide" ? "narrow" : "wide" }))}
      >
        幅: {settings.width === "wide" ? "広" : "狭"}
      </button>
      <button type="button" className={`${buttonClass} ${raw ? "bg-neutral-200 dark:bg-neutral-800" : ""}`} aria-pressed={raw} disabled={!hasDocument} onClick={onToggleRaw}>
        Raw
      </button>
      <details ref={menuRef} className="relative">
        <summary className={`${buttonClass} cursor-pointer list-none ${hasDocument ? "" : "pointer-events-none opacity-40"}`}>コピー</summary>
        <div className="absolute right-0 z-10 mt-1 flex w-36 flex-col rounded border border-neutral-300 bg-white py-1 shadow dark:border-neutral-700 dark:bg-neutral-900">
          <button type="button" className="px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => void copy("markdown")}>
            Markdown
          </button>
          <button type="button" className="px-3 py-1.5 text-left hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800" disabled={raw} onClick={() => void copy("text")}>
            テキスト
          </button>
          <button type="button" className="px-3 py-1.5 text-left hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800" disabled={raw} onClick={() => void copy("html")}>
            HTML
          </button>
        </div>
      </details>
    </div>
  );
};
