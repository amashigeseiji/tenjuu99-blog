import { buildTree, renderTreeHtml } from '../js/tree.js'

export function renderSidebarTree(files) {
  const tree = buildTree(files.filter(f => !f.__is_auto_category))
  return renderTreeHtml(tree)
}
