export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// moves a sample value around its target, never below 20
export function nudge(target: number, spread: number, rand: number): number {
  const clamped = Math.min(Math.max(rand, 0), 1);
  return Math.max(20, Math.round(target + (clamped * 2 - 1) * spread));
}

// deterministic pseudo-random number in [0, 1) for a step and a lane
export function seeded(step: number, lane: number): number {
  const x = Math.sin(step * 12.9898 + lane * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// px and py are the pointer position inside the card, from 0 to 1
export function tiltAngles(px: number, py: number, max: number): { rx: number; ry: number } {
  const x = Math.min(Math.max(px, 0), 1);
  const y = Math.min(Math.max(py, 0), 1);
  return { rx: (0.5 - y) * 2 * max, ry: (x - 0.5) * 2 * max };
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
