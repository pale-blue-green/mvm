import { type ReactNode, useEffect } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

type Props = { children: ReactNode; label: string; onClose: () => void };

/** 画像や図を全画面で拡大・パンするモーダル。Esc または背景のクリックで閉じる。 */
export const ZoomModal = ({ children, label, onClose }: Props) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 bg-black/80" onClick={onClose}>
      <TransformWrapper minScale={0.2} maxScale={20} centerOnInit doubleClick={{ mode: "reset" }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-4 right-4 z-10 flex gap-2 text-sm" onClick={(event) => event.stopPropagation()}>
              {[
                { text: "＋", action: () => zoomIn(), label: "拡大" },
                { text: "－", action: () => zoomOut(), label: "縮小" },
                { text: "リセット", action: () => resetTransform(), label: "表示をリセット" },
                { text: "×", action: onClose, label: "閉じる" },
              ].map((button) => (
                <button key={button.label} type="button" aria-label={button.label} onClick={button.action} className="rounded bg-neutral-800 px-3 py-1.5 text-neutral-100 hover:bg-neutral-700">
                  {button.text}
                </button>
              ))}
            </div>
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
              <div className="zoom-content flex h-screen w-screen items-center justify-center" onClick={(event) => event.stopPropagation()}>
                {children}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
