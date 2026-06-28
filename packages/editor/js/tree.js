/**
 * @typedef {{ dirs: Object.<string, TreeNode>, files: Array<{path: string, label: string}> }} TreeNode
 */

/**
 * @param {Array<{name: string, __filetype: string, url: string}>} files
 * @returns {TreeNode}
 */
// @vocab: ツリービルダー
// @vocab: ファイルリスト
// @vocab: ディレクトリツリー
// @test: tests/editor/editor-sidebar.test.js
export function buildTree(files) {
  const root = { dirs: {}, files: [] }

  for (const file of files) {
    const parts = file.name.split('/')
    const fileName = parts.pop()

    let node = root
    for (const dir of parts) {
      if (!node.dirs[dir]) {
        node.dirs[dir] = { dirs: {}, files: [] }
      }
      node = node.dirs[dir]
    }
    node.files.push({
      path: `${file.name}.${file.__filetype}`,
      label: `${fileName}.${file.__filetype}`,
    })
  }

  return root
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {TreeNode} tree
 * @param {string} [activeFile]
 * @param {string} [_dirPath]
 * @returns {string}
 */
// @vocab: ツリーレンダラー
// @vocab: ディレクトリツリー
// @vocab: ディレクトリノード
// @vocab: ファイルノード
// @vocab: アクティブファイル
// @test: tests/editor/editor-sidebar.test.js
export function renderTreeHtml(tree, activeFile = '', _dirPath = '') {
  let html = '<ul>'

  for (const [dirName, subtree] of Object.entries(tree.dirs)) {
    const dirPath = _dirPath ? `${_dirPath}/${dirName}` : dirName
    html += `<li class="dir-node"><details data-dir="${escapeHtml(dirPath)}"><summary>${escapeHtml(dirName)}</summary>`
    html += renderTreeHtml(subtree, activeFile, dirPath)
    html += `</details></li>`
  }

  for (const file of tree.files) {
    const isActive = file.path === activeFile
    const activeAttr = isActive ? ' class="active"' : ''
    html += `<li><a href="/editor?md=${encodeURIComponent(file.path)}"${activeAttr}>${escapeHtml(file.label)}</a></li>`
  }

  html += '</ul>'
  return html
}
