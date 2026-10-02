// Resize a photo in the browser before upload, so we store ~30 KB instead of 5 MB.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image we can read. Try a JPEG or PNG."));
    };
    img.src = url;
  });
}

/** Square crop from the center, resized to `size` px, as a JPEG data URL. */
function square(img, size, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", quality);
}

// iPhones save photos as HEIC, which most browsers (and canvas) can't read
function checkFile(file) {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    throw new Error("iPhone HEIC photos aren't supported. Choose \"Most Compatible\" in Camera settings, or share the photo as JPEG.");
  }
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
}

export async function makeAvatar(file) {
  checkFile(file);
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB.");
  const img = await loadImage(file);
  return { avatar: square(img, 256, 0.82), avatarThumb: square(img, 64, 0.75) };
}

/**
 * Trip cover: keep the whole photo (no crop), at most 1600px wide, as a JPEG Blob.
 * A 5 MB phone photo becomes roughly 200-400 KB.
 */
export async function makeCover(file) {
  checkFile(file);
  if (file.size > 25 * 1024 * 1024) throw new Error("That image is over 25 MB.");
  const img = await loadImage(file);
  if (img.naturalWidth < 400 || img.naturalHeight < 200) throw new Error("That photo is too small for a cover. Try one at least 400 px wide.");
  const scale = Math.min(1, 1600 / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.85)
  );
}
