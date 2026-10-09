"use client";

import { useState } from "react";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return <div className="gallery-main"><span className="no-photo">Немає фото</span></div>;
  }
  return (
    <div className="gallery">
      <div className="gallery-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={name} />
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((src, n) => (
            <button key={src} type="button" className={n === i ? "active" : undefined} onClick={() => setI(n)} aria-label={`Фото ${n + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
