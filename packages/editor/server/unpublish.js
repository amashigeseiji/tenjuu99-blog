import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { unpublish } from './changeReflector.js'
import { getPublicationStatus } from './publicationStatus.js'
import { syncImagePublicationState } from './imagePublicationSyncer.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { createJsonPostHandler } from './handlerFoundation.js'

export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

const NOT_YET_PUBLISHED_ERROR = 'まだ公開されていない記事のため、非公開にはできません'

/**
 * @vocab: 非公開にする
 * @test tests/editor/sync-operations.test.js
 * 公開済み・更新ありの記事をリモートから取り除く。原稿には関与しない。除去に成功したときは
 * #画像公開同期器 を呼び出し、この記事の参照が失われたことを画像台帳の公開済み参照へ反映する
 * （最後の参照だった画像も道連れにリモートから取り除かれる）。同期器がリモートから取り除け
 * なかった画像があっても記事の非公開そのものは成立しているため、失敗にはせず warning として伝える。
 * ledgerPath の既定は srcDir から導く（srcDir を差し替えたなら台帳も同じ基準で決まる）。
 * @param {{ filePath: string, srcDir?: string, ledgerPath?: string }} options
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string, warning?: string }>}
 */
export async function handleUnpublish({
  filePath,
  srcDir: srcDirParam = config.src_dir,
  ledgerPath = nodePath.join(srcDirParam, 'image-library.json'),
}, means) {
  const target = `${srcDirParam}/pages/${filePath}`
  const status = await getPublicationStatus(target, means.remoteState)
  if (status === 'unknown') return { success: false, error: 'リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）' }
  if (status === 'new') return { success: false, error: NOT_YET_PUBLISHED_ERROR }
  const result = await unpublish([target], means)
  if (result.success) {
    const synced = await syncImagePublicationState(filePath, [], { srcDir: srcDirParam, ledgerPath }, means)
    if (synced.failed.length > 0) {
      return { ...result, warning: `リモートから取り除けなかった画像があります: ${synced.failed.join(', ')}` }
    }
  }
  return result
}

export const path = '/unpublish'

export const post = createJsonPostHandler('unpublish', async ({ filePath }) => {
  if (!filePath) {
    return { status: 400, body: { success: false, error: 'ファイル名がありません' } }
  }
  const pagesDir = nodePath.join(srcDir, 'pages')
  const resolvedFilePath = nodePath.resolve(pagesDir, filePath)
  if (!resolvedFilePath.startsWith(pagesDir + nodePath.sep)) {
    return { status: 400, body: { success: false, error: '不正なファイルパスです' } }
  }
  const means = await resolvePublicationMeans({ means: config.publish?.means, cwd: rootDir })
  const result = await handleUnpublish({ filePath, srcDir: config.src_dir, ledgerPath: imageLedgerPath }, means)
  console.log(styleText(result.success ? 'green' : 'red', `[unpublish] ${filePath} ${result.success ? 'ok' : result.error}`))
  const httpStatus = result.success ? 200 : result.error === NOT_YET_PUBLISHED_ERROR ? 400 : 500
  return { status: httpStatus, body: result }
})
