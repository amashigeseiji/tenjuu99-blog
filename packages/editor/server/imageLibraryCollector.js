import nodePath from 'node:path'
import { scanImages } from './imageScanner.js'
import { readImageMetadata } from './imageMetadataReader.js'
import { readLedger } from './imageLedger.js'

/**
 * @vocab: 画像ライブラリエントリ
 * @typedef {object} ImageLibraryEntry
 * @property {string} path - srcDir からの相対パス（例: `image/post/hello/photo.jpg`）
 * @property {string} url - 公開URL（例: `/image/post/hello/photo.jpg`）
 * @property {number} size - バイト数
 * @property {number|null} width - 解像度（幅）。読み取れない場合は null
 * @property {number|null} height - 解像度（高さ）。読み取れない場合は null
 * @property {string|null} addedAt - エディタ経由で追加された日時（ISO文字列）。記録がなければ null
 */

/**
 * @vocab: 画像リストコレクター
 * @test tests/editor/image-library.test.js
 * #画像スキャナー ・ #画像メタデータ読み取り器 ・ #画像台帳 を組み合わせ、
 * #画像ライブラリ が表示する画像リストを組み立てる。
 * @param {{ srcDir: string, ledgerPath?: string }} options
 * @returns {Promise<ImageLibraryEntry[]>}
 */
export async function collectImageLibrary({ srcDir, ledgerPath = nodePath.join(srcDir, 'image-library.json') }) {
  const imageDir = nodePath.join(srcDir, 'image')
  const relPaths = scanImages(imageDir)
  const ledger = readLedger(ledgerPath)
  return Promise.all(relPaths.map(async (relPath) => {
    const imagePath = `image/${relPath}`
    const metadata = await readImageMetadata(nodePath.join(imageDir, relPath))
    return {
      path: imagePath,
      url: `/${imagePath}`,
      size: metadata.size,
      width: metadata.width,
      height: metadata.height,
      addedAt: ledger[imagePath]?.addedAt ?? null,
    }
  }))
}
