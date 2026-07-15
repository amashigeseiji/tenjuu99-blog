import { buildTree, escapeHtml } from './tree.js'

function renderNode(tree, dirPath = '') {
  let html = '<ul>'
  for (const [dirName, subtree] of Object.entries(tree.dirs)) {
    const nextPath = dirPath ? `${dirPath}/${dirName}` : dirName
    html += `<li class="dir-node"><details data-image-dir="${escapeHtml(nextPath)}" open><summary>${escapeHtml(dirName)}</summary>`
    html += renderNode(subtree, nextPath)
    html += '</details></li>'
  }
  for (const file of tree.files) {
    const imagePath = `image/${file.path}`
    html += `<li><button type="button" class="image-node" data-image-path="${escapeHtml(imagePath)}">${escapeHtml(file.label)}</button></li>`
  }
  html += '</ul>'
  return html
}

/**
 * @vocab: 画像一覧表示
 * @test tests/editor/image-library.test.js
 * #画像一覧コレクター の結果をサイドバーの「画像」タブにツリー表示する。
 * DOM描画に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLElement} container
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry[]} entries
 */
export function renderImageList(container, entries) {
  if (entries.length === 0) {
    container.innerHTML = '<p class="image-library-empty">画像がありません</p>'
    return
  }
  const files = entries.map(entry => {
    const withoutPrefix = entry.path.replace(/^image\//, '')
    const dotIndex = withoutPrefix.lastIndexOf('.')
    const name = dotIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, dotIndex)
    const filetype = dotIndex === -1 ? '' : withoutPrefix.slice(dotIndex + 1)
    return { name, __filetype: filetype }
  })
  const tree = buildTree(files)
  container.innerHTML = renderNode(tree)
}
