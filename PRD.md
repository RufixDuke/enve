# Enve — Environment Variable Doctor

## Product Requirements Document (PRD)

---

## Table of Contents

1. [Introduction & Product Vision](#1-introduction--product-vision)
2. [Why This Tool Exists (The Problem)](#2-why-this-tool-exists-the-problem)
3. [Target User](#3-target-user)
4. [Tech Stack](#4-tech-stack)
5. [Project Architecture](#5-project-architecture)
6. [Feature Specifications](#6-feature-specifications)
   - 6.1 [enve scan](#61-enve-scan)
   - 6.2 [enve doctor](#62-enve-doctor)
   - 6.3 [enve unused](#63-enve-unused)
   - 6.4 [enve missing](#64-enve-missing)
   - 6.5 [enve validate](#65-enve-validate)
   - 6.6 [enve generate-example](#66-enve-generate-example)
   - 6.7 [enve hook](#67-enve-hook)
   - 6.8 [enve dashboard](#68-enve-dashboard)
7. [Core Engine Deep Dive](#7-core-engine-deep-dive)
   - 7.1 [The Parser](#71-the-parser)
   - 7.2 [The Scanner](#72-the-scanner)
   - 7.3 [The Analyzer](#73-the-analyzer)
   - 7.4 [The Config Manager](#74-the-config-manager)
   - 7.5 [The Scoring Engine](#75-the-scoring-engine)
8. [Terminal UI Design](#8-terminal-ui-design)
9. [Data Models](#9-data-models)
10. [MVP Development Roadmap](#10-mvp-development-roadmap)
11. [Testing Strategy](#11-testing-strategy)
12. [Distribution & Packaging](#12-distribution--packaging)
13. [Build in Public Content Plan](#13-build-in-public-content-plan)
14. [Future Features (Post-MVP)](#14-future-features-post-mvp)

---

## 1. Introduction & Product Vision

**Enve** is a command-line interface (CLI) tool designed to be the "doctor" for environment variables in software projects. It scans, validates, protects, and provides visibility into `.env` files and their usage across a codebase.

**Vision Statement:**
> No developer should ever accidentally commit a secret to git, scratch their head over a missing environment variable, or ship code that references `process.env.VAR_NAME` without that variable being defined.

**Product Philosophy:**
- **Proactive, not reactive.** Catch problems *before* they cause issues, not after.
- **Educational, not just functional.** Every warning tells the user *why* it's a problem and *how* to fix it.
- **Invisible when not needed.** Works quietly in the background (via git hooks) and only surfaces when there's something to fix.
- **Beautiful in the terminal.** Developer tools should look good in the environment where developers spend their time.

---

## 2. Why This Tool Exists (The Problem)

Environment variable management is one of the most common yet poorly handled aspects of software development. Here are the specific pain points that Enve addresses:

### Pain Point 1: Accidental Secret Commits
A developer creates a `.env` file with API keys, database passwords, and JWT secrets. They run `git add .` and push. The secret is now in git history forever, even if they delete it later. This happens **every single day** across thousands of repositories. GitHub's secret scanning catches it post-commit, but the damage is done.

### Pain Point 2: The Outdated `.env.example` File
The `.env.example` file is meant to be a template showing which variables new developers need. But in practice:
- A new variable is added for a feature
- The developer forgets to update `.env.example`
- A new team member clones the repo, copies `.env.example`, and the app crashes because a required variable is missing
- This cycle repeats endlessly

### Pain Point 3: Dead Environment Variables
Over months of development, environment variables accumulate like clutter:
- `OLD_API_URL` — the old API was replaced 6 months ago
- `DEBUG_MODE` — used once for a specific bug, never removed
- `TEMP_TOKEN` — created for testing, forgotten
These variables create confusion. New developers don't know if they're still needed.

### Pain Point 4: Missing Variables at Runtime
The code says `process.env.REDIS_URL` but `.env` doesn't have `REDIS_URL`. The app starts, everything looks fine, until a specific code path executes and crashes. Or worse — it uses `undefined` as a connection string and behaves mysteriously.

### Pain Point 5: Secret Sprawl
Sensitive variables like `STRIPE_SECRET_KEY`, `JWT_SECRET`, and `DB_PASSWORD` live in `.env` alongside public variables like `PORT=3000` and `NODE_ENV=development`. When the `.env` file is shared (even internally), secrets leak. Best practice is to keep secrets in `.env.local` (which is gitignored and never shared), but most teams don't enforce this.

### Pain Point 6: No Cross-Project Visibility
A developer works on 4 projects. Each has its own `.env` file with 10-20 variables. There's no way to see all environment variables across all projects at a glance. Switching between projects means mentally re-loading which variables exist and which are needed.

### Pain Point 7: Invalid Values
`DATABASE_URL=localhost:5432` (missing protocol), `PORT=abc` (not a number), `JWT_SECRET=short` (too short for security). These invalid values cause runtime errors that are hard to debug because the error message doesn't say "your PORT value is wrong."

---

## 3. Target User

**Primary User:** Frontend and full-stack developers who work with multiple projects and environment variables daily.

**Specific Profile (based on the builder):**
- Works on 3-5 projects simultaneously
- Comfortable with JavaScript/TypeScript
- Uses `.env` files but doesn't have a strict system for managing them
- Has accidentally come close to committing secrets before
- Writes monthly reports and needs tools to "just work"
- Appreciates tools that explain *why* something is wrong, not just *that* it's wrong

**Secondary Users:**
- **Team leads** who want to ensure consistent env practices across the team
- **DevOps engineers** setting up CI/CD pipelines that need env validation
- **Open source maintainers** who want `.env.example` to always be accurate

---

## 4. Tech Stack

| Layer | Technology | Why This Choice |
|-------|-----------|----------------|
| **Language** | TypeScript | Type safety, familiar to the builder, excellent ecosystem |
| **CLI Framework** | `commander` | Battle-tested CLI argument parsing. Used by thousands of tools. Simple API for defining commands, options, and help text. |
| **Terminal UI** | `ink` | React for the terminal. The builder knows React. Allows building interactive dashboards with components (`<Box>`, `<Text>`, `<SelectList>`) instead of raw ANSI escape codes. |
| **React** | `react` | Peer dependency of `ink`. Familiar to the builder. |
| **.env Parsing** | `dotenv` + custom | `dotenv` handles standard `.env` format reliably. Custom layer on top handles edge cases (comments, multiline values, quoted strings). |
| **File Discovery** | `fast-glob` | Fast glob matching for finding source files. Supports `**/*.{js,ts}` patterns. Much faster than native `fs` recursive traversal. |
| **AST Parsing** | `acorn` + `acorn-walk` | `acorn` is a lightweight JavaScript parser. `acorn-walk` provides visitor functions to walk the AST and find `process.env.X` references without writing complex traversal logic. |
| **Styling** | `chalk` | Terminal string styling — colors, bold, dim. Essential for readable CLI output. |
| **Loading States** | `ora` | Beautiful spinners for long-running operations (scanning large codebases). |
| **Config Storage** | `conf` | Simple key-value store that persists to `~/.config/enve/`. Handles JSON read/write, migrations, and defaults. |
| **Bundler** | `tsup` | Extremely fast TypeScript bundler (uses esbuild internally). Builds to a single CommonJS file with `#!/usr/bin/env node` shebang. |
| **Dev Runner** | `tsx` | TypeScript execution for development. `npm run dev` runs the TypeScript directly without needing to build first. |
| **Testing** | `vitest` | Fast, modern test framework with native TypeScript support and watch mode. |
| **Linting** | `eslint` | Static analysis for code quality. |
| **Distribution** | `npm` | Published as `enve-cli` on npm. Installed globally with `npm install -g enve-cli`. |

---

## 5. Project Architecture

### Directory Structure

```
enve/
├── src/
│   ├── cli/                           # CLI layer — commands and entry point
│   │   ├── index.ts                   # Main entry point (#!/usr/bin/env node)
│   │   └── commands/                  # One file per command
│   │       ├── scan.ts                # enve scan
│   │       ├── doctor.ts              # enve doctor
│   │       ├── unused.ts              # enve unused
│   │       ├── missing.ts             # enve missing
│   │       ├── validate.ts            # enve validate
│   │       ├── generate-example.ts    # enve generate-example
│   │       ├── hook.ts                # enve hook install|uninstall|status
│   │       └── dashboard.ts           # enve dashboard
│   │
│   ├── core/                          # Business logic — the engine
│   │   ├── parser.ts                  # Parses .env files into structured data
│   │   ├── scanner.ts                 # Scans source code for process.env references
│   │   ├── analyzer.ts                # Compares .env vars vs code references
│   │   ├── config.ts                  # Reads/writes enve's global config
│   │   └── project.ts                 # Detects project type, finds .env files
│   │
│   ├── ui/                            # Ink (terminal React) components
│   │   ├── Dashboard.tsx              # Main dashboard screen
│   │   ├── ProjectCard.tsx            # Single project info card
│   │   ├── IssueList.tsx              # Scrollable list of issues
│   │   ├── ScoreBadge.tsx             # Color-coded score display
│   │   └── theme.ts                   # Color constants and styling helpers
│   │
│   ├── utils/                         # Shared utilities
│   │   ├── fs.ts                      # File system helpers (read, write, exists)
│   │   ├── git.ts                     # Git operations (check gitignore, install hooks)
│   │   ├── logger.ts                  # Terminal output formatting
│   │   └── validators.ts              # Value validation (URL, port, secret strength)
│   │
│   └── types/                         # TypeScript type definitions
│       └── index.ts                   # All shared interfaces and types
│
├── tests/
│   ├── fixtures/                      # Test projects with known issues
│   │   ├── basic-project/             # Normal project, minor issues
│   │   ├── messy-project/             # Many issues (secrets, unused, missing)
│   │   ├── clean-project/             # Well-organized env setup
│   │   └── no-env/                    # Project without .env file
│   ├── parser.test.ts
│   ├── scanner.test.ts
│   ├── analyzer.test.ts
│   └── commands.test.ts
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

### Data Flow

```
User runs command
    ↓
CLI (commander) → determines which command handler to call
    ↓
Command Handler (e.g., scan.ts)
    ↓
Project Detection (project.ts) → finds .env files, detects git repo
    ↓                    ↓
Parser (parser.ts)      Scanner (scanner.ts)
reads .env files        reads source code
    ↓                    ↓
EnvVariable[]           EnvReference[]
    ↓                    ↓
         Analyzer (analyzer.ts)
         compares, validates, scores
              ↓
         Issue[] + ScoreResult
              ↓
    Command Handler formats output
              ↓
    Terminal (chalk/ink)
```

---

## 6. Feature Specifications

Each feature is described in detail: what it does, how it works, what the user sees, and how it's implemented.

---

### 6.1 `enve scan`

**Purpose:** Quick overview of the current project's environment variable health.

**When to use:**
- First time running enve in a project
- Quick health check before committing
- CI/CD pipeline preliminary check

**How it works (step by step):**

> **IMPORTANT — Fallback Default Values:**
> When scanning code, Enve detects when a variable has a fallback default value (e.g., `process.env.PORT || 3000`). These are treated as **warnings**, not errors. The code will still work without the env var, but the developer should be aware the default exists.

1. **Detect the project.** Look for `package.json` in the current directory. If not found, walk up the directory tree until one is found or the filesystem root is reached. This means `enve scan` works from any subdirectory of a project (e.g., from `recap/backend/` it finds `recap/`).

2. **Find all `.env` files.** Search for files matching the pattern `.env*` in the project root. Exclude `.env.example` from the "active env files" list (it's a template, not a source). Typical files found: `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.test`.

3. **Parse each .env file.** For each file found, read it line by line and extract variables. Handle:
   - Comments: lines starting with `#` are skipped
   - Empty lines: skipped
   - Quoted values: `KEY="value with spaces"` → value is `value with spaces` (quotes removed)
   - Single-quoted values: `KEY='value'` → literal value
   - Unquoted values: `KEY=value` → value as-is
   - Values with `=` signs: `KEY=val=ue` → value is `val=ue` (only first `=` is the delimiter)
   - Inline comments: `KEY=value # this is a comment` → value is `value`, comment stored separately
   - Multiline values (with backslash): `KEY="line1\nline2"` → preserve the newline

4. **Scan source code for references.** Find all JavaScript/TypeScript files (excluding `node_modules/`, `dist/`, `build/`, `.git/`). For each file, parse the AST and look for:
   - `process.env.VARIABLE_NAME`
   - `process.env['VARIABLE_NAME']`
   - `process.env["VARIABLE_NAME"]`
   - `const { VARIABLE_NAME } = process.env`
   - `import.meta.env.VARIABLE_NAME` (Vite projects)
   Record the file path, line number, column, and surrounding code context.

5. **Run the analyzer.** Compare parsed env vars against code references:
   - For each code reference not found in any .env file → create a "missing" issue
   - For each .env variable not referenced in code → create an "unused" issue (with exceptions: `PORT`, `NODE_ENV`, `HOST` are always considered "likely intentional")
   - For each variable with a secret-like name (`SECRET`, `KEY`, `TOKEN`, `PASSWORD`) in a non-`.local` file → create a "secret-risk" issue
   - For each variable whose value looks invalid (e.g., `PORT=abc`) → create an "invalid" issue
   - Check if `.env` and `.env.local` are in `.gitignore` → if not, create "gitignore" issues
   - Check if `.env.example` exists and matches the structure → if outdated, create an issue

6. **Calculate the score.** See the Scoring Engine section (7.5) for the exact algorithm.

7. **Display results.** Format the output using chalk for colors:

```
$ enve scan

  Enve Scan Report — recap
  /home/dev/projects/recap

  .env files found: 3
    • .env              12 variables
    • .env.local         3 variables
    • .env.example      12 variables

  Code references: 8 variables used in 5 files

  Issues found: 5
    ✗ STRIPE_SECRET_KEY looks like a secret in .env (move to .env.local)
    ⚠ DATABASE_URL uses localhost — may need env-specific value
    ⚠ API_KEY is defined but never used in code
    ✗ SLACK_CLIENT_SECRET missing from .env.example
    ✗ REDIS_URL referenced in src/cache.ts but not in .env

  Score: 72/100  [ Good ]
  3 errors, 2 warnings

  Run `enve doctor` for detailed recommendations.
```

**Color coding:**
- ✗ (red) = error
- ⚠ (yellow) = warning
- ✓ (green) = good
- Score 90-100: green background
- Score 70-89: yellow background
- Score 50-69: red text
- Score 0-49: red background, white text

**Implementation file:** `src/cli/commands/scan.ts`
**Depends on:** `parser.ts`, `scanner.ts`, `analyzer.ts`, `project.ts`

---

### 6.2 `enve doctor`

**Purpose:** Comprehensive health check with detailed recommendations.

**When to use:**
- After `enve scan` shows problems
- Setting up a new project
- Monthly codebase audit
- Before onboarding a new team member

**How it works:**

Runs the same detection pipeline as `scan`, but with deeper analysis and structured output organized into sections.

**Sections:**

#### Section 1: File Structure
Checks the physical organization of env files:
- Does `.env` exist? (most projects should have one)
- Does `.env.example` exist? (needed for new developers)
- Is `.env` listed in `.gitignore`?
- Is `.env.local` listed in `.gitignore`?
- Is `.env.production` listed in `.gitignore`?
- Are there multiple `.env.*` files that might conflict?

#### Section 2: Variables
Analyzes the variables themselves:
- Total count of defined variables
- Total count of variables referenced in code
- Which variables are defined but unused (with line numbers)
- Which variables are referenced but missing (with file locations)
- Which variables have duplicate definitions across files (e.g., same key in `.env` and `.env.local`)

#### Section 3: Security
Focuses on secret management:
- Variables with secret-like names in non-`.local` files
- Variables whose values look like secrets (long random strings, base64, hex)
- Whether `.env` (which might contain secrets) is in `.gitignore`
- Whether `.env.example` contains real-looking values instead of placeholders
- Presence of `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `PRIVATE`, `ACCESS`, `CREDENTIAL` in variable names

#### Section 4: Validation
Checks value formats:
- `PORT` values: must be numeric, between 1-65535
- `DATABASE_URL` / `REDIS_URL` / `*_URL`: must be valid URL format
- `JWT_SECRET` / `SECRET_KEY`: minimum 32 characters recommended
- `NODE_ENV`: should be `development`, `production`, or `test`
- `BOOLEAN`-like variables: should be `true`/`false`, not `yes`/`no`/`1`/`0` (inconsistent)

#### Section 5: Recommendations
Actionable fix list, ordered by priority (errors first, then warnings, then tips).

**Sample output:**
```
$ enve doctor

  ╔══════════════════════════════════════════════════════════════╗
  ║           Enve Health Check — recap                          ║
  ║           /home/dev/projects/recap                           ║
  ╚══════════════════════════════════════════════════════════════╝

  [File Structure]
    ✓ .env file found
    ✓ .env.example found
    ✓ .env is in .gitignore
    ✗ .env.local is NOT in .gitignore  ← HIGH RISK

  [Variables — 12 defined, 8 referenced]
    ✓ All referenced variables are defined
    ⚠ 4 variables defined but unused:
        • OLD_API_URL  (.env:8)
        • DEBUG_MODE   (.env:12)
        • TEMP_TOKEN   (.env:15)
        • LEGACY_KEY   (.env:19)
    ✗ 1 variable missing from .env.example:
        • SLACK_CLIENT_SECRET
    ⚠ 2 variables missing from .env but have fallback defaults:
        • PORT (defaults to '3000' in src/index.ts:8)
        • API_BASE_URL (defaults to 'https://api-staging.example.com' in src/client.ts:15)

  [Security]
    ✗ Potential secret committed in .env:
        • STRIPE_SECRET_KEY  (.env:3)
    ⚠ 3 variables should be moved to .env.local:
        • STRIPE_SECRET_KEY
        • JWT_SECRET
        • DB_PASSWORD
    ✓ .env.example uses placeholder values (GOOD)

  [Validation]
    ✓ PORT=3000 is valid
    ✓ DATABASE_URL is a valid URL
    ⚠ JWT_SECRET is only 12 characters (recommend 32+)
    ✗ NODE_ENV=dev should be 'development', 'production', or 'test'

  [Recommendations — 5 actions needed]

    HIGH PRIORITY:
    1. Add .env.local to .gitignore immediately:
       echo ".env.local" >> .gitignore

    2. Move secrets to .env.local:
       # Cut these from .env and paste into .env.local
       STRIPE_SECRET_KEY=sk_test_...
       JWT_SECRET=...
       DB_PASSWORD=...

    MEDIUM PRIORITY:
    3. Remove unused variables:
       enve unused --fix    (removes them from .env)

    4. Add missing variable to .env.example:
       echo "SLACK_CLIENT_SECRET=your_slack_client_secret" >> .env.example

    LOW PRIORITY:
    5. Make JWT_SECRET at least 32 characters for security.

  Score: 58/100  [ Needs attention ]
  3 errors, 5 warnings, 1 info

  ════════════════════════════════════════════════════════════════
  Fix the HIGH PRIORITY items first. Run `enve doctor` again to
  see your updated score.
  ════════════════════════════════════════════════════════════════
```

**Implementation file:** `src/cli/commands/doctor.ts`
**Depends on:** Same as scan, plus deeper validation logic

---

### 6.3 `enve unused`

**Purpose:** Find environment variables defined in `.env` files that are never referenced in the codebase.

**When to use:**
- Spring cleaning a project
- Before onboarding a new developer (remove confusion)
- After refactoring when some integrations were removed

**How it works:**
1. Parse all `.env` files
2. Scan all source files for `process.env.*` references
3. Compare: if a variable is defined but never referenced → it's unused
4. **Exceptions** (never flagged as unused):
   - `PORT`, `HOST`, `NODE_ENV` — these are used implicitly by many frameworks
   - Variables in `.env.example` (it's a template, expected to have extras)
   - Variables in `.env.test` (test-specific, may be used by test runners)
5. Display results

**Sample output:**
```
$ enve unused

  Unused variables in /home/dev/projects/recap

    .env
      ⚠ OLD_API_URL       (line 8)   Last reference removed 6 months ago
      ⚠ DEBUG_MODE        (line 12)  Never referenced
      ⚠ TEMP_TOKEN        (line 15)  Used in a test that no longer exists
      ⚠ LEGACY_KEY        (line 19)  Feature was removed in v2.1

    .env.local
      ✓ All variables are used

  4 unused variables found. They may be safe to remove.
  Run `enve unused --fix` to automatically remove them.
  Run `enve unused --fix --dry-run` to preview the changes.
```

**Options:**
- `--fix` — Actually removes unused variables from `.env` files (with confirmation prompt)
- `--dry-run` — Shows what would be removed without making changes
- `--include-commons` — Also flag `PORT`, `HOST`, `NODE_ENV` if truly unused

**The `--fix` flow:**
1. Show list of variables to be removed
2. Ask for confirmation: "Remove 4 unused variables from .env? (y/N)"
3. If yes, remove them
4. Create a backup: `.env.backup.2026-01-15T10-30-00`
5. Show: "✓ Removed 4 variables. Backup saved to .env.backup.2026-01-15T10-30-00"

**Implementation file:** `src/cli/commands/unused.ts`

---

### 6.4 `enve missing`

**Purpose:** Find `process.env.VAR` references in code that don't have a corresponding definition in any `.env` file.

**When to use:**
- After pulling code changes from teammates (they may have added new env vars)
- Before deploying (ensure all required vars are set)
- CI/CD pipeline validation step

**How it works:**
1. Scan all source files for `process.env.*` and `import.meta.env.*` references
2. Parse all `.env` files
3. For each code reference, check if the variable exists in any `.env` file
4. If not found → it's missing
5. **Exceptions:**
   - Variables with fallbacks: `process.env.PORT || 3000` → not missing (has default)
   - Variables checked with `?`: `process.env.DEBUG ? ... : ...` → not missing (guarded access)
   - Standard Node.js vars: `process.env.PATH`, `process.env.HOME`, `process.env.USER`

**Sample output:**
```
$ enve missing

  Missing environment variables in /home/dev/projects/recap

  ── Missing (no fallback — WILL cause runtime errors) ───────────

    src/cache.ts:14
      ✗ REDIS_URL — referenced but not defined in any .env file
        → const redis = new Redis(process.env.REDIS_URL)

    src/auth/middleware.ts:22
      ✗ AUTH_SERVICE_URL — referenced but not defined
        → const url = process.env.AUTH_SERVICE_URL

  ── Missing (has fallback — will use default value) ─────────────

    src/mail/sendgrid.ts:8
      ⚠ SENDGRID_API_KEY — has fallback default
        → process.env.SENDGRID_API_KEY || 'SG.mock-key'
        → Default: 'SG.mock-key'

    src/config.ts:5
      ⚠ PORT — has fallback default
        → process.env.PORT || '3000'
        → Default: '3000'

    src/db/client.ts:12
      ⚠ DB_POOL_SIZE — has fallback default
        → parseInt(process.env.DB_POOL_SIZE ?? '10')
        → Default: '10'

  Summary:
    ✗ 2 variables are truly missing (will cause runtime errors)
    ⚠ 3 variables have fallback defaults (code will still work)

  Add the missing ones to .env:
    REDIS_URL=redis://localhost:6379
    AUTH_SERVICE_URL=http://localhost:4001

  And update .env.example so your team knows about them:
    enve generate-example
```

**How fallback detection works:**

The scanner analyzes the AST around each `process.env` reference to detect these fallback patterns:

| Pattern | Detected? | Example |
|---------|-----------|---------|
| `\|\| 'default'` | ✓ Yes | `process.env.PORT \|\| 3000` |
| `?? 'default'` | ✓ Yes | `process.env.API_URL ?? 'https://default.com'` |
| `\|\| ""` | ✓ Yes | `process.env.NAME \|\| 'unknown'` |
| `? :` ternary | ✓ Yes | `process.env.DEBUG ? true : false` |
| `&&` guard | ✓ Partial | `process.env.API_KEY && callApi()` |
| `||` with expression | ✓ Yes | `process.env.TIMEOUT \|\| 30 * 1000` |

When a fallback is detected, the `EnvReference.hasFallback` flag is set to `true` and the default value is captured for display.

**Severity rules:**
- Missing variable **without** fallback → `error` (runtime crash)
- Missing variable **with** fallback → `warning` (code still works, but explicit is better)

**Options:**
- `--include-fallbacks` — Also show variables that have fallback defaults (shown by default, use `--no-fallbacks` to hide)
- `--add` — Interactive prompt to add missing variables to `.env` (asks about fallbacks too)

**Implementation file:** `src/cli/commands/missing.ts`

---

### 6.5 `enve validate`

**Purpose:** Validate the *values* of environment variables against expected formats.

**When to use:**
- Before deploying (catch config errors early)
- CI/CD pipeline gate
- After updating `.env` values

**How it works:**

For each variable in `.env`, apply validation rules based on the variable name:

| Variable Name Pattern | Validation Rule | Error Example |
|----------------------|----------------|---------------|
| `PORT` or `*_PORT` | Must be integer 1-65535 | `PORT=abc` → "PORT must be a number between 1 and 65535" |
| `*_URL` or `DATABASE_URL` or `REDIS_URL` | Must be valid URL with protocol | `DATABASE_URL=localhost:5432` → "Missing protocol. Did you mean postgres://localhost:5432?" |
| `NODE_ENV` | Must be `development`, `production`, or `test` | `NODE_ENV=dev` → "Use 'development' instead of 'dev'" |
| `SECRET`, `KEY`, `TOKEN` (when not `API_KEY`) | Minimum 16 characters, should not be "default", "secret", "test" | `JWT_SECRET=abc` → "JWT_SECRET is too short (3 chars). Use at least 16 random characters." |
| `BOOLEAN`-like (`DEBUG`, `VERBOSE`) | Should be `true` or `false` (not `yes`, `1`, `on`) | `DEBUG=yes` → "Use 'true' or 'false' for boolean values" |
| `*_PATH` | Should be absolute path or relative to project root | `LOG_PATH=/tmp` → warning, not error |
| `*_HOST` | Should not be `localhost` in production `.env` | Flag as warning in `.env.production` |

**Sample output:**
```
$ enve validate

  Validating environment variables — recap

    PORT=3000
      ✓ Valid port number

    DATABASE_URL=postgres://user:pass@localhost:5432/db
      ✓ Valid PostgreSQL URL

    REDIS_URL=localhost:6379
      ✗ Invalid URL — missing protocol
        Suggestion: redis://localhost:6379

    JWT_SECRET=my-secret
      ✗ Too short (10 characters)
        Suggestion: Use at least 16 characters. Generate one:
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

    NODE_ENV=dev
      ✗ Invalid value — use 'development', 'production', or 'test'
        Suggestion: NODE_ENV=development

    API_BASE_URL=https://api.example.com
      ✓ Valid HTTPS URL

  6 variables checked, 3 errors, 0 warnings
  Run `enve validate --fix` to automatically fix simple issues.
```

**The `--fix` option:**
Automatically fixes fixable issues:
- Adds `https://` to URL-like values missing protocol
- Changes `NODE_ENV=dev` → `NODE_ENV=development`
- Changes boolean-like values to `true`/`false`
- Does NOT auto-fix secrets (too risky)

**Implementation file:** `src/cli/commands/validate.ts`
**Depends on:** `validators.ts`

---

### 6.6 `enve generate-example`

**Purpose:** Automatically create or update `.env.example` from the current `.env` file.

**When to use:**
- After adding new environment variables
- When onboarding a new team member
- In CI/CD to ensure `.env.example` is always up to date

**How it works:**

1. Read the main `.env` file
2. For each variable:
   - If the key contains `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `PRIVATE` → replace value with a descriptive placeholder
   - Otherwise → keep the value as-is (it's likely safe to share)
3. Write to `.env.example`
4. If `.env.example` already exists, show a diff of what changed

**Secret detection rules:**
- Key contains: `SECRET`, `KEY`, `TOKEN`, `PASSWORD`, `PRIVATE`, `ACCESS`, `CREDENTIAL`, `AUTH`
- Value is longer than 20 characters and looks random (high entropy)
- Value is base64-encoded (matches base64 pattern)

**Placeholder format:**
```
STRIPE_SECRET_KEY=your_stripe_secret_key
JWT_SECRET=your_jwt_secret_min_32_chars
DB_PASSWORD=your_database_password
```

**Sample output:**
```
$ enve generate-example

  Generating .env.example from .env

  Variables: 12 total
    • 8 public variables → copied as-is
    • 4 secrets redacted:
        STRIPE_SECRET_KEY → your_stripe_secret_key
        JWT_SECRET        → your_jwt_secret
        DB_PASSWORD       → your_database_password
        SLACK_CLIENT_SECRET → your_slack_client_secret

  ✓ Created .env.example

$ enve generate-example
  ⚠ .env.example already exists.

  Changes since last generation:
    + Added: REDIS_URL (new in .env)
    + Added: WEBHOOK_SECRET (new in .env)
    ~ Updated: DATABASE_URL (value changed)
    - Removed: OLD_API_URL (no longer in .env)

  Run with --overwrite to update .env.example
```

**Options:**
- `--overwrite` — Update existing `.env.example` without prompting
- `--output <path>` — Write to a different file (e.g., `--output .env.template`)
- `--all-secrets` — Redact ALL values (maximum safety, but less useful as a template)

**Implementation file:** `src/cli/commands/generate-example.ts`

---

### 6.7 `enve hook`

**Purpose:** Install, manage, and check a pre-commit git hook that prevents `.env` files from being committed.

**When to use:**
- Immediately after setting up a new project
- As part of team onboarding
- After the first `enve scan` shows `.env` is not in `.gitignore`

**How it works:**

Git hooks are scripts that run automatically at certain points in the git workflow. The `pre-commit` hook runs *before* a commit is created. If the hook exits with a non-zero code, the commit is blocked.

**Sub-commands:**

#### `enve hook install`
1. Check if the current directory is a git repository (look for `.git/`)
2. Create or modify `.git/hooks/pre-commit`
3. Add the enve pre-commit check at the top of the file
4. If a pre-commit hook already exists, prepend the enve check (don't overwrite)
5. Make the hook executable (`chmod +x`)

**The hook script that gets installed:**
```bash
#!/bin/bash
# === Enve Pre-Commit Hook ===
# Blocks commits of .env files that may contain secrets
# Installed by: enve hook install
# Remove with: enve hook uninstall

BLOCKED_PATTERNS='^\.env(\.[^/]*)?$'
STAGED_ENV_FILES=$(git diff --cached --name-only | grep -E "$BLOCKED_PATTERNS" || true)

if [ -n "$STAGED_ENV_FILES" ]; then
  echo ""
  echo "  ✗ COMMIT BLOCKED by Enve"
  echo ""
  echo "  You are attempting to commit environment files:"
  echo "$STAGED_ENV_FILES" | sed 's/^/    /'
  echo ""
  echo "  These files may contain secrets (API keys, passwords, tokens)."
  echo ""
  echo "  What to do instead:"
  echo "    1. Add them to .gitignore:  echo '.env.local' >> .gitignore"
  echo "    2. Use .env.example for templates:  enve generate-example"
  echo "    3. Share secrets through a secure channel (1Password, etc.)"
  echo ""
  echo "  If you are CERTAIN these files are safe to commit:"
  echo "    git commit --no-verify"
  echo ""
  exit 1
fi
# === End Enve Hook ===
```

**Sample output:**
```
$ enve hook install

  ✓ Pre-commit hook installed
    Location: .git/hooks/pre-commit
    
  What it does:
    • Blocks commits of .env, .env.local, .env.production files
    • Shows a helpful message with next steps
    • Can be bypassed with --no-verify (emergency only)

  To remove: enve hook uninstall

$ enve hook status

  Pre-commit hook: ✓ Installed (enve protection active)
    
  Hook details:
    • Location: .git/hooks/pre-commit
    • Installed: 3 days ago
    • Commits blocked so far: 2
    
  Last blocked commit:
    Time: 2026-01-13 14:22
    Files: .env.local
    
  Bypassed commits (--no-verify): 1
    ⚠ Warning: --no-verify skipped secret protection

$ enve hook uninstall

  ⚠ Remove pre-commit hook? This will disable .env commit protection. (y/N)
  
  User: y
  
  ✓ Pre-commit hook removed
  Run `enve hook install` to re-enable.
```

**Implementation file:** `src/cli/commands/hook.ts`
**Depends on:** `git.ts` utility

---

### 6.8 `enve dashboard`

**Purpose:** Interactive terminal dashboard showing all tracked projects and their environment variable health.

**When to use:**
- Daily check of all projects
- Before starting work ("which project needs attention?")
- After making changes ("did my fix improve the score?")

**How it works:**

1. Read the enve config file (`~/.config/enve/projects.json`) to get the list of tracked projects
2. For each project, run a quick analysis (same as `enve scan` but without full output)
3. Display an interactive terminal UI using Ink (React for terminals)
4. Allow navigation between projects using arrow keys
5. Show detailed info for the selected project

**Navigation:**
- `↑` / `↓` — Navigate between projects in the list
- `Enter` — Run full `enve doctor` for the selected project
- `r` — Refresh all projects
- `q` or `Ctrl+C` — Quit

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Enve Dashboard                                          v1.0.0    │
│                                                                      │
│  ┌─ Projects ─────────────────────────────────────────────────┐     │
│  │ ▶ recap                   15 vars   2⚠   0✗   Score: 87   │     │
│  │   proteintrail-web        12 vars   1⚠   1✗   Score: 72   │     │
│  │   proteintrail-app         8 vars   0⚠   0✗   Score: 95   │     │
│  │   aft-tools               22 vars   5⚠   2✗   Score: 64   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─ recap ────────────────────────────────────────────────────┐     │
│  │  Path: ~/projects/recap                                    │     │
│  │  Git:  Yes  │  Hook: ✓  │  .gitignore: ✓                  │     │
│  │                                                            │     │
│  │  .env files:                                               │     │
│  │    .env          12 variables                              │     │
│  │    .env.local     3 variables                              │     │
│  │    .env.example  12 variables                              │     │
│  │                                                            │     │
│  │  Top Issues:                                               │     │
│  │    ⚠ SLACK_CLIENT_SECRET should be in .env.local          │     │
│  │    ⚠ OLD_API_URL is unused (line 8)                       │     │
│  │    ⚠ DEBUG_MODE is unused (line 12)                       │     │
│  │    ✓ All code references resolved                          │     │
│  │                                                            │     │
│  │  [Enter] Doctor  [r] Refresh  [q] Quit                     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ↑↓ Navigate  Enter Select  r Refresh  q Quit                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Color scheme:**
- Score 90-100: green badge
- Score 70-89: yellow badge
- Score 50-69: red badge
- Score 0-49: red background, white text
- Issues: ⚠ yellow, ✗ red, ✓ green

**Auto-track projects:**
When `enve scan` or `enve doctor` is run in a directory, that project is automatically added to the dashboard if it's not already tracked.

**Config file location:** `~/.config/enve/projects.json`
```json
{
  "version": 1,
  "projects": [
    {
      "name": "recap",
      "path": "/home/dev/projects/recap",
      "addedAt": "2026-01-15T10:30:00Z"
    },
    {
      "name": "proteintrail-web",
      "path": "/home/dev/projects/proteintrail-web",
      "addedAt": "2026-01-20T14:15:00Z"
    }
  ]
}
```

**Implementation files:**
- `src/cli/commands/dashboard.ts` — command handler
- `src/ui/Dashboard.tsx` — main dashboard component
- `src/ui/ProjectCard.tsx` — project list item
- `src/ui/IssueList.tsx` — issues display
- `src/ui/ScoreBadge.tsx` — color-coded score
- `src/ui/theme.ts` — color constants

---

## 7. Core Engine Deep Dive

This section describes the internal engine that powers all commands. These modules live in `src/core/`.

---

### 7.1 The Parser (`src/core/parser.ts`)

**Responsibility:** Read `.env` files and extract structured data from them.

**Input:** A file path (e.g., `/project/.env`)
**Output:** An array of `EnvVariable` objects

**Parsing algorithm (line by line):**

```
For each line in the file:
  1. Trim trailing whitespace
  2. If line is empty → skip
  3. If line starts with "#" → skip (it's a comment)
  4. Find the first "=" sign
     - Everything before = is the key
     - Everything after = is the raw value
  5. If key is empty → syntax error
  6. Parse the value:
     a. If value starts with '"' → find matching closing '"'
        - Handle escaped quotes: \"
        - Remove surrounding quotes
        - Convert \n to actual newlines
        - Convert \t to actual tabs
     b. If value starts with "'" → find matching closing "'"
        - Remove surrounding quotes
        - No escape sequence processing (literal)
     c. Otherwise → value is raw string (trim trailing whitespace only)
  7. Check for inline comment:
     - If unquoted value has " # " → split at first " # "
     - Comment part is stored separately
  8. Detect if secret:
     - Check if key matches: /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|ACCESS|CREDENTIAL/i
     - Check if value entropy is high (>3.5 bits per character)
     - If either → mark as isSecret = true
  9. Store: { key, value, line, source, isSecret, comment? }
```

**Edge cases to handle:**
- `KEY=` (empty value) → valid, value is empty string
- `KEY=""` (quoted empty) → valid, value is empty string
- `KEY=val # comment with = sign` → value is `val`, comment is `comment with = sign`
- `KEY="value # not a comment"` → value is `value # not a comment` (inside quotes)
- `export KEY=value` → strip the `export` keyword (bash syntax)
- `KEY: value` (YAML-style) → NOT valid for .env, report as syntax error

**API:**
```typescript
// Parse a single .env file
function parseEnvFile(filePath: string): EnvVariable[]

// Find all .env files in a project
function findEnvFiles(projectPath: string): EnvFile[]

// Parse all .env files in a project
function parseAllEnvFiles(projectPath: string): EnvFile[]
```

---

### 7.2 The Scanner (`src/core/scanner.ts`)

**Responsibility:** Find all references to environment variables in the source code.

**Input:** A project path (e.g., `/project/src`)
**Output:** An array of `EnvReference` objects

**Scanning algorithm:**

```
1. Find all source files:
   Use fast-glob to find files matching:
     - "src/**/*.{js,ts,jsx,tsx}"
     - "lib/**/*.{js,ts}"
     - "pages/**/*.{js,ts,jsx,tsx}" (Next.js)
     - "app/**/*.{js,ts,jsx,tsx}" (Next.js App Router)
   Exclude:
     - "**/node_modules/**"
     - "**/dist/**"
     - "**/build/**"
     - "**/.next/**"
     - "**/*.test.{js,ts}" (optional, configurable)
     - "**/*.spec.{js,ts}" (optional, configurable)

2. For each source file:
   a. Read file content
   b. Parse AST using acorn with:
      - ecmaVersion: 'latest'
      - sourceType: 'module'
      - allowReturnOutsideFunction: true
      - allowImportExportEverywhere: true
   c. Walk the AST using acorn-walk visitors:

   Visitor for MemberExpression:
     - Check if object is "process" and property is "env"
     - Then check if the next property access is an identifier
     - Record: { key: propertyName, file, line, column }

   Visitor for ObjectPattern (destructuring):
     - Check if source is "process.env"
     - Record each destructured property as a reference

   Visitor for MetaProperty:
     - Check if meta.name is "import" and property is "env"
     - Handle: import.meta.env.VARIABLE

3. For each reference, detect fallback patterns:

   Walk the AST parent nodes of the `process.env.X` expression to find:

   | Pattern | AST Structure | hasFallback |
  |---------|--------------|-------------|
   | `process.env.X \|\| value` | LogicalExpression (operator: '\\|\\|') | true, capture right operand |
   | `process.env.X ?? value` | LogicalExpression (operator: '??') | true, capture right operand |
   | `process.env.X ? a : b` | ConditionalExpression | true, capture alternate (':') value |
   | `process.env.X \|\| func()` | LogicalExpression | true, capture as `"<function call>"` |
   | `process.env.X && func()` | LogicalExpression | true (guarded access, may skip execution) |
   | `process.env.X` alone | MemberExpression (no parent logical/conditional) | false |

   When `hasFallback` is true, also capture:
   - `fallbackValue`: String representation of the default (e.g., `'3000'`, `'https://default.com'`, `'<expression>'`)
   - `fallbackType`: `'literal'`, `'function'`, or `'expression'`

4. Extract context (±2 lines around the reference for display)
```

**Variable name patterns to detect:**
- Direct access: `process.env.VARIABLE_NAME`
- Bracket access: `process.env['VARIABLE_NAME']`, `process.env["VARIABLE_NAME"]`
- Computed bracket: `process.env[someVar]` → skip (can't determine static name)
- Destructuring: `const { VARIABLE_NAME } = process.env`
- Nested destructuring: `const { env: { VARIABLE_NAME } } = process`
- Vite-style: `import.meta.env.VITE_VARIABLE_NAME`

**API:**
```typescript
// Find all env references in a project
function scanProject(projectPath: string, options?: ScannerOptions): EnvReference[]

// Scan a single file
function scanFile(filePath: string): EnvReference[]
```

---

### 7.2b Fallback Default Detection (Critical Design Decision)

**This is one of the most important behaviors in Enve.**

When a developer writes `const port = process.env.PORT || 3000`, they are providing a **fallback default value**. If `PORT` is not in `.env`, the application will still work — it'll just use port 3000. This is a common and valid pattern.

**Enve's behavior for missing variables:**

| Scenario | Severity | Why |
|----------|----------|-----|
| `process.env.API_KEY` (no fallback) + not in `.env` | **Error** | Code will crash or use `undefined` |
| `process.env.PORT \|\| 3000` + not in `.env` | **Warning** | Code works, default is provided |
| `process.env.DEBUG ?? false` + not in `.env` | **Warning** | Code works, default is provided |
| `process.env.URL ? useUrl() : useDefault()` + not in `.env` | **Warning** | Code has explicit handling |

**Why this matters:**
A typical Express.js server might have 5+ variables with fallbacks:
```javascript
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
```

If Enve reported all of these as **errors**, every Node.js project would score poorly. By treating fallback-protected vars as **warnings**, Enve gives an accurate picture of actual risk.

**The warning message encourages best practices:**
> "`PORT` is not defined in `.env` but has a fallback default: `3000`. Consider adding it to `.env` for explicit configuration."

This nudges the developer toward explicit configuration without creating panic.

---

### 7.3 The Analyzer (`src/core/analyzer.ts`)

**Responsibility:** Compare parsed env variables against code references and generate issues.

**Input:** `EnvVariable[]` (from parser) + `EnvReference[]` (from scanner) + project path
**Output:** `Issue[]`

**Analysis rules:**

#### Rule 1: Missing Variables
```
For each reference in EnvReference[]:
  If reference.key not in any EnvVariable[]:
    If reference.hasFallback == true:
      // Variable is missing but has a default — WARNING, not error
      Create Issue:
        type: 'missing'
        severity: 'warning'          // ← WARNING because code still works
        key: reference.key
        message: "{key} is not defined in .env but has a fallback default: {reference.fallbackValue}"
        file: reference.file
        line: reference.line
        suggestion: "Consider adding {key} to .env for explicit configuration, or keep the fallback"
    Else:
      // Variable is missing with NO fallback — ERROR
      Create Issue:
        type: 'missing'
        severity: 'error'            // ← ERROR because code will break
        key: reference.key
        message: "{key} referenced in {file}:{line} but not defined in any .env file (no fallback)"
        file: reference.file
        line: reference.line
        suggestion: "Add {key} to .env and .env.example"
```

**Key distinction:**
- `process.env.PORT || 3000` → missing `PORT` → **warning** (code works with default 3000)
- `process.env.API_KEY` (no fallback) → missing `API_KEY` → **error** (code crashes with `undefined`)

#### Rule 2: Unused Variables
```
For each variable in EnvVariable[]:
  If variable.source is NOT '.env.example' AND variable.source is NOT '.env.test':
    If variable.key NOT in alwaysAllowed[]:
      If variable.key not referenced in any EnvReference[]:
        Create Issue:
          type: 'unused'
          severity: 'warning'
          key: variable.key
          message: "{key} is defined in {source} but never used in code"
          file: variable.source
          line: variable.line
          suggestion: "Remove if no longer needed, or use it in your code"

alwaysAllowed = ['PORT', 'HOST', 'NODE_ENV', 'CI', 'PWD']
```

#### Rule 3: Secret Risk
```
For each variable in EnvVariable[]:
  If variable.source == '.env' (not .env.local, not .env.example):
    If variable.isSecret == true:
      Create Issue:
        type: 'secret-risk'
        severity: 'error'
        key: variable.key
        message: "{key} looks like a secret but is in .env instead of .env.local"
        file: variable.source
        line: variable.line
        suggestion: "Move {key} to .env.local (which should be in .gitignore)"
```

#### Rule 4: Gitignore Check
```
Check if .gitignore exists in project root:
  Read .gitignore content
  
  If '.env' not in .gitignore:
    Create Issue:
      type: 'gitignore'
      severity: 'error'
      key: '.env'
      message: ".env is not in .gitignore — risk of committing secrets"
      file: '.gitignore'
      suggestion: "echo '.env' >> .gitignore"
  
  If '.env.local' not in .gitignore:
    Create Issue:
      type: 'gitignore'
      severity: 'error'
      key: '.env.local'
      message: ".env.local is not in .gitignore"
      file: '.gitignore'
      suggestion: "echo '.env.local' >> .gitignore"
  
  If '.env.production' not in .gitignore:
    Create Issue:
      type: 'gitignore'
      severity: 'error'
      key: '.env.production'
      message: ".env.production is not in .gitignore — production secrets at risk"
      file: '.gitignore'
      suggestion: "echo '.env.production' >> .gitignore"
```

#### Rule 5: Example File Check
```
If .env.example does NOT exist:
  Create Issue:
    type: 'suspicious'
    severity: 'warning'
    key: '.env.example'
    message: ".env.example is missing — new developers won't know what env vars are needed"
    file: '.'
    suggestion: "Run `enve generate-example` to create one"

If .env.example exists:
  Parse .env.example
  For each variable in .env:
    If variable.key not in .env.example:
      Create Issue:
        type: 'suspicious'
        severity: 'warning'
        key: variable.key
        message: "{key} is in .env but missing from .env.example"
        file: '.env.example'
        suggestion: "Add {key}=your_{key} to .env.example"
```

**API:**
```typescript
function analyze(
  envFiles: EnvFile[],
  references: EnvReference[],
  projectPath: string
): Issue[]
```

---

### 7.4 The Config Manager (`src/core/config.ts`)

**Responsibility:** Read and write enve's global configuration file.

**Config location:**
- Linux/macOS: `~/.config/enve/projects.json`
- Windows: `%APPDATA%/enve/projects.json`

**Uses the `conf` npm package** which handles cross-platform config directories automatically.

**API:**
```typescript
// Get all tracked projects
function getProjects(): TrackedProject[]

// Add a project (auto-detects name from package.json or folder name)
function addProject(projectPath: string): TrackedProject

// Remove a project
function removeProject(projectPath: string): boolean

// Check if a project is already tracked
function isTracked(projectPath: string): boolean

// Get a single project by path
function getProject(projectPath: string): TrackedProject | undefined
```

**Auto-naming logic:**
1. Read `package.json` → if `name` field exists and is not "", use it
2. Otherwise, use the directory name of the project path

---

### 7.5 The Scoring Engine (`src/core/analyzer.ts`)

**Purpose:** Calculate a numeric score (0-100) that represents the health of a project's env setup.

**Scoring algorithm:**

```
Base score: 100

Deductions:
  Missing variable (no fallback):        -10 per variable   ← ERROR
  Missing variable (has fallback):        -3 per variable   ← WARNING (code still works)
  Secret in non-.local file:              -8 per variable
  .env not in .gitignore:                -20
  .env.local not in .gitignore:          -20
  .env.production not in .gitignore:     -25
  Syntax error in .env:                  -15 per error
  Invalid value format:                   -5 per variable
  Unused variable:                        -3 per variable (max -15)
  Missing from .env.example:              -2 per variable (max -10)
  .env.example doesn't exist:            -10

Grades:
  90-100: Excellent (green)
  70-89:  Good (yellow)
  50-69:  Needs attention (orange)
  0-49:   Critical (red)
```

**Why missing-with-fallback is only -3:**
The code will still function because a sensible default is provided. This is a best-practice warning ("be explicit about your config") rather than a critical issue. A project with 5 missing-but-fallback vars only loses 15 points instead of 50.

**The score is designed to:**
- Heavily penalize security risks (secrets in .env, not gitignored)
- Moderately penalize operational issues (missing vars, invalid values)
- Lightly penalize maintenance issues (unused vars, outdated examples)

---

## 8. Terminal UI Design

This section defines the visual design of the terminal output.

### Color Palette

```typescript
// src/ui/theme.ts
export const colors = {
  // Severity
  error: '#FF5252',      // Red — errors, critical issues
  warning: '#FFB300',    // Amber — warnings, attention needed
  success: '#00E676',    // Green — all good, resolved
  info: '#448AFF',       // Blue — informational

  // UI
  primary: '#00E676',    // Main accent (same as success)
  muted: '#78909C',      // Secondary text, borders
  background: 'default', // Terminal default background
  highlight: '#FFFFFF',  // Bright white for emphasis

  // Score badges
  scoreExcellent: '#00E676',
  scoreGood: '#FFB300',
  scoreWarning: '#FF9800',
  scoreCritical: '#FF5252',
};

export const symbols = {
  error: '✗',
  warning: '⚠',
  success: '✓',
  info: 'ℹ',
  bullet: '•',
  arrow: '→',
  pointer: '▸',
};
```

### Output Formatting Rules

1. **Indentation:** Use 2 spaces for each level of indentation
2. **Line width:** Wrap at 80 characters where possible
3. **Headers:** Use box-drawing characters for section headers
4. **Empty lines:** One empty line between sections
5. **Commands in suggestions:** Always wrap in backticks for clarity

### Box Drawing (for headers and cards)

```
Single-line headers:
  ════ Text ════════════════════════════════

Section boxes:
  ┌─ Title ───────────────────────────────┐
  │  Content here                         │
  └───────────────────────────────────────┘
```

---

## 9. Data Models

This section defines every TypeScript interface used in the project.

```typescript
// src/types/index.ts

/** Severity levels for issues */
export type Severity = 'error' | 'warning' | 'info';

/** Types of issues enve can detect */
export type IssueType =
  | 'missing'        // Referenced in code but not in .env
  | 'unused'         // Defined in .env but not referenced in code
  | 'invalid'        // Value doesn't match expected format
  | 'suspicious'     // Potentially problematic value or setup
  | 'secret-risk'    // Secret key in non-.local file
  | 'syntax-error'   // Malformed .env file
  | 'gitignore';     // .env file not in .gitignore

/** A single environment variable found in a .env file */
export interface EnvVariable {
  key: string;
  value: string;
  line: number;
  source: string;        // e.g., ".env", ".env.local"
  isSecret: boolean;     // Heuristically detected
  comment?: string;      // Trailing inline comment
}

/** A reference to process.env.X found in source code */
export interface EnvReference {
  key: string;
  file: string;
  line: number;
  column: number;
  context: string;           // Surrounding code snippet
  hasFallback: boolean;      // Has a default/fallback value in code
  fallbackValue?: string;    // The default value (e.g., "3000", "'https://default.com'")
  fallbackType?: 'literal' | 'function' | 'expression' | 'ternary';
}

/** An issue detected by the analyzer */
export interface Issue {
  type: IssueType;
  severity: Severity;
  key: string;
  message: string;
  file: string;
  line?: number;
  suggestion?: string;
  hasFallback?: boolean;    // Only for 'missing' type — true if code has a default value
  fallbackValue?: string;   // The default value from code (e.g., "3000", "'https://default.com'")
}

/** An .env file found in a project */
export interface EnvFile {
  path: string;
  filename: string;
  variables: EnvVariable[];
}

/** Score grade classification */
export type Grade = 'Excellent' | 'Good' | 'Needs attention' | 'Critical';

/** Scoring result */
export interface ScoreResult {
  score: number;
  grade: Grade;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/** Project information for dashboard and reporting */
export interface ProjectInfo {
  name: string;
  path: string;
  envFiles: EnvFile[];
  envCount: number;
  referenceCount: number;
  issues: Issue[];
  score: ScoreResult;
  hasGit: boolean;
  hookInstalled: boolean;
  hasEnvInGitignore: boolean;
  lastModified: Date;
}

/** Stored project in enve config */
export interface TrackedProject {
  name: string;
  path: string;
  addedAt: string;       // ISO date string
}

/** Enve global configuration */
export interface EnveConfig {
  version: number;
  projects: TrackedProject[];
}

/** Analysis report for a project */
export interface AnalysisReport {
  projectPath: string;
  envFiles: EnvFile[];
  references: EnvReference[];
  issues: Issue[];
  score: ScoreResult;
  generatedAt: Date;
}

/** Options for the scanner */
export interface ScannerOptions {
  include?: string[];    // Additional glob patterns to include
  exclude?: string[];    // Glob patterns to exclude
  checkTests?: boolean;  // Whether to scan test files (default: false)
}

/** Options for parser */
export interface ParserOptions {
  files?: string[];      // Specific .env files to parse
  path?: string;         // Project root path
}

/** Health check sections for doctor command */
export interface HealthCheckSections {
  fileStructure: Issue[];
  variables: Issue[];
  security: Issue[];
  validation: Issue[];
  recommendations: string[];
}
```

---

## 10. MVP Development Roadmap

### Phase 1: Foundation (Days 1-3)

**Day 1: Project Setup**
- [ ] Initialize Node.js project with TypeScript
- [ ] Install all dependencies (commander, chalk, ora, dotenv, fast-glob, acorn, acorn-walk, conf, ink, react)
- [ ] Configure TypeScript, tsup, vitest, eslint
- [ ] Set up directory structure
- [ ] Write shared types (`src/types/index.ts`)
- [ ] Write utility modules (`fs.ts`, `logger.ts`, `validators.ts`, `git.ts`)
- [ ] Commit: `scaffold: project structure and dependencies`

**Day 2: Core Engine**
- [ ] Implement `parser.ts` — `.env` file parsing
  - Handle all edge cases (quoted values, comments, multiline, export keyword)
  - Write tests for each edge case
- [ ] Implement `scanner.ts` — source code scanning
  - Integrate acorn + acorn-walk
  - Handle all access patterns (direct, bracket, destructuring, import.meta.env)
  - Write tests with sample source files
- [ ] Commit: `feat: parser and scanner core engine`

**Day 3: Analyzer & Config**
- [ ] Implement `analyzer.ts` — issue detection
  - All 5 analysis rules (missing, unused, secret-risk, gitignore, example check)
  - Scoring engine
  - Write tests with fixtures
- [ ] Implement `config.ts` — global config management
  - Read/write `~/.config/enve/projects.json`
  - CRUD operations for tracked projects
- [ ] Implement `project.ts` — project detection
  - Find .env files, detect git repo, detect package.json
- [ ] Commit: `feat: analyzer, config, and project detection`

### Phase 2: Commands (Days 4-6)

**Day 4: Basic Commands**
- [ ] Implement `scan` command — quick project overview
- [ ] Implement `doctor` command — comprehensive health check
- [ ] Implement `unused` command — find dead variables
- [ ] Implement `missing` command — find missing variables
- [ ] Write tests for each command
- [ ] Commit: `feat: scan, doctor, unused, missing commands`

**Day 5: Utility Commands**
- [ ] Implement `validate` command — validate env values
  - URL validation, port validation, secret length, NODE_ENV values
- [ ] Implement `generate-example` command — auto-create `.env.example`
  - Secret detection, placeholder generation, diff output
- [ ] Write tests
- [ ] Commit: `feat: validate and generate-example commands`

**Day 6: Security Commands**
- [ ] Implement `hook` command — pre-commit hook management
  - Hook script template, install/uninstall/status subcommands
  - Bash script generation, backup existing hooks
- [ ] Write tests
- [ ] Commit: `feat: pre-commit hook protection`

### Phase 3: Dashboard & Polish (Days 7-8)

**Day 7: Dashboard UI**
- [ ] Set up Ink (React for terminals)
- [ ] Implement `Dashboard.tsx` — main layout
- [ ] Implement `ProjectCard.tsx` — project list with navigation
- [ ] Implement `IssueList.tsx` — issue display
- [ ] Implement `ScoreBadge.tsx` — color-coded score
- [ ] Implement keyboard navigation (↑↓ Enter r q)
- [ ] Connect dashboard to real data (parser + analyzer)
- [ ] Commit: `feat: interactive terminal dashboard`

**Day 8: Polish & Integration**
- [ ] CLI entry point (`src/cli/index.ts`) with commander
  - All commands registered with descriptions and help text
  - Global `--version` flag
  - `--help` shows all commands
- [ ] Error handling — graceful failures with helpful messages
- [ ] Integration tests — run all commands against test fixtures
- [ ] Final code review and cleanup
- [ ] Commit: `polish: CLI entry point and integration`

### Phase 4: Ship (Days 9-10)

**Day 9: Testing & Documentation**
- [ ] Test fixtures — create realistic test projects
  - `basic-project/` — normal setup, a few issues
  - `messy-project/` — many issues (the "stress test")
  - `clean-project/` — perfect setup (should score 100)
  - `no-env/` — project without .env file
- [ ] Write comprehensive README
  - Installation, usage, all commands documented
  - Screenshots of terminal output
  - Contributing guide
- [ ] Test on a real project (Recap itself)
- [ ] Fix any bugs found
- [ ] Commit: `test: fixtures and comprehensive testing`

**Day 10: Distribution**
- [ ] Final build (`npm run build`)
- [ ] Test the built binary: `./dist/cli.js scan`
- [ ] Prepare for npm publish
  - Update package.json description, keywords, repository
  - Add LICENSE file (MIT)
  - Ensure `files` array in package.json only includes `dist/`
- [ ] Create GitHub repository
  - Push code
  - Add README, LICENSE
  - Create initial release tag
- [ ] Build-in-public content
  - Screenshot of enve running on Recap
  - Write launch post for LinkedIn/Twitter
- [ ] Commit: `chore: distribution ready`

---

## 11. Testing Strategy

### Test Structure

```
tests/
├── fixtures/
│   ├── basic-project/
│   │   ├── .env
│   │   ├── .env.example
│   │   ├── .gitignore
│   │   ├── package.json
│   │   └── src/
│   │       ├── app.ts         (uses process.env.PORT, process.env.DATABASE_URL)
│   │       └── config.ts      (uses process.env.JWT_SECRET)
│   ├── messy-project/
│   │   ├── .env               (has secrets, unused vars, syntax errors)
│   │   ├── .env.local         (NOT in .gitignore — deliberate)
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts       (references process.env.NEW_API_KEY which doesn't exist)
│   ├── clean-project/
│   │   ├── .env               (clean, well-organized)
│   │   ├── .env.local
│   │   ├── .env.example       (matches .env perfectly)
│   │   ├── .gitignore         (has .env and .env.local)
│   │   └── package.json
│   └── no-env/
│       ├── package.json
│       └── src/
│           └── app.ts
├── parser.test.ts
├── scanner.test.ts
├── analyzer.test.ts
├── validators.test.ts
├── commands.test.ts
└── integration.test.ts
```

### Test Coverage Goals

| Module | Target Coverage | Key Test Cases |
|--------|----------------|----------------|
| parser.ts | 95%+ | Quoted values, comments, empty values, export keyword, multiline, syntax errors |
| scanner.ts | 90%+ | Direct access, bracket access, destructuring, import.meta.env, fallback detection |
| analyzer.ts | 90%+ | All 5 rules, scoring algorithm edge cases |
| validators.ts | 95%+ | URL, port, secret length, NODE_ENV, boolean validation |
| git.ts | 80%+ | Gitignore check, hook install/uninstall |
| commands | 80%+ | Each command produces expected output for test fixtures |

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode (re-runs on file change)
```

---

## 12. Distribution & Packaging

### npm Package

**Package name:** `enve-cli`
**Reason:** `enve` is likely taken. `-cli` suffix is standard for CLI tools.

**package.json:**
```json
{
  "name": "enve-cli",
  "version": "1.0.0",
  "description": "Environment Variable Doctor — scan, validate, and protect your env files",
  "main": "dist/cli.js",
  "bin": { "enve": "./dist/cli.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/cli/index.ts --format cjs --minify --clean",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["env", "environment-variables", "secrets", "security", "cli", "developer-tools"],
  "author": "Abdul-Qudus Rufai",
  "license": "MIT",
  "engines": { "node": ">=18.0.0" }
}
```

### Installation

```bash
# Install globally
npm install -g enve-cli

# Run
enve scan
enve doctor
enve dashboard
```

### Local Development

```bash
# Clone the repo
git clone https://github.com/yourusername/enve.git
cd enve

# Install dependencies
npm install

# Run in dev mode (uses tsx, no build needed)
npm run dev -- scan
npm run dev -- doctor

# Run tests
npm test

# Build for distribution
npm run build
```

### GitHub Repository Setup

1. Create repo `enve` on GitHub
2. Add topics: `cli`, `developer-tools`, `environment-variables`, `security`, `nodejs`
3. Add description: "Environment Variable Doctor — scan, validate, and protect your .env files"
4. Enable issues for bug reports and feature requests
5. Add MIT LICENSE file
6. Create `v1.0.0` tag for first release

---

## 13. Build in Public Content Plan

### Pre-Launch (Before v1.0.0)

**Post 1: "The Origin Story"**
> "I almost committed my Paystack secret key last week. I was setting up my Recap project, had 10+ env variables in my `.env` file, and nearly ran `git add .` out of habit. The only thing that stopped me was a last-second `git status` check.
>
> That got me thinking — why isn't there a tool that actively protects developers from this? Not a blog post saying 'add .env to .gitignore'. An actual tool that scans your project, finds issues, and prevents mistakes.
>
> So I'm building one. Meet Enve — the Environment Variable Doctor.
> Day 1 of building in public. 🧵"

**Post 2: "Day 3: The Parser"**
> "Day 3 of building Enve. Today I wrote the .env parser.
>
> Turns out `.env` files are more complex than they look:
> - Quoted values: `KEY="value with spaces"`
> - Comments: `KEY=value # this is a comment`
> - Export syntax: `export KEY=value`
> - Empty values: `KEY=`
>
> I wrote 200 lines of parsing logic and 300 lines of tests. Every edge case I could think of.
>
> Tomorrow: scanning source code for `process.env.*` references."

### Launch Day

**Post 3: "Enve is live"**
> "Enve is now on npm. `npm install -g enve-cli`
>
> It's a CLI tool that:
> • Scans your project for env variable issues
> • Detects secrets in .env (not .env.local)
> • Finds unused and missing variables
> • Auto-generates `.env.example`
> • Installs a pre-commit hook to block .env commits
> • Shows a beautiful terminal dashboard
>
> Built because I needed it. Maybe you do too."

### Post-Launch

**Post 4: "Enve found 7 issues in my own project"**
> "I ran Enve on Recap (my other project). Here's what it found:
> - 2 secrets in .env instead of .env.local
> - 3 unused variables
> - 1 missing variable (referenced in code, not in .env)
> - .env.example was missing 2 new variables
>
> Score: 58/100. I thought I was careful.
>
> Fixed everything. Score is now 91. Feels good."

**Post 5: Educational — "Why .env.example is always a lie"**
> "The dirty secret of .env.example files: they're almost always outdated.
>
> Here's why:
> 1. Dev adds a new feature → adds a new env var
> 2. Dev forgets to update .env.example
> 3. New team member clones the repo → copies .env.example → app crashes
> 4. New member asks in Slack → someone sends their .env (with secrets!)
>
> Enve fixes this with `enve generate-example` — auto-creates .env.example from your actual .env, with secrets redacted."

---

## 14. Future Features (Post-MVP)

These features are NOT part of the MVP but are documented for future development.

### 14.1 CI/CD Integration (`enve ci`)
A non-interactive mode designed for CI pipelines:
```bash
enve ci --fail-on error    # Exit with error code if any errors found
enve ci --fail-on warning  # Exit with error code if any warnings found
enve ci --format json      # Output as JSON for programmatic consumption
enve ci --format junit     # Output as JUnit XML for test result dashboards
```

### 14.2 Auto-Fix (`enve fix`)
One command to fix all auto-fixable issues:
```bash
enve fix    # Interactive prompt for each fix
enve fix --yes   # Auto-apply all fixes without prompting
```
Fixes:
- Moves secrets from `.env` to `.env.local`
- Removes unused variables
- Adds missing variables to `.env.example`
- Adds `.env` files to `.gitignore`

### 14.3 Variable Documentation (`enve docs`)
Generate documentation for environment variables:
```bash
enve docs --format markdown   # Creates ENV.md with all variables documented
```

### 14.4 Team Sync
Share environment variable templates across a team:
```bash
enve sync push   # Push .env.example to a shared repository
enve sync pull   # Pull latest .env.example from team
```

### 14.5 Language Support
Extend scanner to support:
- Python (`os.environ.get('VAR')`, `os.getenv('VAR')`)
- Go (`os.Getenv("VAR")`)
- Ruby (`ENV['VAR']`)
- Rust (`std::env::var("VAR")`)

### 14.6 History & Audit
Track changes over time:
```bash
enve history     # Show how the env setup has changed over time
enve history --graph   # ASCII graph of score over time
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-15 | Abdul-Qudus Rufai | Initial PRD — all features, architecture, and roadmap |

---

*End of PRD*
