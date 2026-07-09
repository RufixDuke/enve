import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject, getProjectInfo } from '../../core/project.js';
import { addHistory, getHistory } from '../../core/config.js';
import { error, success, indent, header } from '../../utils/logger.js';

export const historyCommand = new Command('history')
  .description('Track and display env health score history')
  .option('--graph', 'Show ASCII graph of score over time')
  .option('--limit <n>', 'Number of entries to show', '10')
  .action(async (options: { graph?: boolean; limit: string }) => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    await runHistory(projectPath, options.graph ?? false, parseInt(options.limit, 10));
  });

export async function runHistory(
  projectPath: string,
  showGraph: boolean,
  limit: number
): Promise<void> {
  const info = await getProjectInfo(projectPath);

  addHistory({
    projectPath,
    name: info.name,
    score: info.score.score,
    grade: info.score.grade,
    timestamp: new Date().toISOString(),
  });

  const entries = getHistory(projectPath).slice(-Math.max(1, limit));

  console.log();
  console.log(indent(header(`Enve History — ${info.name}`)));
  console.log();

  if (entries.length === 0) {
    console.log(indent('No history recorded yet.'));
    return;
  }

  if (showGraph) {
    printGraph(entries);
  } else {
    printTable(entries);
  }
}

function printTable(entries: Array<{ timestamp: string; score: number; grade: string }>): void {
  console.log(indent(`${chalk.bold('Date'.padEnd(12))} ${chalk.bold('Score'.padEnd(8))} Grade`));
  console.log(indent('-'.repeat(32)));

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toLocaleDateString();
    const score = `${entry.score}/100`.padEnd(8);
    console.log(indent(`${chalk.dim(date.padEnd(12))} ${score} ${entry.grade}`));
  }
}

function printGraph(entries: Array<{ timestamp: string; score: number }>): void {
  const scores = entries.map((e) => e.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = Math.max(max - min, 1);
  const height = 10;

  console.log(indent(chalk.dim(`Score range: ${min}–${max}`)));
  console.log();

  for (let row = height; row >= 0; row--) {
    const threshold = min + (range * row) / height;
    const bars = entries
      .map((e) => {
        const filled = e.score >= threshold;
        return filled ? chalk.green('█') : chalk.dim('·');
      })
      .join(' ');
    console.log(indent(`${String(Math.round(threshold)).padStart(3)} │ ${bars}`));
  }

  const labels = entries
    .map((e) => new Date(e.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
    .join(' ');
  console.log(indent(`    └ ${chalk.dim(labels)}`));
}
