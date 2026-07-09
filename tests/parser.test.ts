import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnvFile, findEnvFiles, parseAllEnvFiles } from '../src/core/parser.js';

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `enve-parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeEnv(content: string): string {
  const path = join(tempDir, '.env');
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('parseEnvFile', () => {
  it('parses basic key-value pairs', () => {
    const path = writeEnv('PORT=3000\nNODE_ENV=development');
    const vars = parseEnvFile(path);

    expect(vars).toHaveLength(2);
    expect(vars[0]).toMatchObject({ key: 'PORT', value: '3000', line: 1 });
    expect(vars[1]).toMatchObject({ key: 'NODE_ENV', value: 'development', line: 2 });
  });

  it('skips empty lines and comments', () => {
    const path = writeEnv('\n# comment\nPORT=3000\n\n');
    const vars = parseEnvFile(path);

    expect(vars).toHaveLength(1);
    expect(vars[0].key).toBe('PORT');
  });

  it('handles empty values', () => {
    const path = writeEnv('KEY=\nQUOTED=""');
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({ key: 'KEY', value: '' });
    expect(vars[1]).toMatchObject({ key: 'QUOTED', value: '' });
  });

  it('handles values containing equals signs', () => {
    const path = writeEnv('KEY=val=ue=here');
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({ key: 'KEY', value: 'val=ue=here' });
  });

  it('handles double-quoted values with spaces', () => {
    const path = writeEnv('KEY="value with spaces"');
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({ key: 'KEY', value: 'value with spaces' });
  });

  it('handles single-quoted values literally', () => {
    const path = writeEnv("KEY='value with ${interpolation}'");
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({ key: 'KEY', value: 'value with ${interpolation}' });
  });

  it('converts escape sequences in double quotes', () => {
    const path = writeEnv('KEY="line1\\nline2\\ttab"');
    const vars = parseEnvFile(path);

    expect(vars[0].value).toBe('line1\nline2\ttab');
  });

  it('extracts inline comments for unquoted values', () => {
    const path = writeEnv('KEY=value # this is a comment');
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({
      key: 'KEY',
      value: 'value',
      comment: 'this is a comment',
    });
  });

  it('extracts inline comments with equals signs', () => {
    const path = writeEnv('KEY=value # comment with = sign');
    const vars = parseEnvFile(path);

    expect(vars[0].comment).toBe('comment with = sign');
  });

  it('does not treat # inside quotes as a comment', () => {
    const path = writeEnv('KEY="value # not a comment"');
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({
      key: 'KEY',
      value: 'value # not a comment',
    });
    expect(vars[0].comment).toBeUndefined();
  });

  it('strips the export keyword', () => {
    const path = writeEnv('export KEY=value');
    const vars = parseEnvFile(path);

    expect(vars[0]).toMatchObject({ key: 'KEY', value: 'value' });
  });

  it('detects secret keys', () => {
    const path = writeEnv('JWT_SECRET=abc\nPUBLIC_KEY=def\nNORMAL=value');
    const vars = parseEnvFile(path);

    expect(vars.find((v) => v.key === 'JWT_SECRET')?.isSecret).toBe(true);
    expect(vars.find((v) => v.key === 'PUBLIC_KEY')?.isSecret).toBe(true);
    expect(vars.find((v) => v.key === 'NORMAL')?.isSecret).toBe(false);
  });

  it('detects high-entropy secret values', () => {
    const path = writeEnv('API_KEY=Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv');
    const vars = parseEnvFile(path);

    expect(vars[0].isSecret).toBe(true);
  });

  it('ignores YAML-style key-colon syntax', () => {
    const path = writeEnv('KEY: value\nREAL=value');
    const vars = parseEnvFile(path);

    expect(vars).toHaveLength(1);
    expect(vars[0].key).toBe('REAL');
  });

  it('ignores lines without an equals sign', () => {
    const path = writeEnv('not_a_valid_line\nKEY=value');
    const vars = parseEnvFile(path);

    expect(vars).toHaveLength(1);
    expect(vars[0].key).toBe('KEY');
  });

  it('returns empty array for missing file', () => {
    const vars = parseEnvFile(join(tempDir, 'missing.env'));
    expect(vars).toEqual([]);
  });
});

describe('findEnvFiles', () => {
  it('finds standard .env files', async () => {
    writeFileSync(join(tempDir, '.env'), 'A=1');
    writeFileSync(join(tempDir, '.env.local'), 'B=2');
    writeFileSync(join(tempDir, '.env.example'), 'C=3');

    const files = await findEnvFiles(tempDir);

    expect(files.map((f) => f.filename)).toEqual(expect.arrayContaining(['.env', '.env.local', '.env.example']));
  });

  it('does not include non-existent files', async () => {
    writeFileSync(join(tempDir, '.env'), 'A=1');

    const files = await findEnvFiles(tempDir);

    expect(files).toHaveLength(1);
  });
});

describe('parseAllEnvFiles', () => {
  it('parses all existing .env files', async () => {
    writeFileSync(join(tempDir, '.env'), 'A=1');
    writeFileSync(join(tempDir, '.env.local'), 'B=2');

    const files = await parseAllEnvFiles(tempDir);

    expect(files).toHaveLength(2);
    expect(files[0].variables[0].key).toBe('A');
    expect(files[1].variables[0].key).toBe('B');
  });
});
