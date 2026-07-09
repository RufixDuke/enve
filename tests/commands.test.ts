import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.mjs');

function runCommand(cwd: string, args: string): { stdout: string; stderr: string } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { stdout, stderr: '' };
  } catch (error) {
    return {
      stdout: (error as Error & { stdout?: string }).stdout ?? '',
      stderr: (error as Error & { stderr?: string }).stderr ?? '',
    };
  }
}

describe('commands', () => {
  it('scan reports issues on basic-project', () => {
    const { stdout } = runCommand('./tests/fixtures/basic-project', 'scan');

    expect(stdout).toContain('Enve Scan Report');
    expect(stdout).toContain('basic-project');
    expect(stdout).toContain('JWT_SECRET looks like a secret');
    expect(stdout).toContain('Score:');
  });

  it('doctor runs on basic-project', () => {
    const { stdout } = runCommand('./tests/fixtures/basic-project', 'doctor');

    expect(stdout).toContain('Enve Health Check');
    expect(stdout).toContain('[File Structure]');
    expect(stdout).toContain('[Variables');
  });

  it('unused detects dead variables on basic-project', () => {
    const { stdout } = runCommand('./tests/fixtures/basic-project', 'unused');

    expect(stdout).toContain('Unused variables');
    expect(stdout).toContain('OLD_API_URL');
  });

  it('missing detects missing variables on no-env fixture', () => {
    const { stdout } = runCommand('./tests/fixtures/no-env', 'missing');

    expect(stdout).toContain('Missing environment variables');
    expect(stdout).toContain('PORT');
  });

  it('validate reports invalid values on messy-project', () => {
    const { stdout } = runCommand('./tests/fixtures/messy-project', 'validate');

    expect(stdout).toContain('Validating environment variables');
    expect(stdout).toContain('DATABASE_URL');
  });

  it('generate-example creates .env.example', () => {
    const tempDir = join(tmpdir(), `enve-gen-example-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    copyFileSync('./tests/fixtures/basic-project/.env', join(tempDir, '.env'));
    copyFileSync('./tests/fixtures/basic-project/package.json', join(tempDir, 'package.json'));

    try {
      const { stdout } = runCommand(tempDir, 'generate-example --overwrite');
      expect(stdout).toContain('Created .env.example');

      const example = readFileSync(join(tempDir, '.env.example'), 'utf-8');
      expect(example).toContain('PORT=3000');
      expect(example).toContain('JWT_SECRET=your_jwt_secret');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
