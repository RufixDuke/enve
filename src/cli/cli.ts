import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { doctorCommand } from './commands/doctor.js';
import { unusedCommand } from './commands/unused.js';
import { missingCommand } from './commands/missing.js';
import { validateCommand } from './commands/validate.js';
import { generateExampleCommand } from './commands/generate-example.js';
import { hookCommand } from './commands/hook.js';
import { dashboardCommand } from './commands/dashboard.js';
import { historyCommand } from './commands/history.js';
import { syncCommand } from './commands/sync.js';
import { docsCommand } from './commands/docs.js';
import { fixCommand } from './commands/fix.js';
import { ciCommand } from './commands/ci.js';
import pkg from '../../package.json' with { type: 'json' };

const program = new Command();

program
  .name('enve')
  .description('Environment Variable Doctor — scan, validate, and protect your env files')
  .version(pkg.version);

program.addCommand(scanCommand);
program.addCommand(doctorCommand);
program.addCommand(unusedCommand);
program.addCommand(missingCommand);
program.addCommand(validateCommand);
program.addCommand(generateExampleCommand);
program.addCommand(hookCommand);
program.addCommand(dashboardCommand);
program.addCommand(ciCommand);
program.addCommand(fixCommand);
program.addCommand(docsCommand);
program.addCommand(syncCommand);
program.addCommand(historyCommand);

process.on('unhandledRejection', (reason) => {
  console.error('\n  Unexpected error:', reason instanceof Error ? reason.message : reason);
  console.error('  If this keeps happening, please open an issue with the stack trace above.');
  process.exit(1);
});

program.parse();
