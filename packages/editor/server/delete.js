import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { deleteArticle } from './deleteArticle.js'
import { getPublicationStatus } from './publicationStatus.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { createJsonPostHandler } from './handlerFoundation.js'

/**
 * @vocab: 削除する
 * @test tests/editor/sync-operations.test.js
 * 未公開の記事をローカルから取り除くエンドポイント。
 * 公開中の記事は先に非公開にする（除去は一操作一場所）。
 */
export const path = '/delete'

export const post = createJsonPostHandler('delete', async ({ filePath }) => {
  if (!filePath) {
    return { status: 400, body: { success: false, error: 'ファイル名がありません' } }
  }
  const pagesDir = nodePath.join(srcDir, 'pages')
  const resolvedFilePath = nodePath.resolve(pagesDir, filePath)
  if (!resolvedFilePath.startsWith(pagesDir + nodePath.sep)) {
    return { status: 400, body: { success: false, error: '不正なファイルパスです' } }
  }
  const means = await resolvePublicationMeans({ means: config.publish?.means, cwd: rootDir })
  const target = `${config.src_dir}/pages/${filePath}`
  const status = await getPublicationStatus(target, means.remoteState)
  if (status === 'unknown') {
    return { status: 500, body: { success: false, error: 'リモートの状態が確認できないため、削除できません' } }
  }
  if (status !== 'new') {
    return { status: 400, body: { success: false, error: '公開中の記事です。先に非公開にしてから削除してください' } }
  }
  try {
    await deleteArticle(resolvedFilePath)
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { status: 404, body: { success: false, error: '削除しようとした記事が手元に見つかりませんでした' } }
    }
    throw e
  }
  console.log(styleText('green', `[delete] ${filePath} ok`))
  return { body: { success: true } }
})
