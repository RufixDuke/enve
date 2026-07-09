import { GithubLogo, Package } from '@phosphor-icons/react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <span className="text-lg font-semibold text-ink">enve</span>
            <p className="mt-1 text-sm text-muted">Environment Variable Doctor. Open-source and free.</p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/RufixDuke/enve"
              className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
            >
              <GithubLogo size={18} />
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/enve-doctor"
              className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
            >
              <Package size={18} />
              npm
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-sm text-subtle">
          MIT License © {new Date().getFullYear()} Abdul-Qudus Rufai
        </div>
      </div>
    </footer>
  );
}
