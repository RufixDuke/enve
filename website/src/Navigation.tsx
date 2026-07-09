import { List, X } from '@phosphor-icons/react';
import { useState } from 'react';

export function Navigation() {
  const [open, setOpen] = useState(false);

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Commands', href: '#commands' },
    { label: 'Scoring', href: '#scoring' },
    { label: 'Get started', href: '#get-started' },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#" className="text-lg font-semibold text-ink">enve</a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://www.npmjs.com/package/enve-cli"
            className="rounded-lg bg-ink px-4 py-2 text-sm text-white transition-colors hover:bg-ink/90"
          >
            Install
          </a>
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          {open ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-b border-border bg-canvas px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted transition-colors hover:text-ink"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://www.npmjs.com/package/enve-cli"
              className="rounded-lg bg-ink px-4 py-2 text-center text-sm text-white"
            >
              Install
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
