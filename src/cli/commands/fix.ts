import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { detectProject, getProjectInfo } from '../../core/project.js';
import { readFileSafe, writeFileSafe, fileExists } from '../../utils/fs.js';
import { error, success, warning, indent, header, bullet } from '../../utils/logger.js';
import { confirm } from '../../utils/prompt.js';
import { isSecretKey } from '../../utils/validators.js';
import type { Issue } from '../../types/index.js';

export const fixCommand = new Command('fix')
  .description('Apply safe, auto-fixable env-file corrections')
  .option('--yes', 'Apply all fixes without prompting')
  .action(async (options: { yes?: boolean }) => {
    const cwd = process.cwd();
    const projectPath = await detectProject(cwd);

    if (!projectPath) {
      console.log(error('No package.json found. Are you in a project directory?'));
      process.exit(1);
    }

    await runFix(projectPath, options.yes ?? false);
  });

export async function runFix(projectPath: string, yes: boolean): Promise<void> {
  const info = await getProjectInfo(projectPath);
  const issues = info.issues;

  console.log();
  console.log(indent(header('Enve Auto-Fix')));
  console.log();

  if (issues.length === 0) {
    console.log(indent(success('No issues to fix')));
    return;
  }

  const applied: string[] = [];

  applied.push(...(await fixGitignore(projectPath, issues, yes)));
  applied.push(...(await fixSecrets(projectPath, issues, yes)));
  applied.push(...(await fixUnused(projectPath, issues, yes)));
  applied.push(...(await fixMissingInExample(projectPath, issues, yes)));
  applied.push(...(await fixExampleFromEnv(projectPath, issues, yes)));

  console.log();
  if (applied.length === 0) {
    console.log(indent(warning('No fixes applied')));
  } else {
    console.log(indent(header('Applied fixes:')));
    for (const message of applied) {
      console.log(indent(bullet(message), 2));
    }
    console.log();
    console.log(indent(success('Run `enve doctor` to see the updated score.')));
  }
}

async function fixGitignore(
  projectPath: string,
  issues: Issue[],
  yes: boolean
): Promise<string[]> {
  const gitignoreIssues = issues.filter((i) => i.type === 'gitignore');
  if (gitignoreIssues.length === 0) return [];

  const patterns = gitignoreIssues.map((i) => i.key);
  const message = `Add ${patterns.join(', ')} to .gitignore?`;
  if (!yes && !(await confirm(message))) return [];

  const gitignorePath = join(projectPath, '.gitignore');
  const content = (await readFileSafe(gitignorePath)) ?? '';
  const lines = content.split('\n');

  for (const pattern of patterns) {
    if (!lines.some((line) => line.trim() === pattern)) {
      lines.push(pattern);
    }
  }

  await writeFileSafe(gitignorePath, lines.join('\n').trimEnd() + '\n');
  return [`Added ${patterns.length} ${patterns.length === 1 ? 'entry' : 'entries'} to .gitignore`];
}

async function fixSecrets(
  projectPath: string,
  issues: Issue[],
  yes: boolean
): Promise<string[]> {
  const secretIssues = issues.filter((i) => i.type === 'secret-risk');
  if (secretIssues.length === 0) return [];

  const keys = secretIssues.map((i) => i.key);
  if (!yes && !(await confirm(`Move ${keys.join(', ')} from .env to .env.local?`))) return [];

  const envPath = join(projectPath, '.env');
  const localPath = join(projectPath, '.env.local');
  const envContent = await readFileSafe(envPath);
  if (!envContent) return [];

  const envLines = envContent.split('\n');
  const localContent = (await readFileSafe(localPath)) ?? '';
  const localLines = localContent ? localContent.split('\n') : [];
  const localKeys = new Set(
    localLines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
  );

  const linesToRemove = new Set<number>();

  for (const issue of secretIssues) {
    const lineIndex = (issue.line ?? 1) - 1;
    const line = envLines[lineIndex];
    if (!line) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim();
    if (key !== issue.key) continue;

    const value = line.slice(equalIndex + 1).trim();
    linesToRemove.add(lineIndex);

    if (!localKeys.has(key)) {
      localLines.push(`${key}=${value}`);
      localKeys.add(key);
    }
  }

  const cleanedEnvLines = envLines.filter((_, idx) => !linesToRemove.has(idx));

  await writeFileSafe(envPath, cleanedEnvLines.join('\n').trimEnd() + '\n');
  await writeFileSafe(localPath, localLines.join('\n').trimEnd() + '\n');

  return [`Moved ${linesToRemove.size} secret ${linesToRemove.size === 1 ? 'variable' : 'variables'} to .env.local`];
}

