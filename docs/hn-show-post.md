# Hacker News Show Post — VirtualFit

## Version 1 (Technical Focus)

**Title:** Show HN: VirtualFit – Real-time 3D garment try-on in browser (Three.js + MediaPipe)

**Body:**
I built a virtual try-on mirror that overlays 3D clothing on your body in real-time using just a webcam.

**Live demo:** https://wonderful-sky-0513a3610.7.azurestaticapps.net/mirror-3d

**How it works:**
- MediaPipe Pose detects 33 body landmarks at 30fps
- Three.js renders .glb meshes with transparent background
- Custom smoothing (lerp/slerp) keeps the garment stable
- Upload any garment image → HuggingFace API converts to 3D → try it on

**Stack:** Next.js 14, Three.js, MediaPipe Tasks Vision, Tailwind, Azure Static Web Apps

No app install. No AR glasses. Works on any laptop/phone with a camera.

The 2D version (/mirror) has been surprisingly stable for gesture detection—swipe to change garments, shake phone to cycle. Would love feedback on the 3D anchoring; it's tricky getting shoulder width scaling right across different body types.

Source is closed for now but considering open-sourcing the embeddable widget for retailers.

---

## Version 2 (Product/Problem Focus)

**Title:** Show HN: VirtualFit – Try on clothes from any online store without leaving your browser

**Body:**
Online shopping has a 30% return rate, mostly because clothes don't fit or look different than expected. I built VirtualFit to fix that.

**Try it:** https://wonderful-sky-0513a3610.7.azurestaticapps.net

Point your webcam at yourself, pick a garment, and see it overlaid on your body in real-time. The 3D version even tracks your movements.

**What's different:**
- Runs entirely in-browser (no app download)
- Works on mobile and desktop
- Retailers can embed it with one line of code
- Upload your own clothing photos and convert them to 3D

Built this over a weekend using Three.js for 3D rendering and MediaPipe for body tracking. The image-to-3D conversion uses HuggingFace's inference API.

Currently free to try. Looking for feedback from anyone who's tried virtual try-on before—does this feel more natural than existing solutions?

---

## Version 3 (Show-Don't-Tell)

**Title:** Show HN: I made a virtual fitting room that works in your browser

**Body:**
**Demo:** https://wonderful-sky-0513a3610.7.azurestaticapps.net/mirror-3d

- Open the link
- Allow camera access
- Wave your arms around

The 3D garment follows your body position in real-time. Swipe left/right or use arrow keys to change models.

**Tech:** Next.js + Three.js + MediaPipe Pose + HuggingFace TripoSR for image→3D

I'm working on an embeddable version for e-commerce sites. The idea is: click "Try On" on any product page → instantly see it on yourself.

Would appreciate feedback on:
1. Latency/smoothness on your device
2. How well the garment "sticks" to your body
3. Whether you'd actually use this before buying clothes online

This is a solo side project, not a startup (yet). Happy to answer technical questions.

---

## Posting Notes for Madhav

**Best times to post:**
- 9-10 AM ET (6-7 AM PT) — catches morning US + afternoon EU
- Tuesday-Thursday typically best

**Things to prep before posting:**
- Have the demo running on your phone to check it's responsive
- Screenshot or screen-record a GIF of yourself using it (HN loves seeing the maker)
- Be ready to answer in first 2 hours (HN rewards early engagement)

**Likely questions to prep answers for:**
- "How does this compare to [Zara/Amazon try-on]?" → Browser-only, no app
- "What about different body types?" → MediaPipe handles diverse poses; scaling is based on detected shoulder width
- "Privacy concerns?" → All processing is client-side, no video leaves browser
- "Open source?" → Considering open-sourcing the embed widget
