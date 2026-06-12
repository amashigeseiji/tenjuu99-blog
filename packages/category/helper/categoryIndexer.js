import { buildCategoryTree } from './category.js'

/**
 * 記事名配列を perPage 件ずつのページ配列に分割する
 * 空の場合は [[]] を返す（ページ数ゼロを避けるため）
 */
function sliceIntoPages(items, perPage) {
  if (items.length === 0) return [[]]
  const pages = []
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage))
  }
  return pages
}

/**
 * 仮想カテゴリーページオブジェクトを生成する
 *
 * 通常のページオブジェクトに対して以下のカテゴリー固有プロパティを追加する:
 *   category_path     - カテゴリーパス配列
 *   category_children - サブカテゴリー一覧 {url, title}[]
 *   category_pages    - このカテゴリーのページ名配列（呼び出し側でセット）
 *   __is_auto_category - 自動生成フラグ
 *
 * 以下のページネーションフィールドは常に設定される:
 *   category_current_page    - 現在のページ番号（1始まり）
 *   category_total_pages     - 総ページ数
 *   category_per_page        - 1ページあたりの件数（per_page <= 0 または未設定時は undefined）
 *   category_pagination_base - カテゴリー1ページ目URL（末尾スラッシュあり）
 * ページネーション無効時（per_page が正の整数でない場合）は current_page=1, total_pages=1 となる。
 *
 * @param {string} url - ページURL
 * @param {Object} categoryData - カテゴリーデータ（baseUrl を含む）
 * @param {Array} children - 子カテゴリー一覧
 * @param {number} currentPage - 現在のページ番号
 * @param {number} totalPages - 総ページ数
 * @param {Object} categoryConfig - 単一カテゴリー設定オブジェクト
 * @param {Object} config - グローバル設定オブジェクト
 */
function buildVirtualPage(url, categoryData, children, currentPage, totalPages, categoryConfig, config) {
  const pageName = url.replace(/^\//, '') + '/index'
  const paginationBase = categoryData.baseUrl + '/'
  const perPage = categoryConfig.per_page

  const page = {
    name: pageName,
    url: url + '/',
    __output: `${url}/index.html`,
    title: categoryData.title,
    template: categoryConfig.template || 'category.html',
    markdown: '',
    category_path: categoryData.path,
    category_children: children,
    __is_auto_category: true,
    distribute: true,
    index: false,
    noindex: false,
    lang: 'ja',
    published: '1970-01-01',
    ext: 'html',
    site_name: config.site_name || 'default',
    url_base: config.url_base || 'http://localhost:8000',
    relative_path: config.relative_path || '',
    description: `${categoryData.title} カテゴリーのページ一覧`,
    og_description: `${categoryData.title} カテゴリーのページ一覧`,
    __filetype: 'md',
    markdown_not_parsed: '',
    full_url: `${config.url_base || 'http://localhost:8000'}${url}/`,
    category_pages: [],
    category_current_page: currentPage,
    category_total_pages: totalPages,
    category_per_page: perPage > 0 ? perPage : undefined,
    category_pagination_base: paginationBase,
  }

  return page
}

/**
 * 単一カテゴリー設定に対してカテゴリーページを生成する
 * @param {Object} allData - 全ページデータ（仮想ページの追加先）
 * @param {Object} categoryConfig - 単一カテゴリー設定オブジェクト
 * @param {Object} config - グローバル設定オブジェクト
 */
function generateCategoryPages(allData, categoryConfig, config) {
  const pathFilter = categoryConfig.path_filter || ''
  let filteredData = allData

  if (pathFilter) {
    filteredData = {}
    for (const [name, page] of Object.entries(allData)) {
      if (name.startsWith(pathFilter)) {
        filteredData[name] = page
      }
    }
  }

  const treeConfig = { category: categoryConfig }
  const tree = buildCategoryTree(filteredData, treeConfig)

  for (const [url, categoryData] of Object.entries(tree)) {
    const children = Object.entries(categoryData.children).map(([childUrl, childNode]) => ({
      url: childUrl + '/',
      title: childNode.title,
    }))

    const categoryInfo = { ...categoryData, baseUrl: url }
    const perPage = categoryConfig.per_page

    if (perPage > 0) {
      const slices = sliceIntoPages(categoryData.pages, perPage)
      const totalPages = slices.length

      for (let i = 0; i < slices.length; i++) {
        const currentPage = i + 1
        const pageUrl = currentPage === 1 ? url : `${url}/${currentPage}`
        const pageName = pageUrl.replace(/^\//, '') + '/index'

        if (allData[pageName]) continue

        const virtualPage = buildVirtualPage(pageUrl, categoryInfo, children, currentPage, totalPages, categoryConfig, config)
        virtualPage.category_pages = slices[i]
        allData[pageName] = virtualPage
      }
    } else {
      const pageName = url.replace(/^\//, '') + '/index'
      if (allData[pageName]) continue

      const virtualPage = buildVirtualPage(url, categoryInfo, children, 1, 1, categoryConfig, config)
      virtualPage.category_pages = categoryData.pages
      allData[pageName] = virtualPage
    }
  }
}

/**
 * afterIndexing フック関数
 * カテゴリーツリーを構築し、仮想カテゴリーインデックスページを生成する
 * `config.categories`（配列）と `config.category`（単一、後方互換）の両方をサポート。
 * @param {Object} allData - 全ページデータ
 * @param {Object} config - 設定オブジェクト
 */
export async function afterIndexing(allData, config) {
  const categorySystems = config.categories
    ? config.categories
    : (config.category ? [config.category] : [])

  for (const categoryConfig of categorySystems) {
    if (categoryConfig.auto_generate === false) {
      continue
    }

    generateCategoryPages(allData, categoryConfig, config)
  }
}
