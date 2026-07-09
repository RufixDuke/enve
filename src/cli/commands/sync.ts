import { Command } from 'commander';
import { join, basename } from 'node:path';
import { detectProject } from '../../core/project.js';
import { getSyncPath, setSyncPath } from '../../core/config.js';
import { readFileSafe, writeFileSafe, fileExists, ensureDir } from '../../utils/fs.js';
import { error, success, warning, indent, header } from '../../utils/logger.js';

export const syncCommand = new Command('sync')
  .description('Share .env.example with a team via a shared directory')
  .addCommand(
    new Command('set-path')
      .description('Set the shared team directory')
      .argument('<path>', 'Path to the shared directory')
      .action(async (path: string) => {
        setSyncPath(path);
        console.log(indent(success(`Team sync path set to ${path}`)));
      })
  )
  .addCommand(
    new Command('push')
      .description('Push .env.example to the shared team directory')
      .action(async () => {
        await runSync('push');
      })
  )
  .addCommand(
    new Command('pull')
      .description('Pull .env.example from the shared team directory')
      .action(async () => {
        await runSync('pull');
      })
  );

async function runSync(direction: 'push' | 'pull'): Promise<void> {
  const cwd = process.cwd();
  const projectPath = await detectProject(cwd);

  if (!projectPath) {
    console.log(error('No package.json found. Are you in a project directory?'));
    process.exit(1);
  }

  const syncPath = getSyncPath();
  if (!syncPath) {
    console.log(
      error('No sync path configured. Run `enve sync set-path <path>` first.')
    );
    process.exit(1);
  }

  const projectName = basename(projectPath);
  const sourceFile = join(projectPath, '.env.example');
  const targetFile = join(syncPath, projectName, '.env.example');

  console.log();
  console.log(indent(header(`Enve Sync — ${direction}`)));
  console.log();
  console.log(indent(`Project: ${projectName}`));
  console.log(indent(`Shared path: ${targetFile}`));
  console.log();

  if (direction === 'push') {
    const content = await readFileSafe(sourceFile);
    if (!content) {
      console.log(error('No .env.example found to push.'));
      process.exit(1);
    }

    await ensureDir(join(syncPath, projectName));
    await writeFileSafe(targetFile, content);
    console.log(indent(success('Pushed .env.example to team directory')));
  } else {
    if (!(await fileExists(targetFile))) {
      console.log(error('No shared .env.example found for this project.'));
      process.exit(1);
    }

    const content = (await readFileSafe(targetFile)) ?? '';
    await writeFileSafe(sourceFile, content);
    console.log(indent(success('Pulled .env.example from team directory')));
  }
}
