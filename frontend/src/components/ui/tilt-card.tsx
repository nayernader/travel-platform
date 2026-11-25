"use client";

import { useRef } from "react";

/**
 * A card that tilts in 3D toward the mouse, with a soft light reflection.
 *   <TiltCard className="h-72">...</TiltCard>
 * No re-renders: it only updates CSS on the element. Turned off for "reduce motion".
 */
export function TiltCard({ className = "", max = 10, children }: { className?: string; max?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
    el.style.setProperty("--glare-x", `${x * 100}%`);
    el.style.setProperty("--glare-y", `${y * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave}
      className={`group relative overflow-hidden rounded-2xl transition-transform duration-200 ease-out will-change-transform [transform-style:preserve-3d] ${className}`}>
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(500px circle at var(--glare-x, 50%) var(--glare-y, 50%), rgb(255 255 255 / 0.25), transparent 45%)" }} />
    </div>
  );
}
