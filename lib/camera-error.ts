/**
 * Translate getUserMedia / pose-tracker init errors into a short human reason
 * so we can show the user what went wrong instead of an opaque "Camera
 * unavailable" badge.
 */

export function describeCameraError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name?: unknown }).name;
    switch (name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera permission denied. Allow camera in your browser and retry.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No usable camera found.";
      case "NotReadableError":
      case "TrackStartError":
        return "Camera is busy in another app or tab.";
      case "AbortError":
        return "Camera request aborted.";
    }
  }
  if (error instanceof Error && error.message) {
    // Pose-tracker init or unknown native error
    return error.message.slice(0, 140);
  }
  return "Camera unavailable.";
}
