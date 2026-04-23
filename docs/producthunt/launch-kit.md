# Product Hunt Launch Kit — VirtualFit

## Tagline (60 characters max)
**Primary:** Try on clothes instantly with your webcam, no app needed
**Alt 1:** Real-time 3D garment try-on, right in your browser
**Alt 2:** Virtual fitting room for any online store

## Description (260 characters max)
VirtualFit is a browser-based virtual try-on that overlays clothes on your body in real-time using AI. Point your webcam, pick a garment, and see how it looks—no app download required. Retailers can embed it with one line of code.

## Maker Comment (1200 characters max)

Hey Product Hunt! 👋

I built VirtualFit because online clothes shopping is broken. 30% of online clothing gets returned, mostly because it "looked different" than expected.

**What VirtualFit does:**
- Point your webcam → see clothes on yourself in real-time
- Works on desktop AND mobile browsers
- Upload any clothing photo → AI converts it to 3D
- Swipe/shake/arrow keys to cycle through garments

**The tech:**
- MediaPipe Pose for body tracking (33 landmarks at 30fps)
- Three.js for 3D rendering
- HuggingFace API for image-to-3D conversion
- Next.js + Azure Static Web Apps

**Why browser-only matters:**
Most virtual try-on requires an app download. That friction kills conversion. VirtualFit loads in 2 seconds.

**For retailers:**
One-line embed: `<virtualfit-button>`
Works on any e-commerce platform.

I'm a solo dev who built this over a weekend sprint. Would love feedback on:
1. Does the 3D tracking feel smooth on your device?
2. Would you actually use this before buying clothes?
3. What features would make this a must-have?

Try it free: [link]

Thanks for checking it out! 🙏

---

## Hunter Recommendations

Research these hunters who launch AI/fashion/3D/developer tools:

### 1. Chris Messina (@chrismessina)
- Hunted 2000+ products, very active
- Covers AI tools, developer products, consumer apps
- Known for supporting indie makers
- DM approach: Brief, show the demo, mention the tech stack

### 2. Kevin William David (@kevinwdavid)
- Prolific hunter, 500+ hunts
- Covers SaaS, AI, productivity tools
- Active on Twitter, responds to DMs
- DM approach: Lead with the retailer embed angle (B2B)

### 3. Ben Tossell (@bentossell)
- Founder of Makerpad, hunts no-code/low-code tools
- Would appreciate the "one-line embed" angle
- Active community builder
- DM approach: Emphasize accessibility and browser-only approach

### Alternative hunters to consider:
- @aaditsh (AI/ML tools)
- @mubashariqbal (indie maker supporter)
- @_jacksmith (developer tools)

---

## Product Images to Generate

Need 5 images at 1270x760px:

✅ Screenshots captured from live site on 2026-04-20:

1. **Hero shot** - `/mirror` with camera prompt UI
   - Filename: `ph-hero-mirror3d.png`
   - Shows: Mirror 3D Test header, "Start Camera" button, Upload button

2. **2D Mirror** - `/mirror` showing onboarding UI
   - Filename: `ph-mirror-2d.png`
   - Shows: "Virtual Try-On" modal, how-it-works sidebar

3. **Upload flow** - `/generate-3d` showing image upload
   - Filename: `ph-generate-3d.png`
   - Shows: Upload area, demo mode notice

4. **Pricing page** - `/pricing` showing 3-tier pricing
   - Filename: `ph-pricing.png`
   - Shows: Free/Creator/Retailer plans, FAQ section

5. **Retailer embed** - `/retailer/signup` signup form
   - Filename: `ph-retailer-embed.png`
   - Shows: Store signup form with platform selection

**Note:** Madhav should re-capture with camera active for better hero shots.
Alternatively, use screen recordings converted to GIFs.

---

## Launch Checklist

- [ ] Screenshots taken at 1270x760
- [ ] GIF/video of try-on in action (15-30 sec)
- [ ] Hunter confirmed
- [ ] First comment drafted (maker comment above)
- [ ] Social posts ready to amplify (see twitter-launch-thread.md)
- [ ] Friends/colleagues ready to upvote + comment in first hour
- [ ] Madhav available for 2-3 hours post-launch to reply to comments

**Best launch day:** Tuesday or Wednesday
**Best launch time:** 12:01 AM PT (Product Hunt resets at midnight PT)
