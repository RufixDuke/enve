import { Command } from 'commander';
import { render } from 'ink';
import React, { useState, useCallback } from 'react';
import { getProjects } from '../../core/config.js';
import { getProjectInfo } from '../../core/project.js';
import { runDoctor } from './doctor.js';
import { Dashboard } from '../../ui/Dashboard.js';
import type { ProjectInfo } from '../../types/index.js';
import pkg from '../../../package.json' with { type: 'json' };

export const dashboardCommand = new Command('dashboard')
  .description('Interactive terminal dashboard showing all tracked projects')
  .action(async () => {
    const tracked = getProjects();

    if (tracked.length === 0) {
      console.log();
      console.log('  Enve Dashboard');
      console.log();
      console.log('  No projects tracked yet.');
      console.log('  Run `enve scan` or `enve doctor` in a project to add it.');
      console.log();
      return;
    }

    if (!process.stdin.isTTY) {
      console.log();
      console.log('  The interactive dashboard requires a TTY terminal.');
      console.log('  Run `enve dashboard` in your terminal to use it.');
      console.log();
      return;
    }

    const initialProjects = await analyzeProjects(tracked.map((p) => p.path));

    render(
      <DashboardApp
        initialProjects={initialProjects}
        trackedPaths={tracked.map((p) => p.path)}
        version={pkg.version}
      />
    );
  });

interface DashboardAppProps {
  initialProjects: ProjectInfo[];
  trackedPaths: string[];
  version: string;
}

function DashboardApp({ initialProjects, trackedPaths, version }: DashboardAppProps): React.ReactElement {
  const [projects, setProjects] = useState(initialProjects);

  const handleRunDoctor = useCallback(
    async (project: ProjectInfo) => {
      await runDoctor(project.path);
    },
    []
  );

  const handleRefresh = useCallback(async () => {
    const fresh = await analyzeProjects(trackedPaths);
    setProjects(fresh);
  }, [trackedPaths]);

  return (
    <Dashboard
      projects={projects}
      version={version}
      onRunDoctor={handleRunDoctor}
      onRefresh={handleRefresh}
    />
  );
}

async function analyzeProjects(paths: string[]): Promise<ProjectInfo[]> {
  const results = await Promise.all(paths.map((p) => getProjectInfo(p)));
  return results;
}
