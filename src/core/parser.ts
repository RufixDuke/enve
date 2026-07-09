import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EnvFile, EnvVariable } from '../types/index.js';
import { readFileSafe } from '../utils/fs.js';

export function parseEnvFile(filePath: string): EnvVariable[] {
  let content: string | undefined;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  if (!content) return [];

  const variables: EnvVariable[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    let key = trimmed.slice(0, equalIndex).trim();
    let rawValue = trimmed.slice(equalIndex + 1);

    // Strip export keyword
    if (key.startsWith('export ')) {
      key = key.slice(7).trim();
    }

    if (!key) continue;

    const { value, comment } = parseValue(rawValue);
    const isSecret = detectSecret(key, value);

    variables.push({
      key,
      value,
      line: i + 1,
      source: filePath,
      isSecret,
      comment,
    });
  }

  return variables;
}

function parseValue(raw: string): { value: string; comment?: string } {
  const trimmed = raw.trimStart();

  if (trimmed.startsWith('"')) {
    const { value, endIndex } = parseQuotedValue(trimmed, '"');
    const rest = trimmed.slice(endIndex + 1).trim();
    const comment = extractInlineComment(rest);
    return { value: unescape(value), comment };
  }

  if (trimmed.startsWith("'")) {
    const { value, endIndex } = parseQuotedValue(trimmed, "'");
    const rest = trimmed.slice(endIndex + 1).trim();
    const comment = extractInlineComment(rest);
    return { value, comment };
  }

  const trailing = raw.trimEnd();
  const commentIndex = findUnquotedCommentIndex(trailing);
  if (commentIndex !== -1) {
    return {
      value: trailing.slice(0, commentIndex).trimEnd(),
      comment: trailing.slice(commentIndex + 1).trim(),
    };
  }

  return { value: raw.trimEnd() };
}

function parseQuotedValue(raw: string, quote: string): { value: string; endIndex: number } {
  let value = '';
  let escaped = false;
  for (let i = 1; i < raw.length; i++) {
    const char = raw[i];
    if (escaped) {
      if (char === 'n') value += '\n';
      else if (char === 't') value += '\t';
      else if (char === quote) value += quote;
      else value += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return { value, endIndex: i };
    }
    value += char;
  }
  // Unterminated quote — return rest as value
  return { value, endIndex: raw.length - 1 };
}

function unescape(value: string): string {
  // Escape sequences are already handled during quote parsing.
  // This function remains as a no-op fallback for any raw unquoted escapes.
  return value;
}

function extractInlineComment(rest: string): string | undefined {
  const idx = rest.indexOf('#');
  if (idx === -1) return undefined;
  return rest.slice(idx + 1).trim();
}

function findUnquotedCommentIndex(value: string): number {
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '#' && (i === 0 || value[i - 1] === ' ')) {
      return i;
    }
  }
  return -1;
}

function detectSecret(key: string, value: string): boolean {
  const secretPatterns = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|ACCESS|CREDENTIAL/i;
  if (secretPatterns.test(key)) return true;

  // Simple entropy heuristic: high ratio of non-word characters or length > 20 with mixed case
  if (value.length > 20 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value)) {
    return true;
  }

  return false;
}

export async function findEnvFiles(projectPath: string): Promise<EnvFile[]> {
  const envFileNames = ['.env', '.env.local', '.env.development', '.env.production', '.env.test', '.env.example'];
  const files: EnvFile[] = [];

  for (const name of envFileNames) {
    const filePath = join(projectPath, name);
    const content = await readFileSafe(filePath);
    if (content !== undefined) {
      files.push({
        path: filePath,
        filename: name,
        variables: parseEnvFile(filePath),
      });
    }
  }

  return files;
}

export async function parseAllEnvFiles(projectPath: string): Promise<EnvFile[]> {
  return findEnvFiles(projectPath);
}
