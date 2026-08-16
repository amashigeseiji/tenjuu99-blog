import fs from 'node:fs'
import nodePath from 'node:path'
import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir, srcDir } from '@tenjuu99/blog/lib/dir.js'
import { collectTarget } from './publishTargetCollector.js'
import { publish, update } from './changeReflector.js'
import { getPublicationStatus } from './publicationStatus.js'
import { syncImagePublicationState } from './imagePublicationSyncer.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'
import { createJsonPostHandler } from './handlerFoundation.js'

export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

/**
 * @vocab: 公開ハンドラー
 * @test tests/editor/publish.test.js
 * 公開・更新に成功したときは #画像公開同期器 を呼び出し、この記事が今参照している画像集合を
 * 画像台帳の公開済み参照へ反映する。同期器がリモートから取り除けなかった画像があっても記事の
 * 公開そのものは成立しているため、失敗にはせず warning として伝える。
 * ledgerPath の既定は srcDir から導く（srcDir を差し替えたなら台帳も同じ基準で決まる）。
 * @param {{ filePath: string, fileContent: string, srcDir?: string, ledgerPath?: string }} options
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').PublicationMeans} means
 * @returns {Promise<{ success: boolean, error?: string, warning?: string }>}
 */
export async function handlePublish({
  filePath,
  fileContent,
  srcDir: srcDirParam = config.src_dir,
  ledgerPath = nodePath.join(srcDirParam, 'image-library.json'),
}, means) {
  const target = collectTarget(filePath, fileContent, srcDirParam)
  const files = [target.markdownFile, ...target.imageFiles]
  const state = await getPublicationStatus(target.markdownFile, means.remoteState)
  let result
  if (state === 'new') result = await publish(files, means)
  else if (state === 'modified') result = await update(files, means)
  else if (state === 'unknown') return { success: false, error: 'リモートへの接続に失敗しました（公開手段の設定・認証情報・接続を確認してください）' }
  else result = { success: true } // published 状態はローカルとリモートが一致しているため操作不要

  if (result.success && (state === 'new' || state === 'modified')) {
    const synced = await syncImagePublicationState(filePath, target.imageFiles, { srcDir: srcDirParam, ledgerPath }, means)
    if (synced.failed.length > 0) {
      return { ...result, warning: `リモートから取り除けなかった画像があります: ${synced.failed.join(', ')}` }
    }
  }
  return result
}

export const path = '/publish'

export const post = createJsonPostHandler('publish', async ({ filePath, fileContent }) => {
  if (!filePath) {
    return { status: 400, body: { success: false, error: 'ファイル名がありません' } }
  }
  const pagesDir = nodePath.join(srcDir, 'pages')
  const resolvedFilePath = nodePath.resolve(pagesDir, filePath)
  if (!resolvedFilePath.startsWith(pagesDir + nodePath.sep)) {
    return { status: 400, body: { success: false, error: '不正なファイルパスです' } }
  }
  const content = fileContent != null ? fileContent : fs.readFileSync(`${srcDir}/pages/${filePath}`, 'utf-8')
  if (fileContent != null) {
    const dir = `${srcDir}/pages/${filePath}`.split('/').slice(0, -1).join('/')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(`${srcDir}/pages/${filePath}`, fileContent)
  }
  const means = await resolvePublicationMeans({ ...config.publish, cwd: rootDir })
  const result = await handlePublish(
    { filePath, fileContent: content, srcDir: config.src_dir, ledgerPath: imageLedgerPath },
    means
  )
  console.log(styleText(result.success ? 'green' : 'red', `[publish] ${filePath} ${result.success ? 'ok' : result.error}`))
  return { status: result.success ? 200 : 500, body: result }
})
