import config from '@tenjuu99/blog/lib/config.js'
import { watch, rootDir } from '@tenjuu99/blog/lib/dir.js'
import { resolveRemoteState } from '@tenjuu99/blog/lib/publishing/remoteStateResolver.js'
import { collectArticleReferences } from './articleReferenceCollector.js'
import { findReferencingArticles } from './referencingArticleFinder.js'
import { getPublicationStatus } from './publicationStatus.js'
import { createJsonGetHandler } from './handlerFoundation.js'

export const path = '/get_image_references'

/**
 * @vocab: 参照記事一覧エンドポイント
 * @test tests/editor/image-library.test.js
 * 画像パスに対する #参照記事逆引き器 の結果を返すエンドポイント。
 * 削除UI・改名UIの両方が、実行前の参照記事確認のために呼び出す。
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export const get = createJsonGetHandler('get_image_references', async (url) => {
  const imagePath = url.searchParams.get('imagePath')
  if (!imagePath) {
    return { status: 400, body: { error: 'imagePath パラメータが必要です' } }
  }
  const articleReferences = collectArticleReferences(watch.pageDir)
  const remoteState = await resolveRemoteState({ means: config.publish?.means, cwd: rootDir })
  const getStatus = (articlePath) => getPublicationStatus(`${config.src_dir}/pages/${articlePath}`, remoteState)
  const articles = await findReferencingArticles(imagePath, articleReferences, getStatus)
  return { body: { articles } }
})
