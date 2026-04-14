/** @typedef {"idle" | "requesting" | "live" | "error"} DemoStage */
/** @typedef {"permission-denied" | "not-found" | "not-readable" | "unsupported" | "unknown" | null} CameraErrorKind */

/**
 * @typedef {Object} OnboardingUiInput
 * @property {DemoStage} stage
 * @property {CameraErrorKind} cameraErrorKind
 * @property {boolean} hasLiveCamera
 * @property {boolean} hasExitedFlow
 * @property {boolean} restoredSessionAvailable
 * @property {boolean} showOnboardingOverlay
 */

/**
 * @typedef {Object} OnboardingUiState
 * @property {boolean} showRetryAction
 * @property {boolean} showPermissionHelp
 * @property {boolean} showUnsupportedHelp
 * @property {boolean} showExitAction
 * @property {boolean} showReopenAction
 * @property {boolean} showResumePreviousSessionAction
 * @property {boolean} showOnboardingTipsToggle
 */

/**
 * @param {OnboardingUiInput} input
 * @returns {OnboardingUiState}
 */
export function deriveOnboardingUiState(input) {
  const showRetryAction = input.stage === "error";
  const showPermissionHelp = input.stage === "error" && input.cameraErrorKind === "permission-denied";
  const showUnsupportedHelp = input.stage === "error" && input.cameraErrorKind === "unsupported";

  return {
    showRetryAction,
    showPermissionHelp,
    showUnsupportedHelp,
    showExitAction: input.hasLiveCamera || input.stage === "error",
    showReopenAction: input.hasExitedFlow && input.stage === "idle",
    showResumePreviousSessionAction: input.restoredSessionAvailable && !input.hasLiveCamera,
    showOnboardingTipsToggle: input.hasLiveCamera && !input.showOnboardingOverlay
  };
}
