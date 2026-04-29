/**
 * Reserved configuration for a future HuggingFace TRELLIS adapter.
 *
 * Approval is intentionally blocked in VF-9 because the Space integration
 * needs either `gradio-client` as a new dependency or a hand-rolled HTTP
 * client plus polling against the HuggingFace Space runtime.
 */
export interface TrellisAdapterConfig {
  spaceUrl: string;
  pollIntervalMs: number;
  maxWaitMs: number;
}

/**
 * Reserved adapter slot for future TRELLIS integration.
 *
 * VF-9 ships the pipeline contract only. Do not replace this throw with a
 * live HuggingFace call until dependency and operational approval is granted.
 */
export const trellisAdapter = {
  name: "trellis",
  async generate(_input: { garmentId: string; sourceImageUrl: string; outputAbsPath: string }) {
    throw new Error(
      "VF-9 reserved slot: TrellisAdapter requires gradio-client (new dep) or a hand-rolled HF client. Approval pending. Use stubAdapter for now."
    );
  }
};
