import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { createJsonPostHandler } from './handlerFoundation.js'
import { setDeclaration } from './imageLedger.js'

export const path = '/image_declaration'

const srcDir = nodePath.join(rootDir, config.src_dir)
export const imageLedgerPath = nodePath.join(srcDir, 'image-library.json')

/**
 * @vocab: 検出外参照宣言エンドポイント
 * @test tests/editor/image-library.test.js
 * 画像への #検出外参照宣言 の付与・解除を受け付け、画像台帳に反映する。
 * 画像台帳のキーは画像の置き場所（`image/` 配下）を指すものに限るため、そこから外れるパスは
 * 受け付けない（受け取った値をそのままキーにすると、後続処理の前提を崩す記録を作れてしまう）。
 * @param {{ imagePath: string, declared: boolean }} params - imagePath は srcDir からの相対パス（例: `image/post/cat.jpg`）
 * @param {{ ledgerPath: string }} deps
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function setImageDeclaration({ imagePath, declared }, deps) {
  if (!isImageLedgerKey(imagePath)) return { success: false, error: '不正な画像パスです' }
  setDeclaration(deps.ledgerPath, imagePath, declared)
  return { success: true }
}

/**
 * 画像台帳のキーとして受け付けられる形か（`image/` 配下を指し、上位へ抜けない）。
 * @param {string} imagePath
 * @returns {boolean}
 */
function isImageLedgerKey(imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('image/')) return false
  return nodePath.normalize(imagePath).startsWith(`image${nodePath.sep}`)
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const post = createJsonPostHandler('image_declaration', async ({ imagePath, declared }) => {
  if (!imagePath) {
    return { status: 400, body: { success: false, error: 'imagePathがありません' } }
  }
  const result = await setImageDeclaration(
    { imagePath, declared: !!declared },
    { ledgerPath: imageLedgerPath }
  )
  return { status: result.success ? 200 : 400, body: result }
})
