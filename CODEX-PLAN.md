# VirtualFit v3 — Complete Rewrite Plan (Codex-driven)

## What is VirtualFit?
A virtual try-on web app where users can see how clothes look on them. Upload a photo, pick a garment, get an AI-generated try-on result.

## Current State (v2)
- Next.js app with Azure Static Web Apps hosting
- 950+ tests (many auto-generated, quality varies)
- Features built: cloth simulation, PBR fabrics, catalog, style-me, clip-recorder, mirror embed
- Problem: much of the code is over-engineered, test-heavy but feature-light, not production-ready

## Goal: Ship a WORKING v3
Build a clean, modern, production-ready virtual try-on website that:
1. Actually works end-to-end (upload photo → pick garment → see result)
2. Looks professional and polished
3. Is fast and mobile-friendly
4. Has a real try-on pipeline (even if using a hosted model API)
5. Deploys to Azure Static Web Apps

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Hosting:** Azure Static Web Apps (existing setup)
- **CI:** GitHub Actions (existing workflow)
- **Try-on API:** Use a hosted virtual try-on API (IDM-VTON, OOTDiffusion, or similar via Replicate/HuggingFace)

## Phases

### Phase 1: Clean Foundation
- Fresh Next.js app with Tailwind
- Landing page with hero, value prop, CTA
- Mobile-responsive layout
- Deploy pipeline working

### Phase 2: Core Try-On Flow
- Photo upload (webcam or file)
- Garment catalog (start with 10-20 sample garments)
- Try-on request → API call → result display
- Before/after comparison view

### Phase 3: Polish & Features
- User accounts (optional, can use localStorage)
- Try-on history
- Share results
- Performance optimization
- SEO basics

### Phase 4: Launch Ready
- Error handling & edge cases
- Loading states & skeleton UIs
- Analytics (Vercel Analytics or similar)
- OG images & social sharing
- Final QA pass

## Key Files from v2 to Reference (NOT copy blindly)
- `app/` — React components (over-engineered, cherry-pick good patterns)
- `api/` — Azure Functions backend
- `public/` — static assets, garment images
- `tests/` — test patterns (but rewrite tests for v3)
- `.github/workflows/deploy.yml` — CI/CD (keep and adapt)

## Rules for Codex
1. Write clean, simple code. No over-engineering.
2. Every feature must be visually testable — if you can't see it work, it's not done.
3. Mobile-first design. Test at 375px width.
4. Use real try-on API integration, not mocks.
5. Commit after each working feature.
6. Keep the repo deployable at all times — never break the deploy pipeline.
