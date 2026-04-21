# VirtualFit

> Virtual try-on for the web — try on clothes using your camera, no app required.

[![Tests](https://img.shields.io/badge/tests-47%20e2e%20%2B%20111%20unit-brightgreen)](https://github.com/madhavsomani/virtual-fit/actions)
[![Deploy](https://img.shields.io/badge/deploy-Azure%20SWA-blue)](https://wonderful-sky-0513a3610.7.azurestaticapps.net)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Live Demo

**[Try it now →](https://wonderful-sky-0513a3610.7.azurestaticapps.net)**

## Features

- 🪞 **2D Mirror Mode** — Real-time body tracking with MediaPipe Pose
- 🧊 **3D Try-On** — Upload clothing images, generate 3D meshes with Three.js
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
- **3D**: Three.js, GLTFLoader
- **Body Tracking**: MediaPipe Pose
- **Payments**: Stripe Payment Links
- **Hosting**: Azure Static Web Apps
- **CI**: GitHub Actions

## Project Structure

```
app/
├── app/                 # Next.js app directory
│   ├── mirror/          # 2D/3D try-on page
│   ├── generate-3d/     # 3D garment generation
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
