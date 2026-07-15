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
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * リンクの作り方の差し替え指定。省略時は従来どおり記事（?md=）へのリンクとして描画する。
 * @typedef {Object} TreeLinkOptions
 * @property {(path: string) => string} [buildHref] ファイルパスからリンク先を組み立てる
 * @property {string} [linkClass] すべてのファイルリンクに付与するクラス名
 * @property {(file: {path: string, label: string}) => string} [fileAttrs] リンクに付け足す属性文字列（エスケープは呼び出し側の責任）
 * @property {string} [dirAttr] ディレクトリの <details> に付けるパス属性名
 * @property {boolean} [openDirs] ディレクトリを開いた状態で描画するか
 */

/**
 * @param {TreeNode} tree
 * @param {string} [activeFile]
 * @param {Object.<string, 'new'|'modified'|'published'|'unknown'>} [statusMap]
 * @param {string} [_dirPath]
 * @param {TreeLinkOptions} [options]
 * @returns {string}
 */
// @vocab: ツリーレンダラー
// @vocab: ディレクトリツリー
// @vocab: ディレクトリノード
// @vocab: ファイルノード
// @vocab: アクティブファイル
// @test: tests/editor/editor-sidebar.test.js
// @test: tests/editor/image-library.test.js
export function renderTreeHtml(tree, activeFile = '', statusMap = {}, _dirPath = '', options = {}) {
  const buildHref = options.buildHref ?? (path => `/editor?md=${encodeURIComponent(path)}`)
  const dirAttr = options.dirAttr ?? 'data-dir'
  const openAttr = options.openDirs ? ' open' : ''
  let html = '<ul>'

  for (const [dirName, subtree] of Object.entries(tree.dirs)) {
    const dirPath = _dirPath ? `${_dirPath}/${dirName}` : dirName
    html += `<li class="dir-node"><details ${dirAttr}="${escapeHtml(dirPath)}"${openAttr}><summary>${escapeHtml(dirName)}</summary>`
    html += renderTreeHtml(subtree, activeFile, statusMap, dirPath, options)
    html += `</details></li>`
  }

  for (const file of tree.files) {
    const isActive = file.path === activeFile
    const classes = [options.linkClass, isActive ? 'active' : ''].filter(Boolean).join(' ')
    const classAttr = classes ? ` class="${classes}"` : ''
    const status = statusMap[file.path]
    const statusAttr = status ? ` data-status="${escapeHtml(status)}"` : ''
    const extraAttrs = options.fileAttrs ? options.fileAttrs(file) : ''
    html += `<li><a href="${buildHref(file.path)}"${classAttr}${statusAttr}${extraAttrs}>${escapeHtml(file.label)}</a></li>`
  }

  html += '</ul>'
  return html
}
