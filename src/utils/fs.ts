import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readFileSafe(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

export async function writeFileSafe(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  if (!dirPath) return;
  try {
    await mkdir(dirPath, { recursive: true });
  } catch {
    // Directory may already exist
  }
}
