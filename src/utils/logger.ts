import chalk from 'chalk';

export const symbols = {
  error: '✗',
  warning: '⚠',
  success: '✓',
  info: 'ℹ',
  bullet: '•',
  arrow: '→',
  pointer: '▸',
};

export function error(message: string): string {
  return `${chalk.red(symbols.error)} ${message}`;
}

export function warning(message: string): string {
  return `${chalk.yellow(symbols.warning)} ${message}`;
}

export function success(message: string): string {
  return `${chalk.green(symbols.success)} ${message}`;
}

export function info(message: string): string {
  return `${chalk.blue(symbols.info)} ${message}`;
}

export function bullet(message: string): string {
  return `  ${symbols.bullet} ${message}`;
}

export function indent(message: string, level = 1): string {
  return '  '.repeat(level) + message;
}

export function header(title: string): string {
  return chalk.bold(title);
}

export function dim(message: string): string {
  return chalk.dim(message);
}
