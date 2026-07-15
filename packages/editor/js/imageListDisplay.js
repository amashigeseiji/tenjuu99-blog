import { buildTree, renderTreeHtml, escapeHtml } from './tree.js'

/**
 * @vocab: 画像リスト表示
 * @test tests/editor/image-library.test.js
 * 選択中の画像が識別できるリンクのツリーとして画像一覧のHTMLを生成する（純粋関数）。
 * ツリーの構築・描画はファイルリストと共通のツリービルダー・ツリーレンダラーを使い、
 * リンク先の組み立て（?image= で画像を特定する）だけを差し替える。
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry[]} entries
 * @param {string} [activeImagePath] 選択中の画像パス（`image/` プレフィックスつき）
 * @returns {string}
 */
export function renderImageListHtml(entries, activeImagePath = '') {
  if (entries.length === 0) {
    return '<p class="image-library-empty">画像がありません</p>'
  }
  const files = entries.map(entry => {
    const withoutPrefix = entry.path.replace(/^image\//, '')
    const dotIndex = withoutPrefix.lastIndexOf('.')
    const name = dotIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, dotIndex)
    const filetype = dotIndex === -1 ? '' : withoutPrefix.slice(dotIndex + 1)
    return { name, __filetype: filetype }
  })
  const tree = buildTree(files)
  return renderTreeHtml(tree, activeImagePath.replace(/^image\//, ''), {}, '', {
    buildHref: path => `/editor?image=${encodeURIComponent(`image/${path}`)}`,
    linkClass: 'image-node',
    fileAttrs: file => ` data-image-path="${escapeHtml(`image/${file.path}`)}"`,
    dirAttr: 'data-image-dir',
    openDirs: true,
  })
}

/**
 * @vocab: 画像リスト表示
 * @test tests/editor/image-library.test.js
 * #画像リストコレクター の結果をサイドバーの「画像」タブにツリー表示する。
 * DOM描画に依存するため自動テストを持たない（HTML生成は renderImageListHtml が担う）。
 * @param {HTMLElement} container
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry[]} entries
 * @param {string} [activeImagePath] 選択中の画像パス（`image/` プレフィックスつき）
 */
export function renderImageList(container, entries, activeImagePath = '') {
  container.innerHTML = renderImageListHtml(entries, activeImagePath)
}
