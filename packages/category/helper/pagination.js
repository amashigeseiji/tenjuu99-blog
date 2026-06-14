/**
 * getPaginationUrl: ページ番号から URL を生成する
 * page === 1 なら basePath、それ以外なら basePath + page + '/'
 */
// @vocab: ページネーション (docs/dictionary.md#ページネーション)
// @vocab: カテゴリーページ (docs/dictionary.md#カテゴリーページ)
// @test: tests/category/category-pagination.test.js
export function getPaginationUrl(basePath, page) {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`
  if (page === 1) return base
  return `${base}${page}/`
}

/**
 * buildWindowedPages: ウィンドウ付きページ番号リストを生成する
 * 各要素は {num, isCurrent} または {num: null, isEllipsis: true}
 */
// @vocab: ページネーション (docs/dictionary.md#ページネーション)
// @test: tests/category/category-pagination.test.js
export function buildWindowedPages(totalPages, currentPage, windowSize = 2) {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [{ num: 1, isCurrent: currentPage === 1 }]

  const rangeStart = Math.max(2, currentPage - windowSize)
  const rangeEnd = Math.min(totalPages - 1, currentPage + windowSize)
  const result = []

  result.push({ num: 1, isCurrent: currentPage === 1 })

  if (rangeStart > 2) result.push({ num: null, isEllipsis: true })

  for (let i = rangeStart; i <= rangeEnd; i++) {
    result.push({ num: i, isCurrent: i === currentPage })
  }

  if (rangeEnd < totalPages - 1) result.push({ num: null, isEllipsis: true })

  result.push({ num: totalPages, isCurrent: currentPage === totalPages })

  return result
}
