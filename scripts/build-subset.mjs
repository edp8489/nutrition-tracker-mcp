#!/usr/bin/env bun
/**
 * build-subset.mjs
 *
 * Reads the OpenNutrition source TSV and emits:
 *   dist/data/subset.jsonl           — selected subset of foods (default: "everyday")
 *   dist/data/full-database.jsonl    — direct TSV→JSON conversion (ALL rows, ALL columns)
 *   dist/data/chunks/{prefix}.jsonl  — full dataset chunked by first letter
 *   dist/data/manifest.json          — chunk index
 *
 * Usage:
 *   node scripts/build-subset.mjs [path/to/opennutrition_foods.tsv]
 *        [--subset everyday|grocery|prepared|restaurant]
 *
 * Defaults to ./opennutrition_foods.tsv in CWD, and subset "everyday".
 *
 * Per ADR-0011, ADR-0012, ADR-0015.
 */

import { createReadStream } from 'node:fs'
import {
  createWriteStream,
  mkdirSync,
  existsSync,
  statSync,
  promises as fsPromises,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TSV_PATH = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, 'opennutrition_foods.tsv')

const OUT_DIR = resolve(ROOT, 'dist', 'data')
const CHUNK_DIR = resolve(OUT_DIR, 'chunks')

// Supported subset values for the --subset CLI flag.
const SUPPORTED_SUBSETS = ['none', 'everyday', 'grocery', 'prepared', 'restaurant']

/**
 * Parse --subset from argv. Supports both "--subset everyday" and
 * "--subset=everyday". Returns null when not provided.
 */
function parseSubset(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--subset') {
      const value = argv[i + 1]
      // Reject a missing value or a value that looks like another flag.
      if (value && !value.startsWith('-')) return value
      return null
    }
    if (arg.startsWith('--subset=')) {
      return arg.slice('--subset='.length)
    }
  }
  return null
}

let subsetFilter = 'none'
const subsetArg = parseSubset(process.argv)
if (subsetArg !== null) {
  if (!SUPPORTED_SUBSETS.includes(subsetArg)) {
    console.error(`Invalid --subset value: ${subsetArg}`)
    console.error(`Supported values: ${SUPPORTED_SUBSETS.join(', ')}`)
    process.exit(1)
  }
  subsetFilter = subsetArg
}

if (!existsSync(TSV_PATH)) {
  console.error(`Source TSV not found: ${TSV_PATH}`)
  console.error('Pass the path as argument: node scripts/build-subset.mjs <path>')
  process.exit(1)
}

mkdirSync(CHUNK_DIR, { recursive: true })

const CHUNK_MAX = 5000
const chunks = new Map() // prefix -> array of rows
const chunkFileNames = new Map() // prefix -> active filename
const chunkSizes = new Map() // prefix -> count

function bucketFor(name) {
  const first = name.charAt(0).toLowerCase()
  if (/[a-z]/.test(first)) return first
  if (/[0-9]/.test(first)) return '0-9'
  return '_'
}

function projectRow(cols) {
  // cols: id, name, alternate_names, description, type, source, serving,
  //       nutrition_100g, ean_13, labels, package_size, ingredients, ingredient_analysis
  const id = cols[0]
  const name = cols[1]
  let altNames = []
  try {
    altNames = JSON.parse(cols[2] || '[]')
  } catch {
    altNames = []
  }
  const type = cols[4] || 'everyday'
  let servingMetric = { unit: 'g', quantity: 100 }
  try {
    const serving = JSON.parse(cols[6] || '{}')
    if (serving?.metric) servingMetric = serving.metric
  } catch {
    // keep default
  }
  let nutrition100g = { calories: 0, protein: 0, total_fat: 0, carbohydrates: 0 }
  try {
    nutrition100g = JSON.parse(cols[7] || '{}')
  } catch {
    // keep default
  }
  const ean13 = cols[8] || undefined
  let labels = []
  try {
    labels = JSON.parse(cols[9] || '[]')
  } catch {
    labels = []
  }

  return {
    id,
    name,
    altNames,
    type,
    servingMetric,
    nutrition100g,
    ...(ean13 ? { ean13 } : {}),
    ...(labels.length ? { labels } : {}),
  }
}

/**
 * Direct TSV → JSON conversion: each source row becomes one JSON object whose
 * keys are the TSV header names and whose values are the raw (unparsed) cell
 * strings. This is a faithful 1:1 mapping with no projection/transformation.
 */
function rowToObject(header, cols) {
  const obj = {}
  header.forEach((key, i) => {
    obj[key] = cols[i] !== undefined ? cols[i] : null
  })
  return obj
}

async function writeChunk(prefix) {
  const rows = chunks.get(prefix)
  if (!rows || rows.length === 0) return
  const fileName = `${prefix}.jsonl`
  const filePath = join(CHUNK_DIR, fileName)
  const lines = rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
  await fsPromises.writeFile(filePath, lines, 'utf8')
  const stat = statSync(filePath)
  chunkFileNames.set(prefix, fileName)
  chunkSizes.set(prefix, { count: rows.length, sizeBytes: stat.size })
}

async function main() {
  console.log(`Reading: ${TSV_PATH}`)
  const stream = createReadStream(TSV_PATH, { encoding: 'utf8' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  let header = null
  let total = 0
  let subsetCount = 0
  const subsetLines = []
  const fullDatabaseRows = []

  for await (const line of rl) {
    if (!line) continue
    if (!header) {
      header = line.split('\t')
      continue
    }
    const cols = line.split('\t')
    if (cols.length < 13) continue

    const row = projectRow(cols)

    // Faithful raw conversion of this source row (collected regardless of subset).
    fullDatabaseRows.push(rowToObject(header, cols))

    total++

    if (row.type === subsetFilter) {
      subsetLines.push(JSON.stringify(row))
      subsetCount++
    }

    const bucket = bucketFor(row.name)
    if (!chunks.has(bucket)) chunks.set(bucket, [])
    chunks.get(bucket).push(row)
  }

  // Selected subset (filtered by type) — skipped entirely when --subset none.
  if (subsetFilter !== 'none') {
    await fsPromises.writeFile(
      join(OUT_DIR, `subset_${subsetFilter}.jsonl`),
      subsetLines.join('\n') + '\n',
      'utf8',
    )
  }

  // Direct full-database conversion (every row, every column).
  await fsPromises.writeFile(
    join(OUT_DIR, 'full-database.jsonl'),
    fullDatabaseRows.map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  )

  for (const prefix of chunks.keys()) await writeChunk(prefix)

  const manifest = {
    version: '2025.1',
    generatedAt: new Date().toISOString(),
    subset: subsetFilter,
    fullDatabaseRows: fullDatabaseRows.length,
    chunks: Array.from(chunkFileNames.entries()).map(([prefix, fileName]) => ({
      chunkFile: fileName,
      firstChars:
        prefix === '0-9'
          ? '0,1,2,3,4,5,6,7,8,9'
          : prefix === '_'
            ? '_'
            : prefix,
      foodCount: chunkSizes.get(prefix).count,
      sizeBytes: chunkSizes.get(prefix).sizeBytes,
    })),
  }

  await fsPromises.writeFile(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )

  console.log(`Total rows: ${total}`)
  if (subsetFilter === 'none') {
    console.log('Subset filtering disabled (none)')
  } else {
    console.log(`Subset ("${subsetFilter}") rows: ${subsetCount}`)
  }
  console.log(`Full-database rows: ${fullDatabaseRows.length}`)
  console.log(`Chunks written: ${manifest.chunks.length}`)
  console.log(`Output dir: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})