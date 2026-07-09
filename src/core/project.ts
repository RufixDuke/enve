import { join, basename } from 'node:path';
import { fileExists } from '../utils/fs.js';
import { isGitRepo } from '../utils/git.js';
import { parseAllEnvFiles } from './parser.js';
import { scanProject } from './scanner.js';
import { analyze, calculateScore } from './analyzer.js';
import { addProject } from './config.js';
import type { ProjectInfo } from '../types/index.js';
import { isHookInstalled } from '../utils/git.js';

export async function detectProject(startPath: string): Promise<string | undefined> {
  let current = startPath;
  while (true) {
    if (await fileExists(join(current, 'package.json'))) {
      return current;
    }
    const parent = join(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

export async function getProjectInfo(projectPath: string): Promise<ProjectInfo> {
  const [envFiles, references, hasGit, hookInstalled] = await Promise.all([
    parseAllEnvFiles(projectPath),
    scanProject(projectPath),
    isGitRepo(projectPath),
    isHookInstalled(projectPath),
  ]);

  const issues = await analyze(envFiles, references, projectPath);
  const score = calculateScore(issues);
  const name = basename(projectPath);

  await addProject(projectPath);

  return {
    name,
    path: projectPath,
    envFiles,
    envCount: envFiles.reduce((sum, f) => sum + f.variables.length, 0),
    referenceCount: references.length,
    issues,
    score,
    hasGit,
    hookInstalled,
    hasEnvInGitignore: !issues.some((i) => i.type === 'gitignore'),
    lastModified: new Date(),
  };
}
