import { assertNever, type FileEntry, type FileId, type Tab } from "../domain/types";

type Props = {
  tab: Tab;
  files: Record<FileId, FileEntry>;
  onSelect: (id: FileId) => void;
  onClose: (id: FileId) => void;
};

const statusMark = (entry: FileEntry): string => {
  switch (entry.status) {
    case "loading":
      return "…";
    case "loaded":
      return "";
    case "missing":
      return "削除済み";
    case "error":
      return "エラー";
    default:
      return assertNever(entry);
  }
};

export const Sidebar = ({ tab, files, onSelect, onClose }: Props) => (
  <nav aria-label="開いているファイル" className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
    <ul className="py-2">
      {tab.fileIds.map((id) => {
        const entry = files[id];
        if (entry === undefined) return null;
        const active = id === tab.activeFileId;
        return (
          <li key={id} className="group relative">
            <button
              type="button"
              title={entry.file.path}
              onClick={() => onSelect(id)}
              className={`flex w-full items-baseline gap-2 truncate px-3 py-1.5 pr-8 text-left text-sm ${
                active ? "bg-neutral-200 font-medium dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
              }`}
            >
              <span className="truncate">{entry.file.name}</span>
              <span className="shrink-0 text-xs text-neutral-500">{statusMark(entry)}</span>
            </button>
            <button
              type="button"
              aria-label={`${entry.file.name} を閉じる`}
              onClick={() => onClose(id)}
              className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded px-1 text-neutral-500 hover:bg-neutral-300 group-hover:block dark:hover:bg-neutral-700"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);
