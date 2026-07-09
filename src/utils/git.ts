import { join } from 'node:path';
import { readFileSafe, fileExists, writeFileSafe } from './fs.js';

const PRE_COMMIT_HOOK_MARKER = '# === Enve Pre-Commit Hook ===';
const PRE_COMMIT_HOOK_END = '# === End Enve Hook ===';

export async function isGitRepo(projectPath: string): Promise<boolean> {
  return fileExists(join(projectPath, '.git'));
}

export async function readGitignore(projectPath: string): Promise<string | undefined> {
  const gitignorePath = join(projectPath, '.gitignore');
  return readFileSafe(gitignorePath);
}

export function isPatternInGitignore(gitignoreContent: string, pattern: string): boolean {
  const lines = gitignoreContent.split('\n');
  return lines.some((line) => {
    const trimmed = line.trim();
    return trimmed === pattern || trimmed === `/${pattern}`;
  });
}

export async function isEnvFileGitignored(
  projectPath: string,
  filename: string
): Promise<boolean> {
  const content = await readGitignore(projectPath);
  if (!content) return false;
  return isPatternInGitignore(content, filename);
}

export function getPreCommitHookPath(projectPath: string): string {
  return join(projectPath, '.git', 'hooks', 'pre-commit');
}

export function getHookScript(): string {
  return `#!/bin/bash
${PRE_COMMIT_HOOK_MARKER}
# Blocks commits of .env files that may contain secrets
# Installed by: enve hook install
# Remove with: enve hook uninstall

BLOCKED_PATTERNS='^\\.env(\\.[^/]*)?$'
STAGED_ENV_FILES=$(git diff --cached --name-only | grep -E "$BLOCKED_PATTERNS" || true)

if [ -n "$STAGED_ENV_FILES" ]; then
  echo ""
  echo "  ✗ COMMIT BLOCKED by Enve"
  echo ""
  echo "  You are attempting to commit environment files:"
  echo "$STAGED_ENV_FILES" | sed 's/^/    /'
  echo ""
  echo "  These files may contain secrets (API keys, passwords, tokens)."
  echo ""
  echo "  What to do instead:"
  echo "    1. Add them to .gitignore:  echo '.env.local' >> .gitignore"
  echo "    2. Use .env.example for templates:  enve generate-example"
  echo "    3. Share secrets through a secure channel (1Password, etc.)"
  echo ""
  echo "  If you are CERTAIN these files are safe to commit:"
  echo "    git commit --no-verify"
  echo ""
  exit 1
fi
${PRE_COMMIT_HOOK_END}
`;
}

export async function isHookInstalled(projectPath: string): Promise<boolean> {
  const hookPath = getPreCommitHookPath(projectPath);
  if (!(await fileExists(hookPath))) return false;
  const content = await readFileSafe(hookPath);
  return content?.includes(PRE_COMMIT_HOOK_MARKER) ?? false;
}

export async function installHook(projectPath: string): Promise<void> {
  const hookPath = getPreCommitHookPath(projectPath);
  const existing = (await readFileSafe(hookPath)) ?? '';

  if (existing.includes(PRE_COMMIT_HOOK_MARKER)) {
    return; // Already installed
  }

  const newContent = `${getHookScript()}\n${existing}`;
  await writeFileSafe(hookPath, newContent);
}

export async function uninstallHook(projectPath: string): Promise<boolean> {
  const hookPath = getPreCommitHookPath(projectPath);
  if (!(await fileExists(hookPath))) return false;

  const content = await readFileSafe(hookPath);
  if (!content || !content.includes(PRE_COMMIT_HOOK_MARKER)) return false;

  const markerStart = content.indexOf(PRE_COMMIT_HOOK_MARKER);
  const markerEnd = content.indexOf(PRE_COMMIT_HOOK_END, markerStart);
  if (markerStart === -1 || markerEnd === -1) return false;

  const before = content.slice(0, markerStart);
  const after = content.slice(markerEnd + PRE_COMMIT_HOOK_END.length);
  const newContent = `${before.trimEnd()}\n${after.trimStart()}`.trim();

  if (newContent) {
    await writeFileSafe(hookPath, `${newContent}\n`);
  } else {
    // No remaining content; leave file removal to caller if desired
    await writeFileSafe(hookPath, '');
  }
  return true;
}
