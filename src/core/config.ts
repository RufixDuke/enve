import Conf from 'conf';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EnveConfig, TrackedProject } from '../types/index.js';

const DEFAULT_CONFIG: EnveConfig = {
  version: 1,
  projects: [],
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
