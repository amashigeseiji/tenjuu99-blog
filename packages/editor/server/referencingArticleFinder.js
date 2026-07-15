/**
 * @vocab: 参照記事逆引き器
 * @test tests/editor/image-library.test.js
 * @typedef {{ path: string, status: 'new'|'modified'|'published'|'unknown' }} ReferencingArticle - #ローカル参照 する記事1件（公開状態つき）
 */

/**
 * @vocab: 参照記事逆引き器
 * @test tests/editor/image-library.test.js
 * 画像パスを参照している記事を、記事参照コレクターの結果から逆引きする（#ローカル参照 を実現する）。
 * 各記事の公開ステータスは呼び出し側から注入された判定関数で取得する。
 * @param {string} imagePath - 画像ライブラリエントリの path（例: `image/post/hello/a.jpg`）
 * @param {import('./articleReferenceCollector.js').ArticleImageReferences[]} articleReferences - collectArticleReferences の結果
 * @param {(articlePath: string) => Promise<'new'|'modified'|'published'|'unknown'>} getStatus - 記事パス（pagesDir からの相対パス）に対する公開ステータス判定
 * @returns {Promise<ReferencingArticle[]>}
 */
export async function findReferencingArticles(imagePath, articleReferences, getStatus) {
  const matches = articleReferences.filter(article => article.imagePaths.includes(imagePath))
  return Promise.all(matches.map(async article => ({
    path: article.path,
    status: await getStatus(article.path),
  })))
}
