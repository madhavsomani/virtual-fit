# Reddit Launch Posts — VirtualFit

## Posting Schedule
**Best time:** 9-10 AM ET (6-7 AM PT) on Tuesday-Wednesday
**Reason:** Max US reach, avoids weekend dead zone

---

## r/SideProject

### Title
I built a virtual fitting room that runs in your browser — no app needed

### Body
Hey r/SideProject!

After getting annoyed by online shopping returns, I spent a weekend building VirtualFit — a virtual try-on that works entirely in your browser.

**What it does:**
- Point your webcam at yourself
- Pick a garment from the library (or upload your own)
- See it overlaid on your body in real-time

**Live demo:** https://wonderful-sky-0513a3610.7.azurestaticapps.net/mirror

**Tech stack:**
- Next.js 14 (static export)
- Three.js for 3D rendering
- MediaPipe Pose for body tracking
- HuggingFace API for image-to-3D conversion
- Azure Static Web Apps

The whole thing runs client-side — your video never leaves your browser.

I'm considering adding an embeddable widget so retailers can add try-on to their stores. Would that be useful?

Would love feedback on:
1. How smooth is it on your device?
2. Does the garment "stick" to your body well?
3. Would you actually use this before buying clothes?

Thanks for checking it out! Happy to answer any technical questions.

### Follow-up Comment (post 5 min after)
Some technical details for anyone curious:

The hardest part was getting the 3D garment to feel "attached" to your body. MediaPipe gives you 33 landmark points, but they're noisy frame-to-frame.

I built a smoothing layer with exponential moving average for position and spherical interpolation (slerp) for rotation. It adds ~2 frames of latency but makes the garment much more stable.

The image-to-3D conversion uses HuggingFace's TripoSR model via their inference API. Takes about 30-60 seconds per image.

---

## r/InternetIsBeautiful

### Title
Virtual fitting room that works in your browser — try on 3D clothes with your webcam

### Body
https://wonderful-sky-0513a3610.7.azurestaticapps.net/mirror

Open the link, allow camera access, and you can try on 3D garments in real-time.

- Swipe left/right to change garments
- Use arrow keys on desktop
- Shake your phone to cycle through options

No account needed, no app download. Works on mobile too.

Built with Three.js + MediaPipe + Next.js.

### Follow-up Comment (post 5 min after)
The tech behind this:

Your webcam feed is processed by MediaPipe Pose to detect 33 body landmarks (shoulders, hips, etc). Then Three.js renders a 3D garment mesh and positions it based on where your body is.

All processing happens in your browser — nothing is uploaded anywhere.

There's also an upload feature where you can convert any clothing photo to 3D: [link]/generate-3d

---

## r/webdev

### Title
Built a real-time 3D try-on with Three.js + MediaPipe — seeking feedback on the tech

### Body
Hey r/webdev,

I built a virtual try-on that overlays 3D clothing on your body using just a webcam. Looking for feedback on the implementation.

**Demo:** https://wonderful-sky-0513a3610.7.azurestaticapps.net/mirror

**Stack:**
- Next.js 14 with static export (`output: 'export'`)
- Three.js for WebGL rendering
- MediaPipe Tasks Vision (Pose Landmarker)
- HuggingFace Inference API for image→3D (TripoSR)
- Azure Static Web Apps

**Challenges I'd love input on:**

1. **Smoothing jittery pose data** — I'm using EMA for position and slerp for rotation. Works okay but there's still some jitter on fast movements. Anyone have experience with Kalman filters in JS?

2. **Scaling 3D models to body size** — Currently using shoulder width from landmarks. But different garment meshes have different scales/origins. Is there a standard way to normalize .glb models for body overlay?

3. **Mobile performance** — It runs at ~20fps on my iPhone 14. Wondering if there are optimizations I'm missing (I'm already using low-res pose detection and capped texture sizes).

Source isn't public yet but happy to share code snippets for specific parts.

### Follow-up Comment (post 5 min after)
For those interested in the smoothing implementation:

```javascript
// Position smoothing (EMA)
const alpha = 0.3;
smoothedPosition.lerp(rawPosition, alpha);

// Rotation smoothing (slerp)
smoothedRotation.slerp(rawRotation, alpha);
```

The tricky part is choosing alpha. Too low = laggy. Too high = jittery. I landed on 0.3 for desktop and 0.4 for mobile (more responsive since mobile users expect touch-like feedback).

Also considering switching to a proper Kalman filter but haven't found a good lightweight JS implementation.

---

## Cross-Post Timing

| Subreddit | Post Time (PT) | Expected Peak | Notes |
|-----------|----------------|---------------|-------|
| r/SideProject | 6:00 AM | 8-10 AM ET | Supportive community, good feedback |
| r/InternetIsBeautiful | 6:30 AM | 9-11 AM ET | Needs strong visual hook |
| r/webdev | 7:00 AM | 10 AM-12 PM ET | Technical questions drive engagement |

**Spacing:** 30 min between posts to avoid rate limiting

**Engagement:** Reply to every comment in first 2 hours
