# Phase 8.2 — Cloth-Sim Feasibility Spike (DECISION)

**Date:** 2026-04-28
**Decision:** Custom Verlet (Provot/Jakobsen) in pure JS, zero new deps.
**Implementation:** [`app/mirror/cloth-sim.js`](./mirror/cloth-sim.js) — 130 LOC.
**Status:** Spike-quality. Sufficient for P8.3 mesh-pipeline integration; refinements (collision, tearing, anisotropy) deferred.

---

## Candidates Evaluated

| Candidate            | Maintained?    | Bundle adds | Has cloth?         | Verdict   |
| -------------------- | -------------- | ----------- | ------------------ | --------- |
| **three-cloth**      | n/a (pattern, not pkg) | 0 KB         | re-implement (this) | ✅ pick   |
| `@babylonjs/core`    | active (v9.4.1, 2026) | **+62 MB unpacked**, ~600 KB gz minified subset | yes (PhysicsImpostor) | ❌ bandwidth bomb |
| `cannon-es`          | **stale since 2022-08** | +774 KB     | NO native cloth (rigid + soft constraints only) | ❌ unmaintained + missing core feature |
| `ammo.js`            | abandoned (~10 versions ever) | +3-4 MB     | yes (btSoftBody)   | ❌ abandoned |
| `physx-js-webidl`    | active         | +10 MB      | yes (PhysX cloth)  | ❌ overkill (physics for full game), too heavy for try-on |
| `@react-three/cannon`| extension      | +1.7 MB     | inherits cannon-es (no cloth) | ❌ no cloth |

## Why Custom Verlet Wins

1. **Zero new deps.** App bundle is currently 307 KB First Load JS for `/mirror`. Babylon is +600 KB gzipped *minimum*; PhysX is +10 MB. Neither survives the "free tier + iframe-embed-friendly" product constraint.
2. **No HARD-RULE conflict.** Pure-JS Verlet has no API key, no Tailscale URL, no paid tier — same posture as the rest of Phase 7.
3. **Maintained = us.** cannon-es has been stale for 4+ years. Owning ~130 LOC of Verlet is cheaper than depending on a dead package.
4. **Perf headroom.** 12×16 cloth (192 particles, ~750 constraints, 4 iters/step) → **4.4ms for 60 steps in Node single-thread** (`tests/cloth-sim.test.mjs` perf budget). Browser with V8 + JIT typically beats Node by 1.5-2× → comfortably under 1ms/frame on M1, leaving 15ms/frame for MediaPipe + render.
5. **Deterministic + testable.** No GPU compute required; entire sim runs in plain `for` loops over flat arrays. 10 contract tests cover algebra, gravity, anchor coupling, and perf budget.

## API Surface (already shipped)

```js
import { createClothMesh, stepCloth, setAnchor } from "./cloth-sim.js";

const cloth = createClothMesh({ width: 12, height: 16, spacing: 0.04, bend: true });
//             → { particles[192], constraints[~750], width, height, spacing }

setAnchor(cloth, 0, shoulderL.x, shoulderL.y, shoulderL.z);  // drive from MediaPipe
setAnchor(cloth, 11, shoulderR.x, shoulderR.y, shoulderR.z);

stepCloth(cloth, { dt: 1 / 60, gravity: -9.81, iterations: 4 });
//             → mutates cloth.particles in place
```

Particle layout: row 0 is pinned (default), drives top edge from anchors. Constraints: structural (4-neighbour), shear (diagonal), optional bend (skip-1 for fold stiffness).

## Tradeoffs / Known Limits

- **No self-collision.** A sleeve passing through the chest will clip. Acceptable for v1; ZERO10 also has visible self-clip on edge cases.
- **No body collision.** Cloth doesn't currently collide with the body mesh — it dangles from shoulder anchors. P8.3 will add a sphere-collider list (head, torso) for cheap occlusion-free collision.
- **No anisotropy.** Real fabric is stiffer along weave; Verlet treats all springs equally. Visually fine for casual wear (T-shirts/tanks); poor for stiff materials (denim) — defer to a P8 later commit.
- **Single-threaded.** Worker-offload is straightforward (transferable Float32Array buffers) but not needed at current particle count.

## Wiring Path (for P8.3)

1. P8.3 will replace the static GLB-overlay path in `mirror/page.tsx` with a `BufferGeometry` whose `position` attribute points at a `Float32Array` view of the cloth particle array (Verlet writes directly into geometry → zero copy).
2. Anchor count will be 2 (left+right shoulder) initially; later expand to 4 (shoulders + hips) for hem control once P8.4 lands.
3. Texture stays from TRELLIS GLB output; UVs come from the cloth grid (procedural).

## Test Evidence

```
tests/cloth-sim.test.mjs · 10/10 pass
- particle layout
- structural + shear constraint count (38+30 = 68 for 4×6)
- bend springs add expected (W-2)*H + W*(H-2)
- rest length == initial distance (at-rest at t=0)
- pinned particles never move under gravity
- unpinned particles fall under gravity
- 12×16 mesh + 4 iter doesn't explode after 2 simulated seconds
- setAnchor only moves pinned particles + zeroes velocity
- perf budget: 60 steps · 192 particles · 4 iter · 4.4ms in Node
- anchor drag: moving the top row pulls bottom row with it
```

## Conclusion

Cloth sim is **feasible, cheap, and ships in P8.2**. P8.3 (mesh-pipeline integration) is unblocked.
