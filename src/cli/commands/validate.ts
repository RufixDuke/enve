import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject } from '../../core/project.js';
import { parseAllEnvFiles } from '../../core/parser.js';
import {
  validatePort,
  validateUrl,
  validateNodeEnv,
  validateSecret,
  validateBoolean,
} from '../../utils/validators.js';
import { readFileSafe, writeFileSafe } from '../../utils/fs.js';
import { copyFile } from 'node:fs/promises';
import { error, success, indent, header } from '../../utils/logger.js';
import { confirm } from '../../utils/prompt.js';
import type { EnvVariable } from '../../types/index.js';

export const validateCommand = new Command('validate')
  .description('Validate the values of environment variables against expected formats')
  .option('--fix', 'Automatically fix simple issues')
  .action(async (options) => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    const envFiles = await parseAllEnvFiles(projectPath);
    const envFile = envFiles.find((f) => f.filename === '.env');

    if (!envFile) {
      console.log(error('No .env file found. Cannot validate.'));
      process.exit(1);
    }

    const variables = envFile.variables;

    console.log();
    console.log(indent(header(`Validating environment variables — ${envFile.filename}`)));
    console.log();

    let errorCount = 0;
    let warningCount = 0;
    const fixes: Array<{ key: string; oldValue: string; newValue: string }> = [];

    for (const variable of variables) {
      const result = validateVariable(variable);
      if (result.valid) {
        console.log(indent(success(`${variable.key}=${truncate(variable.value)}`)));
      } else {
        errorCount++;
        console.log(indent(error(`${variable.key}=${truncate(variable.value)}`)));
        if (result.message) console.log(indent(chalk.dim(`  ${result.message}`), 2));
        if (result.suggestion) console.log(indent(chalk.dim(`  Suggestion: ${result.suggestion}`), 2));

        const fixedValue = getFixedValue(variable);
        if (fixedValue !== undefined) {
          console.log(indent(chalk.yellow(`  Auto-fix available: ${variable.key}=${fixedValue}`), 2));
          fixes.push({ key: variable.key, oldValue: variable.value, newValue: fixedValue });
        }
      }
    }

    console.log();
    console.log(indent(`${variables.length} variables checked, ${errorCount} errors, ${warningCount} warnings`));

    if (options.fix) {
      const safeFixes = fixes.filter((f) => !isSecretKey(f.key));
      if (safeFixes.length === 0) {
        console.log(indent(chalk.dim('No auto-fixable issues (secrets are never auto-fixed).')));
        return;
      }

      const confirmed = await confirm(`Apply ${safeFixes.length} auto-fixes to .env?`);
      if (!confirmed) {
        console.log(indent(chalk.dim('Aborted. No changes made.')));
        return;
      }

      await applyFixes(envFile.path, safeFixes);
      console.log();
      console.log(indent(success(`Applied ${safeFixes.length} fixes to .env`)));
    } else if (fixes.length > 0) {
      console.log(indent('Run with `--fix` to apply available auto-fixes.'));
    }
  });

export function validateVariable(variable: EnvVariable): { valid: boolean; message?: string; suggestion?: string } {
  const key = variable.key;
  const value = variable.value;

  if (key === 'PORT' || key.endsWith('_PORT')) {
    return validatePort(value);
  }

  if (key === 'NODE_ENV') {
    return validateNodeEnv(value);
  }

  if (key.endsWith('_URL') || key === 'DATABASE_URL' || key === 'REDIS_URL') {
    return validateUrl(value);
  }

  if (isSecretKey(key)) {
    return validateSecret(value, key);
  }

  if (key === 'DEBUG' || key === 'VERBOSE' || key.endsWith('_ENABLED')) {
    return validateBoolean(value, key);
  }

  return { valid: true };
}

function isSecretKey(key: string): boolean {
  return /SECRET|KEY|TOKEN|PRIVATE/i.test(key) && key !== 'API_KEY';
}

function getFixedValue(variable: EnvVariable): string | undefined {
  const key = variable.key;
  const value = variable.value;

  // URL missing protocol
  if (key.endsWith('_URL') || key === 'DATABASE_URL' || key === 'REDIS_URL') {
    if (!value.includes('://') && !value.startsWith('http')) {
      return `https://${value}`;
    }
  }

  // NODE_ENV shorthand
  if (key === 'NODE_ENV') {
    if (value === 'dev') return 'development';
    if (value === 'prod') return 'production';
  }

  // Boolean normalization
  if (key === 'DEBUG' || key === 'VERBOSE' || key.endsWith('_ENABLED')) {
    const normalized = value.toLowerCase();
    if (normalized === 'yes' || normalized === '1' || normalized === 'on') return 'true';
    if (normalized === 'no' || normalized === '0' || normalized === 'off') return 'false';
  }

  return undefined;
}

async function applyFixes(filePath: string, fixes: Array<{ key: string; newValue: string }>): Promise<void> {
  const backupPath = `${filePath}.backup.validate.${formatTimestamp(new Date())}`;
  await copyFile(filePath, backupPath);

  const content = (await readFileSafe(filePath)) ?? '';
  const fixMap = new Map(fixes.map((f) => [f.key, f.newValue]));

  const lines = content.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) return line;

    let key = trimmed.slice(0, equalIndex).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();

    if (fixMap.has(key)) {
      const prefix = line.match(/^\s*/)?.[0] ?? '';
      const suffix = line.slice(line.indexOf('=') + 1);
      const commentIndex = suffix.indexOf(' #');
      const comment = commentIndex !== -1 ? suffix.slice(commentIndex) : '';
      const rawValue = commentIndex !== -1 ? suffix.slice(0, commentIndex) : suffix;
      const leadingSpaces = rawValue.match(/^\s*/)?.[0] ?? '';
      return `${prefix}${key}=${leadingSpaces}${fixMap.get(key)}${comment}`;
    }

    return line;
  });

  await writeFileSafe(filePath, lines.join('\n'));
  console.log(indent(chalk.dim(`Backup saved: ${backupPath}`), 2));
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function truncate(value: string, max = 40): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '...';
}
