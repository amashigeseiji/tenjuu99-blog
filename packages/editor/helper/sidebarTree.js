import { buildTree, renderTreeHtml } from '../js/tree.js'

/**
 * @param {Array<{name: string, __filetype: string, __is_auto_category: boolean}>} files
 * @param {Object.<string, 'new'|'modified'|'published'|'unknown'>} [statusMap]
 * @returns {string}
 */
export function renderSidebarTree(files, statusMap = {}) {
  const tree = buildTree(files.filter(f => !f.__is_auto_category))
  return renderTreeHtml(tree, '', statusMap)
}
