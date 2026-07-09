import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, cpSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.mjs');

function runFix(cwd: string, args = ''): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} fix ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { stdout, exitCode: 0 };
  } catch (error) {
    const err = error as Error & { stdout?: string; status?: number };
    return { stdout: err.stdout ?? '', exitCode: err.status ?? 1 };
  }
}

function copyFixture(name: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  cpSync(join(process.cwd(), 'tests', 'fixtures', name), dest, { recursive: true });
}

describe('fix command', () => {
  it('applies all safe fixes with --yes', () => {
    const tempDir = join(tmpdir(), `enve-fix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    copyFixture('basic-project', tempDir);

    try {
      const { stdout, exitCode } = runFix(tempDir, '--yes');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Moved 1 secret variable to .env.local');
      expect(stdout).toContain('Removed 1 unused variable');

      const envContent = readFileSync(join(tempDir, '.env'), 'utf-8');
      expect(envContent).not.toContain('JWT_SECRET');
      expect(envContent).not.toContain('OLD_API_URL');
      expect(envContent).toContain('PORT=3000');

      const gitignore = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('.env');
      expect(gitignore).toContain('.env.local');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reports nothing to fix for a clean project', () => {
    const tempDir = join(tmpdir(), `enve-fix-clean-${Date.now()}`);
    copyFixture('clean-project', tempDir);

    try {
      const { stdout, exitCode } = runFix(tempDir, '--yes');
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No issues to fix');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
