import { TerminalWindow } from './Terminal';

interface CommandCardProps {
  command: string;
  title: string;
  description: string;
  output: React.ReactNode;
}

function CommandCard({ command, title, description, output }: CommandCardProps) {
  return (
    <div className="grid gap-6 rounded-2xl border border-border bg-white p-6 lg:grid-cols-2 lg:items-center">
      <div>
        <div className="mb-3 inline-block rounded-lg bg-canvas px-3 py-1.5 font-mono text-sm text-ink">
          {command}
        </div>
        <h3 className="mb-2 text-xl font-semibold text-ink">{title}</h3>
        <p className="text-muted leading-relaxed">{description}</p>
      </div>
      <TerminalWindow title="output">{output}</TerminalWindow>
    </div>
  );
}

export function Commands() {
  return (
    <section className="border-t border-border bg-canvas/50">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-16 max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-subtle">Commands</p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            One tool, every env workflow
          </h2>
          <p className="text-lg text-muted">
            From quick scans to automated fixes, each command is designed to do one job well.
          </p>
        </div>

        <div className="space-y-6">
          <CommandCard
            command="enve scan"
            title="Quick health overview"
            description="Get a fast summary of env files, code references, issues, and an overall score."
            output={
              <>
                <div className="text-white/40">$ enve scan</div>
                <div className="text-white/90"></div>
                <div className="text-white/90">  Enve Scan Report - basic-project</div>
                <div className="text-white/90">  .env files found: 3</div>
                <div className="text-white/90">  Code references: 7 variables used</div>
                <div className="text-white/90">  Issues found: 2</div>
                <div className="text-white/90">  Score: 81/100 [ Good ]</div>
              </>
            }
          />

          <CommandCard
            command="enve unused --fix"
            title="Remove dead variables"
            description="Finds variables defined in .env but never used in code, then removes them after confirmation."
            output={
              <>
                <div className="text-white/40">$ enve unused --fix</div>
                <div className="text-white/90"></div>
                <div className="text-warning">  ⚠ OLD_API_URL is defined but never used</div>
                <div className="text-warning">  ⚠ STAGING_TOKEN is defined but never used</div>
                <div className="text-white/90"></div>
                <div className="text-white/90">  Remove 2 unused variables? (y/N) y</div>
                <div className="text-success">  ✓ Removed OLD_API_URL</div>
                <div className="text-success">  ✓ Removed STAGING_TOKEN</div>
              </>
            }
          />

          <CommandCard
            command="enve validate --fix"
            title="Fix format issues"
            description="Validates PORT, URLs, NODE_ENV, booleans, and secrets. Safe fixes are applied with your approval."
            output={
              <>
                <div className="text-white/40">$ enve validate --fix</div>
                <div className="text-white/90"></div>
                <div className="text-error">  ✗ PORT=80000 must be between 1 and 65535</div>
                <div className="text-warning">  ✗ DEBUG=yes should be true or false</div>
                <div className="text-white/90"></div>
                <div className="text-white/90">  Apply 1 auto-fix? (y/N) y</div>
                <div className="text-success">  ✓ DEBUG=true</div>
              </>
            }
          />

          <CommandCard
            command="enve ci --format junit"
            title="CI/CD ready"
            description="Run non-interactive checks in your pipeline. Exit codes, JSON, and JUnit output included."
            output={
              <>
                <div className="text-white/40">$ enve ci --fail-on warning</div>
                <div className="text-white/90"></div>
                <div className="text-white/90">  Score: 85/100 [ Good ]</div>
                <div className="text-white/90">  1 errors, 2 warnings</div>
                <div className="text-error">  ✗ .env is not in .gitignore</div>
                <div className="text-warning">  ⚠ JWT_SECRET is defined but never used</div>
              </>
            }
          />

          <CommandCard
            command="enve fix --yes"
            title="One-command cleanup"
            description="Apply safe fixes: gitignore entries, secret moves, unused variable removal, and .env.example updates."
            output={
              <>
                <div className="text-white/40">$ enve fix --yes</div>
                <div className="text-white/90"></div>
                <div className="text-success">  ✓ Added .env to .gitignore</div>
                <div className="text-success">  ✓ Moved API_KEY to .env.local</div>
                <div className="text-success">  ✓ Removed 2 unused variables</div>
                <div className="text-success">  ✓ Added 3 placeholders to .env.example</div>
              </>
            }
          />

          <CommandCard
            command="enve docs"
            title="Auto-generated docs"
            description="Generate an up-to-date ENV.md with variables, sources, usage status, and current issues."
            output={
              <>
                <div className="text-white/40">$ enve docs --overwrite</div>
                <div className="text-white/90"></div>
                <div className="text-white/90">  Generated ENV.md</div>
                <div className="text-white/90"></div>
                <div className="text-white/40">  | Variable | Source | Used | Secret |</div>
                <div className="text-white/40">  | --- | --- | --- | --- |</div>
                <div className="text-white/90">  | PORT | .env | Yes | No |</div>
                <div className="text-white/90">  | API_KEY | .env.local | Yes | Yes |</div>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}
