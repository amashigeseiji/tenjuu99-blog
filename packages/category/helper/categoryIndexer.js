import { buildCategoryTree } from './category.js'

/**
 * afterIndexing フック関数
 * カテゴリーツリーを構築し、仮想カテゴリーインデックスページを生成する
 * @param {Object} allData - 全ページデータ
 * @param {Object} config - 設定オブジェクト
 */
export async function afterIndexing(allData, config) {
  // auto_generate が false の場合は何もしない
  if (config.category?.auto_generate === false) {
    return
  }

  // カテゴリーツリーを構築
  const tree = buildCategoryTree(allData, config)

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
      template: config.category?.template || 'category.html',
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
