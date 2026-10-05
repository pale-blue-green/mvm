import { describe, expect, it } from "vitest";
import { splitFrontmatter } from "./frontmatter";

describe("splitFrontmatter", () => {
  it("先頭の YAML frontmatter を分離する", () => {
    expect(splitFrontmatter("---\ntitle: A\ntags: [x]\n---\n# 本文\n")).toEqual({ frontmatter: "title: A\ntags: [x]", body: "# 本文\n" });
  });

  it("CRLF と BOM に対応する", () => {
    expect(splitFrontmatter("﻿---\r\ntitle: A\r\n---\r\n# 本文")).toEqual({ frontmatter: "title: A", body: "# 本文" });
  });

  it("閉じ行が無い、または先頭でない `---` は frontmatter として扱わない", () => {
    expect(splitFrontmatter("---\ntitle: A\n# 本文").frontmatter).toBeNull();
    expect(splitFrontmatter("# 見出し\n\n---\nx: 1\n---\n").frontmatter).toBeNull();
  });

  it("空の frontmatter と、本文のない文書を扱う", () => {
    expect(splitFrontmatter("---\n\n---\nbody")).toEqual({ frontmatter: "", body: "body" });
    expect(splitFrontmatter("---\na: 1\n---")).toEqual({ frontmatter: "a: 1", body: "" });
  });

  it("本文中の水平線は影響しない", () => {
    const text = "---\na: 1\n---\n本文\n\n---\n\n続き";
    expect(splitFrontmatter(text).body).toBe("本文\n\n---\n\n続き");
  });
});
