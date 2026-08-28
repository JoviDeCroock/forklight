export function head() {
  return {
    title: "Page not found",
    meta: [{ content: "noindex", name: "robots" }],
  };
}

export function Component() {
  return (
    <section class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p class="fl-eyebrow text-ink-500">404 · no such route</p>
      <h1 class="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] text-ink-50">
        Nothing forked from here.
      </h1>
      <p class="mt-4 text-[15px] leading-relaxed text-ink-300">
        The page you asked for does not exist. It may have moved, or the link may be wrong.
      </p>
      {/* A plain anchor keeps this page independent of the route table.
          Use a typed <Link> once you want client-side navigation. */}
      <a
        href="/"
        class="mt-7 inline-flex w-fit items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-4 py-2.5 text-[13px] font-medium text-ink-100 transition-colors hover:border-ink-600 hover:bg-ink-800"
      >
        ← Back to the incident canvas
      </a>
    </section>
  );
}
