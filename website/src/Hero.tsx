import { ArrowRight, Copy } from '@phosphor-icons/react';
import { TerminalWindow } from './Terminal';

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
            </span>
            <span className="text-sm text-muted">Open-source CLI for Node.js projects</span>
          </div>

          <h1 className="mb-6 text-4xl font-semibold tracking-tight text-ink md:text-5xl lg:text-6xl">
            Stop env-file mistakes before they ship
          </h1>

          <p className="mb-8 max-w-lg text-lg leading-relaxed text-muted">
            enve scans your projects for missing variables, unused secrets, format errors, and gitignore risks. One command keeps every project healthy.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#get-started"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3 text-white transition-all hover:bg-ink/90 active:scale-[0.98]"
            >
              Get started
              <ArrowRight size={18} weight="bold" />
            </a>
            <a
              href="https://www.npmjs.com/package/enve-doctor"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 py-3 text-ink transition-all hover:border-border-strong active:scale-[0.98]"
            >
              View on npm
            </a>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <code className="code-pill text-ink">npm install -g enve-doctor</code>
            <button
              className="text-subtle transition-colors hover:text-ink"
              onClick={() => navigator.clipboard.writeText('npm install -g enve-doctor')}
              aria-label="Copy install command"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        <TerminalWindow>
          <div className="space-y-1">
            <div className="text-white/40">$ enve doctor</div>
            <div className="text-white/90"></div>
            <div className="text-white/90">  Enve Health Check - basic-project</div>
            <div className="text-white/50">  /Users/dev/projects/basic-project</div>
            <div className="text-white/90"></div>
            <div className="text-white/90">  [File Structure]</div>
            <div className="text-error">    ✗ .env is not in .gitignore</div>
            <div className="text-white/90"></div>
            <div className="text-white/90">  [Security]</div>
            <div className="text-error">    ✗ JWT_SECRET looks like a secret but is in .env</div>
            <div className="text-white/90"></div>
            <div className="text-white/90">  Score: 70/100 [ Good ]</div>
            <div className="text-white/50">  2 errors, 1 warning</div>
          </div>
        </TerminalWindow>
      </div>
    </section>
  );
}
