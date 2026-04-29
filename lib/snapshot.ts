/**
 * Compose a single PNG snapshot from the webcam video + the WebGL armor
 * canvas. Used by the "Snapshot" button in Tryon.
 *
 * We can't just call `renderer.domElement.toDataURL()` because that gives us
 * only the 3D layer on a transparent background — the webcam video is a
 * separate <video> element behind it. Instead we draw the video first onto
 * an offscreen canvas, then draw the WebGL canvas on top, then export.
 *
 * Returns a Blob (PNG). Caller is responsible for download / sharing.
 *
 * Pure-ish: requires DOM canvas APIs. Tested under jsdom in Node.
 */

export interface SnapshotInputs {
  video: HTMLVideoElement;
  glCanvas: HTMLCanvasElement;
  /** When true, mirror the X axis to match the on-screen mirrored preview. */
  mirrorX?: boolean;
}

export async function captureSnapshot(
  inputs: SnapshotInputs,
  documentRef: Document = typeof document !== "undefined" ? document : (undefined as unknown as Document)
): Promise<Blob> {
  const { video, glCanvas, mirrorX = true } = inputs;
  const width = video.videoWidth || glCanvas.width;
  const height = video.videoHeight || glCanvas.height;
  if (!width || !height) {
    throw new Error("Video not ready for snapshot");
  }
  if (!documentRef) {
    throw new Error("No document available for snapshot canvas");
  }

  const composite = documentRef.createElement("canvas");
  composite.width = width;
  composite.height = height;
  const ctx = composite.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  ctx.save();
  if (mirrorX) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  // Draw the GL canvas at native size, scaled to match the video frame.
  ctx.drawImage(glCanvas, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    composite.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode snapshot PNG"));
    }, "image/png");
  });
}

/** Trigger a browser download for a Blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Stable filename helper: virtualfit-YYYYMMDD-HHMMSS.png */
export function snapshotFilename(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `virtualfit-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}
