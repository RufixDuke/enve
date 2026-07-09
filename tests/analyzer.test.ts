import { describe, it, expect } from 'vitest';
import { analyze, calculateScore } from '../src/core/analyzer.js';
import type { EnvFile, EnvReference, Issue } from '../src/types/index.js';

function makeEnvFile(filename: string, variables: Array<{ key: string; value: string; isSecret?: boolean }>): EnvFile {
  return {
    filename,
    path: `/project/${filename}`,
    variables: variables.map((v, i) => ({
      key: v.key,
      value: v.value,
      line: i + 1,
      source: filename,
      isSecret: v.isSecret ?? false,
    })),
  };
}

function makeRef(key: string, hasFallback = false, fallbackValue?: string): EnvReference {
  return {
    key,
    file: '/project/src/app.ts',
    line: 1,
    column: 0,
    context: '',
    hasFallback,
    fallbackValue,
  };
}

describe('analyze', () => {
  it('flags missing variables without fallback as errors', async () => {
    const envFiles: EnvFile[] = [makeEnvFile('.env', [{ key: 'PORT', value: '3000' }])];
    const refs: EnvReference[] = [makeRef('DATABASE_URL')];

    const issues = await analyze(envFiles, refs, '/project');
    const missing = issues.filter((i) => i.type === 'missing');

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      type: 'missing',
      severity: 'error',
      key: 'DATABASE_URL',
    });
  });

  it('flags missing variables with fallback as warnings', async () => {
    const envFiles: EnvFile[] = [makeEnvFile('.env', [{ key: 'PORT', value: '3000' }])];
    const refs: EnvReference[] = [makeRef('HOST', true, '0.0.0.0')];

    const issues = await analyze(envFiles, refs, '/project');
    const missing = issues.filter((i) => i.type === 'missing');

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      type: 'missing',
      severity: 'warning',
      key: 'HOST',
      hasFallback: true,
    });
  });

  it('flags unused variables except always-allowed ones', async () => {
    const envFiles: EnvFile[] = [
      makeEnvFile('.env', [
        { key: 'PORT', value: '3000' },
        { key: 'OLD_API_URL', value: 'https://old.example.com' },
      ]),
    ];
    const refs: EnvReference[] = [];

    const issues = await analyze(envFiles, refs, '/project');

    const unusedKeys = issues.filter((i) => i.type === 'unused').map((i) => i.key);
    expect(unusedKeys).toContain('OLD_API_URL');
    expect(unusedKeys).not.toContain('PORT');
  });

  it('does not flag variables in .env.example as unused', async () => {
    const envFiles: EnvFile[] = [
      makeEnvFile('.env.example', [{ key: 'UNUSED_IN_EXAMPLE', value: 'x' }]),
    ];
    const refs: EnvReference[] = [];

    const issues = await analyze(envFiles, refs, '/project');

    expect(issues).toHaveLength(0);
  });

  it('flags secrets in .env as secret-risk errors', async () => {
    const envFiles: EnvFile[] = [
      makeEnvFile('.env', [{ key: 'STRIPE_SECRET_KEY', value: 'sk_test_123', isSecret: true }]),
      makeEnvFile('.env.local', [{ key: 'LOCAL_SECRET', value: 'safe-here', isSecret: true }]),
    ];
    const refs: EnvReference[] = [];

    const issues = await analyze(envFiles, refs, '/project');

    const secretIssues = issues.filter((i) => i.type === 'secret-risk');
    expect(secretIssues).toHaveLength(1);
    expect(secretIssues[0].key).toBe('STRIPE_SECRET_KEY');
  });

  it('flags .env files not in .gitignore', async () => {
    const envFiles: EnvFile[] = [makeEnvFile('.env', [{ key: 'PORT', value: '3000' }])];
    const refs: EnvReference[] = [];

    const issues = await analyze(envFiles, refs, '/project');

    const gitignoreIssues = issues.filter((i) => i.type === 'gitignore');
    expect(gitignoreIssues.length).toBeGreaterThan(0);
    expect(gitignoreIssues.map((i) => i.key)).toContain('.env');
  });

  it('flags missing .env.example', async () => {
    const envFiles: EnvFile[] = [makeEnvFile('.env', [{ key: 'PORT', value: '3000' }])];
    const refs: EnvReference[] = [];

    const issues = await analyze(envFiles, refs, '/project');

    const exampleIssue = issues.find((i) => i.key === '.env.example');
    expect(exampleIssue).toBeDefined();
    expect(exampleIssue?.type).toBe('suspicious');
  });

  it('flags variables in .env missing from .env.example', async () => {
    const envFiles: EnvFile[] = [
      makeEnvFile('.env', [{ key: 'PORT', value: '3000' }]),
      makeEnvFile('.env.example', []),
    ];
    const refs: EnvReference[] = [];

    const issues = await analyze(envFiles, refs, '/project');

    const missingExample = issues.find((i) => i.key === 'PORT' && i.type === 'suspicious');
    expect(missingExample).toBeDefined();
  });
});

describe('calculateScore', () => {
  it('returns 100 for no issues', () => {
    const result = calculateScore([]);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('Excellent');
  });

  it('deducts for missing variables without fallback', () => {
    const issues: Issue[] = [
      { type: 'missing', severity: 'error', key: 'A', message: '', file: '' },
      { type: 'missing', severity: 'error', key: 'B', message: '', file: '' },
    ];
    const result = calculateScore(issues);
    expect(result.score).toBe(80);
    expect(result.errorCount).toBe(2);
  });

  it('deducts less for missing variables with fallback', () => {
    const issues: Issue[] = [
      { type: 'missing', severity: 'warning', key: 'A', message: '', file: '', hasFallback: true },
      { type: 'missing', severity: 'warning', key: 'B', message: '', file: '', hasFallback: true },
    ];
    const result = calculateScore(issues);
    expect(result.score).toBe(94);
  });

  it('heavily deducts for ungitignored .env files', () => {
    const issues: Issue[] = [
      { type: 'gitignore', severity: 'error', key: '.env', message: '', file: '' },
    ];
    const result = calculateScore(issues);
    expect(result.score).toBe(80);
  });

  it('deducts for secrets in .env', () => {
    const issues: Issue[] = [
      { type: 'secret-risk', severity: 'error', key: 'SECRET', message: '', file: '' },
    ];
    const result = calculateScore(issues);
    expect(result.score).toBe(92);
  });

  it('caps unused variable deductions', () => {
    const issues: Issue[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'unused',
      severity: 'warning',
      key: `UNUSED_${i}`,
      message: '',
      file: '',
    }));
    const result = calculateScore(issues);
    expect(result.score).toBe(85);
  });

  it('grades correctly at boundaries', () => {
    expect(calculateScore([]).grade).toBe('Excellent');
    expect(calculateScore([{ type: 'gitignore', severity: 'error', key: '.env', message: '', file: '' }]).grade).toBe('Good');
    expect(calculateScore([{ type: 'gitignore', severity: 'error', key: '.env.production', message: '', file: '' }]).grade).toBe('Good');
    expect(calculateScore([
      { type: 'gitignore', severity: 'error', key: '.env.production', message: '', file: '' },
      { type: 'gitignore', severity: 'error', key: '.env', message: '', file: '' },
    ]).grade).toBe('Needs attention');
  });
});
