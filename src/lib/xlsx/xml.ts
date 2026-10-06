import { DOMParser } from "@xmldom/xmldom";

// ブラウザの DOMParser ではなく xmldom を使う。vitest (Node) でも同じ実装で動かすため
export const parseXml = (text: string): Element => {
  const doc = new DOMParser({ onError: () => undefined }).parseFromString(text, "text/xml");
  return doc.documentElement as unknown as Element;
};

/** 名前空間の接頭辞を無視して、直下の子要素を返す。 */
export const kids = (el: Element | null | undefined, name?: string): Element[] => {
  if (!el) return [];
  const out: Element[] = [];
  for (let node = el.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && (name === undefined || (node as Element).localName === name)) out.push(node as Element);
  }
  return out;
};

export const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null;

/** 子孫を深さ優先(文書順)で返す。 */
export const descendants = (el: Element | null | undefined, name: string): Element[] => {
  const out: Element[] = [];
  const walk = (node: Element) => {
    for (const child of kids(node)) {
      if (child.localName === name) out.push(child);
      walk(child);
    }
  };
  if (el) walk(el);
  return out;
};

export const attr = (el: Element | null | undefined, name: string): string | null => (el && el.hasAttribute(name) ? el.getAttribute(name) : null);

export const num = (el: Element | null | undefined, name: string, fallback: number): number => {
  const value = attr(el, name);
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const flag = (el: Element | null | undefined, name: string, fallback = false): boolean => {
  const value = attr(el, name);
  if (value === null) return fallback;
  return value === "1" || value === "true";
};

/** 子要素の連結テキスト */
export const text = (el: Element | null | undefined): string => (el ? (el.textContent ?? "") : "");
