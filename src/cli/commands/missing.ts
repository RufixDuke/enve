import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { detectProject } from '../../core/project.js';
import { parseAllEnvFiles } from '../../core/parser.js';
import { scanProject } from '../../core/scanner.js';
import { readFileSafe, writeFileSafe } from '../../utils/fs.js';
import { error, warning, success, indent, header } from '../../utils/logger.js';
import { prompt, confirm } from '../../utils/prompt.js';

const STANDARD_NODE_VARS = new Set([
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'PWD',
  'OLDPWD',
  'NODE',
  'NODE_PATH',
  'TMPDIR',
  'LANG',
  'LOGNAME',
  'TERM',
  'EDITOR',
  'SHLVL',
  '_',
  '__CF_USER_TEXT_ENCODING',
]);

export const missingCommand = new Command('missing')
  .description('Find process.env references in code that are not defined in any .env file')
  .option('--include-fallbacks', 'Also show variables that have fallback defaults')
  .option('--no-fallbacks', 'Hide variables with fallback defaults')
  .option('--add', 'Interactively add missing variables to .env')
  .action(async (options) => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    const envFiles = await parseAllEnvFiles(projectPath);
    const references = await scanProject(projectPath);
    const definedKeys = new Set(envFiles.flatMap((f) => f.variables.map((v) => v.key)));

    const missingNoFallback = references.filter(
      (r) => !definedKeys.has(r.key) && !r.hasFallback && !STANDARD_NODE_VARS.has(r.key)
    );
    const missingWithFallback = options.fallbacks
      ? references.filter((r) => !definedKeys.has(r.key) && r.hasFallback && !STANDARD_NODE_VARS.has(r.key))
      : [];

    console.log();
    console.log(indent(header(`Missing environment variables in ${projectPath}`)));
    console.log();

    if (missingNoFallback.length === 0 && missingWithFallback.length === 0) {
      console.log(indent(success('All referenced variables are defined')));
      return;
    }

    if (missingNoFallback.length > 0) {
      console.log(indent(header('Missing (no fallback — WILL cause runtime errors)')));
      for (const ref of missingNoFallback) {
        console.log(indent(error(`${ref.key}`), 2));
        console.log(indent(chalk.dim(`→ ${ref.file}:${ref.line}`), 3));
        if (ref.context) {
          console.log(indent(chalk.dim(ref.context.split('\n').map((l) => `  ${l}`).join('\n')), 3));
        }
      }
      console.log();
    }

    if (missingWithFallback.length > 0) {
      console.log(indent(header('Missing (has fallback — will use default value)')));
      for (const ref of missingWithFallback) {
        console.log(indent(warning(`${ref.key}`), 2));
        console.log(indent(chalk.dim(`→ fallback: ${ref.fallbackValue ?? 'unknown'}`), 3));
        console.log(indent(chalk.dim(`→ ${ref.file}:${ref.line}`), 3));
      }
      console.log();
    }

    console.log(
      indent(
        `${error(`${missingNoFallback.length} truly missing`)} · ${warning(
          `${missingWithFallback.length} with fallback defaults`
        )}`
      )
    );

    if (options.add) {
      await addMissingVariables(projectPath, envFiles, missingNoFallback);
    } else {
      console.log();
      console.log(indent('Run with `--add` to interactively add missing variables to .env'));
    }
  });

async function addMissingVariables(
  projectPath: string,
  envFiles: Awaited<ReturnType<typeof parseAllEnvFiles>>,
  missing: Awaited<ReturnType<typeof scanProject>>
): Promise<void> {
  const envPath = join(projectPath, '.env');
  const envFile = envFiles.find((f) => f.filename === '.env');

  if (!envFile) {
    console.log(error('No .env file found. Cannot add variables.'));
    return;
  }

  const updates: string[] = [];
  const exampleUpdates: string[] = [];

  for (const ref of missing) {
    const value = await prompt(`Value for ${ref.key}:`);
    if (!value) continue;

    updates.push(`${ref.key}=${value}`);

    const addToExample = await confirm(`Add ${ref.key} to .env.example?`, false);
    if (addToExample) {
      exampleUpdates.push(`${ref.key}=your_${ref.key.toLowerCase()}`);
    }
  }

  if (updates.length === 0) {
    console.log(indent(chalk.dim('No variables added.')));
    return;
  }

  const existing = (await readFileSafe(envPath)) ?? '';
  const separator = existing.endsWith('\n') || existing === '' ? '' : '\n';
  await writeFileSafe(envPath, `${existing}${separator}${updates.join('\n')}\n`);

  if (exampleUpdates.length > 0) {
    const examplePath = join(projectPath, '.env.example');
    const exampleExisting = (await readFileSafe(examplePath)) ?? '';
    const exampleSeparator = exampleExisting.endsWith('\n') || exampleExisting === '' ? '' : '\n';
    await writeFileSafe(examplePath, `${exampleExisting}${exampleSeparator}${exampleUpdates.join('\n')}\n`);
  }

  console.log();
  console.log(indent(success(`Added ${updates.length} variables to .env`)));
  if (exampleUpdates.length > 0) {
    console.log(indent(success(`Added ${exampleUpdates.length} placeholders to .env.example`)));
  }
}
