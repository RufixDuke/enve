import type { EnvFile, EnvReference, Issue, ScoreResult, Grade } from '../types/index.js';
import { isEnvFileGitignored } from '../utils/git.js';

const ALWAYS_ALLOWED = ['PORT', 'HOST', 'NODE_ENV', 'CI', 'PWD'];

export async function analyze(
  envFiles: EnvFile[],
  references: EnvReference[],
  projectPath: string
): Promise<Issue[]> {
  const issues: Issue[] = [];

  issues.push(...(await checkMissingVariables(envFiles, references)));
  issues.push(...checkUnusedVariables(envFiles, references));
  issues.push(...checkSecretRisks(envFiles));
  issues.push(...(await checkGitignore(envFiles, projectPath)));
  issues.push(...checkExampleFile(envFiles));

  return issues;
}

async function checkMissingVariables(envFiles: EnvFile[], references: EnvReference[]): Promise<Issue[]> {
  const definedKeys = new Set(envFiles.flatMap((file) => file.variables.map((v) => v.key)));
  const issues: Issue[] = [];

  for (const ref of references) {
    if (definedKeys.has(ref.key)) continue;

    if (ref.hasFallback) {
      issues.push({
        type: 'missing',
        severity: 'warning',
        key: ref.key,
        message: `${ref.key} is not defined in .env but has a fallback default: ${ref.fallbackValue ?? 'unknown'}`,
        file: ref.file,
        line: ref.line,
        suggestion: `Consider adding ${ref.key} to .env for explicit configuration, or keep the fallback`,
        hasFallback: true,
        fallbackValue: ref.fallbackValue,
      });
    } else {
      issues.push({
        type: 'missing',
        severity: 'error',
        key: ref.key,
        message: `${ref.key} referenced in ${ref.file}:${ref.line} but not defined in any .env file (no fallback)`,
        file: ref.file,
        line: ref.line,
        suggestion: `Add ${ref.key} to .env and .env.example`,
      });
    }
  }

  return issues;
}

function checkUnusedVariables(envFiles: EnvFile[], references: EnvReference[]): Issue[] {
  const referencedKeys = new Set(references.map((r) => r.key));
  const issues: Issue[] = [];

  for (const file of envFiles) {
    if (file.filename === '.env.example' || file.filename === '.env.test') continue;

    for (const variable of file.variables) {
      if (ALWAYS_ALLOWED.includes(variable.key)) continue;
      if (referencedKeys.has(variable.key)) continue;

      issues.push({
        type: 'unused',
        severity: 'warning',
        key: variable.key,
        message: `${variable.key} is defined in ${file.filename} but never used in code`,
        file: file.filename,
        line: variable.line,
        suggestion: 'Remove if no longer needed, or use it in your code',
      });
    }
  }

  return issues;
}

function checkSecretRisks(envFiles: EnvFile[]): Issue[] {
  const issues: Issue[] = [];

  for (const file of envFiles) {
    if (file.filename !== '.env') continue;

    for (const variable of file.variables) {
      if (!variable.isSecret) continue;

      issues.push({
        type: 'secret-risk',
        severity: 'error',
        key: variable.key,
        message: `${variable.key} looks like a secret but is in .env instead of .env.local`,
        file: file.filename,
        line: variable.line,
        suggestion: `Move ${variable.key} to .env.local (which should be in .gitignore)`,
      });
    }
  }

  return issues;
}

async function checkGitignore(envFiles: EnvFile[], projectPath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const filenames = envFiles.map((f) => f.filename);

  const filesToCheck = ['.env', '.env.local', '.env.production'];
  const messages: Record<string, string> = {
    '.env': '.env is not in .gitignore — risk of committing secrets',
    '.env.local': '.env.local is not in .gitignore',
    '.env.production': '.env.production is not in .gitignore — production secrets at risk',
  };
  const suggestions: Record<string, string> = {
    '.env': "echo '.env' >> .gitignore",
    '.env.local': "echo '.env.local' >> .gitignore",
    '.env.production': "echo '.env.production' >> .gitignore",
  };

  for (const filename of filesToCheck) {
    if (!filenames.includes(filename)) continue;
    const ignored = await isEnvFileGitignored(projectPath, filename);
    if (!ignored) {
      issues.push({
        type: 'gitignore',
        severity: 'error',
        key: filename,
        message: messages[filename],
        file: '.gitignore',
        suggestion: suggestions[filename],
      });
    }
  }

  return issues;
}

function checkExampleFile(envFiles: EnvFile[]): Issue[] {
  const issues: Issue[] = [];
  const exampleFile = envFiles.find((f) => f.filename === '.env.example');
  const envFile = envFiles.find((f) => f.filename === '.env');

  if (!exampleFile) {
    issues.push({
      type: 'suspicious',
      severity: 'warning',
      key: '.env.example',
      message: ".env.example is missing — new developers won't know what env vars are needed",
      file: '.',
      suggestion: 'Run `enve generate-example` to create one',
    });
    return issues;
  }

  if (!envFile) return issues;

  const exampleKeys = new Set(exampleFile.variables.map((v) => v.key));
  for (const variable of envFile.variables) {
    if (exampleKeys.has(variable.key)) continue;

    issues.push({
      type: 'suspicious',
      severity: 'warning',
      key: variable.key,
      message: `${variable.key} is in .env but missing from .env.example`,
      file: '.env.example',
      suggestion: `Add ${variable.key}=your_${variable.key} to .env.example`,
    });
  }

  return issues;
}

export function calculateScore(issues: Issue[]): ScoreResult {
  let score = 100;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let unusedDeduction = 0;
  let exampleDeduction = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        errorCount++;
        break;
      case 'warning':
        warningCount++;
        break;
      case 'info':
        infoCount++;
        break;
    }

    switch (issue.type) {
      case 'missing':
        score -= issue.hasFallback ? 3 : 10;
        break;
      case 'secret-risk':
        score -= 8;
        break;
      case 'gitignore':
        if (issue.key === '.env.production') score -= 25;
        else score -= 20;
        break;
      case 'syntax-error':
        score -= 15;
        break;
      case 'invalid':
        score -= 5;
        break;
      case 'unused':
        unusedDeduction = Math.min(unusedDeduction + 3, 15);
        break;
      case 'suspicious':
        if (issue.key === '.env.example') score -= 10;
        else exampleDeduction = Math.min(exampleDeduction + 2, 10);
        break;
    }
  }

  score -= unusedDeduction + exampleDeduction;
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: getGrade(score),
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
  };
}

function getGrade(score: number): Grade {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs attention';
  return 'Critical';
}
