"use client";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";
import { DESTINATIONS } from "@/lib/destinations";

const CAIRO = DESTINATIONS[0].location;

// cobe's rotation angles that put a [lat, lng] in the middle of the globe
function toAngles([lat, lng]: [number, number]) {
  return { phi: Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), theta: (lat * Math.PI) / 180 };
}

/**
 * 3D WebGL globe (cobe, ~5 KB) with our 8 destinations and flight arcs from Cairo.
 * Drag to spin. Pass `focus={[lat, lng]}` to turn smoothly to a place. Respects "reduce motion".
 */
export function Globe({ focus = null, className = "" }: { focus?: [number, number] | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; phi: number } | null>(null);
  const target = useRef<{ phi: number; theta: number } | null>(null);

  useEffect(() => {
    target.current = focus ? toAngles(focus) : null;
  }, [focus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let phi = 4.2; // start with Africa, Europe and Asia in view
    let theta = 0.28;
    let size = canvas.offsetWidth;
    let frame = 0;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi,
      theta,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 16000,
      mapBrightness: 5,
      baseColor: [0.35, 0.33, 0.29],
      markerColor: [0.85, 0.7, 0.45],
      glowColor: [0.55, 0.5, 0.42],
      markers: DESTINATIONS.map((d) => ({ location: d.location, size: 0.06 })),
      arcs: DESTINATIONS.slice(1).map((d) => ({ from: CAIRO, to: d.location })),
      arcColor: [0.95, 0.85, 0.65],
      arcWidth: 0.6,
      arcHeight: 0.35,
      markerElevation: 0.02,
    });

    const onResize = () => {
      size = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);

    const tick = () => {
      const t = target.current;
      if (t && !drag.current) {
        // turn the shortest way round to the focused place
        const d = ((t.phi - phi + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        phi += d * (reduceMotion ? 1 : 0.06);
        theta += (t.theta * 0.6 - theta) * (reduceMotion ? 1 : 0.06);
      } else if (!drag.current && !reduceMotion) {
        phi += 0.0028;
        theta += (0.28 - theta) * 0.02;
      }
      globe.update({ phi, theta, width: size * dpr, height: size * dpr });
      frame = requestAnimationFrame(tick);
    };
    tick();
    canvas.style.opacity = "1";

    const onDown = (e: PointerEvent) => {
      drag.current = { x: e.clientX, phi };
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (drag.current) phi = drag.current.phi + (e.clientX - drag.current.x) / 180;
    };
    const onUp = () => {
      drag.current = null;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(frame);
      globe.destroy();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <canvas ref={canvasRef} aria-label="Globe showing our destinations"
        className="h-full w-full cursor-grab opacity-0 transition-opacity duration-1000" style={{ contain: "layout paint size" }} />
    </div>
  );
}
