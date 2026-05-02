type StatusInput = {
  isStarting: boolean;
  isActive: boolean;
  error: unknown;
};

type StatusChip = {
  label: "Idle" | "Connecting" | "Live" | "Error";
  tone: "slate" | "amber" | "emerald" | "rose";
};

type CaptureInput = {
  isActive: boolean;
  error?: unknown;
};

export function getStatusChip(state: StatusInput): StatusChip {
  if (state.error) {
    return { label: "Error", tone: "rose" };
  }

  if (state.isStarting) {
    return { label: "Connecting", tone: "amber" };
  }

  if (state.isActive) {
    return { label: "Live", tone: "emerald" };
  }

  return { label: "Idle", tone: "slate" };
}

export function canCapture(state: CaptureInput): boolean {
  return state.isActive && !state.error;
}
