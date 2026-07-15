import fs from 'node:fs'
import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, watch } from '@tenjuu99/blog/lib/dir.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'
import { collectArticleReferences } from './articleReferenceCollector.js'
import { updateReference } from './referenceUpdater.js'
import { removeEntry } from './imageLedger.js'

export const path = '/delete_image'

const srcDir = nodePath.join(rootDir, config.src_dir)
export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

/**
 * @vocab: 画像削除エンドポイント
 * @test tests/editor/image-library.test.js
 * 参照の扱いの指定に応じて画像を安全に削除する。
 * `referenceHandling` が `'update'` のときは、参照している記事から参照更新器で参照を除去してから画像を削除する。
 * 省略時・`'keep'` のときは参照している記事を変更せず画像だけを削除する。
 * @param {{ imagePath: string, referenceHandling?: 'keep'|'update' }} params
 * @param {{ srcDir: string, pagesDir: string, ledgerPath: string }} deps
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteImage({ imagePath, referenceHandling = 'keep' }, deps) {
  const fullPath = nodePath.resolve(deps.srcDir, imagePath)
  if (!fullPath.startsWith(nodePath.resolve(deps.srcDir) + nodePath.sep)) {
    return { success: false, error: '不正な画像パスです' }
  }
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: '画像が見つかりません' }
  }
  if (referenceHandling === 'update') {
    const articleReferences = collectArticleReferences(deps.pagesDir)
    for (const article of articleReferences) {
      if (!article.imagePaths.includes(imagePath)) continue
      const articleFullPath = nodePath.join(deps.pagesDir, article.path)
      const content = fs.readFileSync(articleFullPath, 'utf-8')
      fs.writeFileSync(articleFullPath, updateReference(content, imagePath, null))
    }
  }
  fs.rmSync(fullPath)
  removeEntry(deps.ledgerPath, imagePath)
  return { success: true }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const post = async (req, res) => {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: e.message }))
    return true
  }
  const { imagePath, referenceHandling } = body
  if (!imagePath) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'imagePathがありません' }))
    return true
  }
  const result = await deleteImage(
    { imagePath, referenceHandling },
    { srcDir, pagesDir: watch.pageDir, ledgerPath: imageLedgerPath }
  )
  res.writeHead(result.success ? 200 : 400, { 'content-type': 'application/json' })
  res.end(JSON.stringify(result))
  return true
}
