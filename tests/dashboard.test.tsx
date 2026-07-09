import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Dashboard } from '../src/ui/Dashboard.js';
import type { ProjectInfo } from '../src/types/index.js';

const mockUseInput = vi.fn();

vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  return {
    ...actual,
    useInput: (handler: (input: string, key: { return: boolean; upArrow: boolean; downArrow: boolean; escape: boolean }) => void, options?: unknown) => {
      mockUseInput(handler, options);
    },
  };
});

describe('Dashboard', () => {
  const mockProjects: ProjectInfo[] = [
    {
      name: 'alpha',
      path: '/projects/alpha',
      envFiles: [{ path: '/projects/alpha/.env', filename: '.env', variables: [] }],
      envCount: 3,
      referenceCount: 2,
      issues: [],
      score: {
        score: 100,
        grade: 'Excellent',
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
      hasGit: true,
      hookInstalled: true,
      hasEnvInGitignore: true,
      lastModified: new Date(),
    },
    {
      name: 'beta',
      path: '/projects/beta',
      envFiles: [{ path: '/projects/beta/.env', filename: '.env', variables: [] }],
      envCount: 5,
      referenceCount: 4,
      issues: [
        {
          type: 'missing',
          severity: 'error',
          key: 'API_KEY',
          message: 'API_KEY referenced but not defined',
          file: 'src/index.ts',
          suggestion: 'Add API_KEY to .env',
        },
      ],
      score: {
        score: 70,
        grade: 'Good',
        totalIssues: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      },
      hasGit: true,
      hookInstalled: false,
      hasEnvInGitignore: false,
      lastModified: new Date(),
    },
  ];

  const handlers = {
    onRunDoctor: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders project list and details', () => {
    const { lastFrame } = render(
      <Dashboard projects={mockProjects} version="1.0.0" {...handlers} />
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('alpha');
    expect(frame).toContain('beta');
    expect(frame).toContain('Env vars');
    expect(frame).toContain('1 err');
  });

  it('navigates with arrow keys', () => {
    const { lastFrame } = render(
      <Dashboard projects={mockProjects} version="1.0.0" {...handlers} />
    );

    const [inputHandler] = mockUseInput.mock.calls[0] ?? [];
    expect(inputHandler).toBeDefined();

    inputHandler('', { upArrow: false, downArrow: true, return: false, escape: false });

    const frame = lastFrame() ?? '';
    expect(frame).toContain('beta');
  });

  it('calls onRunDoctor when Enter is pressed', () => {
    render(
      <Dashboard projects={mockProjects} version="1.0.0" {...handlers} />
    );

    const [inputHandler] = mockUseInput.mock.calls[0] ?? [];
    expect(inputHandler).toBeDefined();

    inputHandler('', { upArrow: false, downArrow: false, return: true, escape: false });

    expect(handlers.onRunDoctor).toHaveBeenCalledWith(mockProjects[0]);
  });

  it('calls onRefresh when r is pressed', () => {
    render(
      <Dashboard projects={mockProjects} version="1.0.0" {...handlers} />
    );

    const [inputHandler] = mockUseInput.mock.calls[0] ?? [];
    expect(inputHandler).toBeDefined();

    inputHandler('r', { upArrow: false, downArrow: false, return: false, escape: false });

    expect(handlers.onRefresh).toHaveBeenCalled();
  });

  it('renders empty state when no projects', () => {
    const { lastFrame } = render(
      <Dashboard projects={[]} version="1.0.0" {...handlers} />
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('No projects tracked yet');
  });
});
