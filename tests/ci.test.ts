import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.mjs');

function runCi(
  cwd: string,
  args: string
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ci ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

describe('ci command', () => {
  it('exits with 1 when errors exist and --fail-on error', () => {
    const { stdout, exitCode } = runCi('./tests/fixtures/basic-project', '--fail-on error');
    expect(stdout).toContain('Enve CI Report');
    expect(stdout).toContain('JWT_SECRET looks like a secret');
    expect(exitCode).toBe(1);
  });

  it('exits with 1 when warnings exist and --fail-on warning', () => {
    const { stdout, exitCode } = runCi('./tests/fixtures/basic-project', '--fail-on warning');
    expect(stdout).toContain('Score:');
    expect(exitCode).toBe(1);
  });

  it('exits with 0 when --fail-on none', () => {
    const { stdout, exitCode } = runCi('./tests/fixtures/basic-project', '--fail-on none');
    expect(stdout).toContain('Enve CI Report');
    expect(exitCode).toBe(0);
  });

  it('outputs valid JSON with --format json', () => {
    const { stdout, exitCode } = runCi('./tests/fixtures/basic-project', '--format json --fail-on none');
    const report = JSON.parse(stdout);
    expect(report).toHaveProperty('name', 'basic-project');
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('issues');
    expect(exitCode).toBe(0);
  });

  it('outputs JUnit XML with --format junit', () => {
    const { stdout, exitCode } = runCi('./tests/fixtures/basic-project', '--format junit --fail-on none');
    expect(stdout).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(stdout).toContain('<testsuites');
    expect(stdout).toContain('<testcase name="unused: JWT_SECRET"');
    expect(exitCode).toBe(0);
  });

  it('exits with 0 for a clean project', () => {
    const { stdout, exitCode } = runCi('./tests/fixtures/clean-project', '--fail-on error');
    expect(stdout).toContain('No issues found');
    expect(exitCode).toBe(0);
  });
});
