import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { unpublish } from './changeReflector.js'
import { getPublicationStatus } from './publicationStatus.js'
import { syncImagePublicationState } from './imagePublicationSyncer.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { parseJsonBody } from '@tenjuu99/blog/lib/server/helper/parseRequestBody.js'

export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

const NOT_YET_PUBLISHED_ERROR = 'まだ公開されていない記事のため、非公開にはできません'

/**
 * @vocab: 非公開にする
 * @test tests/editor/sync-operations.test.js
 * 公開済み・更新ありの記事をリモートから取り除く。原稿には関与しない。除去に成功したときは
 * #画像公開同期器 を呼び出し、この記事の参照が失われたことを画像台帳の公開済み参照へ反映する
 * （最後の参照だった画像も道連れにリモートから取り除かれる）。
 * @param {{ filePath: string, srcDir?: string, ledgerPath?: string }} options
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function handleUnpublish({ filePath, srcDir: srcDirParam = config.src_dir, ledgerPath = imageLedgerPath }, means) {
  const target = `${srcDirParam}/pages/${filePath}`
  const status = await getPublicationStatus(target, means.remoteState)
  if (status === 'unknown') return { success: false, error: 'リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）' }
  if (status === 'new') return { success: false, error: NOT_YET_PUBLISHED_ERROR }
  const result = await unpublish([target], means)
  if (result.success) {
    await syncImagePublicationState(filePath, [], { srcDir: srcDirParam, ledgerPath }, means)
  }
  return result
}

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
    const result = await handleUnpublish({ filePath }, means)
    console.log(styleText(result.success ? 'green' : 'red', `[unpublish] ${filePath} ${result.success ? 'ok' : result.error}`))
    const httpStatus = result.success ? 200 : result.error === NOT_YET_PUBLISHED_ERROR ? 400 : 500
    res.writeHead(httpStatus, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    console.log(styleText('red', '[unpublish] エラー:'), error.message)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
  return true
}
