import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { createJsonPostHandler } from './handlerFoundation.js'
import { unpublish } from './changeReflector.js'
import { removeEntry } from './imageLedger.js'

export const path = '/remove_remote_image'

export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

/**
 * @vocab 画像除去エンドポイント
 * @test tests/editor/image-library.test.js
 * 指定した画像を #リモート から取り除く。ローカルの実体には関与しない
 * （#公開ステータス が「リモートのみ」の画像に対する #除去 の実行にあたる）。
 * 除去に成功したら、その画像についての台帳の記録も片付ける。
 * @param {{ imagePath: string }} params - imagePath は srcDir からの相対パス（例: `image/post/cat.jpg`）
 * @param {{ srcDir: string, ledgerPath: string }} deps
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function removeRemoteImage({ imagePath }, deps, means) {
  const resolvedSrcDir = nodePath.resolve(deps.srcDir)
  const imageDir = nodePath.join(resolvedSrcDir, 'image')
  const fullPath = nodePath.resolve(resolvedSrcDir, imagePath)
  if (!fullPath.startsWith(imageDir + nodePath.sep)) {
    return { success: false, error: '不正な画像パスです' }
  }
  const result = await unpublish([fullPath], means)
  if (!result.success) return result
  removeEntry(deps.ledgerPath, imagePath)
  return result
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const post = createJsonPostHandler('remove_remote_image', async ({ imagePath }) => {
  if (!imagePath) {
    return { status: 400, body: { success: false, error: 'imagePathがありません' } }
  }
  const means = await resolvePublicationMeans({ ...config.publish, cwd: rootDir })
  const result = await removeRemoteImage({ imagePath }, { srcDir, ledgerPath: imageLedgerPath }, means)
  console.log(styleText(result.success ? 'green' : 'red', `[remove_remote_image] ${imagePath} ${result.success ? 'ok' : result.error}`))
  return { status: result.success ? 200 : 400, body: result }
})
