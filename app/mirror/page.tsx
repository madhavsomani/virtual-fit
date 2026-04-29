import { WebcamMirror } from "./WebcamMirror";

export default function MirrorPage() {
  return (
    <main className="min-h-screen bg-surface px-5 py-10 text-ink sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-100/80">VirtualFit v3</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Virtual Mirror</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-mist sm:text-base">
            Start the camera to verify the live capture flow before pose tracking and try-on layers land in
            Phase 2.
          </p>
        </section>

        <WebcamMirror />
      </div>
    </main>
  );
}
