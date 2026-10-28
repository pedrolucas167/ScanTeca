"use client";

import { useEffect, type RefObject } from "react";

/** Follow the visible viewport: mobile keyboards do not consistently resize 100dvh. */
export function useOracleViewport(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia("(max-width: 767px)");
    let frame = 0;
    let previousWidth = window.innerWidth;
    let fullHeight = viewport?.height ?? window.innerHeight;

    const update = () => {
      if (!mobile.matches || (viewport && viewport.scale !== 1)) {
        element.style.removeProperty("--oracle-viewport-height");
        element.style.removeProperty("--oracle-viewport-top");
        delete element.dataset.keyboardOpen;
        return;
      }
      const height = viewport?.height ?? window.innerHeight;
      if (Math.abs(window.innerWidth - previousWidth) > 40) fullHeight = height;
      previousWidth = window.innerWidth;
      fullHeight = Math.max(fullHeight, height);
      element.style.setProperty("--oracle-viewport-height", `${height}px`);
      element.style.setProperty("--oracle-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      element.dataset.keyboardOpen = String(
        document.activeElement?.tagName === "TEXTAREA" && fullHeight - height > 120
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    mobile.addEventListener("change", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      mobile.removeEventListener("change", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [ref]);
}
