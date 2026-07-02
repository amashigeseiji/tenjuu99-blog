#!/usr/bin/env node
// Usage: depgraph-regen.js
//
// このプロジェクトは純粋な ESM・相対パスの import のみ（パスエイリアスなし、
// TypeScript なし）なので、依存グラフ生成に外部ツール（dependency-cruiser 等）を
// 導入せず、正規表現ベースの自前スクリプトで静的解析する。
//
// 対象: lib/, bin/, packages/, src-sample/, index.js
// 除外: node_modules, dist, .cache, tests, test-results, playwright-report

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const OUT_PATH = path.join(import.meta.dirname, 'dependency-graph.json')

const TARGET_ENTRIES = ['lib', 'bin', 'packages', 'src-sample', 'index.js']
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules', 'dist', '.cache', 'tests', 'test', '__tests__',
  'test-results', 'playwright-report', '.git',
])

function collectFiles(entryPath, out) {
  const stat = fs.statSync(entryPath)
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entryPath)) {
      if (EXCLUDE_DIR_NAMES.has(name)) continue
      collectFiles(path.join(entryPath, name), out)
    }
  } else if (stat.isFile()) {
    out.push(entryPath)
  }
}

function isJsCandidate(file) {
  if (file.endsWith('.js')) return true
  if (path.extname(file) !== '') return false
  // 拡張子なしファイル（bin/generate 等）は shebang で node スクリプトか判定する
  const firstLine = fs.readFileSync(file, 'utf8').split('\n', 1)[0]
  return /^#!.*\bnode\b/.test(firstLine)
}

// JSDoc の `{import('./foo.js').Type}` のような型参照や、テンプレートリテラルの
// 動的 import（`import(\`${x}\`)`）は依存として解決できないため、コメントを
// 取り除いてから import 文だけを拾う。
function stripComments(content) {
  const noBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlockComments
    .split('\n')
    .map(line => (line.trim().startsWith('//') ? '' : line))
    .join('\n')
}

const IMPORT_PATTERNS = [
  /\bimport\s+[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\bexport\s+[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function extractSpecifiers(content) {
  const specifiers = new Set()
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      specifiers.add(match[1])
    }
  }
  return specifiers
}

function resolveImport(fromFile, specifier) {
  const fromDir = path.dirname(fromFile)
  const resolved = path.resolve(fromDir, specifier)
  const candidates = [resolved, `${resolved}.js`, path.join(resolved, 'index.js')]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

function toRootRelative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

const allFiles = []
for (const entry of TARGET_ENTRIES) {
  const entryPath = path.join(ROOT, entry)
  if (fs.existsSync(entryPath)) collectFiles(entryPath, allFiles)
}

const jsFiles = allFiles.filter(isJsCandidate)

const modules = []
for (const file of jsFiles) {
  const content = stripComments(fs.readFileSync(file, 'utf8'))
  const specifiers = extractSpecifiers(content)
  const dependencies = new Set()
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue
    const resolved = resolveImport(file, specifier)
    if (resolved) dependencies.add(toRootRelative(resolved))
  }
  modules.push({
    source: toRootRelative(file),
    dependencies: [...dependencies].sort(),
  })
}

modules.sort((a, b) => a.source.localeCompare(b.source))

fs.writeFileSync(OUT_PATH, JSON.stringify({ modules }, null, 2))
console.log(`Wrote ${modules.length} modules to ${toRootRelative(OUT_PATH)}`)
