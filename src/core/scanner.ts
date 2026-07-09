import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Parser } from 'acorn';
import { fullAncestor } from 'acorn-walk';
import type { EnvReference, ScannerOptions } from '../types/index.js';

const DEFAULT_INCLUDE = [
  '**/*.{js,ts,jsx,tsx,mjs,cjs,py,go,rb,rs}',
];

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/target/**',
  '**/__pycache__/**',
  '**/vendor/**',
];

export async function scanProject(
  projectPath: string,
  options: ScannerOptions = {}
): Promise<EnvReference[]> {
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;

  const files = await fg(include, {
    cwd: projectPath,
    ignore: exclude,
    absolute: true,
  });

  const references: EnvReference[] = [];
  for (const file of files) {
    const fileRefs = await scanFile(file);
    references.push(...fileRefs);
  }

  return references;
}

export async function scanFile(filePath: string): Promise<EnvReference[]> {
  const references: EnvReference[] = [];
  const content = await readFile(filePath, 'utf-8');

  let ast: unknown;
  try {
    ast = Parser.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      locations: true,
    });
  } catch {
    // If acorn can't parse the file (e.g. TSX/JSX or TypeScript-specific syntax),
    // fall back to a regex-based scan so we don't miss obvious process.env uses.
    return extractReferencesWithRegex(content, filePath);
  }

  fullAncestor(ast as any, (node: any, _state: any, ancestors: any[]) => {
    if (node.type === 'MemberExpression') {
      const ref = extractEnvReference(node, ancestors, filePath, content);
      if (ref) references.push(ref);
    }

    if (node.type === 'ObjectPattern') {
      const refs = extractDestructuredEnvReferences(node, ancestors, filePath, content);
      references.push(...refs);
    }
  });

  return references;
}

function extractEnvReference(
  node: any,
  ancestors: any[],
  filePath: string,
  content: string
): EnvReference | undefined {
  const key = getMemberExpressionKey(node);
  if (!key) return undefined;

  // fullAncestor includes the current node as the last ancestor
  const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : undefined;
  const fallback = detectFallback(node, parent);

  return createReference(key, filePath, node, content, fallback);
}

function getMemberExpressionKey(node: any): string | undefined {
  // process.env.X or process.env['X'] (object is process.env)
  if (
    node.object?.type === 'MemberExpression' &&
    node.object.object?.name === 'process' &&
    node.object.property?.name === 'env'
  ) {
    if (node.property?.type === 'Identifier' && !node.computed) return node.property.name;
    if (node.property?.type === 'Literal' && typeof node.property.value === 'string') {
      return node.property.value;
    }
    if (node.property?.type === 'TemplateLiteral' && node.property.quasis?.length === 1) {
      return node.property.quasis[0].value.cooked ?? node.property.quasis[0].value.raw;
    }
  }

  // import.meta.env.X (static property access, not computed)
  if (
    node.object?.type === 'MemberExpression' &&
    node.object.object?.type === 'MetaProperty' &&
    node.object.object.meta?.name === 'import' &&
    node.object.object.property?.name === 'meta' &&
    node.object.property?.name === 'env' &&
    !node.computed
  ) {
    if (node.property?.type === 'Identifier') return node.property.name;
    if (node.property?.type === 'Literal' && typeof node.property.value === 'string') {
      return node.property.value;
    }
  }

  return undefined;
}

function extractDestructuredEnvReferences(
  node: any,
  ancestors: any[],
  filePath: string,
  content: string
): EnvReference[] {
  if (!isEnvDestructuringPattern(node, ancestors)) return [];

  const references: EnvReference[] = [];
  for (const prop of node.properties) {
    if (prop.type === 'RestElement' && prop.argument?.type === 'Identifier') {
      references.push(
        createReference(prop.argument.name, filePath, node, content, { hasFallback: false })
      );
      continue;
    }

    if (prop.type !== 'Property') continue;

    if (prop.value?.type === 'Identifier' && prop.key?.type === 'Identifier') {
      // Shorthand: const { MY_VAR } = process.env
      // Renamed:   const { MY_VAR: myVar } = process.env
      references.push(
        createReference(prop.key.name, filePath, prop.value, content, { hasFallback: false })
      );
    }

    if (prop.value?.type === 'AssignmentPattern' && prop.value.left?.type === 'Identifier' && prop.key?.type === 'Identifier') {
      // Shorthand with default: const { MY_VAR = 'x' } = process.env
      // Renamed with default:   const { MY_VAR: myVar = 'x' } = process.env
      const key = prop.key.name;
      const fallbackValue = expressionToString(prop.value.right);
      references.push(
        createReference(key, filePath, prop.value.left, content, {
          hasFallback: true,
          fallbackValue,
          fallbackType: 'literal',
        })
      );
    }

    // Nested destructuring: const { env: { X } } = process
    if (prop.value?.type === 'ObjectPattern' && prop.key?.name === 'env') {
      const nested = extractDestructuredEnvReferences(
        prop.value,
        [...ancestors, prop, prop.value],
        filePath,
        content
      );
      references.push(...nested);
    }
  }

  return references;
}

function extractReferencesWithRegex(content: string, filePath: string): EnvReference[] {
  const references: EnvReference[] = [];
  const seen = new Set<string>();

  const addRef = (key: string, index: number) => {
    if (seen.has(key)) return;
    seen.add(key);

    const line = content.slice(0, index).split('\n').length;
    const dummyNode = { loc: { start: { line, column: 0 } } };
    references.push(
      createReference(key, filePath, dummyNode as any, content, { hasFallback: false })
    );
  };

  const ext = extname(filePath);

  // JavaScript / TypeScript
  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    // process.env.X or import.meta.env.X
    const memberRe = /(?:process|import\.meta)\.env\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let match: RegExpExecArray | null;
    while ((match = memberRe.exec(content)) !== null) {
      addRef(match[1], match.index);
    }

    // process.env['X'] / process.env["X"] / process.env[`X`]
    const bracketRe = /(?:process|import\.meta)\.env\[(?:'([^']+)'|"([^"]+)"|`([^`]+)`)\]/g;
    while ((match = bracketRe.exec(content)) !== null) {
      const key = match[1] ?? match[2] ?? match[3];
      if (key) addRef(key, match.index);
    }

    // const { X, Y: y, Z = 'd' } = process.env[ || {}]
    const destructRe =
      /(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*(?:process\.env|import\.meta\.env)(?:\s*(?:\|\||\?\?)\s*\{[^}]*\})?/g;
    while ((match = destructRe.exec(content)) !== null) {
      const props = match[1].split(',');
      for (const prop of props) {
        const trimmed = prop.trim();
        if (!trimmed) continue;
        const keyMatch = trimmed.match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
        if (keyMatch) {
          addRef(keyMatch[1], match.index);
        }
      }
    }
  }

  // Python
  if (ext === '.py') {
    const pythonRe =
      /(?:os\.environ\.get|os\.environ\[|os\.getenv)\s*\(\s*['"]([^'"]+)['"]\s*\)|os\.environ\[\s*['"]([^'"]+)['"]\s*\]/g;
    let match: RegExpExecArray | null;
    while ((match = pythonRe.exec(content)) !== null) {
      const key = match[1] ?? match[2];
      if (key) addRef(key, match.index);
    }
  }

  // Go
  if (ext === '.go') {
    const goRe = /os\.Getenv\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = goRe.exec(content)) !== null) {
      addRef(match[1], match.index);
    }
  }

  // Ruby
  if (ext === '.rb') {
    const rubyRe = /ENV\s*\[\s*["']([^"']+)["']\s*\]/g;
    let match: RegExpExecArray | null;
    while ((match = rubyRe.exec(content)) !== null) {
      addRef(match[1], match.index);
    }
  }

  // Rust
  if (ext === '.rs') {
    const rustRe = /(?:std::)?env::var(?:_os)?\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = rustRe.exec(content)) !== null) {
      addRef(match[1], match.index);
    }
  }

  return references;
}

function isEnvDestructuringPattern(node: any, ancestors: any[]): boolean {
  // fullAncestor includes the current node as the last ancestor
  const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : undefined;
  if (!parent) return false;

  // const { X } = process.env
  if (parent.type === 'VariableDeclarator' && parent.id === node) {
    return isEnvSource(parent.init);
  }

  // const { X = 'd' } = process.env (AssignmentPattern wrapping ObjectPattern)
  if (parent.type === 'AssignmentPattern' && parent.left === node) {
    return isEnvSource(parent.right);
  }

  // const { env: { X } } = process
  if (parent.type === 'Property' && parent.value === node && parent.key?.name === 'env') {
    const grandParent = ancestors.length > 2 ? ancestors[ancestors.length - 3] : undefined;
    if (grandParent?.type === 'ObjectPattern') {
      return isEnvDestructuringPattern(grandParent, ancestors.slice(0, -2));
    }
  }

  return false;
}

function isProcessNode(node: any): boolean {
  return node?.type === 'Identifier' && node.name === 'process';
}

function isProcessEnvNode(node: any): boolean {
  if (!node) return false;

  // process.env
  if (
    node.type === 'MemberExpression' &&
    node.object?.type === 'Identifier' &&
    node.object.name === 'process' &&
    node.property?.name === 'env'
  ) {
    return true;
  }

  return false;
}

function isEnvSource(node: any): boolean {
  if (isProcessEnvNode(node) || isProcessNode(node)) return true;

  // const { X } = process.env || {}
  // const { X } = process.env ?? {}
  if (
    node?.type === 'LogicalExpression' &&
    (node.operator === '||' || node.operator === '??')
  ) {
    return isEnvSource(node.left) || isEnvSource(node.right);
  }

  // const { X } = condition ? process.env : {}
  if (node?.type === 'ConditionalExpression') {
    return isEnvSource(node.consequent) || isEnvSource(node.alternate);
  }

  return false;
}

function detectFallback(node: any, parent: any): FallbackInfo {
  if (!parent) return { hasFallback: false };

  if (parent.type === 'LogicalExpression') {
    const isLeft = parent.left === node;
    const isRight = parent.right === node;

    if (parent.operator === '||' || parent.operator === '??') {
      const fallbackNode = isLeft ? parent.right : isRight ? parent.left : undefined;
      if (fallbackNode) {
        return {
          hasFallback: true,
          fallbackValue: expressionToString(fallbackNode),
          fallbackType: getFallbackType(fallbackNode),
        };
      }
    }

    if (parent.operator === '&&' && isLeft) {
      return { hasFallback: true, fallbackValue: 'guarded', fallbackType: 'expression' };
    }
  }

  if (parent.type === 'ConditionalExpression' && parent.test === node) {
    return {
      hasFallback: true,
      fallbackValue: expressionToString(parent.alternate),
      fallbackType: 'ternary',
    };
  }

  return { hasFallback: false };
}

function getFallbackType(node: any): 'literal' | 'function' | 'expression' {
  if (node.type === 'Literal' || node.type === 'TemplateLiteral') return 'literal';
  if (node.type === 'CallExpression' || node.type === 'NewExpression') return 'function';
  return 'expression';
}

function expressionToString(node: any): string {
  if (!node) return 'unknown';

  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? `'${node.value}'` : String(node.value);
  }

  if (node.type === 'Identifier') return node.name;

  if (node.type === 'TemplateLiteral') {
    if (node.quasis.length === 1) return `'${node.quasis[0].value.cooked ?? node.quasis[0].value.raw}'`;
    return '`template`';
  }

  if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    const callee = node.callee?.name ?? node.callee?.property?.name ?? 'function';
    return `<${callee}()>`;
  }

  if (node.type === 'UnaryExpression') {
    return `${node.operator}${expressionToString(node.argument)}`;
  }

  if (node.type === 'BinaryExpression') {
    return `${expressionToString(node.left)} ${node.operator} ${expressionToString(node.right)}`;
  }

  if (node.type === 'MemberExpression') {
    return node.property?.name ?? 'member';
  }

  return '<expression>';
}

interface FallbackInfo {
  hasFallback: boolean;
  fallbackValue?: string;
  fallbackType?: 'literal' | 'function' | 'expression' | 'ternary';
}

function createReference(
  key: string,
  filePath: string,
  node: any,
  content: string,
  fallback: FallbackInfo
): EnvReference {
  const line = node.loc?.start?.line ?? 0;
  const column = node.loc?.start?.column ?? 0;
  const context = extractContext(content, line);

  return {
    key,
    file: filePath,
    line,
    column,
    context,
    hasFallback: fallback.hasFallback,
    fallbackValue: fallback.fallbackValue,
    fallbackType: fallback.fallbackType,
  };
}

function extractContext(content: string, line: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);
  return lines.slice(start, end).join('\n');
}
