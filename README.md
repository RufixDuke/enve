# enve

> Environment Variable Doctor — scan, validate, and protect your `.env` files.

[![npm version](https://img.shields.io/npm/v/enve-doctor.svg)](https://www.npmjs.com/package/enve-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`enve` is a developer-friendly CLI that continuously monitors your projects for environment-variable mistakes: missing variables, unused secrets, values that don't match expected formats, `.env` files not in `.gitignore`, and more. It also ships an interactive terminal dashboard so you can see the health of every tracked project at a glance.

---

## Table of Contents

- [Why enve?](#why-enve)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [`enve scan`](#enve-scan)
  - [`enve doctor`](#enve-doctor)
  - [`enve unused`](#enve-unused)
  - [`enve missing`](#enve-missing)
  - [`enve validate`](#enve-validate)
  - [`enve generate-example`](#enve-generate-example)
  - [`enve hook`](#enve-hook)
  - [`enve dashboard`](#enve-dashboard)
  - [`enve ci`](#enve-ci)
  - [`enve fix`](#enve-fix)
  - [`enve docs`](#enve-docs)
  - [`enve sync`](#enve-sync)
  - [`enve history`](#enve-history)
- [How the Score Works](#how-the-score-works)
- [Tracking Behavior](#tracking-behavior)
- [Contributing](#contributing)

---

## Why enve?

Environment variables are easy to get wrong:

- You reference `process.env.API_KEY` but forget to add it to `.env`.
- You leave an old secret in `.env` after rotating it.
- You commit a `.env` file because `.gitignore` was missing.
- Your `.env.example` drifts out of sync with `.env`.

`enve` catches these issues before they become production incidents.

---

## Installation

```bash
npm install -g enve-doctor
```

Requires Node.js 18 or later.

---

## Quick Start

```bash
# Navigate to any project with a package.json
cd my-project

# Run a full health check
enve doctor

# Or scan for a quick overview
enve scan
```

`enve` automatically detects the project root by walking up from the current directory until it finds a `package.json`.

---

## Commands

### `enve scan`

Fast overview of env-file health.

```bash
enve scan
```

Output includes `.env` files found, code references, issues, and a score.

### `enve doctor`

Comprehensive health check with detailed recommendations.

```bash
enve doctor
```

Sections: File Structure, Variables, Security, Validation, and prioritized Recommendations.

### `enve unused`

Find variables defined in `.env` but never referenced in code.

```bash
enve unused
enve unused --fix   # Remove unused variables after confirmation
```

Standard variables like `PORT`, `HOST`, `NODE_ENV`, `CI`, and `PWD` are ignored.

### `enve missing`

Find variables referenced in code but missing from `.env`.

```bash
enve missing
enve missing --add   # Add placeholders after confirmation
```

Variables that have a fallback default in code are reported as warnings; those without are errors.

### `enve validate`

Validate values against expected formats.

```bash
enve validate
enve validate --fix   # Auto-fix simple issues after confirmation
```

Checks include:

- `PORT` and `*_PORT` — must be a valid port number.
- `NODE_ENV` — must be `development`, `production`, or `test`.
- `*_URL`, `DATABASE_URL`, `REDIS_URL` — must be a valid URL.
- `SECRET`, `KEY`, `TOKEN`, `PRIVATE` — warns if too short or weak.
- `DEBUG`, `VERBOSE`, `*_ENABLED` — must be a boolean-like value.

### `enve generate-example`

Create or update `.env.example` from `.env`.

```bash
enve generate-example
enve generate-example --overwrite
enve generate-example --dry-run
enve generate-example --all-secrets
```

Secrets are redacted to `your_variable_name` placeholders. Public values are copied as-is.

### `enve hook`

Install a Git pre-commit hook that runs `enve doctor` before each commit.

```bash
enve hook install
enve hook uninstall
```

### `enve dashboard`

Launch the interactive terminal dashboard.

```bash
enve dashboard
```

Keyboard shortcuts:

| Key | Action |
| --- | --- |
| `↑` / `↓` | Navigate projects |
| `Enter` | Run `enve doctor` for selected project |
| `r` | Refresh all projects |
| `q` / `Ctrl+C` | Quit |

### `enve ci`

Non-interactive check designed for CI/CD pipelines.

```bash
enve ci
enve ci --fail-on error      # Exit with error code if any errors exist (default)
enve ci --fail-on warning    # Exit with error code if any warnings or errors exist
enve ci --fail-on none       # Never fail the pipeline
enve ci --format json        # Output a JSON report
enve ci --format junit       # Output a JUnit XML report
```

Example GitHub Actions step:

```yaml
- name: Check env health
  run: npx enve-doctor ci --fail-on warning
```

### `enve fix`

Apply safe, auto-fixable corrections.

```bash
enve fix
enve fix --yes   # Apply all fixes without prompting
```

Fixes include:

- Adding `.env`, `.env.local`, and `.env.production` to `.gitignore`
- Moving secrets from `.env` to `.env.local`
- Removing unused variables from `.env`
- Adding missing variables to `.env.example`

### `enve docs`

Generate `ENV.md` documentation from your `.env` files.

```bash
enve docs
enve docs --output docs/env.md
enve docs --overwrite
```

### `enve sync`

Share `.env.example` with your team through a shared directory.

```bash
enve sync set-path /path/to/team/shared
enve sync push
enve sync pull
```

### `enve history`

Track env health score over time.

```bash
enve history
enve history --graph
enve history --limit 20
```

---

## How the Score Works

Every project gets a score from 0 to 100 and a grade:

| Score | Grade | Meaning |
| --- | --- | --- |
| 90–100 | Excellent | Clean env setup |
| 70–89 | Good | Minor issues |
| 50–69 | Needs attention | Several issues to fix |
| 0–49 | Critical | Major problems |

Score deductions include:

- Missing variable without fallback: `-10`
- Missing variable with fallback: `-3`
- Secret in non-local `.env`: `-8`
- `.env` not in `.gitignore`: `-20`
- `.env.production` not in `.gitignore`: `-25`
- Unused variable: up to `-15` total
- Missing `.env.example`: `-10`
- Variable in `.env` but not `.env.example`: up to `-10` total

---

## Tracking Behavior

`enve` keeps a lightweight local config (using [`conf`](https://github.com/sindresorhus/conf)) so the dashboard can show all your projects. A project is added to the tracked list the first time you run `enve scan`, `enve doctor`, or any command that calls `getProjectInfo`. No data leaves your machine.

---

## Contributing

```bash
# Clone and install
git clone https://github.com/your-username/enve.git
cd enve
npm install

# Run tests
npm test

# Run in development
npm run dev

# Build the CLI
npm run build
```

Pull requests are welcome. Please add tests for new behavior and run `npm test` before submitting.

---

## License

MIT © Abdul-Qudus Rufai
