import fs from 'node:fs'
import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { collectTarget } from './publishTargetCollector.js'
import { publish, update } from './changeReflector.js'
import { getPublicationStatus } from './publicationStatus.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

/**
 * @vocab: 公開ハンドラー
 * @test tests/editor/publish.test.js
 * @param {{ filePath: string, fileContent: string, srcDir?: string }} options
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function handlePublish({ filePath, fileContent, srcDir: srcDirParam = 'src' }, means) {
  const target = collectTarget(filePath, fileContent, srcDirParam)
  const files = [target.markdownFile, ...target.imageFiles]
  const state = await getPublicationStatus(target.markdownFile, means.publishedState)
  if (state === 'new') return await publish(files, means)
  if (state === 'modified') return await update(files, means)
  if (state === 'unknown') return { success: false, error: 'リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）' }
  // published 状態はローカルとリモートが一致しているため操作不要
  return { success: true }
}

export const path = '/publish'

export const post = async (req, res) => {
  let body
  try {
    body = await parseJsonBody(req)
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: e.message }))
    return true
  }
  try {
    const { filePath, fileContent } = body
    if (!filePath) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'ファイル名がありません' }))
      return true
    }
    const pagesDir = nodePath.join(srcDir, 'pages')
    const resolvedFilePath = nodePath.resolve(pagesDir, filePath)
    if (!resolvedFilePath.startsWith(pagesDir + nodePath.sep)) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: '不正なファイルパスです' }))
      return true
    }
    const content = fileContent != null ? fileContent : fs.readFileSync(`${srcDir}/pages/${filePath}`, 'utf-8')
    if (fileContent != null) {
      const dir = `${srcDir}/pages/${filePath}`.split('/').slice(0, -1).join('/')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(`${srcDir}/pages/${filePath}`, fileContent)
    }
    const means = await resolvePublicationMeans({ means: config.publish?.means, cwd: rootDir })
    const result = await handlePublish(
      { filePath, fileContent: content, srcDir: config.src_dir },
      means
    )
    console.log(styleText(result.success ? 'green' : 'red', `[publish] ${filePath} ${result.success ? 'ok' : result.error}`))
    res.writeHead(result.success ? 200 : 500, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
  return true
}
