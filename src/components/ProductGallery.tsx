"use client";

import { useState } from "react";
import { thumb } from "@/lib/image";
import SmartImage from "./SmartImage";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return <div className="gallery-main"><span className="no-photo">Немає фото</span></div>;
  }
  return (
    <div className="gallery">
      <div className="gallery-main">
        <SmartImage key={images[i]} src={thumb(images[i], 640)} fallback={images[i]} alt={name} loading="eager" />
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((src, n) => (
            <button key={src} type="button" className={n === i ? "active" : undefined} onClick={() => setI(n)} aria-label={`Фото ${n + 1}`}>
              <SmartImage src={thumb(src, 120)} fallback={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
