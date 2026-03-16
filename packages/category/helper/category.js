import { allData, config } from '@tenjuu99/blog'

let categoryTreeCache = null

/**
 * カテゴリーツリーを構築する
 * @param {Object} allData - 全ページデータ
 * @param {Object} config - 設定オブジェクト
 * @returns {Object} カテゴリーツリー
 */
export function buildCategoryTree(data = allData, conf = config) {
  const tree = {}
  const urlCase = conf.category?.url_case || 'lower'
  const urlSeparator = conf.category?.url_separator || '-'
  const urlPrefix = conf.category?.url_prefix || ''
  const maxDepth = conf.category?.max_depth || 3

  for (const [name, page] of Object.entries(data)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    const categoryPath = page.category.slice(0, maxDepth)
    let currentPath = urlPrefix

    for (let i = 0; i < categoryPath.length; i++) {
      const category = categoryPath[i]
      let categoryUrl = urlCase === 'lower' ? category.toLowerCase() : category
      categoryUrl = categoryUrl.replace(/\s+/g, urlSeparator)
      currentPath += `/${categoryUrl}`

      if (!tree[currentPath]) {
        tree[currentPath] = {
          title: category,
          path: categoryPath.slice(0, i + 1),
          pages: [],
          children: {}
        }
      }

      tree[currentPath].pages.push(name)
    }
  }

  // children を計算
  for (const [url, node] of Object.entries(tree)) {
    const depth = node.path.length
    for (const [childUrl, childNode] of Object.entries(tree)) {
      if (childNode.path.length === depth + 1 && childUrl.startsWith(url + '/')) {
        node.children[childUrl] = childNode
      }
    }
  }

  return tree
}

/**
 * カテゴリーツリーを取得する（キャッシュあり）
 * @returns {Object} カテゴリーツリー
 */
export function getCategoryTree() {
  if (!categoryTreeCache) {
    categoryTreeCache = buildCategoryTree()
  }
  return categoryTreeCache
}

/**
 * 特定のカテゴリーに所属するページを取得する（完全一致）
 * @param {Array} categoryPath - カテゴリーパス（例: ["Art", "Painting"]）
 * @returns {Array} ページデータの配列
 */
export function getCategoryPages(categoryPath) {
  const pages = []

  for (const [name, page] of Object.entries(allData)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    if (JSON.stringify(page.category) === JSON.stringify(categoryPath)) {
      pages.push(page)
    }
  }

  return pages
}

/**
 * 特定のカテゴリーに所属するページを再帰的に取得する（サブカテゴリー含む）
 * @param {Array} categoryPath - カテゴリーパス（例: ["Art"]）
 * @returns {Array} ページデータの配列
 */
export function getCategoryPagesRecursive(categoryPath) {
  const pages = []

  for (const [name, page] of Object.entries(allData)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    // categoryPath が page.category の先頭部分と一致するか確認
    if (page.category.length >= categoryPath.length) {
      let match = true
      for (let i = 0; i < categoryPath.length; i++) {
        if (page.category[i] !== categoryPath[i]) {
          match = false
          break
        }
      }
      if (match) {
        pages.push(page)
      }
    }
  }

  return pages
}

/**
 * カテゴリーキャッシュをクリアする（テスト用）
 */
export function clearCategoryCache() {
  categoryTreeCache = null
}
