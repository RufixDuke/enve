import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import type { ProjectInfo } from '../types/index.js';
import { ProjectCard } from './ProjectCard.js';
import { IssueList } from './IssueList.js';
import { ScoreBadge } from './ScoreBadge.js';
import { colors, layout } from './theme.js';

interface DashboardProps {
  projects: ProjectInfo[];
  version: string;
  onRunDoctor: (project: ProjectInfo) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export function Dashboard({
  projects,
  version,
  onRunDoctor,
  onRefresh,
}: DashboardProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const terminalRows = stdout.rows ?? 24;
  const selectedProject = projects[selectedIndex];
  const maxVisible = Math.max(4, Math.floor((terminalRows - 10) / 5));

  const visibleProjects = useMemo(() => {
    if (projects.length <= maxVisible) return projects;

    let start = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
    let end = start + maxVisible;
    if (end > projects.length) {
      end = projects.length;
      start = Math.max(0, end - maxVisible);
    }
    return projects.slice(start, end);
  }, [projects, selectedIndex, maxVisible]);

  const visibleStart = projects.length <= maxVisible ? 0 : Math.max(0, selectedIndex - Math.floor(maxVisible / 2));

  useInput(
    (input, key) => {
      if (isExiting) return;

      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => Math.min(projects.length - 1, prev + 1));
      } else if (key.return) {
        if (selectedProject) {
          setIsExiting(true);
          void Promise.resolve(onRunDoctor(selectedProject)).then(() => exit());
        }
      } else if (input === 'r') {
        void Promise.resolve(onRefresh());
      } else if (input === 'q' || key.escape) {
        setIsExiting(true);
        exit();
      }
    },
    { isActive: !isExiting }
  );

  if (projects.length === 0) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text bold color={colors.ink}>enve dashboard</Text>
        <Box marginTop={1}>
          <Text color={colors.muted}>No projects tracked yet.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.subtle}>Run `enve scan` or `enve doctor` in a project to add it.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" paddingX={layout.paddingX} paddingY={layout.paddingY}>
      {/* Top bar */}
      <Box justifyContent="space-between" width="100%" marginBottom={1}>
        <Box>
          <Text bold color={colors.ink}>enve</Text>
          <Text color={colors.muted}> dashboard</Text>
        </Box>
        <Text color={colors.subtle}>v{version}</Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} width="100%">
        {/* Sidebar */}
        <Box
          width={layout.sidebarWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={colors.border}
          paddingX={1}
          paddingY={1}
          marginRight={2}
        >
          <Box marginBottom={1}>
            <Text bold color={colors.ink}>Projects</Text>
            <Text color={colors.subtle}> ({projects.length})</Text>
          </Box>

          <Box flexDirection="column" rowGap={1} flexGrow={1}>
            {visibleProjects.map((project, index) => {
              const actualIndex = visibleStart + index;
              return (
                <ProjectCard
                  key={project.path}
                  project={project}
                  isSelected={actualIndex === selectedIndex}
                  isFocused={actualIndex === selectedIndex}
                />
              );
            })}
          </Box>

          {projects.length > maxVisible && (
            <Box marginTop={1}>
              <Text color={colors.subtle}>Use ↑/↓ to scroll</Text>
            </Box>
          )}
        </Box>

        {/* Details panel */}
        <Box
          flexGrow={1}
          flexDirection="column"
          borderStyle="single"
          borderColor={colors.border}
          paddingX={2}
          paddingY={1}
        >
          {selectedProject ? (
            <ProjectDetail project={selectedProject} />
          ) : (
            <Box>
              <Text color={colors.muted}>Select a project to view details.</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Bottom bar */}
      <Box
        justifyContent="space-between"
        width="100%"
        borderStyle="single"
        borderColor={colors.border}
        paddingX={1}
        marginTop={1}
      >
        <Box columnGap={3}>
          <Text color={colors.muted}><Text bold>↑/↓</Text> navigate</Text>
          <Text color={colors.muted}><Text bold>Enter</Text> doctor</Text>
          <Text color={colors.muted}><Text bold>r</Text> refresh</Text>
          <Text color={colors.muted}><Text bold>q</Text> quit</Text>
        </Box>
        <Text color={colors.subtle}>enve-doctor v{version}</Text>
      </Box>
    </Box>
  );
}

function ProjectDetail({ project }: { project: ProjectInfo }): React.ReactElement {
  const envFileNames = project.envFiles.map((f) => f.filename).join(', ') || 'none';

  return (
    <Box flexDirection="column" width="100%">
      <Box justifyContent="space-between" alignItems="center" marginBottom={1}>
        <Text bold color={colors.ink}>{project.name}</Text>
        <ScoreBadge score={project.score} />
      </Box>

      <Box marginBottom={1}>
        <Text color={colors.muted}>{project.path}</Text>
      </Box>

      <Box flexDirection="row" columnGap={4} marginBottom={1}>
        <Metric label="Env vars" value={String(project.envCount)} />
        <Metric label="References" value={String(project.referenceCount)} />
        <Metric label="Issues" value={String(project.score.totalIssues)} />
      </Box>

      <Box flexDirection="row" columnGap={4} marginBottom={1}>
        <Status label="Git repo" ok={project.hasGit} />
        <Status label="Git hook" ok={project.hookInstalled} />
        <Status label=".gitignore" ok={project.hasEnvInGitignore} />
      </Box>

      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.subtle}>Env files: </Text>
        <Text color={colors.ink}>{envFileNames}</Text>
      </Box>

      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.borderStrong}>{'─'.repeat(60)}</Text>
      </Box>

      <Box marginTop={1} marginBottom={1}>
        <Text bold color={colors.ink}>Top issues</Text>
      </Box>

      <IssueList issues={project.issues} maxRows={8} />
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text color={colors.subtle}>{label}</Text>
      <Text bold color={colors.ink}>{value}</Text>
    </Box>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }): React.ReactElement {
  return (
    <Box>
      <Text color={ok ? colors.success : colors.error}>{ok ? '✓' : '✗'} </Text>
      <Text color={colors.muted}>{label}</Text>
    </Box>
  );
}
