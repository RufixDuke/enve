import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject } from '../../core/project.js';
import { parseAllEnvFiles } from '../../core/parser.js';
import { scanProject } from '../../core/scanner.js';
import { readFileSafe, writeFileSafe } from '../../utils/fs.js';
import { copyFile } from 'node:fs/promises';
import { error, warning, success, indent, header } from '../../utils/logger.js';
import { confirm } from '../../utils/prompt.js';

export const unusedCommand = new Command('unused')
  .description('Find environment variables defined in .env files but never referenced in code')
  .option('--fix', 'Remove unused variables from .env files')
  .option('--dry-run', 'Show what would be removed without making changes')
  .option('--include-commons', 'Also flag PORT, HOST, NODE_ENV if truly unused')
  .action(async (options) => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    const envFiles = await parseAllEnvFiles(projectPath);
    const references = await scanProject(projectPath);
    const referencedKeys = new Set(references.map((r) => r.key));

    const alwaysAllowed = options.includeCommons ? [] : ['PORT', 'HOST', 'NODE_ENV', 'CI', 'PWD'];

    type UnusedItem = { filename: string; path: string; key: string; line: number };
    const unused: UnusedItem[] = [];

    for (const file of envFiles) {
      if (file.filename === '.env.example' || file.filename === '.env.test') continue;
      for (const variable of file.variables) {
        if (alwaysAllowed.includes(variable.key)) continue;
        if (!referencedKeys.has(variable.key)) {
          unused.push({
            filename: file.filename,
            path: file.path,
            key: variable.key,
            line: variable.line,
          });
        }
      }
    }

    console.log();
    console.log(indent(header(`Unused variables in ${projectPath}`)));
    console.log();

    if (unused.length === 0) {
      console.log(indent(success('All variables are used')));
      return;
    }

    // Group by file
    const byFile = new Map<string, UnusedItem[]>();
    for (const item of unused) {
      byFile.set(item.filename, [...(byFile.get(item.filename) ?? []), item]);
    }

    for (const [filename, items] of byFile) {
      console.log(indent(filename));
      for (const item of items) {
        console.log(indent(warning(`${item.key.padEnd(20)} (line ${item.line})`), 2));
      }
    }

    console.log();
    console.log(indent(`${unused.length} unused variables found. They may be safe to remove.`));

    if (options.dryRun) {
      console.log(indent(chalk.dim('Dry run: no changes made.')));
      return;
    }

    if (!options.fix) {
      console.log(indent('Run `enve unused --fix` to remove them, or `--dry-run` to preview.'));
      return;
    }

    const confirmed = await confirm(`Remove ${unused.length} unused variables from .env files?`);
    if (!confirmed) {
      console.log(indent(chalk.dim('Aborted. No changes made.')));
      return;
    }

    // Group by file path for removal
    const byPath = new Map<string, UnusedItem[]>();
    for (const item of unused) {
      byPath.set(item.path, [...(byPath.get(item.path) ?? []), item]);
    }

    let removedCount = 0;
    for (const [filePath, items] of byPath) {
      const backupPath = `${filePath}.backup.${formatTimestamp(new Date())}`;
      await copyFile(filePath, backupPath);

      const content = (await readFileSafe(filePath)) ?? '';
      const lines = content.split('\n');
      const linesToRemove = new Set(items.map((i) => i.line - 1));
      const newLines = lines.filter((_, idx) => !linesToRemove.has(idx));
      await writeFileSafe(filePath, newLines.join('\n'));

      removedCount += items.length;
      console.log(indent(chalk.dim(`Backup saved: ${backupPath}`), 2));
    }

    console.log();
    console.log(indent(success(`Removed ${removedCount} unused variables.`)));
  });

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
