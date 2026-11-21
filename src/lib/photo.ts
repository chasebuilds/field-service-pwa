const MAX_SIDE = 1280;

/** Fit width x height inside a max side, keeping aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));
}

/** Downscale a camera photo to max 1280px and re-encode as JPEG so local storage stays small. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvasToBlob(canvas, 'image/jpeg', 0.8);
}

/** Drawn stand-in image for demo data, so the demo needs no image files. */
export function makePlaceholderPhoto(label: string, variant: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const g = canvas.getContext('2d');
  if (!g) return Promise.reject(new Error('No canvas'));
  const hues = [['#6b7f8e', '#2f3d48'], ['#8a6447', '#3b2c22']] as const;
  const [a, b] = hues[variant % hues.length] ?? hues[0];
  const grad = g.createLinearGradient(0, 0, 640, 480);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.fillRect(0, 0, 640, 480);
  g.fillStyle = 'rgba(255,255,255,.14)';
  g.beginPath();
  g.roundRect(150, 120, 340, 240, 24);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.font = '600 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(label, 320, 250);
  g.font = '16px system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillText('demo photo', 320, 285);
  return canvasToBlob(canvas, 'image/jpeg', 0.8);
}
