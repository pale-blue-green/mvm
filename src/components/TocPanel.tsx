import { useEffect, useState } from "react";
import type { Heading } from "../domain/types";

export const VIEWER_SCROLL_ID = "viewer-scroll";

/** 画面上部に最も近い見出しを現在位置として強調する。 */
const useActiveHeading = (headings: Heading[]): string | null => {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const root = document.getElementById(VIEWER_SCROLL_ID);
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = headings.find((heading) => visible.has(heading.id));
        if (first !== undefined) setActive(first.id);
      },
      { root, rootMargin: "0px 0px -75% 0px" },
    );
    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element !== null) observer.observe(element);
    }
    setActive(headings[0]?.id ?? null);
    return () => observer.disconnect();
  }, [headings]);
  return active;
};

export const TocPanel = ({ headings }: { headings: Heading[] }) => {
  const active = useActiveHeading(headings);
  if (headings.length === 0) return null;
  const minDepth = Math.min(...headings.map((heading) => heading.depth));
  return (
    <nav aria-label="目次" className="sticky top-6 hidden max-h-[calc(100vh-6rem)] w-60 shrink-0 overflow-y-auto pr-4 text-sm xl:block">
      <p className="mb-2 font-medium text-neutral-500">目次</p>
      <ul className="space-y-1">
        {headings.map((heading, index) => (
          <li key={`${heading.id}-${index}`} style={{ paddingLeft: `${(heading.depth - minDepth) * 0.75}rem` }}>
            <button
              type="button"
              onClick={() => document.getElementById(heading.id)?.scrollIntoView()}
              className={`block w-full truncate text-left hover:text-neutral-900 dark:hover:text-neutral-100 ${
                heading.id === active ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-500"
              }`}
              title={heading.text}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
