import type { FileId, OpenedFile } from "../domain/types";

export type TreeNode =
  | { kind: "dir"; name: string; path: string; children: TreeNode[] }
  | { kind: "file"; id: FileId; name: string };

type MutableDir = { name: string; path: string; dirs: Map<string, MutableDir>; files: OpenedFile[] };

const splitPath = (path: string): string[] => path.split(/[\\/]/).filter((segment) => segment !== "");

/** 全ファイルに共通するディレクトリ部分の長さ */
const commonDirLength = (dirs: string[][]): number => {
  const first = dirs[0];
  if (first === undefined) return 0;
  let length = first.length;
  for (const dir of dirs) {
    let i = 0;
    while (i < length && dir[i] === first[i]) i++;
    length = i;
  }
  return length;
};

const toNodes = (dir: MutableDir): TreeNode[] => {
  const dirs = [...dir.dirs.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((child): TreeNode => {
      let node = child;
      let name = child.name;
      // 子が1つのディレクトリだけの連鎖は "a/b/c" に畳む
      while (node.files.length === 0 && node.dirs.size === 1) {
        const [only] = node.dirs.values();
        if (only === undefined) break;
        name = `${name}/${only.name}`;
        node = only;
      }
      return { kind: "dir", name, path: node.path, children: toNodes(node) };
    });
  const files = [...dir.files]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file): TreeNode => ({ kind: "file", id: file.id, name: file.name }));
  return [...dirs, ...files];
};

/** 共通の親ディレクトリを根として、ファイルをディレクトリ階層に並べる。 */
export const buildTree = (files: OpenedFile[]): TreeNode[] => {
  const dirParts = files.map((file) => splitPath(file.path).slice(0, -1));
  const skip = commonDirLength(dirParts);
  const root: MutableDir = { name: "", path: "", dirs: new Map(), files: [] };
  files.forEach((file, index) => {
    const parts = (dirParts[index] ?? []).slice(skip);
    let current = root;
    let path = "";
    for (const part of parts) {
      path = `${path}/${part}`;
      let next = current.dirs.get(part);
      if (next === undefined) {
        next = { name: part, path, dirs: new Map(), files: [] };
        current.dirs.set(part, next);
      }
      current = next;
    }
    current.files.push(file);
  });
  return toNodes(root);
};
