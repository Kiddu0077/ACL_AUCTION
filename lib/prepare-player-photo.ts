/** Decode before uploading so corrupt/unsupported images cannot become broken
 * player photos. Bound dimensions and encode JPEG to keep auction images small. */
export async function preparePlayerPhoto(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The photo took too long to open. Please choose a smaller JPG, PNG or WebP image.")), 15_000);
      image.onload = () => { window.clearTimeout(timeout); resolve(); };
      image.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("This photo could not be opened. Please export it as JPG, PNG or WebP and try again."));
      };
      image.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the photo. Please try another browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Could not prepare the photo. Please choose another image.");
    // Already-small supported images need no additional compression.
    if (scale === 1 && file.type !== "image/heic" && file.size <= blob.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
