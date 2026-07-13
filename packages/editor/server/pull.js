import { styleText } from 'node:util'
import config from '@tenjuu99/blog/lib/config.js'
import { rootDir } from '@tenjuu99/blog/lib/dir.js'
import { pull } from '@tenjuu99/blog/lib/publishing/pull.js'
import { resolvePublicationMeans } from '@tenjuu99/blog/lib/publishing/publicationMeansResolver.js'

/**
 * @vocab: 取り込む
 * @test tests/publishing/sync.test.js
 * リモートの内容を手元に取り込むエンドポイント。対象は原稿の置き場所（src 配下）に限る。
 * 安全に取り込めない記事は見送られ、理由が返る。
 */
export const path = '/pull'

export const post = async (req, res) => {
  try {
    const means = await resolvePublicationMeans({ means: config.publish?.means, cwd: rootDir })
    const result = await pull(means, { scope: `${config.src_dir}/` })
    const summary = `applied=${result.applied.length} skipped=${result.skipped.length}`
    console.log(styleText(result.success ? 'green' : 'red', `[pull] ${result.success ? summary : result.error}`))
    res.writeHead(result.success ? 200 : 500, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (error) {
    console.log(styleText('red', '[pull] エラー:'), error.message)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, applied: [], skipped: [], error: error.message }))
  }
  return true
}
