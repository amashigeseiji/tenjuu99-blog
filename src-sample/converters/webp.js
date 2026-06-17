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

export default async function convert(buffer) {
  return await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp()
    .toBuffer()
}
