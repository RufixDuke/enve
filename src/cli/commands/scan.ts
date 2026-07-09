import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject, getProjectInfo } from '../../core/project.js';
import { success, warning, error, bullet, indent } from '../../utils/logger.js';

export const scanCommand = new Command('scan')
  .description('Quick overview of the current project\'s environment variable health')
  .action(async () => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    const info = await getProjectInfo(projectPath);

    console.log();
    console.log(indent(`${chalk.bold('Enve Scan Report')} — ${info.name}`));
    console.log(indent(chalk.dim(info.path)));
    console.log();

    console.log(indent(`.env files found: ${info.envFiles.length}`));
    for (const file of info.envFiles) {
      console.log(indent(`${bullet(`${file.filename.padEnd(18)} ${file.variables.length} variables`)}`, 2));
    }
    console.log();

    console.log(indent(`Code references: ${info.referenceCount} variables used`));
    console.log();

    if (info.issues.length === 0) {
      console.log(indent(success('No issues found. Great job!')));
    } else {
      console.log(indent(`Issues found: ${info.issues.length}`));

      const errors = info.issues.filter((i) => i.severity === 'error');
      const warnings = info.issues.filter((i) => i.severity === 'warning');
      const infos = info.issues.filter((i) => i.severity === 'info');

      for (const issue of errors) {
        console.log(indent(error(issue.message), 2));
      }
      for (const issue of warnings) {
        console.log(indent(warning(issue.message), 2));
      }
      for (const issue of infos) {
        console.log(indent(success(issue.message), 2));
      }
    }

    console.log();
    console.log(indent(`Score: ${formatScore(info.score.score)}  [ ${info.score.grade} ]`));
    console.log(indent(chalk.dim(`${info.score.errorCount} errors, ${info.score.warningCount} warnings`)));
    console.log();
    console.log(indent('Run `enve doctor` for detailed recommendations.'));
  });

function formatScore(score: number): string {
  const text = `${score}/100`;
  if (score >= 90) return chalk.bgGreen.black(` ${text} `);
  if (score >= 70) return chalk.bgYellow.black(` ${text} `);
  if (score >= 50) return chalk.red(text);
  return chalk.bgRed.white(` ${text} `);
}
