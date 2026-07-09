import React from 'react';
import { Box, Text } from 'ink';
import type { ScoreResult } from '../types/index.js';
import { gradeStyles } from './theme.js';

interface ScoreBadgeProps {
  score: ScoreResult;
  compact?: boolean;
}

export function ScoreBadge({ score, compact = false }: ScoreBadgeProps): React.ReactElement {
  const style = gradeStyles[score.grade];

  if (compact) {
    return (
      <Box>
        <Text backgroundColor={style.bg} color={style.text} bold>
          {' '}
          {score.score}
          {' '}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text backgroundColor={style.bg} color={style.text} bold>
        {' '}
        {score.score} {score.grade}
        {' '}
      </Text>
    </Box>
  );
}
