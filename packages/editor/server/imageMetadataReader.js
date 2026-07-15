import { statSync } from 'node:fs'
import sharp from 'sharp'

/**
 * @vocab: 画像メタデータ読み取り器
 * @test tests/editor/image-library.test.js
 * 画像ファイルのバイト数と解像度を読み取る。解像度が読み取れない画像（壊れたファイル等）は
 * width/height を null にして返す（一覧全体の取得を失敗させないため）。
 * @param {string} absoluteFilePath
 * @returns {Promise<{ size: number, width: number|null, height: number|null }>}
 */
export async function readImageMetadata(absoluteFilePath) {
  const { size } = statSync(absoluteFilePath)
  try {
    const metadata = await sharp(absoluteFilePath).metadata()
    return { size, width: metadata.width ?? null, height: metadata.height ?? null }
  } catch {
    return { size, width: null, height: null }
  }
}
