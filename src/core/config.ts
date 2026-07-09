import Conf from 'conf';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EnveConfig, TrackedProject, HistoryEntry } from '../types/index.js';

const DEFAULT_CONFIG: EnveConfig = {
  version: 1,
  projects: [],
  sync: {},
  history: [],
};

function createConfig(): Conf<EnveConfig> {
  return new Conf<EnveConfig>({
    projectName: 'enve',
    defaults: DEFAULT_CONFIG,
  });
}

export function getProjects(): TrackedProject[] {
  const config = createConfig();
  return config.get('projects', []);
}

export function isTracked(projectPath: string): boolean {
  return getProjects().some((p) => p.path === projectPath);
}

export function getProject(projectPath: string): TrackedProject | undefined {
  return getProjects().find((p) => p.path === projectPath);
}

export async function addProject(projectPath: string): Promise<TrackedProject> {
  const config = createConfig();

  if (isTracked(projectPath)) {
    return getProject(projectPath)!;
  }

  const name = await detectProjectName(projectPath);
  const project: TrackedProject = {
    name,
    path: projectPath,
    addedAt: new Date().toISOString(),
  };

  const projects = config.get('projects', []);
  config.set('projects', [...projects, project]);

  return project;
}

export function removeProject(projectPath: string): boolean {
  const config = createConfig();
  const projects = config.get('projects', []);
  const before = projects.length;
  const filtered = projects.filter((p) => p.path !== projectPath);

  if (filtered.length === before) return false;

  config.set('projects', filtered);
  return true;
}

export function setSyncPath(path: string): void {
  const config = createConfig();
  const sync = config.get('sync', {});
  sync.path = path;
  config.set('sync', sync);
}

export function getSyncPath(): string | undefined {
  const config = createConfig();
  return config.get('sync', {}).path;
}

export function getHistory(projectPath?: string): HistoryEntry[] {
  const config = createConfig();
  const history = config.get('history', []);
  if (!projectPath) return history;
  return history.filter((entry) => entry.projectPath === projectPath);
}

export function addHistory(entry: HistoryEntry): void {
  const config = createConfig();
  const history = config.get('history', []);
  history.push(entry);

  // Keep only the last 50 entries per project
  const byProject = new Map<string, HistoryEntry[]>();
  for (const h of history) {
    if (!byProject.has(h.projectPath)) byProject.set(h.projectPath, []);
    byProject.get(h.projectPath)!.push(h);
  }

  const trimmed: HistoryEntry[] = [];
  for (const entries of byProject.values()) {
    trimmed.push(...entries.slice(-50));
  }

  config.set('history', trimmed);
}

async function detectProjectName(projectPath: string): Promise<string> {
  try {
    const pkgRaw = await readFile(join(projectPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw) as { name?: string };
    if (pkg.name) return pkg.name;
  } catch {
    // fall through to directory name
  }
  return projectPath.split('/').pop() ?? 'unknown';
}
