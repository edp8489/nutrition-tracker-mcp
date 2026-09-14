#!/usr/bin/env bun
/**
 * build-sqlite.mjs
 *
 * Reads the OpenNutrition source TSV and emits a full-dataset SQLite database
 * for the MCP server (ADR-0020):
 *   opennutrition.sqlite  — foods table (all columns, ADR-0023) +
 *                           foods_fts contentless FTS5 index over weighted
 *                           columns: name, altNames, labels, description,
 *                           ingredients (ADR-0025) +
 *                           meta table (version, generatedAt, rowCount)
 *
 * Query-time BM25 column weights (highest → lowest): name, altNames, labels,
 * description, ingredients.
 *
 * Usage:
 *   bun scripts/build-sqlite.mjs [path/to/opennutrition_foods.tsv]
 *        [--out path/to/opennutrition.sqlite]
 *        [--out-dir /path/to/dir]
 *
 * Defaults to ./opennutrition_foods.tsv in CWD; output goes to --out-dir
 * (default: next to the TSV).
 *
 * Per ADR-0020, ADR-0023, ADR-0025.
 */

import { createReadStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { Database } from 'bun:sqlite'
import { projectRow, TSV_COLUMN_COUNT } from './project-food.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const argv = process.argv.slice(2)
const tsvArg = argv.find((a) => !a.startsWith('--'))
const TSV_PATH = tsvArg ? resolve(tsvArg) : resolve(ROOT, 'opennutrition_foods.tsv')

function parseOut(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {
      const value = args[i + 1]
      if (value && !value.startsWith('-')) return resolve(value)
    }
    if (args[i].startsWith('--out=')) {
      return resolve(args[i].slice('--out='.length))
    }
  }
  return null
}

function parseOutDir(args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out-dir') {
      const value = args[i + 1]
      if (value && !value.startsWith('-')) return resolve(value)
    }
    if (args[i].startsWith('--out-dir=')) {
      return resolve(args[i].slice('--out-dir='.length))
    }
  }
  return null
}

const OUT_DIR = parseOutDir(argv) || dirname(TSV_PATH)
const OUT_PATH = parseOut(argv) || resolve(OUT_DIR, 'opennutrition.sqlite')

if (!existsSync(TSV_PATH)) {
  console.error(`Source TSV not found: ${TSV_PATH}`)
  console.error('Pass the path as argument: bun scripts/build-sqlite.mjs <path>')
  process.exit(1)
}

const BATCH_SIZE = 5000

function jsonOrNull(value) {
  return value === null || value === undefined ? null : JSON.stringify(value)
}

function ftsText(value) {
  if (value === null || value === undefined) return ''
  return Array.isArray(value) ? value.join(' ') : value
}

async function main() {
  console.log(`Reading: ${TSV_PATH}`)
  console.log(`Output:  ${OUT_PATH}`)

  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(OUT_PATH + suffix)) rmSync(OUT_PATH + suffix)
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })

  const db = new Database(OUT_PATH)

  db.run('PRAGMA journal_mode = OFF')
  db.run('PRAGMA synchronous = OFF')

  db.run(`
    CREATE TABLE foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      altNames TEXT,
      description TEXT,
      type TEXT,
      source TEXT,
      servingMetric TEXT,
      servingCommon TEXT,
      nutrition100g TEXT,
      ean13 TEXT,
      labels TEXT,
      packageSize TEXT,
      ingredients TEXT,
      ingredientAnalysis TEXT
    )
  `)
  db.run('CREATE INDEX idx_foods_type ON foods(type)')
  db.run(`
    CREATE VIRTUAL TABLE foods_fts USING fts5(
      name, altNames, labels, description, ingredients,
      content=''
    )
  `)
  db.run('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)')

  const stmtFoods = db.prepare(`
    INSERT OR IGNORE INTO foods (
      id, name, altNames, description, type, source, servingMetric,
      servingCommon, nutrition100g, ean13, labels, packageSize,
      ingredients, ingredientAnalysis
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const stmtFts = db.prepare(`
    INSERT INTO foods_fts (rowid, name, altNames, labels, description, ingredients)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const stream = createReadStream(TSV_PATH, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const startedAt = Date.now()
  let header = null
  let total = 0
  let inserted = 0
  let skippedDuplicates = 0

  db.run('BEGIN')

  for await (const line of rl) {
    if (!line) continue
    if (!header) {
      header = line.split('\t')
      continue
    }
    const cols = line.split('\t')
    if (cols.length < TSV_COLUMN_COUNT) continue

    const row = projectRow(cols)
    total++

    const { changes } = stmtFoods.run(
      row.id,
      row.name,
      jsonOrNull(row.altNames),
      row.description,
      row.type,
      jsonOrNull(row.source),
      jsonOrNull(row.servingMetric),
      jsonOrNull(row.servingCommon),
      jsonOrNull(row.nutrition100g),
      row.ean13,
      jsonOrNull(row.labels),
      jsonOrNull(row.packageSize),
      row.ingredients,
      jsonOrNull(row.ingredientAnalysis),
    )
    if (changes !== 1) {
      skippedDuplicates++
      continue
    }
    stmtFts.run(
      db.lastInsertRowid,
      row.name,
      ftsText(row.altNames),
      ftsText(row.labels),
      ftsText(row.description),
      ftsText(row.ingredients),
    )
    inserted++

    if (inserted % BATCH_SIZE === 0) {
      db.run('COMMIT')
      db.run('BEGIN')
    }
  }

  db.run('COMMIT')

  stmtFoods.finalize()
  stmtFts.finalize()

  const meta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
  meta.run('version', '2025.1')
  meta.run('generatedAt', new Date().toISOString())
  meta.run('rowCount', String(inserted))
  meta.finalize()

  const count = db.prepare('SELECT COUNT(*) AS c FROM foods').get().c
  const ftsSmoke = db
    .prepare(
      `SELECT f.rowid, foods.name
       FROM foods_fts f JOIN foods ON foods.rowid = f.rowid
       WHERE foods_fts MATCH ?
       ORDER BY bm25(foods_fts, 10.0, 5.0, 3.0, 1.0, 0.5)
       LIMIT 3`,
    )
    .all('chicken breast')

  db.close()

  console.log(`Total rows: ${total}`)
  console.log(`Inserted:   ${inserted}`)
  console.log(`Skipped duplicate ids: ${skippedDuplicates}`)
  console.log(`foods count: ${count}`)
  console.log(`FTS smoke ('chicken breast'): ${ftsSmoke.map((r) => r.name).join(' | ')}`)
  console.log(`Elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
