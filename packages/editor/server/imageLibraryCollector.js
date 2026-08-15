import nodePath from 'node:path'
import { scanImages, isImageFileName } from './imageScanner.js'
import { readImageMetadata } from './imageMetadataReader.js'
import { readLedger } from './imageLedger.js'
import { collectStatuses } from './sidebarStatusCollector.js'

/**
 * @vocab: 画像ライブラリエントリ
 * @test: tests/editor/image-library.test.js
 * @typedef {object} ImageLibraryEntry
 * @property {string} path - srcDir からの相対パス（例: `image/post/hello/photo.jpg`）
 * @property {string} url - 公開URL（例: `/image/post/hello/photo.jpg`）
 * @property {number|null} size - バイト数。ローカルに実体がなければ null
 * @property {number|null} width - 解像度（幅）。読み取れない場合は null
 * @property {number|null} height - 解像度（高さ）。読み取れない場合は null
 * @property {string|null} addedAt - エディタ経由で追加された日時（ISO文字列）。記録がなければ null
 * @property {boolean} declared - #検出外参照宣言 が付与されているか
 * @property {'new'|'modified'|'published'|'remote-only'|'unknown'} status - #公開ステータス
 */

/**
 * @vocab: 画像リストコレクター
 * @test tests/editor/image-library.test.js
 * #画像スキャナー ・ #画像メタデータ読み取り器 ・ #画像台帳 を組み合わせ、
 * #画像ライブラリ が表示する画像リストを組み立てる。
 * 各画像には #ファイルステータスコレクター から取得した #公開ステータス を添える。
 * #移動元パス がリモートに在る画像は、別物が現れたのではなく同じ画像の未同期の変更として
 * 「更新あり」と読む。ローカルに実体がなくリモートにのみ存在する画像は、ローカルの一覧
 * （画像ツリー）には混ぜず remoteOnly として別に返す。
 * @param {{ srcDir: string, ledgerPath?: string, remoteState?: import('@tenjuu99/blog/lib/publishing/publicationMeans.js').RemoteState|null, srcPrefix?: string }} options
 *   srcPrefix: プロジェクトルートから srcDir までの相対プレフィックス（例: `src/`）。
 *   #公開ステータス 判定はプロジェクトルート相対のパスで行われるため必要になる
 * @returns {Promise<{ images: ImageLibraryEntry[], remoteOnly: ImageLibraryEntry[] }>}
 */
export async function collectImageLibrary({
  srcDir,
  ledgerPath = nodePath.join(srcDir, 'image-library.json'),
  remoteState = null,
  srcPrefix = `${nodePath.basename(srcDir)}/`,
}) {
  const imageDir = nodePath.join(srcDir, 'image')
  const relPaths = scanImages(imageDir)
  const ledger = readLedger(ledgerPath)
  const imagePrefix = `${srcPrefix}image/`

  const statusMap = remoteState
    ? await collectStatuses(
      relPaths.map(rel => ({ treePath: rel, localPath: `${imagePrefix}${rel}` })),
      remoteState,
      { pagesPrefix: imagePrefix }
    )
    : {}

  const images = await Promise.all(relPaths.map(async (relPath) => {
    const imagePath = `image/${relPath}`
    const metadata = await readImageMetadata(nodePath.join(imageDir, relPath))
    const movedFrom = ledger[imagePath]?.movedFrom ?? null
    return {
      path: imagePath,
      url: `/${imagePath}`,
      size: metadata.size,
      width: metadata.width,
      height: metadata.height,
      addedAt: ledger[imagePath]?.addedAt ?? null,
      declared: ledger[imagePath]?.protected ?? false,
      status: await resolveImageStatus(statusMap[relPath] ?? 'unknown', movedFrom, remoteState, srcPrefix),
    }
  }))

  const movedFromPaths = new Set(
    Object.values(ledger).map(entry => entry.movedFrom).filter(Boolean)
  )
  const remoteOnly = Object.entries(statusMap)
    .filter(([relPath, status]) => status === 'remote-only'
      && isImageFileName(relPath)
      && !movedFromPaths.has(`image/${relPath}`))
    .map(([relPath]) => ({
      path: `image/${relPath}`,
      url: `/image/${relPath}`,
      size: null,
      width: null,
      height: null,
      addedAt: null,
      declared: false,
      status: 'remote-only',
    }))

  return { images, remoteOnly }
}

/**
 * ローカルの実体から導いた #公開ステータス に #移動元パス の知識を重ねる。
 * 移動した画像はローカルの新しいパスとしてはリモートに存在しないため素の判定では「未公開」に
 * なるが、リモートが移動元パスを知っているなら、それは同じ画像のまだ届いていない変更である。
 * @param {'new'|'modified'|'published'|'unknown'} status
 * @param {string|null} movedFrom
 * @param {import('@tenjuu99/blog/lib/publishing/publicationMeans.js').RemoteState|null} remoteState
 * @param {string} srcPrefix
 * @returns {Promise<'new'|'modified'|'published'|'unknown'>}
 */
async function resolveImageStatus(status, movedFrom, remoteState, srcPrefix) {
  if (status !== 'new' || !movedFrom || !remoteState) return status
  try {
    return await remoteState.existsInRemote(`${srcPrefix}${movedFrom}`) ? 'modified' : 'new'
  } catch {
    return 'unknown'
  }
}
