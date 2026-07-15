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

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 画像パスのエントリを取り除く。記録がない画像パスに対しては何もしない。
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @returns {void}
 */
export function removeEntry(ledgerPath, imagePath) {
  const ledger = readLedger(ledgerPath)
  if (!(imagePath in ledger)) return
  delete ledger[imagePath]
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2))
}

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 画像パスのエントリを新しいパスへ付け替える。追加日時は引き継がれる。
 * 記録がない画像パスに対しては何もしない（新しいパスにもエントリは作られない）。
 * @param {string} ledgerPath
 * @param {string} oldImagePath
 * @param {string} newImagePath
 * @returns {void}
 */
export function renameEntry(ledgerPath, oldImagePath, newImagePath) {
  const ledger = readLedger(ledgerPath)
  if (!(oldImagePath in ledger)) return
  ledger[newImagePath] = ledger[oldImagePath]
  delete ledger[oldImagePath]
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2))
}
