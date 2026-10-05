import { dirname } from "../lib/path";
import { MarkdownView } from "../lib/markdown";
import { assertNever, type FileEntry } from "../domain/types";

type Props = {
  entry: FileEntry | null;
  onOpenRelative: (baseDir: string, path: string) => void;
};

const Message = ({ children }: { children: string }) => <p className="p-8 text-neutral-500">{children}</p>;

export const Viewer = ({ entry, onOpenRelative }: Props) => {
  if (entry === null) {
    return <Message>ファイルが開かれていません。`mvm file.md` で起動してください。</Message>;
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
      return (
        <article className="prose prose-neutral dark:prose-invert mx-auto max-w-4xl px-8 py-6">
          <MarkdownView content={entry.content} baseDir={baseDir} onOpenRelative={(path) => onOpenRelative(baseDir, path)} />
        </article>
      );
    }
    default:
      return assertNever(entry);
  }
};
