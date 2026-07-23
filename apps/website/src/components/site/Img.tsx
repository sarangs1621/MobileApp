"use client";

import React from "react";

interface ImgProps {
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  /** CSS background applied as a full-bleed overlay (photo-protection scrim). */
  overlay?: string;
}

/**
 * Resilient image with a graceful maroon crest fallback — school photography
 * is hotlinked from the live site, so any missing image degrades to brand.
 */
export function Img({ src, alt = "", style, className, overlay }: ImgProps) {
  const [err, setErr] = React.useState(false);
  if (err || !src) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: "linear-gradient(135deg, var(--maroon-600), var(--maroon-900))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img src="/assets/crest-cream.png" alt="" style={{ height: "44%", opacity: 0.32 }} />
      </div>
    );
  }
  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
      <img
        src={src}
        alt={alt}
        onError={() => setErr(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {overlay && <div style={{ position: "absolute", inset: 0, background: overlay }} />}
    </div>
  );
}
