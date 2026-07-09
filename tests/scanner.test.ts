import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanFile, scanProject } from '../src/core/scanner.js';

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `enve-scanner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(join(tempDir, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeSrc(filename: string, content: string): string {
  const path = join(tempDir, filename);
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('scanFile', () => {
  it('detects direct process.env access', async () => {
    const path = writeSrc('src/app.ts', 'const port = process.env.PORT;');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: 'PORT', hasFallback: false });
  });

  it('detects bracket string access', async () => {
    const path = writeSrc('src/app.ts', "const url = process.env['DATABASE_URL'];");
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: 'DATABASE_URL', hasFallback: false });
  });

  it('detects import.meta.env access', async () => {
    const path = writeSrc('src/app.ts', 'const key = import.meta.env.VITE_API_KEY;');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: 'VITE_API_KEY', hasFallback: false });
  });

  it('detects destructuring from process.env', async () => {
    const path = writeSrc('src/app.ts', 'const { PORT, HOST } = process.env;');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.key)).toEqual(expect.arrayContaining(['PORT', 'HOST']));
  });

  it('detects renamed destructuring from process.env', async () => {
    const path = writeSrc('src/app.ts', 'const { PORT: port, HOST: host } = process.env;');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.key)).toEqual(expect.arrayContaining(['PORT', 'HOST']));
  });

  it('detects destructuring from process.env with fallback object', async () => {
    const path = writeSrc('src/app.ts', "const { PORT } = process.env || {};");
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: 'PORT', hasFallback: false });
  });

  it('detects nested destructuring from process', async () => {
    const path = writeSrc('src/app.ts', 'const { env: { PORT } } = process;');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: 'PORT' });
  });

  it('detects fallback with ||', async () => {
    const path = writeSrc('src/app.ts', "const port = process.env.PORT || 3000;");
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: 'PORT',
      hasFallback: true,
      fallbackValue: '3000',
    });
  });

  it('detects fallback with ??', async () => {
    const path = writeSrc('src/app.ts', "const url = process.env.API_URL ?? 'https://default.com';");
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: 'API_URL',
      hasFallback: true,
      fallbackValue: "'https://default.com'",
    });
  });

  it('detects ternary fallback', async () => {
    const path = writeSrc('src/app.ts', 'const debug = process.env.DEBUG ? true : false;');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: 'DEBUG',
      hasFallback: true,
      fallbackType: 'ternary',
      fallbackValue: 'false',
    });
  });

  it('detects guarded && access as fallback', async () => {
    const path = writeSrc('src/app.ts', 'process.env.API_KEY && callApi();');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: 'API_KEY',
      hasFallback: true,
      fallbackValue: 'guarded',
    });
  });

  it('captures function call fallback value', async () => {
    const path = writeSrc('src/app.ts', 'const retries = process.env.MAX_RETRIES || getDefaultRetries();');
    const refs = await scanFile(path);

    expect(refs[0]).toMatchObject({
      key: 'MAX_RETRIES',
      hasFallback: true,
      fallbackValue: '<getDefaultRetries()>',
      fallbackType: 'function',
    });
  });

  it('captures expression fallback value', async () => {
    const path = writeSrc('src/app.ts', 'const timeout = process.env.TIMEOUT || 30 * 1000;');
    const refs = await scanFile(path);

    expect(refs[0]).toMatchObject({
      key: 'TIMEOUT',
      hasFallback: true,
      fallbackValue: '30 * 1000',
      fallbackType: 'expression',
    });
  });

  it('skips dynamic bracket access', async () => {
    const path = writeSrc('src/app.ts', 'const key = "SECRET"; const val = process.env[key];');
    const refs = await scanFile(path);

    expect(refs).toHaveLength(0);
  });

  it('detects destructuring with default values', async () => {
    const path = writeSrc('src/app.ts', "const { PORT = 3000 } = process.env;");
    const refs = await scanFile(path);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: 'PORT',
      hasFallback: true,
      fallbackValue: '3000',
    });
  });
});

describe('scanProject', () => {
  it('scans all source files in a project', async () => {
    writeSrc('src/app.ts', 'const port = process.env.PORT;');
    writeSrc('src/config.ts', 'const db = process.env.DATABASE_URL;');

    const refs = await scanProject(tempDir);

    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.key)).toEqual(expect.arrayContaining(['PORT', 'DATABASE_URL']));
  });

  it('falls back to regex for TSX/JSX files that acorn cannot parse', async () => {
    mkdirSync(join(tempDir, 'components'), { recursive: true });
    writeFileSync(
      join(tempDir, 'components', 'Card.tsx'),
      `import React from 'react';
      type Props = { title: string };
      export const Card: React.FC<Props> = ({ title }) => {
        const apiUrl = process.env.API_URL;
        return <div>{title} {apiUrl}</div>;
      };`,
      'utf-8'
    );

    const refs = await scanProject(tempDir);

    expect(refs.some((r) => r.key === 'API_URL')).toBe(true);
  });

  it('ignores node_modules and dist', async () => {
    writeSrc('src/app.ts', 'const port = process.env.PORT;');
    mkdirSync(join(tempDir, 'node_modules'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'pkg.js'), 'process.env.IGNORED;', 'utf-8');

    const refs = await scanProject(tempDir);

    expect(refs).toHaveLength(1);
    expect(refs[0].key).toBe('PORT');
  });
});
