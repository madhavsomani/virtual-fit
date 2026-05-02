/**
 * Camera option overrides for preferred capture resolution.
 */
export type CameraConstraintOptions = {
  width?: number;
  height?: number;
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

const CAMERA_ERROR_MESSAGES = {
  NotAllowedError:
    "Camera permission denied. Click the lock icon in your browser address bar to allow VirtualFit to use your camera.",
  NotFoundError: "No camera detected. Plug in a webcam or try a device with a built-in camera.",
  NotReadableError:
    "Camera is in use by another app. Close other tabs/apps using the camera and try again.",
  OverconstrainedError: "Your camera does not support the requested 1280×720 resolution. Try a different device."
} as const;

function assertPositiveFiniteNumber(value: number, label: "width" | "height") {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
}

/**
 * Builds SSR-safe webcam constraints for a front-facing camera request.
 *
 * @param opts Optional width and height overrides.
 * @returns Media stream constraints with audio disabled.
 * @throws {RangeError} If width or height is not a positive finite number.
 */
export function getCameraConstraints(opts: CameraConstraintOptions = {}): MediaStreamConstraints {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;

  assertPositiveFiniteNumber(width, "width");
  assertPositiveFiniteNumber(height, "height");

  return {
    video: {
      facingMode: "user",
      width: { ideal: width },
      height: { ideal: height }
    },
    audio: false
  };
}

/**
 * Maps webcam startup failures to stable UI copy.
 *
 * @param err Unknown thrown value from camera setup.
 * @returns Normalized error code and human-readable message.
 */
export function mapCameraError(err: unknown): { code: string; message: string } {
  if (!err || typeof err !== "object") {
    return { code: "unknown", message: "Camera could not start." };
  }

  const maybeError = err as { name?: unknown; message?: unknown };
  const name = typeof maybeError.name === "string" ? maybeError.name : "unknown";

  if (name in CAMERA_ERROR_MESSAGES) {
    return {
      code: name,
      message: CAMERA_ERROR_MESSAGES[name as keyof typeof CAMERA_ERROR_MESSAGES]
    };
  }

  if (typeof maybeError.message === "string" && maybeError.message.length > 0) {
    return {
      code: name,
      message: `Camera could not start: ${maybeError.message}`
    };
  }

  return { code: name, message: "Camera could not start." };
}

/**
 * Stops every track on a media stream and swallows malformed stream failures.
 *
 * @param stream Media stream to stop.
 */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream || typeof stream !== "object" || !("getTracks" in stream) || typeof stream.getTracks !== "function") {
    return;
  }

  try {
    for (const track of stream.getTracks()) {
      if (track && typeof track.stop === "function") {
        track.stop();
      }
    }
  } catch {
    // Ignore malformed stream implementations during cleanup.
  }
}
