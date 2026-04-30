// ============================================================================
// TYPES GENERATOR SCRIPT
// ============================================================================
// Reads database/schema.sql and generates TypeScript interface declarations.
//
// Parsing strategy:
//   1. Strip SQL comments (-- and /* */)
//   2. Extract CREATE TABLE blocks via balanced-parenthesis walking
//      (skips CREATE VIEW, FUNCTION, TRIGGER automatically)
//   3. Split each table body into entries on depth-0 commas;
//      a second pass handles the rare missing-comma authoring bug where a
//      CONSTRAINT keyword appears at the start of a new line without a
//      preceding comma.
//   4. Classify each entry as a column definition or a table constraint
//   5. Parse ALTER TABLE … ADD CONSTRAINT statements for PKs and FKs that
//      are declared outside the CREATE TABLE body (pg_dump style)
//   6. Apply CHECK-derived enum union types and FK references to columns
//   7. Emit TypeScript interfaces, writing to src/types/database.d.ts
//
// Usage: pnpm run generate:types
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCHEMA_PATH  = 'database/schema.sql';
const OUTPUT_PATH  = 'src/types/database.d.ts';

/**
 * Explicit interface name overrides.
 * Tables not listed here receive auto-generated PascalCase names.
 * These names must stay in sync with the imports in src/lib/supabase.ts.
 */
const INTERFACE_NAME_MAP: Record<string, string> = {
  serie_posts:                'SeriePost',
  serie_data:                 'SerieDataPoint',
  serie_validations:          'SerieValidation',
  user_roles:                 'UserRole',
  analysis:                   'Analysis',
  analysis_indicators:        'AnalysisIndicator',
  analysis_periods:           'AnalysisPeriod',
  analysis_source_selections: 'AnalysisSourceSelection',
  analysis_macro_events:      'AnalysisMacroEvent',
};

// ============================================================================
// SQL → TYPESCRIPT TYPE MAPPING
// ============================================================================

/**
 * Convert a raw SQL type string (e.g. "character varying(10)", "numeric(20,6)")
 * to the corresponding TypeScript primitive type.
 */
function sqlTypeToTs(sqlType: string): string {
  // Normalise: collapse whitespace, uppercase
  const t = sqlType.trim().replace(/\s+/g, ' ').toUpperCase();

  // UUID
  if (t === 'UUID') return 'string';

  // Text / string types  (CHARACTER VARYING must come before CHARACTER)
  if (
    t.startsWith('TEXT') ||
    t.startsWith('VARCHAR') ||
    t.startsWith('CHARACTER VARYING') ||
    t.startsWith('CHARACTER(') ||
    t.startsWith('NVARCHAR') ||
    t === 'CHARACTER' ||
    t === 'CHAR'
  ) return 'string';

  // Boolean
  if (t === 'BOOLEAN' || t === 'BOOL') return 'boolean';

  // Integer types
  if (
    t === 'SMALLINT'  || t.startsWith('SMALLINT') ||
    t === 'INTEGER'   || t.startsWith('INTEGER') ||
    t === 'INT'       || t.startsWith('INT') ||
    t === 'BIGINT'    || t.startsWith('BIGINT') ||
    t.startsWith('SERIAL') || t.startsWith('BIGSERIAL') || t.startsWith('SMALLSERIAL')
  ) return 'number';

  // Numeric / floating-point
  if (
    t.startsWith('NUMERIC') || t.startsWith('DECIMAL') ||
    t.startsWith('FLOAT')   || t.startsWith('DOUBLE')  || t === 'REAL'
  ) return 'number';

  // Date / time  (multi-word variants are normalised before this point)
  if (
    t === 'DATE'                         ||
    t.startsWith('TIMESTAMP')            ||
    t === 'TIMESTAMPTZ'                  ||
    t === 'TIME'   || t.startsWith('TIME') ||
    t === 'TIMETZ'
  ) return 'string';

  // JSON
  if (t.startsWith('JSONB') || t.startsWith('JSON')) return 'Record<string, unknown>';

  // Binary
  if (t === 'BYTEA') return 'string';

  // Fallback — treat unknown SQL types as string
  return 'string';
}

// ============================================================================
// INTERNAL DATA STRUCTURES
// ============================================================================

interface ColumnDef {
  name:         string;
  sqlType:      string;
  tsType:       string;
  nullable:     boolean;   // true → emits `?` in the interface
  isPrimary:    boolean;   // inline PRIMARY KEY
  isForeignKey: boolean;
  fkRef?:       string;    // e.g. "public.serie_posts(id)"
  enumValues?:  string[];  // from a matching CHECK constraint
}

