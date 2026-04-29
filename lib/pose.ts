import type { PoseLandmark } from "@/lib/armor";

const TASKS_VISION_VERSION = "0.10.34";
const VISION_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface PoseDetectionResult {
  landmarks: PoseLandmark[] | null;
}

export interface PoseTracker {
  detect(video: HTMLVideoElement, timestampMs: number): PoseDetectionResult;
  close(): void;
}

export async function createPoseTracker(): Promise<PoseTracker> {
  if (typeof window === "undefined") {
    throw new Error("Pose tracking must be initialized in the browser.");
  }

  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM_ROOT);
  const poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
      delegate: "GPU"
    },
    numPoses: 1,
    runningMode: "VIDEO"
  });

  return {
    detect(video, timestampMs) {
      const result = poseLandmarker.detectForVideo(video, timestampMs);

      return {
        landmarks: (result.landmarks[0] as PoseLandmark[] | undefined) ?? null
      };
    },
    close() {
      poseLandmarker.close();
    }
  };
}
