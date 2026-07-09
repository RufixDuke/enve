import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';

interface GradeRowProps {
  range: string;
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'error' | 'muted';
}

function GradeRow({ range, label, description, tone }: GradeRowProps) {
  const toneStyles = {
    success: 'bg-success-bg text-success border-success/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    error: 'bg-error-bg text-error border-error/20',
    muted: 'bg-canvas text-muted border-border',
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className={`inline-flex rounded-lg border px-3 py-1 text-sm font-medium ${toneStyles[tone]}`}>
          {range}
        </span>
        <span className="font-semibold text-ink">{label}</span>
      </div>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

export function Score() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="max-w-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-subtle">Scoring</p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            A clear grade for every project
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-muted">
            enve scores each project from 0 to 100 based on the severity and type of issues found. The grade makes it obvious where to focus first.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle size={20} className="mt-0.5 text-success" weight="fill" />
              <div>
                <span className="font-medium text-ink">Automatic scoring</span>
                <p className="text-sm text-muted">Each issue type has a fixed deduction, so scores are consistent across projects.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <WarningCircle size={20} className="mt-0.5 text-warning" weight="fill" />
              <div>
                <span className="font-medium text-ink">Severity-aware</span>
                <p className="text-sm text-muted">Errors hurt more than warnings. Missing secrets in .gitignore hurt the most.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <XCircle size={20} className="mt-0.5 text-error" weight="fill" />
              <div>
                <span className="font-medium text-ink">Capped deductions</span>
                <p className="text-sm text-muted">Repeated low-severity issues cap out so one category cannot tank the whole score.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <GradeRow range="90-100" label="Excellent" description="Clean env setup with no major issues." tone="success" />
          <GradeRow range="70-89" label="Good" description="Minor issues that are safe to fix later." tone="warning" />
          <GradeRow range="50-69" label="Needs attention" description="Several issues that should be addressed soon." tone="muted" />
          <GradeRow range="0-49" label="Critical" description="Major problems like exposed secrets or missing gitignore." tone="error" />
        </div>
      </div>
    </section>
  );
}
