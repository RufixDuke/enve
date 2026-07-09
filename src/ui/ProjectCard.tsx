import React from 'react';
import { Box, Text } from 'ink';
import type { ProjectInfo } from '../types/index.js';
import { ScoreBadge } from './ScoreBadge.js';
import { colors } from './theme.js';

interface ProjectCardProps {
  project: ProjectInfo;
  isSelected: boolean;
  isFocused: boolean;
}

export function ProjectCard({
  project,
  isSelected,
  isFocused,
}: ProjectCardProps): React.ReactElement {
  const { score } = project;
  const borderColor = isSelected ? colors.ink : colors.border;
  const indicator = isFocused ? '›' : ' ';

  return (
    <Box
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      paddingY={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Box>
          <Text color={isSelected ? colors.ink : colors.muted}>{indicator} </Text>
          <Text bold color={colors.ink}>{project.name}</Text>
        </Box>
        <ScoreBadge score={score} compact />
      </Box>

      <Box marginTop={1}>
        <Text color={colors.muted}>{project.path}</Text>
      </Box>

      <Box marginTop={1} columnGap={2}>
        {score.errorCount > 0 && (
          <Text color={colors.error}>{score.errorCount} err</Text>
        )}
        {score.warningCount > 0 && (
          <Text color={colors.warning}>{score.warningCount} warn</Text>
        )}
        {score.totalIssues === 0 && (
          <Text color={colors.success}>Clean</Text>
        )}
      </Box>
    </Box>
  );
}
