/** Square, letterboxed JPEGs display consistently in PowerPoint, including
 * photos originally uploaded as WebP or browser-supported HEIC. */
export async function prepareExportPhoto(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Photo decoding timed out")), 10_000);
      image.onload = () => { window.clearTimeout(timeout); resolve(); };
      image.onerror = () => { window.clearTimeout(timeout); reject(new Error("Photo could not be decoded")); };
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Photo has no dimensions");
    const edge = Math.min(1200, Math.max(image.naturalWidth, image.naturalHeight));
    const scale = edge / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo preparation is unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, edge, edge);
    context.drawImage(image, (edge - width) / 2, (edge - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
