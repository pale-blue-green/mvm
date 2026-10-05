import { assertNever, type FileEntry } from "../domain/types";
import { MarkdownBody } from "../lib/markdown";
import { dirname } from "../lib/path";
import { useMarkdownTree } from "../lib/useMarkdownTree";
import { TocPanel } from "./TocPanel";

type Props = {
  entry: FileEntry | null;
  onOpenRelative: (baseDir: string, path: string) => void;
};

const Message = ({ children }: { children: string }) => <p className="p-8 text-neutral-500">{children}</p>;

const LoadedDocument = ({ content, baseDir, onOpenRelative }: { content: string; baseDir: string; onOpenRelative: (path: string) => void }) => {
  const rendered = useMarkdownTree(content);
  switch (rendered.status) {
    case "pending":
      return null;
    case "failed":
      return <Message>{`Markdown を変換できません: ${rendered.message}`}</Message>;
    case "ready":
      return (
        <div className="mx-auto flex max-w-7xl justify-center gap-6 px-8 py-6">
          <article className="prose prose-neutral dark:prose-invert min-w-0 max-w-4xl flex-1">
            <MarkdownBody tree={rendered.tree} baseDir={baseDir} onOpenRelative={onOpenRelative} />
          </article>
          <TocPanel headings={rendered.headings} />
        </div>
      );
  }
};

export const Viewer = ({ entry, onOpenRelative }: Props) => {
  if (entry === null) {
    return <Message>ファイルが開かれていません。`mvm file.md` で起動するか、ファイルをドロップしてください。</Message>;
  }
  switch (entry.status) {
    case "loading":
      return <Message>読み込み中…</Message>;
    case "missing":
      return <Message>{`${entry.file.path} は存在しません。`}</Message>;
    case "error":
      return <Message>{`${entry.file.path} を読み込めません: ${entry.message}`}</Message>;
    case "loaded": {
      const baseDir = dirname(entry.file.path);
      return <LoadedDocument content={entry.content} baseDir={baseDir} onOpenRelative={(path) => onOpenRelative(baseDir, path)} />;
    }
    default:
      return assertNever(entry);
  }
};
