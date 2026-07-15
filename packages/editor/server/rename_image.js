import fs from 'node:fs'
import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, watch } from '@tenjuu99/blog/lib/dir.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'
import { collectArticleReferences } from './articleReferenceCollector.js'
import { updateReference } from './referenceUpdater.js'
import { renameEntry } from './imageLedger.js'

export const path = '/rename_image'

const srcDir = nodePath.join(rootDir, config.src_dir)
export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

/**
 * @vocab: 画像改名エンドポイント
 * @test tests/editor/image-library.test.js
 * 重複を避けつつ、参照の扱いの指定に応じて画像を安全に改名する。
 * `newFileName` はファイル名のみを受け付ける（ディレクトリの変更は対象外）。
 * `referenceHandling` が `'update'` のときは、参照している記事から参照更新器で新しいパスに書き換える。
 * 省略時・`'keep'` のときは参照している記事を変更しない。
 * @param {{ imagePath: string, newFileName: string, referenceHandling?: 'keep'|'update' }} params
 * @param {{ srcDir: string, pagesDir: string, ledgerPath: string }} deps
 * @returns {Promise<{ success: boolean, error?: string, newPath?: string }>}
 */
export async function renameImage({ imagePath, newFileName, referenceHandling = 'keep' }, deps) {
  const resolvedSrcDir = nodePath.resolve(deps.srcDir)
  const fullPath = nodePath.resolve(deps.srcDir, imagePath)
  if (!fullPath.startsWith(resolvedSrcDir + nodePath.sep)) {
    return { success: false, error: '不正な画像パスです' }
  }
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: '画像が見つかりません' }
  }
  const safeFileName = nodePath.basename(newFileName)
  if (!safeFileName || safeFileName !== newFileName) {
    return { success: false, error: '不正なファイル名です' }
  }
  const newImagePath = `${nodePath.dirname(imagePath)}/${safeFileName}`.replace(/^\.\//, '')
  const newFullPath = nodePath.resolve(deps.srcDir, newImagePath)
  if (fs.existsSync(newFullPath)) {
    return { success: false, error: '同名のファイルが既に存在します' }
  }
  if (referenceHandling === 'update') {
    const articleReferences = collectArticleReferences(deps.pagesDir)
    for (const article of articleReferences) {
      if (!article.imagePaths.includes(imagePath)) continue
      const articleFullPath = nodePath.join(deps.pagesDir, article.path)
      const content = fs.readFileSync(articleFullPath, 'utf-8')
      fs.writeFileSync(articleFullPath, updateReference(content, imagePath, newImagePath))
    }
  }
  fs.renameSync(fullPath, newFullPath)
  renameEntry(deps.ledgerPath, imagePath, newImagePath)
  return { success: true, newPath: newImagePath }
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
  const { imagePath, newFileName, referenceHandling } = body
  if (!imagePath || !newFileName) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'imagePath・newFileNameがありません' }))
    return true
  }
  const result = await renameImage(
    { imagePath, newFileName, referenceHandling },
    { srcDir, pagesDir: watch.pageDir, ledgerPath: imageLedgerPath }
  )
  res.writeHead(result.success ? 200 : 400, { 'content-type': 'application/json' })
  res.end(JSON.stringify(result))
  return true
}
