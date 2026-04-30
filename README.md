# VirtualFit v3 — VF-12 prototype

Real 3D objects anchored to the body via webcam + MediaPipe Pose +
Three.js. Iron-Man-style chest plate, helmet, and forearm/upper-arm
cuffs — six independent body-anchored 3D meshes that track position,
scale, and rotation in real time. **Not** a 2D sticker, **not** a
flat shirt overlay.

> Branch: `ca1/VF-12-armor-prototype` · Linear: `VF-12` (In Review)

## Quickstart (local demo)

```bash
cd /Users/madhav/.openclaw/workspace/projects/virtual-tryon-v2/_worktrees/v3-vf12
pnpm install   # only first time
pnpm dev
```

Then open <http://localhost:3000/tryon> and grant camera access.

Stand back so your shoulders, hips, and arms are in frame. The armor
fades in once a stable lock is achieved.

## What's anchored

| Anchor      | Source                            | Mesh                          |
|-------------|-----------------------------------|-------------------------------|
| Chest       | `lib/armor.ts`                    | red plate + sternum + arc reactor |
| Helmet      | `lib/helmet.ts`  (nose+ears)      | sphere + jaw + gold visor     |
| L/R bicep   | `lib/bicep.ts`   (shoulder→elbow) | tapered cuff + gold band      |
| L/R gauntlet| `lib/gauntlet.ts`(elbow→wrist)    | tapered cuff + gold band      |

All transforms are pure functions (deterministic, clock-free) and
covered by unit tests in `tests/`. Renderer (`app/tryon/Tryon.tsx`)
owns one `Three.Group` per anchor with its own smoother and opacity
ease — a missed landmark fades that piece out without affecting the
others.

## On-screen affordances

- **HUD (top-right)** — fps · confidence · phase, throttled to 4 Hz.
- **Snapshot (bottom-right)** — composites webcam + GL canvas to PNG
  and downloads it as `virtualfit-YYYYMMDD-HHMMSS.png`.
- **Landmarks: on/off (bottom-left)** — toggleable green skeleton
  proving the app reads real body landmarks.
- **Camera-error overlay** — friendly DOMException message + Retry
  button when getUserMedia fails.

## Tests

```bash
pnpm test     # 55/55 pass, ~310 ms
pnpm build    # /tryon ≈ 148 kB, shared 87.3 kB
```

## Known blocker — occlusion / depth (filed separately as VF-13)

The 3D objects render *in front of* the webcam frame; arms passing
behind the torso still show the chest plate on top. Three options
under review by Madhav:

1. BlazePose-3D + manual depth-sort
2. ARKit / WebXR front-camera depth (iOS-only)
3. MediaPipe Selfie Segmentation as a depth mask

Documented at the top of `app/tryon/Tryon.tsx`.

## File map

```
app/tryon/Tryon.tsx     # Main renderer — owns scene, anchors, UI
lib/armor.ts            # chest transform from shoulders+hips
lib/helmet.ts           # helmet transform from nose+ears
lib/bicep.ts            # upper-arm transform from shoulder→elbow
lib/gauntlet.ts         # forearm transform from elbow→wrist
lib/smooth.ts           # exponential transform smoother
lib/tracking-gate.ts    # asymmetric hysteresis (lock 3, unlock 5)
lib/landmark-overlay.ts # debug skeleton point/edge data
lib/snapshot.ts         # composite PNG capture + download
lib/camera-error.ts     # DOMException → friendly message
lib/pose.ts             # MediaPipe Tasks-Vision wrapper
tests/                  # node:test unit tests
```

## Stack

- Next.js 14.2 / React 18.3 (app router)
- `@mediapipe/tasks-vision` 0.10.34
- `three` 0.183.2
- TypeScript, pnpm, Node 22
