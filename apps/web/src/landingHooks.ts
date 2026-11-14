import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, tiltAngles } from "./landingMotion";

// Becomes true once the element scrolls into view (immediately if motion is reduced).
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// Tilts an element towards the mouse. Only for fine pointers and normal motion settings.
export function useTilt<T extends HTMLElement>(maxDegrees = 6) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const { rx, ry } = tiltAngles(
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
        maxDegrees
      );
      element.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };
    const onLeave = () => {
      element.style.transform = "";
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      element.style.transform = "";
    };
  }, [maxDegrees]);

  return ref;
}
