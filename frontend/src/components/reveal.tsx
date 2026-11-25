"use client";

import { useEffect, useRef } from "react";

/** Fades and slides its content in when it scrolls into view. */
export function Reveal({ delay = 0, className = "", children }: { delay?: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.shown = "true";
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`translate-y-8 opacity-0 transition duration-1000 ease-out data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100 ${className}`}>
      {children}
    </div>
  );
}