async function fixUnused(
  projectPath: string,
  issues: Issue[],
  yes: boolean
): Promise<string[]> {
  const secretPattern = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|ACCESS|CREDENTIAL/i;
  const unusedIssues = issues.filter(
    (i) => i.type === 'unused' && i.file === '.env' && !secretPattern.test(i.key)
  );
  if (unusedIssues.length === 0) return [];

  const keys = unusedIssues.map((i) => i.key);
  if (!yes && !(await confirm(`Remove unused ${keys.join(', ')} from .env?`))) return [];

  const envPath = join(projectPath, '.env');
  const content = await readFileSafe(envPath);
  if (!content) return [];

  const lines = content.split('\n');
  const keysToRemove = new Set(keys);
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return true;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) return true;
    let key = trimmed.slice(0, equalIndex).trim();
    if (key.startsWith('export ')) {
      key = key.slice(7).trim();
    }
    if (keysToRemove.has(key)) {
      keysToRemove.delete(key);
      return false;
    }
    return true;
  });

  const removedCount = keys.length - keysToRemove.size;
  if (removedCount === 0) return [];

  await writeFileSafe(envPath, cleaned.join('\n').trimEnd() + '\n');
  return [`Removed ${removedCount} unused ${removedCount === 1 ? 'variable' : 'variables'}`];
}

async function fixMissingInExample(
  projectPath: string,
  issues: Issue[],
  yes: boolean
): Promise<string[]> {
  const missingIssues = issues.filter((i) => i.type === 'missing' && i.severity === 'error');
  if (missingIssues.length === 0) return [];

  const keys = missingIssues.map((i) => i.key);
  if (!yes && !(await confirm(`Add ${keys.join(', ')} placeholders to .env.example?`))) return [];

  const examplePath = join(projectPath, '.env.example');
  const content = (await readFileSafe(examplePath)) ?? '';
  const lines = content ? content.split('\n') : [];
  const existingKeys = new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
  );

  let added = 0;
  for (const key of keys) {
    if (!existingKeys.has(key)) {
      lines.push(`${key}=your_${key.toLowerCase()}`);
      existingKeys.add(key);
      added++;
    }
  }

  if (added === 0) return [];

  await writeFileSafe(examplePath, lines.join('\n').trimEnd() + '\n');
  return [`Added ${added} missing ${added === 1 ? 'placeholder' : 'placeholders'} to .env.example`];
}

async function fixExampleFromEnv(
  projectPath: string,
  issues: Issue[],
  yes: boolean
): Promise<string[]> {
  const suspiciousIssues = issues.filter(
    (i) => i.type === 'suspicious' && i.key !== '.env.example'
  );
  const missingExampleIssue = issues.find((i) => i.type === 'suspicious' && i.key === '.env.example');

  if (suspiciousIssues.length === 0 && !missingExampleIssue) return [];

  const envPath = join(projectPath, '.env');
  const envContent = await readFileSafe(envPath);
  if (!envContent) return [];

  const examplePath = join(projectPath, '.env.example');
  const exampleExists = await fileExists(examplePath);
  const exampleContent = (await readFileSafe(examplePath)) ?? '';
  const exampleLines = exampleContent ? exampleContent.split('\n') : [];
  const existingKeys = new Set(
    exampleLines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
  );

  const envVars = parseSimpleEnv(envContent);
  let added = 0;

  if (missingExampleIssue) {
    if (yes || (await confirm('Create .env.example from .env?'))) {
      const newLines: string[] = [];
      for (const variable of envVars) {
        if (variable.isSecret || isSecretKey(variable.key)) {
          newLines.push(`${variable.key}=your_${variable.key.toLowerCase()}`);
        } else {
          newLines.push(`${variable.key}=${variable.value}`);
        }
        added++;
      }
      await writeFileSafe(examplePath, newLines.join('\n').trimEnd() + '\n');
      return [`Created .env.example with ${added} variables`];
    }
    return [];
  }

  const keysToAdd = suspiciousIssues.map((i) => i.key);
  if (!yes && !(await confirm(`Add ${keysToAdd.join(', ')} to .env.example?`))) return [];

  for (const variable of envVars) {
    if (!keysToAdd.includes(variable.key)) continue;
    if (existingKeys.has(variable.key)) continue;

    if (variable.isSecret || isSecretKey(variable.key)) {
      exampleLines.push(`${variable.key}=your_${variable.key.toLowerCase()}`);
    } else {
      exampleLines.push(`${variable.key}=${variable.value}`);
    }
    existingKeys.add(variable.key);
    added++;
  }

  if (added === 0) return [];

  await writeFileSafe(examplePath, exampleLines.join('\n').trimEnd() + '\n');
  return [`Added ${added} missing ${added === 1 ? 'variable' : 'variables'} to .env.example`];
}

function parseSimpleEnv(content: string): Array<{ key: string; value: string; isSecret: boolean }> {
  const variables: Array<{ key: string; value: string; isSecret: boolean }> = [];
  const secretPattern = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|ACCESS|CREDENTIAL/i;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    let key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim();

    if (key.startsWith('export ')) {
      key = key.slice(7).trim();
    }

    if (!key) continue;
    variables.push({ key, value, isSecret: secretPattern.test(key) });
  }

  return variables;
}
