/** Markdown 内の相対パスを、Markdown のあるディレクトリ基準の絶対パスに解決する (POSIX / Windows 両対応)。 */
export const resolveRelative = (baseDir: string, relative: string): string => {
  const separator = baseDir.includes("\\") && !baseDir.includes("/") ? "\\" : "/";
  const segments = baseDir.split(/[\\/]/);
  const root = segments.shift() ?? ""; // POSIX は "" 、Windows は "C:"
  const stack = segments.filter((segment) => segment !== "");
  for (const segment of relative.split(/[\\/]/)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") stack.pop();
    else stack.push(segment);
  }
  return [root, ...stack].join(separator);
};

export const dirname = (path: string): string => {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index <= 0 ? path.slice(0, index + 1) || "/" : path.slice(0, index);
};

/** `scheme:` 付き、`//` 始まり、`#` 始まり、絶対パスのいずれでもない参照 */
export const isRelativeReference = (reference: string): boolean =>
  !/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/|#|\\)/.test(reference);

export const splitFragment = (reference: string): { path: string; fragment: string } => {
  const index = reference.indexOf("#");
  return index < 0 ? { path: reference, fragment: "" } : { path: reference.slice(0, index), fragment: reference.slice(index) };
};

export const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
