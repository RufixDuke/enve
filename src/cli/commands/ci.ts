import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject, getProjectInfo } from '../../core/project.js';
import { error, warning, bullet, indent } from '../../utils/logger.js';
import type { Issue, ProjectInfo } from '../../types/index.js';

type FailOn = 'error' | 'warning' | 'none';
type Format = 'text' | 'json' | 'junit';

export const ciCommand = new Command('ci')
  .description('Non-interactive CI check with structured output')
  .option('--fail-on <level>', 'Fail on "error", "warning", or "none"', 'error')
  .option('--format <format>', 'Output format: text, json, or junit', 'text')
  .action(async () => {
    const opts = ciCommand.opts<{ failOn: FailOn; format: Format }>();
    const exitCode = await runCi(opts.failOn, opts.format);
    process.exit(exitCode);
  });

export async function runCi(failOn: FailOn, format: Format): Promise<number> {
  const cwd = process.cwd();
  const projectPath = await detectProject(cwd);

  if (!projectPath) {
    console.log(error('No package.json found. Are you in a project directory?'));
    return 1;
  }

  const info = await getProjectInfo(projectPath);

  if (format === 'json') {
    console.log(JSON.stringify(toJson(info), null, 2));
  } else if (format === 'junit') {
    console.log(toJUnit(info));
  } else {
    printText(info);
  }

  if (failOn === 'none') return 0;
  if (failOn === 'warning') {
    return info.score.errorCount > 0 || info.score.warningCount > 0 ? 1 : 0;
  }
  return info.score.errorCount > 0 ? 1 : 0;
}

function printText(info: ProjectInfo): void {
  console.log();
  console.log(chalk.bold(`Enve CI Report — ${info.name}`));
  console.log(chalk.dim(info.path));
  console.log();
  console.log(`Score: ${formatScore(info.score.score)}  [ ${info.score.grade} ]`);
  console.log(
    chalk.dim(
      `${info.score.errorCount} errors, ${info.score.warningCount} warnings, ${info.score.infoCount} info`
    )
  );
  console.log();

  if (info.issues.length === 0) {
    console.log(chalk.green('No issues found'));
    return;
  }

  const errors = info.issues.filter((i) => i.severity === 'error');
  const warnings = info.issues.filter((i) => i.severity === 'warning');
  const infos = info.issues.filter((i) => i.severity === 'info');

  printSection('Errors', errors);
  printSection('Warnings', warnings);
  printSection('Info', infos);
}

function printSection(title: string, issues: Issue[]): void {
  if (issues.length === 0) return;
  console.log(chalk.bold(`${title} (${issues.length})`));
  for (const issue of issues) {
    const formatter = issue.severity === 'error' ? error : warning;
    console.log(indent(formatter(`${bullet(issue.message)}`), 2));
    if (issue.suggestion) {
      console.log(indent(chalk.dim(`→ ${issue.suggestion}`), 4));
    }
  }
  console.log();
}

function formatScore(score: number): string {
  if (score >= 90) return chalk.green(`${score}/100`);
  if (score >= 70) return chalk.yellow(`${score}/100`);
  if (score >= 50) return chalk.hex('#f97316')(`${score}/100`);
  return chalk.red(`${score}/100`);
}

function toJson(info: ProjectInfo) {
  return {
    name: info.name,
    path: info.path,
    score: info.score,
    envFiles: info.envFiles.map((f) => ({
      filename: f.filename,
      variableCount: f.variables.length,
    })),
    referenceCount: info.referenceCount,
    issues: info.issues.map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      key: issue.key,
      message: issue.message,
      file: issue.file,
      line: issue.line,
      suggestion: issue.suggestion,
    })),
    generatedAt: new Date().toISOString(),
  };
}

function toJUnit(info: ProjectInfo): string {
  const issues = info.issues;
  const failures = issues.length;
  const tests = issues.length || 1;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuites name="enve" tests="${tests}" failures="${failures}" errors="0" time="0">`
  );
  lines.push(
    `  <testsuite name="Environment Variables — ${escapeXml(info.name)}" tests="${tests}" failures="${failures}" errors="0" time="0">`
  );

  if (issues.length === 0) {
    lines.push('    <testcase name="No issues found" />');
  } else {
    for (const issue of issues) {
      const name = escapeXml(`${issue.type}: ${issue.key}`);
      const message = escapeXml(issue.message);
      const detail = [issue.message, issue.suggestion, `${issue.file}${issue.line ? `:${issue.line}` : ''}`]
        .filter(Boolean)
        .join('\n');
      lines.push(`    <testcase name="${name}">`);
      lines.push(`      <failure message="${message}" type="${issue.severity}">${escapeXml(detail)}</failure>`);
      lines.push('    </testcase>');
    }
  }

  lines.push('  </testsuite>');
  lines.push('</testsuites>');
  return lines.join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