interface TableDef {
  name:          string;   // snake_case table name
  interfaceName: string;   // PascalCase TypeScript name
  columns:       ColumnDef[];
  primaryKeys:   string[]; // column names that form the PK (may be composite)
}

interface ConstraintInfo {
  type:         'pk' | 'fk' | 'check' | 'unique' | 'other';
  columns?:     string[];
  refTable?:    string;
  refColumns?:  string[];
  checkColumn?: string;    // inferred from constraint name pattern
  enumValues?:  string[];
}

// ============================================================================
// STEP 1 — STRIP SQL COMMENTS
// ============================================================================

function stripComments(sql: string): string {
  // Block comments  /* … */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Line comments   -- … \n
  sql = sql.replace(/--[^\n]*/g, '');
  return sql;
}

// ============================================================================
// STEP 2 — EXTRACT CREATE TABLE BLOCKS
// ============================================================================

/**
 * Walk the cleaned SQL and return the inner body of every CREATE TABLE (…)
 * block.  Uses balanced-parenthesis counting so nested parens inside CHECK
 * expressions, DEFAULT calls, etc. are handled correctly.
 *
 * CREATE VIEW / FUNCTION / TRIGGER / INDEX are not matched because the regex
 * anchors on the keyword TABLE only.
 */
function extractCreateTableBlocks(sql: string): { name: string; body: string }[] {
  const results: { name: string; body: string }[] = [];

  // Match: CREATE TABLE [IF NOT EXISTS] [schema.]tableName (
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\w+\.)?(\w+)\s*\(/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(sql)) !== null) {
    const tableName = m[1];
    // Index of the opening '(' (last char of the full match)
    const openIdx = m.index + m[0].length - 1;

    // Find the matching closing ')'
    let depth = 0;
    let closeIdx = openIdx;
    for (let i = openIdx; i < sql.length; i++) {
      if      (sql[i] === '(') depth++;
      else if (sql[i] === ')') { depth--; if (depth === 0) { closeIdx = i; break; } }
    }

    const body = sql.substring(openIdx + 1, closeIdx);
    results.push({ name: tableName, body });

    // Advance past the closing ')' so the next exec() starts outside this block
    regex.lastIndex = closeIdx + 1;
  }

  return results;
}

// ============================================================================
// STEP 3 — SPLIT TABLE BODY INTO ENTRIES
// ============================================================================

/**
 * Split a CREATE TABLE body into individual entries (column definitions and
 * table-level constraint declarations) by commas at paren depth 0.
 *
 * A second pass further splits entries that contain a constraint keyword
 * at the start of a new line without a preceding comma — this handles the
 * authoring bug in the `analysis` table definition.
 */
function splitTableEntries(body: string): string[] {
  // ── Phase 1: comma-split at depth 0 ──────────────────────────────────────
  const raw: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if      (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      const entry = body.substring(start, i).trim();
      if (entry) raw.push(entry);
      start = i + 1;
    }
  }
  const last = body.substring(start).trim();
  if (last) raw.push(last);

  // ── Phase 2: split entries that embed a constraint keyword on a new line ──
  // Handles the authoring bug where a column def is directly followed by a
  // CONSTRAINT on the next line without a separating comma, e.g.:
  //   status text NOT NULL DEFAULT 'draft'
  //   CONSTRAINT analysis_pkey PRIMARY KEY (id),   ← missing comma!
  //
  // IMPORTANT: entries that already BEGIN with a constraint keyword must be
  // kept intact even if their body spans multiple lines, e.g.:
  //   CONSTRAINT foo_check
  //       CHECK (col IN ('a', 'b'))    ← must NOT be split here
  // Splitting would strip the constraint name, breaking checkColumn inference.
  const CONSTRAINT_START  = /\n[ \t]*(?=(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b)/i;
  const CONSTRAINT_OPENER = /^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE)\b/i;

  const entries: string[] = [];
  for (const entry of raw) {
    if (CONSTRAINT_OPENER.test(entry.trimStart())) {
      // Already a constraint entry — preserve it as-is
      const trimmed = entry.trim();
      if (trimmed) entries.push(trimmed);
    } else {
      // Column definition (possibly followed by a constraint without a comma)
      const parts = entry.split(CONSTRAINT_START);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) entries.push(trimmed);
      }
    }
  }

  return entries;
}

// ============================================================================
// STEP 4a — EXTRACT SQL TYPE FROM COLUMN DEFINITION REMAINDER
// ============================================================================

