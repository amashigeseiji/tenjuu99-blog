import nodePath from 'node:path'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { resolveRemoteState } from '@tenjuu99/blog/lib/publishing/remoteStateResolver.js'
import { collectImageLibrary } from './imageLibraryCollector.js'

export const path = '/get_image_library'

/**
 * @vocab: 画像ライブラリ
 * @test tests/editor/image-library.test.js
 * #画像リストコレクター の結果をJSONで返すエンドポイント。画像ライブラリのリスト表示・詳細表示が
 * 参照するデータをここから一度だけ取得する。ローカルに実体がなく #リモート にのみ存在する画像は
 * remoteOnly として別に返し、#リモートのみ画像表示 が別枠で扱う。
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const get = async (req, res) => {
  const srcDir = nodePath.join(rootDir, config.src_dir)
  const remoteState = await resolveRemoteState({ means: config.publish?.means, cwd: rootDir })
  const { images, remoteOnly } = await collectImageLibrary({
    srcDir,
    remoteState,
    srcPrefix: `${config.src_dir}/`,
  })
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ images, remoteOnly }),
  }
}
