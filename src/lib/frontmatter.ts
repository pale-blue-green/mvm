export type SplitContent = {
  /** 先頭の YAML frontmatter ( `---` を除く本文)。なければ null */
  frontmatter: string | null;
  body: string;
};

// 先頭行が `---` で、次の `---` 行までを frontmatter とする。閉じ行が無ければ frontmatter ではない
const FRONTMATTER = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export const splitFrontmatter = (content: string): SplitContent => {
  const match = FRONTMATTER.exec(content);
  if (match === null) return { frontmatter: null, body: content };
  return { frontmatter: match[1] ?? "", body: content.slice(match[0].length) };
};
