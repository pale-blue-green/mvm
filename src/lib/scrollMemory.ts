import { type RefObject, useLayoutEffect, useRef } from "react";

/** 復元を待つ時間の上限。画像や図の読み込みで高さが増えるのを待つ */
const RESTORE_TIMEOUT_MS = 2000;
/** ユーザーが操作したら復元を打ち切るイベント */
const USER_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/** 目標の位置に到達済みか。内容がまだ短く、目標まで届かない場合は false。 */
export const isRestored = (scrollTop: number, target: number, scrollHeight: number, clientHeight: number): boolean => {
  if (target === 0) return scrollTop === 0;
  const reachable = scrollHeight - clientHeight >= target;
  return reachable && Math.abs(scrollTop - target) < 1;
};

/**
 * ファイル(key)ごとにスクロール位置を覚え、ファイルを切り替えたときに復元する。
 * 内容は非同期に描画され、画像や Mermaid の図で高さが後から変わるため、
 * 目標に届くまで内容のサイズ変化のたびに再適用する。
 */
export const useScrollMemory = (scrollRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>, key: string | null) => {
  const positions = useRef(new Map<string, number>());

  // 描画の確定と同じタイミングで設定する。内容の入れ替えで scrollTop が丸められる scroll イベントを、
  // 切替前のファイルの位置として保存しないため
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (scroller === null || content === null) return;

    const target = key === null ? 0 : (positions.current.get(key) ?? 0);
    let restoring = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: ResizeObserver | undefined;

    const finish = () => {
      restoring = false;
      observer?.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      for (const name of USER_EVENTS) scroller.removeEventListener(name, finish);
    };

    const done = () => isRestored(scroller.scrollTop, target, scroller.scrollHeight, scroller.clientHeight);
    const apply = () => {
      if (!done()) scroller.scrollTop = target;
      if (done()) finish();
    };

    const onScroll = () => {
      // 復元中の scroll イベントは、位置の保存対象にしない
      if (!restoring && key !== null) positions.current.set(key, scroller.scrollTop);
    };

    scroller.addEventListener("scroll", onScroll);
    for (const name of USER_EVENTS) scroller.addEventListener(name, finish, { passive: true });
    observer = new ResizeObserver(apply);
    observer.observe(content);
    timer = setTimeout(finish, RESTORE_TIMEOUT_MS);
    apply();

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      finish();
    };
  }, [scrollRef, contentRef, key]);
};
