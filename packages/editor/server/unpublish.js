import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { unpublish } from './changeReflector.js'
import { getPublicationStatus } from './publicationStatus.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

/**
 * @vocab: 非公開にする
 * @test tests/editor/sync-operations.test.js
 * 公開済み・更新ありの記事をリモートから取り除くエンドポイント。原稿には関与しない。
 * エディタ外で手元のファイルが消された記事（リモートに残っているもの）もここで取り除ける。
 */
export const path = '/unpublish'

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
    const { filePath } = body
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
    const means = await resolvePublicationMeans({ means: config.publish?.means, cwd: rootDir })
    const target = `${config.src_dir}/pages/${filePath}`
    const status = await getPublicationStatus(target, means.remoteState)
    if (status === 'unknown') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）' }))
      return true
    }
    if (status === 'new') {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'まだ公開されていない記事のため、非公開にはできません' }))
      return true
    }
    const result = await unpublish([target], means)
    console.log(styleText(result.success ? 'green' : 'red', `[unpublish] ${filePath} ${result.success ? 'ok' : result.error}`))
    res.writeHead(result.success ? 200 : 500, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    console.log(styleText('red', '[unpublish] エラー:'), error.message)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
  return true
}
