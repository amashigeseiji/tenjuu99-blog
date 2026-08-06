/**
 * @vocab 公開ステータスラベル
 * @test tests/editor/image-library.test.js
 * #公開ステータス の各状態に対応する作成者向けの表示語を一か所から与える。
 * 記事と画像がどちらもここを通ることで、同じ状態が同じ言葉で示される。
 * 状態が参照できない（unknown）ときは「不明」、状態そのものが無いときは表示語を持たない。
 * @param {'new'|'modified'|'published'|'remote-only'|'unknown'|''|undefined} status
 * @returns {string}
 */
export function labelFor(status) {
  const labels = {
    new: '未公開',
    modified: '更新あり',
    published: '公開済み',
    'remote-only': 'リモートのみ',
    unknown: '不明',
  }
  return labels[status] ?? ''
}