/**
 * Multi-word PostgreSQL types that must be matched before falling back to a
 * single-token match.  Order matters: longest/most-specific first.
 */
const MULTI_WORD_TYPES = [
  'TIMESTAMP WITH TIME ZONE',
  'TIMESTAMP WITHOUT TIME ZONE',
  'TIME WITH TIME ZONE',
  'TIME WITHOUT TIME ZONE',
  'CHARACTER VARYING',
  'DOUBLE PRECISION',
  'BIT VARYING',
] as const;

/**
 * Given the portion of a column definition that comes *after* the column name,
 * extract the SQL type string and the remaining text.
 *
 * Returns [sqlTypeString, remainder].
 */
function extractSqlType(after: string): [string, string] {
  const upper = after.trimStart().replace(/\s+/g, ' ').toUpperCase();

  for (const mwt of MULTI_WORD_TYPES) {
    if (upper.startsWith(mwt)) {
      const afterMwt  = after.trimStart().substring(mwt.length);
      // Optional (N) or (M,N) suffix
      const parenM    = afterMwt.match(/^\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\)/);
      const typePart  = mwt + (parenM ? parenM[0] : '');
      const rest      = afterMwt.substring(parenM ? parenM[0].length : 0);
      return [typePart, rest];
    }
  }

  // Single-word type with optional (N) or (M,N)
  const single = after.trimStart().match(/^(\w+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/);
  if (single) return [single[1], after.trimStart().substring(single[0].length)];

  return ['unknown', after];
}

// ============================================================================
// STEP 4b — PARSE A SINGLE COLUMN ENTRY
// ============================================================================

/**
 * Parse a column definition entry.
 * Returns null for table-level constraint entries (CONSTRAINT, PRIMARY KEY, …).
 */
function parseColumnEntry(entry: string): ColumnDef | null {
  const trimmed = entry.trim();
  const upperStart = trimmed.replace(/\s+/g, ' ').toUpperCase();

  // Reject constraint entries
  if (
    upperStart.startsWith('CONSTRAINT ')    ||
    upperStart.startsWith('PRIMARY KEY')    ||
    upperStart.startsWith('FOREIGN KEY')    ||
    upperStart.startsWith('UNIQUE')         ||
    upperStart.startsWith('CHECK')          ||
    upperStart.startsWith('EXCLUDE')
  ) return null;

  // First token = column name
  const nameM = trimmed.match(/^(\w+)\s*/);
  if (!nameM) return null;
  const colName = nameM[1];

  const after = trimmed.substring(nameM[0].length);
  const [sqlType, rest] = extractSqlType(after);

  const restUpper  = rest.toUpperCase();
  const entryUpper = trimmed.toUpperCase();

  return {
    name:         colName,
    sqlType,
    tsType:       sqlTypeToTs(sqlType),
    nullable:     !entryUpper.includes('NOT NULL'),
    isPrimary:    restUpper.includes('PRIMARY KEY'),
    isForeignKey: false,
  };
}

// ============================================================================
// STEP 4c — PARSE A CONSTRAINT ENTRY
// ============================================================================

/**
 * Parse a table-level constraint entry.
 * Extracts PK columns, FK references, and CHECK-derived enum values.
 */
