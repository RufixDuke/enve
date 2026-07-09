import React from 'react';
import { Box, Text } from 'ink';
import type { Issue } from '../types/index.js';
import { severityStyles, issueTypeSymbol, colors } from './theme.js';

interface IssueListProps {
  issues: Issue[];
  maxRows?: number;
}

export function IssueList({ issues, maxRows = 12 }: IssueListProps): React.ReactElement {
  if (issues.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={colors.success}>No issues found. Great job.</Text>
      </Box>
    );
  }

  const sorted = [...issues].sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  const visible = sorted.slice(0, maxRows);
  const remaining = sorted.length - visible.length;

  return (
    <Box flexDirection="column" width="100%">
      {visible.map((issue, index) => {
        const style = severityStyles[issue.severity];
        const symbol = issueTypeSymbol[issue.type] ?? '•';

        return (
          <Box key={`${issue.type}-${issue.key}-${index}`} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={style.color}>{symbol} </Text>
              <Text bold color={colors.ink}>{issue.key}</Text>
              <Text color={colors.subtle}> — {issue.type}</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color={colors.muted}>{issue.message}</Text>
            </Box>
            {issue.suggestion && (
              <Box marginLeft={2}>
                <Text color={colors.subtle}>→ {issue.suggestion}</Text>
              </Box>
            )}
          </Box>
        );
      })}
      {remaining > 0 && (
        <Box marginTop={1}>
          <Text color={colors.subtle}>+ {remaining} more issue{remaining === 1 ? '' : 's'}</Text>
        </Box>
      )}
    </Box>
  );
}
