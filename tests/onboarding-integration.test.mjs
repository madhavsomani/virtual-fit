import test from "node:test";
import assert from "node:assert/strict";

import { deriveOnboardingUiState } from "../app/mirror/onboarding-ui-state.js";

test("onboarding integration: idle default shows no retry/exit/reopen", () => {
  const state = deriveOnboardingUiState({
    stage: "idle",
    cameraErrorKind: null,
    hasLiveCamera: false,
    hasExitedFlow: false,
    restoredSessionAvailable: false,
    showOnboardingOverlay: true
  });

  assert.equal(state.showRetryAction, false);
  assert.equal(state.showExitAction, false);
  assert.equal(state.showReopenAction, false);
  assert.equal(state.showResumePreviousSessionAction, false);
});

test("onboarding integration: permission-denied error exposes retry + permission help + exit", () => {
  const state = deriveOnboardingUiState({
    stage: "error",
    cameraErrorKind: "permission-denied",
    hasLiveCamera: false,
    hasExitedFlow: false,
    restoredSessionAvailable: false,
    showOnboardingOverlay: true
  });

  assert.equal(state.showRetryAction, true);
  assert.equal(state.showPermissionHelp, true);
  assert.equal(state.showUnsupportedHelp, false);
  assert.equal(state.showExitAction, true);
});

test("onboarding integration: unsupported error exposes unsupported help", () => {
  const state = deriveOnboardingUiState({
    stage: "error",
    cameraErrorKind: "unsupported",
    hasLiveCamera: false,
    hasExitedFlow: false,
    restoredSessionAvailable: false,
    showOnboardingOverlay: true
  });

  assert.equal(state.showRetryAction, true);
  assert.equal(state.showPermissionHelp, false);
  assert.equal(state.showUnsupportedHelp, true);
});

test("onboarding integration: exited idle enables reopen button", () => {
  const state = deriveOnboardingUiState({
    stage: "idle",
    cameraErrorKind: null,
    hasLiveCamera: false,
    hasExitedFlow: true,
    restoredSessionAvailable: false,
    showOnboardingOverlay: false
  });

  assert.equal(state.showReopenAction, true);
  assert.equal(state.showExitAction, false);
});

test("onboarding integration: restored session enables resume action", () => {
  const state = deriveOnboardingUiState({
    stage: "idle",
    cameraErrorKind: null,
    hasLiveCamera: false,
    hasExitedFlow: false,
    restoredSessionAvailable: true,
    showOnboardingOverlay: false
  });

  assert.equal(state.showResumePreviousSessionAction, true);
});

test("onboarding integration: live camera and hidden onboarding shows tips toggle + exit", () => {
  const state = deriveOnboardingUiState({
    stage: "live",
    cameraErrorKind: null,
    hasLiveCamera: true,
    hasExitedFlow: false,
    restoredSessionAvailable: false,
    showOnboardingOverlay: false
  });

  assert.equal(state.showOnboardingTipsToggle, true);
  assert.equal(state.showExitAction, true);
});
