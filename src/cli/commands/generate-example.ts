import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { detectProject } from '../../core/project.js';
import { parseEnvFile } from '../../core/parser.js';
import { readFileSafe, writeFileSafe } from '../../utils/fs.js';
import { isSecretKey } from '../../utils/validators.js';
import { error, success, indent, header, bullet } from '../../utils/logger.js';
import { confirm } from '../../utils/prompt.js';

export const generateExampleCommand = new Command('generate-example')
  .description('Automatically create or update .env.example from the current .env file')
  .option('--overwrite', 'Update existing .env.example without prompting')
  .option('--output <path>', 'Write to a different file', '.env.example')
  .option('--all-secrets', 'Redact ALL values')
  .option('--dry-run', 'Show what would be generated without writing files')
  .action(async (options) => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    const envPath = join(projectPath, '.env');
    const envContent = await readFileSafe(envPath);

    if (!envContent) {
      console.log(error('No .env file found. Cannot generate .env.example.'));
      process.exit(1);
    }

    const outputPath = join(projectPath, options.output);
    const existing = await readFileSafe(outputPath);
    const variables = parseEnvFile(envPath);

    const newLines: string[] = [];
    let redactedCount = 0;
    let copiedCount = 0;

    for (const variable of variables) {
      const shouldRedact = options.allSecrets || variable.isSecret || isSecretKey(variable.key);
      if (shouldRedact) {
        newLines.push(`${variable.key}=your_${variable.key.toLowerCase()}`);
        redactedCount++;
      } else {
        newLines.push(`${variable.key}=${variable.value}`);
        copiedCount++;
      }
    }

    const newContent = `${newLines.join('\n')}\n`;

    console.log();
    console.log(indent(header(`Generating ${options.output} from .env`)));
    console.log();
    console.log(indent(`Variables: ${variables.length} total`));
    console.log(indent(bullet(`${copiedCount} public variables → copied as-is`), 2));
    console.log(indent(bullet(`${redactedCount} secrets redacted`), 2));

    if (existing) {
      const diff = computeDiff(existing, newContent);

      if (diff.length === 0) {
        console.log();
        console.log(indent(success(`${options.output} is already up to date.`)));
        return;
      }

      console.log();
      console.log(indent(header('Changes since last generation:')));
      for (const change of diff) {
        const symbol = change.type === 'added' ? chalk.green('+') : change.type === 'removed' ? chalk.red('-') : chalk.yellow('~');
        console.log(indent(`${symbol} ${change.type}: ${change.key}`, 2));
      }

      if (options.dryRun) {
        console.log();
        console.log(indent(chalk.dim('Dry run — no changes made.')));
        return;
      }

      if (!options.overwrite) {
        const confirmed = await confirm(`Update ${options.output}?`);
        if (!confirmed) {
          console.log(indent(chalk.dim('Aborted. No changes made.')));
          return;
        }
      }
    } else if (options.dryRun) {
      console.log();
      console.log(indent(chalk.dim('Dry run — no changes made.')));
    }

    if (!options.dryRun) {
      await writeFileSafe(outputPath, newContent);

      console.log();
      console.log(indent(success(`Created ${options.output}`)));
    }
  });

interface DiffEntry {
  type: 'added' | 'removed' | 'updated';
  key: string;
}

function computeDiff(existingContent: string, newContent: string): DiffEntry[] {
  const existingVars = new Map<string, string>();
  const newVars = new Map<string, string>();

  for (const line of existingContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    existingVars.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim());
  }

  for (const line of newContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    newVars.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim());
  }

  const diff: DiffEntry[] = [];

  for (const [key, value] of newVars) {
    if (!existingVars.has(key)) {
      diff.push({ type: 'added', key });
    } else if (existingVars.get(key) !== value) {
      diff.push({ type: 'updated', key });
    }
  }

  for (const key of existingVars.keys()) {
    if (!newVars.has(key)) {
      diff.push({ type: 'removed', key });
    }
  }

  return diff;
}