function parseConstraintEntry(entry: string, tableName: string): ConstraintInfo | null {
  // Constraint name (used to infer checked column for CHECK constraints)
  const nameM          = entry.match(/CONSTRAINT\s+(\w+)\s+/i);
  const constraintName = nameM ? nameM[1].toLowerCase() : '';

  // ── PRIMARY KEY ──────────────────────────────────────────────────────────
  const pkM = entry.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
  if (pkM) {
    const cols = pkM[1].split(',').map(c => c.trim());
    return { type: 'pk', columns: cols };
  }

  // ── FOREIGN KEY ──────────────────────────────────────────────────────────
  const fkM = entry.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([\w.]+)\s*\(([^)]+)\)/i);
  if (fkM) {
    return {
      type:       'fk',
      columns:    fkM[1].split(',').map(c => c.trim()),
      refTable:   fkM[2],
      refColumns: fkM[3].split(',').map(c => c.trim()),
    };
  }

  // ── CHECK ────────────────────────────────────────────────────────────────
  const checkM = entry.match(/CHECK\s*\(([\s\S]+)\)\s*$/i);
  if (checkM) {
    const expr = checkM[1];

    // Skip regex / pattern validations (hex colours, email formats, etc.)
    if (/~\s*'/.test(expr) || /LIKE\s+'/i.test(expr)) {
      return { type: 'check' };
    }

    // Infer the affected column from the constraint name:
    //   tableName_columnName_check  →  columnName
    let checkColumn: string | undefined;
    if (constraintName.startsWith(tableName + '_') && constraintName.endsWith('_check')) {
      checkColumn = constraintName.slice(tableName.length + 1, -6);
    }

    // Extract enum literals ────────────────────────────────────────────────

    const enumValues: string[] = [];

    // Pattern: ARRAY['val1'::type, 'val2'::type, …]
    const arrayM = expr.match(/ARRAY\s*\[([^\]]+)\]/i);
    if (arrayM) {
      const items = arrayM[1].match(/'([^']*)'/g);
      if (items) enumValues.push(...items.map(i => i.replace(/'/g, '')));
    }

    // Pattern: IN ('val1', 'val2', …)   — only when ARRAY pattern didn't fire
    if (enumValues.length === 0) {
      const inM = expr.match(/\bIN\s*\(\s*((?:'[^']*'\s*,\s*)*'[^']*')\s*\)/i);
      if (inM) {
        const items = inM[1].match(/'([^']*)'/g);
        if (items) enumValues.push(...items.map(i => i.replace(/'/g, '')));
      }
    }

    return {
      type:        'check',
      checkColumn,
      enumValues:  enumValues.length > 0 ? enumValues : undefined,
    };
  }

  // ── UNIQUE ───────────────────────────────────────────────────────────────
  if (/UNIQUE/i.test(entry)) {
    const uniqueM = entry.match(/UNIQUE\s*\(([^)]+)\)/i);
    return {
      type:    'unique',
      columns: uniqueM ? uniqueM[1].split(',').map(c => c.trim()) : [],
    };
  }

  return { type: 'other' };
}

// ============================================================================
// STEP 5 — PARSE ALTER TABLE … ADD CONSTRAINT STATEMENTS
// ============================================================================

interface AlterConstraint {
  tableName: string;
  info:      ConstraintInfo;
}

/**
 * Extract PK and FK constraints declared via ALTER TABLE … ADD CONSTRAINT …
 * (the style emitted by pg_dump for older table definitions).
 */
function extractAlterConstraints(sql: string): AlterConstraint[] {
  const results: AlterConstraint[] = [];

  const regex =
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:\w+\.)?(\w+)\s+ADD\s+CONSTRAINT\s+(\w+)\s+([\s\S]+?);/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(sql)) !== null) {
    const tableName  = m[1].toLowerCase();
    const body       = `CONSTRAINT ${m[2]} ${m[3]}`;
    const info       = parseConstraintEntry(body, tableName);
    if (info) results.push({ tableName, info });
  }

  return results;
}

// ============================================================================
// STEP 6 — BUILD TABLE DEFINITIONS
// ============================================================================

