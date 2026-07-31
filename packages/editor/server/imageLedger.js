import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * @param {string} ledgerPath
 * @returns {Object.<string, { addedAt: string, publishedReferredBy?: string[], protected?: boolean }>}
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

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 画像パスの #公開済み参照 （記事パスの配列）を記録する。呼び出しごとに丸ごと置き換える。
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @param {string[]} articlePaths
 * @returns {void}
 */
export function setPublishedReferredBy(ledgerPath, imagePath, articlePaths) {
  const ledger = readLedger(ledgerPath)
  ledger[imagePath] = { ...(ledger[imagePath] ?? {}), publishedReferredBy: articlePaths }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2))
}

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 記録がない画像パスに対しては空配列を返す。
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @returns {string[]}
 */
export function getPublishedReferredBy(ledgerPath, imagePath) {
  return readLedger(ledgerPath)[imagePath]?.publishedReferredBy ?? []
}

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 画像パスへ #検出外参照宣言 を付与・解除する。
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @param {boolean} declared
 * @returns {void}
 */
export function setDeclaration(ledgerPath, imagePath, declared) {
  const ledger = readLedger(ledgerPath)
  ledger[imagePath] = { ...(ledger[imagePath] ?? {}), protected: declared }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2))
}

/**
 * @vocab: 画像台帳
 * @test tests/editor/image-library.test.js
 * 記録がない画像パスに対しては false を返す。
 * @param {string} ledgerPath
 * @param {string} imagePath
 * @returns {boolean}
 */
export function isDeclared(ledgerPath, imagePath) {
  return readLedger(ledgerPath)[imagePath]?.protected ?? false
}
