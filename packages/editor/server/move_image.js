import fs from 'node:fs'
import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, watch } from '@tenjuu99/blog/lib/dir.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'
import { collectArticleReferences } from './articleReferenceCollector.js'
import { updateReference } from './referenceUpdater.js'
import { renameEntry } from './imageLedger.js'
import { validateDestination } from './moveDestinationValidator.js'

export const path = '/move_image'

const srcDir = nodePath.join(rootDir, config.src_dir)
export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

/**
 * @vocab: 画像移動エンドポイント
 * @test tests/editor/image-library.test.js
 * 参照の扱いの指定にもとづいて画像を新しいパス（置き場所とファイル名）へ移動する。
 * 改名（ファイル名だけの変更）は同じ置き場所への移動として包含する。
 * `destPath` は image/ 相対の配置パス（階層可）。移動先検証器が管理下にとどまると
 * 判定しないパス、および既存の画像と重複するパスへは実行しない。
 * `referenceHandling` が `'update'` のときは、参照している記事から参照更新器で新しいパスに書き換える。
 * 省略時・`'keep'` のときは参照している記事を変更しない。
 * @param {{ imagePath: string, destPath: string, referenceHandling?: 'keep'|'update' }} params
 * @param {{ srcDir: string, pagesDir: string, ledgerPath: string }} deps
 * @returns {Promise<{ success: boolean, error?: string, newPath?: string }>}
 */
export async function moveImage({ imagePath, destPath, referenceHandling = 'keep' }, deps) {
  const resolvedSrcDir = nodePath.resolve(deps.srcDir)
  const fullPath = nodePath.resolve(deps.srcDir, imagePath)
  if (!fullPath.startsWith(resolvedSrcDir + nodePath.sep)) {
    return { success: false, error: '不正な画像パスです' }
  }
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: '画像が見つかりません' }
  }
  const validation = validateDestination(destPath)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }
  const newImagePath = `image/${destPath}`
  const newFullPath = nodePath.resolve(deps.srcDir, newImagePath)
  if (fs.existsSync(newFullPath)) {
    return { success: false, error: '移動先に同じパスのファイルが既に存在します' }
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
  fs.mkdirSync(nodePath.dirname(newFullPath), { recursive: true })
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
  const { imagePath, destPath, referenceHandling } = body
  if (!imagePath || !destPath) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'imagePath・destPathがありません' }))
    return true
  }
  const result = await moveImage(
    { imagePath, destPath, referenceHandling },
    { srcDir, pagesDir: watch.pageDir, ledgerPath: imageLedgerPath }
  )
  res.writeHead(result.success ? 200 : 400, { 'content-type': 'application/json' })
  res.end(JSON.stringify(result))
  return true
}
