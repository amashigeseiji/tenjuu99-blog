import { buildCategoryTree } from './category.js'

/**
 * 単一カテゴリー設定に対してカテゴリーページを生成する
 * @param {Object} allData - 全ページデータ（仮想ページの追加先）
 * @param {Object} categoryConfig - 単一カテゴリー設定オブジェクト
 * @param {Object} config - グローバル設定オブジェクト
 */
function generateCategoryPages(allData, categoryConfig, config) {
  // path_filter でページをフィルタ
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

  // カテゴリーツリーを構築（category キーにラップして buildCategoryTree に渡す）
  const treeConfig = { category: categoryConfig }
  const tree = buildCategoryTree(filteredData, treeConfig)

  // 各カテゴリーに対して仮想ページを生成
  for (const [url, categoryData] of Object.entries(tree)) {
    const pageName = url.replace(/^\//, '') + '/index'

    // 既存ページ（手動作成）が存在する場合はスキップ
    if (allData[pageName]) {
      continue
    }

    // 仮想カテゴリーページを生成
    allData[pageName] = {
      name: pageName,
      url: url,
      __output: `${url}/index.html`,
      title: categoryData.title,
      template: categoryConfig.template || 'category.html',
      markdown: '',
      category_path: categoryData.path,
      category_pages: categoryData.pages,
      category_children: Object.keys(categoryData.children),
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
      full_url: `${config.url_base || 'http://localhost:8000'}${url}`
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
  // categories 配列または category 単一設定からカテゴリーシステム一覧を取得
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
