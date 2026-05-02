const steps = [
  {
    title: "Upload Photo",
    copy: "Start with a clear full-body photo and let VirtualFit map your silhouette in seconds."
  },
  {
    title: "Pick Outfit",
    copy: "Browse statement outerwear, elevated basics, and occasion looks curated for fast comparison."
  },
  {
    title: "See Result",
    copy: "Preview a realistic try-on instantly so you can judge fit, color, and vibe before checkout."
  }
];

const gallery = [
  {
    src: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    alt: "Woman styling a beige coat in a city setting",
    label: "City Layers"
  },
  {
    src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    alt: "Friends in polished contemporary outfits",
    label: "Weekend Edit"
  },
  {
    src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
    alt: "Fashion portrait with warm-toned modern styling",
    label: "Evening Statement"
  }
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-surface text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(57,208,255,0.18),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(88,242,176,0.15),transparent_22%),linear-gradient(180deg,#0b1020_0%,#070b16_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:34px_34px] opacity-20" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-halo">
              <span className="text-lg font-semibold">VF</span>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-mist">VirtualFit</p>
              <p className="text-xs text-white/55">AI styling preview</p>
            </div>
          </div>

          <a
            href="#gallery"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            See examples
          </a>
        </header>

        <section className="relative grid flex-1 items-center gap-14 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-100">
              New standard for online try-on
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Try On Any Outfit Virtually
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-mist sm:text-lg">
              Upload one photo, test complete looks, and decide faster with a premium virtual fitting
              experience designed for modern fashion shopping.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/tryon"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#cf2a2a] via-[#e24b2e] to-[#d4af37] px-6 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(212,175,55,0.28)]"
              >
                Try the armor →
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent-cyan to-accent-emerald px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:shadow-halo"
              >
                Start Your Try-On
              </a>
              <a
                href="/mirror"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent-cyan to-accent-emerald px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:shadow-halo"
              >
                Launch Live Mirror
              </a>
              <a
                href="#gallery"
                className="inline-flex items-center justify-center rounded-full border border-white/[0.12] bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
              >
                Browse sample results
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">1 photo</p>
                <p className="mt-1 text-sm text-mist">No measuring tape, no setup friction.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">Real looks</p>
                <p className="mt-1 text-sm text-mist">Compare silhouettes and styling before purchase.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-2xl font-semibold">Mobile-first</p>
                <p className="mt-1 text-sm text-mist">Designed to feel sharp on a 375px screen.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -right-6 bottom-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-halo backdrop-blur-xl">
              <div className="rounded-[1.6rem] border border-white/10 bg-[#09101d]/90 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Live preview</p>
                    <p className="mt-1 text-lg font-medium">Luxury coat try-on</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    Rendering
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20">
                    <img
                      src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80"
                      alt="Person wearing a simple tee as source image"
                      className="h-72 w-full object-cover sm:h-80"
                    />
                    <div className="border-t border-white/10 px-4 py-3">
                      <p className="text-sm font-medium">Source photo</p>
                      <p className="text-xs text-mist">Clean upload, neutral pose</p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20">
                    <img
                      src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80"
                      alt="Stylish result image with premium outerwear"
                      className="h-72 w-full object-cover sm:h-80"
                    />
                    <div className="border-t border-white/10 px-4 py-3">
                      <p className="text-sm font-medium">Virtual try-on</p>
                      <p className="text-xs text-mist">Statement outerwear, preserved proportions</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist">Fit read</p>
                    <p className="mt-2 text-sm text-white/90">Structured shoulders, relaxed drape</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist">Color match</p>
                    <p className="mt-2 text-sm text-white/90">Cool neutrals with soft contrast</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist">Decision</p>
                    <p className="mt-2 text-sm text-white/90">Ready to add to bag</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="relative mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-100/80">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Three steps from curiosity to confidence
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/90 to-emerald-300/90 text-lg font-semibold text-slate-950">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-mist">{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="gallery" className="py-16">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-100/80">Sample results</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                A polished preview before the real try-on flow lands
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-mist">
              The visual direction is premium, dark, and editorial so the product already feels like a real
              fashion tool rather than a generic AI demo.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {gallery.map((item) => (
              <figure
                key={item.label}
                className="group overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/5"
              >
                <div className="overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="h-80 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <figcaption className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-base font-medium">{item.label}</p>
                    <p className="text-sm text-mist">Editorial-grade styling preview</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75">
                    Preview
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <footer className="mt-auto border-t border-white/10 pb-4 pt-6 text-sm text-mist">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>VirtualFit v3 foundation. Built for a fast, premium online try-on experience.</p>
            <p>Upload Photo → Pick Outfit → See Result</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
