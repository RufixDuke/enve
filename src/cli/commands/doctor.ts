import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject, getProjectInfo } from '../../core/project.js';
import { parseAllEnvFiles } from '../../core/parser.js';
import { error, warning, success, indent, header } from '../../utils/logger.js';
import type { Issue } from '../../types/index.js';

export const doctorCommand = new Command('doctor')
  .description('Comprehensive health check with detailed recommendations')
  .action(async () => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    await runDoctor(projectPath);
  });

export async function runDoctor(projectPath: string): Promise<void> {
  const info = await getProjectInfo(projectPath);
  const envFiles = await parseAllEnvFiles(projectPath);

  console.log();
  console.log(indent(header(`Enve Health Check — ${info.name}`)));
  console.log(indent(chalk.dim(info.path)));
  console.log();

  const fileStructureIssues = info.issues.filter(
    (i) => i.type === 'gitignore' || (i.type === 'suspicious' && i.key === '.env.example')
  );
  const variableIssues = info.issues.filter((i) => i.type === 'missing' || i.type === 'unused');
  const securityIssues = info.issues.filter((i) => i.type === 'secret-risk');
  const validationIssues = info.issues.filter((i) => i.type === 'invalid' || i.type === 'syntax-error');

  printSection('[File Structure]', fileStructureIssues);
  printVariablesSection(variableIssues, envFiles);
  printSection('[Security]', securityIssues);
  printSection('[Validation]', validationIssues);
  printRecommendations(info.issues);

  console.log();
  console.log(indent(`Score: ${formatScore(info.score.score)}  [ ${info.score.grade} ]`));
  console.log(indent(chalk.dim(`${info.score.errorCount} errors, ${info.score.warningCount} warnings, ${info.score.infoCount} info`)));
  console.log();
}

function printSection(title: string, issues: Issue[]): void {
  console.log(indent(header(title)));
  if (issues.length === 0) {
    console.log(indent(success('No issues')));
  } else {
    for (const issue of issues) {
      const formatter = issue.severity === 'error' ? error : issue.severity === 'warning' ? warning : success;
      console.log(indent(formatter(issue.message), 2));
      if (issue.suggestion) {
        console.log(indent(chalk.dim(`→ ${issue.suggestion}`), 3));
      }
    }
  }
  console.log();
}

function printVariablesSection(issues: Issue[], envFiles: Awaited<ReturnType<typeof import('../../core/parser.js').parseAllEnvFiles>>): void {
  const totalDefined = envFiles.reduce((sum, f) => sum + f.variables.length, 0);
  console.log(indent(header(`[Variables — ${totalDefined} defined]`)));

  if (issues.length === 0) {
    console.log(indent(success('All variables are used and defined')));
  } else {
    for (const issue of issues) {
      const formatter = issue.severity === 'error' ? error : warning;
      let message = issue.message;
      if (issue.type === 'missing' && issue.hasFallback && issue.fallbackValue) {
        message += chalk.dim(` (fallback: ${issue.fallbackValue})`);
      }
      console.log(indent(formatter(message), 2));
      if (issue.suggestion) {
        console.log(indent(chalk.dim(`→ ${issue.suggestion}`), 3));
      }
    }
  }
  console.log();
}

function printRecommendations(issues: Issue[]): void {
  const actionable = issues.filter((i) => i.suggestion);
  if (actionable.length === 0) return;

  console.log(indent(header(`[Recommendations — ${actionable.length} actions needed]`)));

  const high = actionable.filter((i) => i.severity === 'error');
  const medium = actionable.filter((i) => i.severity === 'warning');
  const low = actionable.filter((i) => i.severity === 'info');

  if (high.length > 0) {
    console.log(indent(chalk.red.bold('HIGH PRIORITY:')));
    high.forEach((issue, idx) => {
      console.log(indent(`${idx + 1}. ${issue.suggestion}`, 2));
    });
    console.log();
  }

  if (medium.length > 0) {
    console.log(indent(chalk.yellow.bold('MEDIUM PRIORITY:')));
    medium.forEach((issue, idx) => {
      console.log(indent(`${idx + 1}. ${issue.suggestion}`, 2));
    });
    console.log();
  }

  if (low.length > 0) {
    console.log(indent(chalk.blue.bold('LOW PRIORITY:')));
    low.forEach((issue, idx) => {
      console.log(indent(`${idx + 1}. ${issue.suggestion}`, 2));
    });
    console.log();
  }
}

function formatScore(score: number): string {
  const text = `${score}/100`;
  if (score >= 90) return chalk.bgGreen.black(` ${text} `);
  if (score >= 70) return chalk.bgYellow.black(` ${text} `);
  if (score >= 50) return chalk.red(text);
  return chalk.bgRed.white(` ${text} `);
}
