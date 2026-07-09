import { Command } from 'commander';
import { detectProject } from '../../core/project.js';
import {
  isGitRepo,
  isHookInstalled,
  installHook,
  uninstallHook,
  getPreCommitHookPath,
} from '../../utils/git.js';
import { error, warning, success, indent } from '../../utils/logger.js';

export const hookCommand = new Command('hook')
  .description('Install, manage, and check a pre-commit git hook that prevents .env commits')
  .addCommand(
    new Command('install')
      .description('Install the enve pre-commit hook')
      .action(async () => {
        const cwd = process.cwd();
        const projectPath = await detectProject(cwd);

        if (!projectPath || !(await isGitRepo(projectPath))) {
          console.log(error('Not a git repository. Run `git init` first.'));
          process.exit(1);
        }

        await installHook(projectPath);
        console.log();
        console.log(indent(success('Pre-commit hook installed')));
        console.log(indent(`Location: ${getPreCommitHookPath(projectPath)}`));
        console.log();
        console.log(indent('What it does:'));
        console.log(indent(bullet('Blocks commits of .env, .env.local, .env.production files'), 2));
        console.log(indent(bullet('Shows a helpful message with next steps'), 2));
        console.log(indent(bullet('Can be bypassed with --no-verify (emergency only)'), 2));
        console.log();
        console.log(indent('To remove: enve hook uninstall'));
      })
  )
  .addCommand(
    new Command('status')
      .description('Check the status of the enve pre-commit hook')
      .action(async () => {
        const cwd = process.cwd();
        const projectPath = await detectProject(cwd);

        if (!projectPath || !(await isGitRepo(projectPath))) {
          console.log(error('Not a git repository.'));
          process.exit(1);
        }

        const installed = await isHookInstalled(projectPath);
        console.log();
        if (installed) {
          console.log(indent(success('Pre-commit hook: Installed (enve protection active)')));
          console.log(indent(`Location: ${getPreCommitHookPath(projectPath)}`));
        } else {
          console.log(indent(warning('Pre-commit hook: Not installed')));
          console.log(indent('Run `enve hook install` to enable .env commit protection.'));
        }
      })
  )
  .addCommand(
    new Command('uninstall')
      .description('Remove the enve pre-commit hook')
      .action(async () => {
        const cwd = process.cwd();
        const projectPath = await detectProject(cwd);

        if (!projectPath || !(await isGitRepo(projectPath))) {
          console.log(error('Not a git repository.'));
          process.exit(1);
        }

        const removed = await uninstallHook(projectPath);
        console.log();
        if (removed) {
          console.log(indent(success('Pre-commit hook removed')));
          console.log(indent('Run `enve hook install` to re-enable.'));
        } else {
          console.log(indent(warning('No enve hook found to remove.')));
        }
      })
  );

function bullet(text: string): string {
  return `• ${text}`;
}
