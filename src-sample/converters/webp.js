/**
 * WebP変換コンバーターのサンプル実装。
 * sharp を使って画像を WebP に変換する。
 *
 * 使い方:
 *   1. sharp をインストール: npm install sharp
 *   2. blog.json に設定: { "image_converter": "./converters/webp.js" }
 *      （ビルトインを使う場合は "sharp" のみ指定）
 */

import sharp from 'sharp'

export const ext = 'webp'

/**
 * 変換関数をデフォルトエクスポート、出力拡張子を `ext` としてエクスポートする形。
 * `blog.json` の `image_converter` にこのファイルへのパスを指定すると解決される。
 */
export default async function convert(buffer) {
  return await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp()
    .toBuffer()
}
