#!/usr/bin/env node
/**
 * build-subset.mjs
 *
 * Reads the OpenNutrition source TSV and emits:
 *   dist/data/subset.jsonl         — all "everyday" type foods (projected)
 *   dist/data/chunks/{prefix}.jsonl — full dataset chunked by first letter
 *   dist/data/manifest.json        — chunk index
 *
 * Usage:
 *   node scripts/build-subset.mjs [path/to/opennutrition_foods.tsv]
 *
 * Defaults to ./opennutrition_foods.tsv in CWD.
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
  for await (const line of rl) {
    if (!line) continue
    if (!header) {
      header = line.split('\t')
      continue
    }
    const cols = line.split('\t')
    if (cols.length < 13) continue

    const row = projectRow(cols)
    total++

    if (row.type === 'everyday') {
      subsetLines.push(JSON.stringify(row))
      subsetCount++
    }

    const bucket = bucketFor(row.name)
    if (!chunks.has(bucket)) chunks.set(bucket, [])
    chunks.get(bucket).push(row)
  }

  await fsPromises.writeFile(
    join(OUT_DIR, 'subset.jsonl'),
    subsetLines.join('\n') + '\n',
    'utf8',
  )
  for (const prefix of chunks.keys()) await writeChunk(prefix)

  const manifest = {
    version: '2025.1',
    generatedAt: new Date().toISOString(),
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
  console.log(`Subset (everyday) rows: ${subsetCount}`)
  console.log(`Chunks written: ${manifest.chunks.length}`)
  console.log(`Output dir: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
