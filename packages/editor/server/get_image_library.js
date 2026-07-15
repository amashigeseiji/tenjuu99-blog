import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { collectImageLibrary } from './imageLibraryCollector.js'

export const path = '/get_image_library'

/**
 * @vocab: 画像ライブラリ
 * @test tests/editor/image-library.test.js
 * #画像一覧コレクター の結果をJSONで返すエンドポイント。画像ライブラリの一覧表示・詳細表示が
 * 参照するデータをここから一度だけ取得する。
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const get = async (req, res) => {
  const srcDir = nodePath.join(rootDir, config.src_dir)
  const images = await collectImageLibrary({ srcDir })
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ images }),
  }
}
