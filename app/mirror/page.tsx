import { WebcamMirror } from "./WebcamMirror";

export default function MirrorPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(57,208,255,0.18),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(88,242,176,0.12),transparent_20%),linear-gradient(180deg,#0b1020_0%,#050814_100%)] text-ink">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:40px_40px] opacity-10" />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <a
            href="/"
            aria-label="Exit mirror"
            className="inline-flex min-h-14 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs uppercase tracking-[0.28em]">
              VF
            </span>
            <span>Exit</span>
          </a>
          <div className="hidden sm:block">
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">VirtualFit mirror</p>
            <p className="mt-1 text-sm text-mist">Retail kiosk preview</p>
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.26em] text-white/70 backdrop-blur">
          VirtualFit v3
        </div>
      </header>

      <section className="relative z-10 flex-1 overflow-hidden px-4 pb-3 sm:px-6 lg:px-8">
        <WebcamMirror />
      </section>

      <footer className="relative z-10 px-4 pb-5 pt-2 text-center text-sm text-mist sm:px-6 lg:px-8">
        Camera stays on your device. Nothing leaves your browser.
      </footer>
    </main>
  );
}
