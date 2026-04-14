/** @typedef {"idle" | "requesting" | "live" | "error"} DemoStage */
/** @typedef {"permission-denied" | "not-found" | "not-readable" | "unsupported" | "unknown"} CameraErrorKind */

/**
 * @typedef {Object} PermissionState
 * @property {DemoStage} stage
 * @property {CameraErrorKind | null} cameraErrorKind
 * @property {string | null} cameraError
 * @property {number} retryCount
 */

/**
 * @typedef {Object} PermissionEventStart
 * @property {"request-start"} type
 */

/**
 * @typedef {Object} PermissionEventSuccess
 * @property {"request-success"} type
 */

/**
 * @typedef {Object} PermissionEventFailure
 * @property {"request-failure"} type
 * @property {CameraErrorKind} kind
 * @property {string} message
 */

/**
 * @typedef {Object} PermissionEventRetry
 * @property {"retry"} type
 */

/**
 * @typedef {Object} PermissionEventStop
 * @property {"stop"} type
 */

/** @typedef {PermissionEventStart | PermissionEventSuccess | PermissionEventFailure | PermissionEventRetry | PermissionEventStop} PermissionEvent */

/** @type {PermissionState} */
export const initialPermissionState = {
  stage: "idle",
  cameraErrorKind: null,
  cameraError: null,
  retryCount: 0
};

/**
 * @param {PermissionState} state
 * @param {PermissionEvent} event
 * @returns {PermissionState}
 */
export function reducePermissionState(state, event) {
  if (event.type === "request-start") {
    return {
      ...state,
      stage: "requesting",
      cameraErrorKind: null,
      cameraError: null
    };
  }

  if (event.type === "request-success") {
    return {
      ...state,
      stage: "live",
      cameraErrorKind: null,
      cameraError: null
    };
  }

  if (event.type === "request-failure") {
    return {
      ...state,
      stage: "error",
      cameraErrorKind: event.kind,
      cameraError: event.message
    };
  }

  if (event.type === "retry") {
    return {
      ...state,
      stage: "requesting",
      retryCount: state.retryCount + 1,
      cameraErrorKind: null,
      cameraError: null
    };
  }

  if (event.type === "stop") {
    return {
      ...state,
      stage: "idle",
      cameraErrorKind: null,
      cameraError: null
    };
  }

  return state;
}

/**
 * @param {unknown} error
 * @returns {{ kind: CameraErrorKind, message: string }}
 */
export function classifyCameraError(error) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return {
        kind: "permission-denied",
        message: "Camera permission denied. Allow camera access in browser settings and retry."
      };
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return {
        kind: "not-found",
        message: "No camera device found. Connect a camera or switch devices and retry."
      };
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return {
        kind: "not-readable",
        message: "Camera is busy or unavailable. Close other apps using it and retry."
      };
    }
  }

  if (error instanceof Error) {
    return { kind: "unknown", message: error.message };
  }

  return { kind: "unknown", message: "Camera permission failed." };
}
