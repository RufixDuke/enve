import { Terminal, ShieldCheck, MagnifyingGlass, Trash, FilePlus, Gauge } from '@phosphor-icons/react';

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <div className="group rounded-2xl border border-border bg-white p-6 transition-all duration-300 hover:border-border-strong hover:shadow-sm">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-ink">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-ink">{title}</h3>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
}

export function Features() {
  const features: FeatureProps[] = [
    {
      icon: <MagnifyingGlass size={22} weight="duotone" />,
      title: 'Scan everything',
      description: 'Finds .env files across your project and maps every process.env reference in your source code.',
    },
    {
      icon: <ShieldCheck size={22} weight="duotone" />,
      title: 'Catch secret risks',
      description: 'Flags secrets living in .env instead of .env.local, and warns when env files are not gitignored.',
    },
    {
      icon: <Trash size={22} weight="duotone" />,
      title: 'Remove the dead weight',
      description: 'Detects unused variables and removes them safely with `enve unused --fix`.',
    },
    {
      icon: <FilePlus size={22} weight="duotone" />,
      title: 'Find missing variables',
      description: 'Surfaces variables referenced in code but missing from .env, then adds placeholders with `--add`.',
    },
    {
      icon: <Gauge size={22} weight="duotone" />,
      title: 'Validate formats',
      description: 'Checks PORT, URLs, NODE_ENV, booleans, and secret strength. Auto-fixes the safe ones.',
    },
    {
      icon: <Terminal size={22} weight="duotone" />,
      title: 'Interactive dashboard',
      description: 'Run `enve dashboard` to see every tracked project, its health score, and top issues at a glance.',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-16 max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-subtle">Features</p>
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Built for the ways env files actually break
        </h2>
        <p className="text-lg text-muted">
          Six focused checks that catch the mistakes that slip into production.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Feature key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}
