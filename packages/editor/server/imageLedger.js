import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * @param {string} ledgerPath
 * @returns {Object.<string, { addedAt: string }>}
 */
export function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return {}
  try {
    return JSON.parse(readFileSync(ledgerPath, 'utf-8'))
  } catch (e) {
    return {}
  }
}

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 画像パスの追加日時を記録する。既存のエントリは保持したまま追記・上書きする。
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @param {string} [addedAt]
 * @returns {void}
 */
export function recordAddition(ledgerPath, imagePath, addedAt = new Date().toISOString()) {
  const ledger = readLedger(ledgerPath)
  ledger[imagePath] = { addedAt }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2))
}

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @returns {string|null}
 */
export function getAddedAt(ledgerPath, imagePath) {
  return readLedger(ledgerPath)[imagePath]?.addedAt ?? null
}
