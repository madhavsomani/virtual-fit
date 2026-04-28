# VirtualFit

> Virtual try-on for the web — try on clothes using your camera, no app required.

> ⚠️ **Known issue (Phase 7.85, 2026-04-25):** `virtualfit.app` DNS points at AWS Global Accelerator IPs serving a stale legacy `/lander` redirect stub. The CI pipeline deploys to a different Azure SWA origin (the `*.<azure-static>.net` hostname returned by Azure's deploy step — see `gh run view` logs) where the real Next.js app is live and correct. End users hitting `virtualfit.app/mirror` see the stub, not the camera/3D try-on. Operator action required: repoint DNS to the SWA origin, or move the SWA token to whichever Azure resource `virtualfit.app` is bound to. Run `VFIT_PROD_HEALTHCHECK=1 npm test` to verify status. See `tests/prod-deploy-divergence.test.mjs`.

[![Tests](https://img.shields.io/badge/tests-952%20unit%20%2B%2013%20e2e-brightgreen)](https://github.com/madhavsomani/virtual-fit/actions)
[![Deploy](https://img.shields.io/badge/deploy-Azure%20SWA-blue)](https://virtualfit.app)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Live Demo

**[Try it now →](https://virtualfit.app)**

## Features

- 🧊 **3D Virtual Mirror** — Upload a garment photo → TRELLIS generates a GLB → Three.js overlays it on your body. MediaPipe Pose drives the overlay (rotation, position, scale). No 2D fallback.
- 📱 **Mobile Ready** — Works on phones and tablets
- 🏪 **Embeddable Widget** — One-line script for retailers
- 💳 **Stripe Integration** — Payment links for Creator/Retailer plans

## Quick Start

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing

```bash
# E2E tests (Playwright)
npm run test:e2e

# Unit tests
node --test tests/*.test.mjs

# All tests with timing
time npm run test:e2e && time node --test tests/*.test.mjs
```

See [TESTING.md](TESTING.md) for full test documentation.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **3D**: Three.js, GLTFLoader, MediaPipe Pose
- **Garment → GLB**: HuggingFace Spaces (TRELLIS), HF Inference (segformer) — no paid APIs
- **Payments**: Stripe Payment Links
- **Hosting**: Azure Static Web Apps
- **CI**: GitHub Actions

## Project Structure

```
app/
├── app/                 # Next.js app directory
│   ├── mirror/          # 3D virtual mirror (webcam + GLB overlay)
│   ├── generate-3d/     # Garment photo → 3D GLB pipeline
│   ├── pricing/         # Pricing plans
│   └── retailer/        # Retailer embed docs
├── e2e/                 # Playwright E2E tests
├── tests/               # Node.js unit tests
├── public/              # Static assets + embed.js
└── packages/embed/      # Standalone embed widget
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Write tests
4. Submit a PR

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Madhav Somani](https://github.com/madhavsomani)
