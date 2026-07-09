import type { Grade, Severity } from '../types/index.js';

export const colors = {
  // Warm monochrome base
  canvas: '#FAFAF8',
  ink: '#1A1A1A',
  muted: '#6B6B6B',
  subtle: '#A3A3A3',

  // Borders & dividers
  border: '#E5E5E0',
  borderStrong: '#D4D4CF',

  // Semantic accents — desaturated pastels
  excellent: '#10B981', // emerald 500
  excellentBg: '#ECFDF5', // emerald 50
  good: '#F59E0B', // amber 500
  goodBg: '#FFFBEB', // amber 50
  attention: '#F97316', // orange 500
  attentionBg: '#FFF7ED', // orange 50
  critical: '#EF4444', // red 500
  criticalBg: '#FEF2F2', // red 50

  // Severity
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  success: '#059669',
} as const;

export const gradeStyles: Record<
  Grade,
  { text: string; bg: string; label: string }
> = {
  Excellent: { text: colors.excellent, bg: colors.excellentBg, label: 'Excellent' },
  Good: { text: colors.good, bg: colors.goodBg, label: 'Good' },
  'Needs attention': { text: colors.attention, bg: colors.attentionBg, label: 'Needs attention' },
  Critical: { text: colors.critical, bg: colors.criticalBg, label: 'Critical' },
};

export const severityStyles: Record<Severity, { color: string; symbol: string }> = {
  error: { color: colors.error, symbol: '●' },
  warning: { color: colors.warning, symbol: '●' },
  info: { color: colors.info, symbol: '●' },
};

export const issueTypeSymbol: Record<string, string> = {
  missing: '⊘',
  unused: '○',
  invalid: '✕',
  suspicious: '◆',
  'secret-risk': '▲',
  'syntax-error': '✕',
  gitignore: '◉',
};

export const layout = {
  sidebarWidth: 34,
  maxContentWidth: 86,
  paddingX: 2,
  paddingY: 1,
} as const;
