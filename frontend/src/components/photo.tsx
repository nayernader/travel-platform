"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * A cover photo that fills its parent. If the file is missing, a gradient is shown instead.
 * The parent needs `relative` and a height.
 */
export function Photo({ src, alt, gradient = "from-slate-700 to-slate-900", priority, className = "" }: {
  src: string;
  alt: string;
  gradient?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`absolute inset-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
      {!failed && (
        <Image src={src} alt={alt} fill priority={priority} sizes="100vw" onError={() => setFailed(true)}
          className={`object-cover ${className}`} />
      )}
    </div>
  );
}
