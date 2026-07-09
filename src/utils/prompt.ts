import { createInterface } from 'node:readline/promises';

export async function prompt(message: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${message} `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const suffix = defaultValue ? ' (Y/n)' : ' (y/N)';
  const answer = await prompt(`${message}${suffix}`);
  if (!answer) return defaultValue;
  return /^y(es)?$/i.test(answer);
}
