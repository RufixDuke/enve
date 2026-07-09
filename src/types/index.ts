/** Severity levels for issues */
export type Severity = 'error' | 'warning' | 'info';

/** Types of issues enve can detect */
export type IssueType =
  | 'missing' // Referenced in code but not in .env
  | 'unused' // Defined in .env but not referenced in code
  | 'invalid' // Value doesn't match expected format
  | 'suspicious' // Potentially problematic value or setup
  | 'secret-risk' // Secret key in non-.local file
  | 'syntax-error' // Malformed .env file
  | 'gitignore'; // .env file not in .gitignore

/** A single environment variable found in a .env file */
export interface EnvVariable {
  key: string;
  value: string;
  line: number;
  source: string; // e.g., ".env", ".env.local"
  isSecret: boolean; // Heuristically detected
  comment?: string; // Trailing inline comment
}

/** A reference to process.env.X found in source code */
export interface EnvReference {
  key: string;
  file: string;
  line: number;
  column: number;
  context: string; // Surrounding code snippet
  hasFallback: boolean; // Has a default/fallback value in code
  fallbackValue?: string; // The default value (e.g., "3000", "'https://default.com'")
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
  hasFallback?: boolean; // Only for 'missing' type — true if code has a default value
  fallbackValue?: string; // The default value from code (e.g., "3000", "'https://default.com'")
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
  addedAt: string; // ISO date string
}

/** History snapshot for audit tracking */
export interface HistoryEntry {
  projectPath: string;
  name: string;
  score: number;
  grade: Grade;
  timestamp: string; // ISO date string
}

/** Enve global configuration */
export interface EnveConfig {
  version: number;
  projects: TrackedProject[];
  sync?: {
    path?: string;
  };
  history?: HistoryEntry[];
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
  include?: string[]; // Additional glob patterns to include
  exclude?: string[]; // Glob patterns to exclude
  checkTests?: boolean; // Whether to scan test files (default: false)
}

/** Options for parser */
export interface ParserOptions {
  files?: string[]; // Specific .env files to parse
  path?: string; // Project root path
}

/** Health check sections for doctor command */
export interface HealthCheckSections {
  fileStructure: Issue[];
  variables: Issue[];
  security: Issue[];
  validation: Issue[];
  recommendations: string[];
}
