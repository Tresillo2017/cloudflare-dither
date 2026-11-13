import { useEffect, useRef, useState, type ReactNode } from "react";

const DATA_STATE = "data-state";
const ERROR_STATE = "error";

interface FailureGuardProps {
  /** Adapter id, for the error message. */
  adapterId: string;
  children: ReactNode;
}

/**
 * Watches the dithercn component inside for `data-state="error"`. Stand-ins
 * fail asynchronously (image decode, logo load), so the error is raised during
 * render: the portal's error boundary then disposes the stand-in and the original
 * element is shown again. Without this the original would stay hidden.
 */
export const FailureGuard = ({ adapterId, children }: FailureGuardProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const check = (): void => {
      if (root.querySelector(`[${DATA_STATE}]`)?.getAttribute(DATA_STATE) === ERROR_STATE) setFailed(true);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(root, { attributes: true, attributeFilter: [DATA_STATE], subtree: true });
    return () => observer.disconnect();
  }, []);

  if (failed) throw new Error(`${adapterId}: stand-in content failed to load`);
  return (
    <div ref={rootRef} className="size-full">
      {children}
    </div>
  );
};

/**
 * For stand-ins that draw from a bare image URL: probes the source once and throws
 * during render when it cannot load, so the original is shown again.
 */
export const useImageLoadGuard = (src: string, adapterId: string): void => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return undefined;
    const probe = new Image();
    probe.onerror = () => setFailedSrc(src);
    probe.src = src;
    return () => {
      probe.onerror = null;
    };
  }, [src]);

  if (src && failedSrc === src) throw new Error(`${adapterId}: image failed to load`);
};
