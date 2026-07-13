import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { deleteArticle } from './deleteArticle.js'
import { getPublicationStatus } from './publicationStatus.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

/**
 * @vocab: 削除する
 * @test tests/editor/sync-operations.test.js
 * 未公開の記事をローカルから取り除くエンドポイント。
 * 公開中の記事は先に非公開にする（除去は一操作一場所）。
 */
export const path = '/delete'

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
      res.end(JSON.stringify({ success: false, error: 'リモートの状態が確認できないため、削除できません' }))
      return true
    }
    if (status !== 'new') {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: '公開中の記事です。先に非公開にしてから削除してください' }))
      return true
    }
    try {
      await deleteArticle(resolvedFilePath)
    } catch (e) {
      if (e.code === 'ENOENT') {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: '削除しようとした記事が手元に見つかりませんでした' }))
        return true
      }
      throw e
    }
    console.log(styleText('green', `[delete] ${filePath} ok`))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  } catch (error) {
    console.log(styleText('red', '[delete] エラー:'), error.message)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
  return true
}
