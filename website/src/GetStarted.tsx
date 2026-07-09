import { TerminalWindow } from './Terminal';

export function GetStarted() {
  return (
    <section className="border-t border-border bg-ink py-24 text-white md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="max-w-xl">
            <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Get started in seconds
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-white/70">
              Install the CLI globally, navigate to any Node.js project, and run your first health check.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-sm">1</span>
                <div>
                  <p className="font-medium">Install globally</p>
                  <p className="text-sm text-white/60">Use npm, pnpm, or yarn to install enve-cli.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-sm">2</span>
                <div>
                  <p className="font-medium">Run a health check</p>
                  <p className="text-sm text-white/60">`enve doctor` gives you a full report and prioritized fixes.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-sm">3</span>
                <div>
                  <p className="font-medium">Watch the dashboard</p>
                  <p className="text-sm text-white/60">`enve dashboard` tracks all your projects in one interactive view.</p>
                </div>
              </div>
            </div>
          </div>

          <TerminalWindow title="install">
            <div className="space-y-1">
              <div className="text-white/40">$ npm install -g enve-cli</div>
              <div className="text-white/90">added 1 package in 340ms</div>
              <div className="text-white/90"></div>
              <div className="text-white/40">$ cd my-project && enve doctor</div>
              <div className="text-white/90"></div>
              <div className="text-white/90">  Enve Health Check - my-project</div>
              <div className="text-success">  ✓ All sections passed</div>
              <div className="text-white/90">  Score: 100/100 [ Excellent ]</div>
            </div>
          </TerminalWindow>
        </div>
      </div>
    </section>
  );
}
