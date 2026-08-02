import sharp from 'sharp'

export const ext = 'webp'

/**
 * パッケージに同梱された sharp ベースの変換処理。`blog.json` の `image_converter` に
 * ビルトイン名 `"sharp"` を指定すると、コンバーターファクトリーがこれを解決する。
 *
 * @vocab: 変換ドライバー
 * @vocab: ビルトインコンバーター
 * @test: tests/editor/editor-image-upload.test.js
 *
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export default async function convert(buffer) {
  return await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp()
    .toBuffer()
}