function toInterfaceName(tableName: string): string {
  if (INTERFACE_NAME_MAP[tableName]) return INTERFACE_NAME_MAP[tableName];
  // Fallback: snake_case → PascalCase
  return tableName
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function parseSchema(sql: string): TableDef[] {
  const cleaned         = stripComments(sql);
  const tableBlocks     = extractCreateTableBlocks(cleaned);
  const alterConstraints = extractAlterConstraints(cleaned);

  return tableBlocks.map(({ name: rawName, body }) => {
    const tableName = rawName.toLowerCase();
    const entries   = splitTableEntries(body);

    const columns:          ColumnDef[]      = [];
    const tableConstraints: ConstraintInfo[] = [];

    // Classify and parse every entry
    for (const entry of entries) {
      const upperStart = entry.trimStart().replace(/\s+/g, ' ').toUpperCase();

      if (
        upperStart.startsWith('CONSTRAINT ')  ||
        upperStart.startsWith('PRIMARY KEY')  ||
        upperStart.startsWith('FOREIGN KEY')  ||
        upperStart.startsWith('UNIQUE')       ||
        upperStart.startsWith('CHECK')
      ) {
        const info = parseConstraintEntry(entry, tableName);
        if (info) tableConstraints.push(info);
      } else {
        const col = parseColumnEntry(entry);
        if (col) columns.push(col);
      }
    }

    // Merge ALTER TABLE constraints for this table
    for (const { tableName: tn, info } of alterConstraints) {
      if (tn === tableName) tableConstraints.push(info);
    }

    // ── Collect primary key columns ──────────────────────────────────────
    const primaryKeys: string[] = [];
    for (const col of columns)           if (col.isPrimary)                  primaryKeys.push(col.name);
    for (const tc  of tableConstraints)  if (tc.type === 'pk' && tc.columns) {
      for (const c of tc.columns) if (!primaryKeys.includes(c)) primaryKeys.push(c);
    }

    // ── Apply FK references ──────────────────────────────────────────────
    for (const tc of tableConstraints) {
      if (tc.type !== 'fk' || !tc.columns || !tc.refTable) continue;
      for (const colName of tc.columns) {
        const col = columns.find(c => c.name === colName);
        if (col) {
          col.isForeignKey = true;
          col.fkRef = `${tc.refTable}(${tc.refColumns?.join(', ') ?? 'id'})`;
        }
      }
    }

    // ── Apply CHECK enum values ──────────────────────────────────────────
    for (const tc of tableConstraints) {
      if (tc.type !== 'check' || !tc.checkColumn || !tc.enumValues?.length) continue;
      const col = columns.find(c => c.name === tc.checkColumn);
      if (col) {
        col.enumValues = tc.enumValues;
        col.tsType     = tc.enumValues.map(v => `'${v}'`).join(' | ');
      }
    }

    return {
      name:          tableName,
      interfaceName: toInterfaceName(tableName),
      columns,
      primaryKeys,
    };
  });
}

// ============================================================================
// STEP 7 — TYPESCRIPT CODE GENERATION
// ============================================================================

const DIVIDER = '='.repeat(76);

function generateInterface(table: TableDef): string {
  const lines: string[] = [];

  lines.push(`// ${DIVIDER}`);
  lines.push(`// ${table.name.toUpperCase()}`);
  lines.push(`// ${DIVIDER}`);
  lines.push('/**');
  lines.push(` * Maps database table: \`public.${table.name}\``);
  if (table.primaryKeys.length > 0) {
    lines.push(` * @pk ${table.primaryKeys.join(', ')}`);
  }
  lines.push(' */');
  lines.push(`export interface ${table.interfaceName} {`);

  for (const col of table.columns) {
    const isOpt = col.nullable && !col.isPrimary && !table.primaryKeys.includes(col.name);
    if (col.isForeignKey && col.fkRef) {
      lines.push(`  /** FK → ${col.fkRef} */`);
    }
    lines.push(`  ${col.name}${isOpt ? '?' : ''}: ${col.tsType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function generateOutput(tables: TableDef[]): string {
  const header = `// ${DIVIDER}
// AUTOMATICALLY GENERATED — DO NOT EDIT MANUALLY
// ${DIVIDER}
// Source:  database/schema.sql
// Script:  scripts/generate-types.ts
// Command: pnpm run generate:types
// Generated: ${new Date().toISOString()}
// ${DIVIDER}

/**
 * TypeScript interface declarations for all \`public\` schema tables.
 *
 * @example
 * \`\`\`typescript
 * import type { SeriePost, SerieDataPoint } from '@/types/database';
 * \`\`\`
 */
`;

  return header + tables.map(generateInterface).join('\n\n') + '\n';
}

// ============================================================================
// ENTRY POINT
// ============================================================================

function main(): void {
  console.log(`Reading ${SCHEMA_PATH}…`);

  let sql: string;
  try {
    sql = readFileSync(SCHEMA_PATH, 'utf-8');
  } catch {
    console.error(`ERROR: cannot read ${SCHEMA_PATH}`);
    process.exit(1);
  }

  console.log('Parsing SQL schema…');
  const tables = parseSchema(sql);

  if (tables.length === 0) {
    console.error('ERROR: no CREATE TABLE statements found.');
    process.exit(1);
  }

  console.log(`\nFound ${tables.length} table(s):`);
  for (const t of tables) {
    const pkLabel = t.primaryKeys.length ? ` [pk: ${t.primaryKeys.join(', ')}]` : '';
    console.log(`  ${t.interfaceName.padEnd(30)} ← ${t.name}${pkLabel}`);
    for (const c of t.columns) {
      const flags = [
        c.enumValues ? 'enum'    : '',
        c.isForeignKey           ? `fk→${c.fkRef}` : '',
        c.nullable               ? 'nullable' : '',
      ].filter(Boolean).join(', ');
      console.log(`      ${c.name.padEnd(28)} ${c.tsType}${flags ? `  (${flags})` : ''}`);
    }
  }

  const output = generateOutput(tables);

  try {
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, output, 'utf-8');
  } catch (e) {
    console.error(`ERROR: cannot write ${OUTPUT_PATH}`, e);
    process.exit(1);
  }

  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main();
