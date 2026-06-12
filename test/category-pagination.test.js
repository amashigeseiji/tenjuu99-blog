/**
 * カテゴリーページネーション テスト
 * 受け入れ条件: P-01 〜 P-09
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { afterIndexing } from '../packages/category/helper/categoryIndexer.js'
import { getPaginationUrl, buildWindowedPages } from '../packages/category/helper/pagination.js'

const BASE_CONFIG = {
  site_name: 'Test',
  url_base: 'http://localhost',
  relative_path: '',
}

function makePage(name, categories) {
  return { name, title: name, url: `/${name}`, category: categories, published: '2024-01-01' }
}

function makeConfig(perPage) {
  const config = {
    category: {
      auto_generate: true,
      template: 'category.html',
    },
    ...BASE_CONFIG,
  }
  if (perPage !== undefined) {
    config.category.per_page = perPage
  }
  return config
}

// ─── P-01: ページ数計算 ────────────────────────────────────────────────────

describe('P-01: per_page を設定すると ceil(記事数/per_page) 個の仮想ページが生成される', () => {
  test('7記事 / per_page=3 → 3ページ', async () => {
    const allData = {}
    for (let i = 1; i <= 7; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    assert.ok(allData['tech/index'], 'ページ1が存在する')
    assert.ok(allData['tech/2/index'], 'ページ2が存在する')
    assert.ok(allData['tech/3/index'], 'ページ3が存在する')
    assert.strictEqual(allData['tech/4/index'], undefined, 'ページ4は存在しない')
  })

  test('3記事 / per_page=3 → 1ページ（ちょうど割り切れる）', async () => {
    const allData = {}
    for (let i = 1; i <= 3; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    assert.ok(allData['tech/index'])
    assert.strictEqual(allData['tech/2/index'], undefined)
  })

  test('4記事 / per_page=3 → 2ページ', async () => {
    const allData = {}
    for (let i = 1; i <= 4; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    assert.ok(allData['tech/index'])
    assert.ok(allData['tech/2/index'])
    assert.strictEqual(allData['tech/3/index'], undefined)
  })
})

// ─── P-02: 1ページ目のURL後方互換 ─────────────────────────────────────────

describe('P-02: 1ページ目の仮想ページ名・URLは既存と同じ', () => {
  test('ページ1のキーは {category_path}/index', async () => {
    const allData = {
      'post/1': makePage('post/1', ['Tech']),
      'post/2': makePage('post/2', ['Tech']),
      'post/3': makePage('post/3', ['Tech']),
      'post/4': makePage('post/4', ['Tech']),
    }
    await afterIndexing(allData, makeConfig(3))

    assert.ok(allData['tech/index'], 'tech/index が存在する')
    assert.strictEqual(allData['tech/index'].url, '/tech/')
    assert.strictEqual(allData['tech/index'].__output, '/tech/index.html')
  })
})

// ─── P-03: 2ページ目以降のURL形式 ─────────────────────────────────────────

describe('P-03: 2ページ目以降は {category_path}/2/index 形式', () => {
  test('ページ2のキーは tech/2/index', async () => {
    const allData = {}
    for (let i = 1; i <= 4; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    assert.ok(allData['tech/2/index'], 'tech/2/index が存在する')
    assert.strictEqual(allData['tech/2/index'].url, '/tech/2/')
    assert.strictEqual(allData['tech/2/index'].__output, '/tech/2/index.html')
  })

  test('ページ3のキーは tech/3/index', async () => {
    const allData = {}
    for (let i = 1; i <= 7; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    assert.ok(allData['tech/3/index'], 'tech/3/index が存在する')
    assert.strictEqual(allData['tech/3/index'].url, '/tech/3/')
  })
})

// ─── P-04: category_pages にはそのページ分のスライスのみ ──────────────────

describe('P-04: category_pages には当該ページの記事スライスのみ入る', () => {
  test('7記事 / per_page=3: ページ1=3件、ページ2=3件、ページ3=1件', async () => {
    const allData = {}
    for (let i = 1; i <= 7; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    assert.strictEqual(allData['tech/index'].category_pages.length, 3, 'ページ1は3件')
    assert.strictEqual(allData['tech/2/index'].category_pages.length, 3, 'ページ2は3件')
    assert.strictEqual(allData['tech/3/index'].category_pages.length, 1, 'ページ3は1件')
  })

  test('各ページのスライスに他ページの記事が含まれない', async () => {
    const allData = {}
    for (let i = 1; i <= 4; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    const page1 = allData['tech/index'].category_pages
    const page2 = allData['tech/2/index'].category_pages
    const overlap = page1.filter(p => page2.includes(p))
    assert.strictEqual(overlap.length, 0, 'ページ1とページ2に重複なし')
  })
})

// ─── P-05: per_page 未設定は従来動作 ─────────────────────────────────────

describe('P-05: per_page 未設定のカテゴリーシステムは従来通り1仮想ページ', () => {
  test('5記事で per_page なし → 1ページのみ、category_pages に全記事', async () => {
    const allData = {}
    for (let i = 1; i <= 5; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(undefined))

    assert.ok(allData['tech/index'])
    assert.strictEqual(allData['tech/2/index'], undefined, '2ページ目は生成されない')
    assert.strictEqual(allData['tech/index'].category_pages.length, 5, '全記事が含まれる')
  })
})

// ─── P-06: category_children は {url, title}[] ────────────────────────────

describe('P-06: category_children は {url, title}[] 型（per_page 有無にかかわらず）', () => {
  test('per_page あり: category_children が {url, title}[] 型', async () => {
    const allData = {
      'post/1': makePage('post/1', ['Tech', 'Frontend']),
      'post/2': makePage('post/2', ['Tech', 'Backend']),
      'post/3': makePage('post/3', ['Tech', 'Frontend']),
      'post/4': makePage('post/4', ['Tech', 'Backend']),
    }
    await afterIndexing(allData, makeConfig(3))

    const children = allData['tech/index'].category_children
    assert.ok(Array.isArray(children))
    assert.ok(children.length > 0)
    for (const child of children) {
      assert.ok(typeof child === 'object' && child !== null, 'オブジェクト型')
      assert.ok(typeof child.url === 'string', 'url が string')
      assert.ok(typeof child.title === 'string', 'title が string')
    }
  })

  test('per_page なし: category_children が {url, title}[] 型', async () => {
    const allData = {
      'post/1': makePage('post/1', ['Tech', 'Frontend']),
      'post/2': makePage('post/2', ['Tech', 'Backend']),
    }
    await afterIndexing(allData, makeConfig(undefined))

    const children = allData['tech/index'].category_children
    assert.ok(Array.isArray(children))
    for (const child of children) {
      assert.ok(typeof child === 'object' && child !== null)
      assert.ok(typeof child.url === 'string')
      assert.ok(typeof child.title === 'string')
    }
  })
})

// ─── P-07: getPaginationUrl ───────────────────────────────────────────────

describe('P-07: getPaginationUrl(basePath, page)', () => {
  test('page === 1 は basePath をそのまま返す', () => {
    assert.strictEqual(getPaginationUrl('/tech/', 1), '/tech/')
  })

  test('page === 2 は basePath + "2/" を返す', () => {
    assert.strictEqual(getPaginationUrl('/tech/', 2), '/tech/2/')
  })

  test('page === 3 は basePath + "3/" を返す', () => {
    assert.strictEqual(getPaginationUrl('/tech/', 3), '/tech/3/')
  })
})

// ─── P-08: buildWindowedPages ─────────────────────────────────────────────

describe('P-08: buildWindowedPages(totalPages, currentPage, windowSize=2)', () => {
  test('buildWindowedPages(10, 5, 2) は前後2件ウィンドウと省略記号を含む', () => {
    const result = buildWindowedPages(10, 5, 2)
    const nums = result.map(p => p.isEllipsis ? '...' : p.num)
    assert.deepStrictEqual(nums, [1, '...', 3, 4, 5, 6, 7, '...', 10])
    assert.strictEqual(result.find(p => p.num === 5)?.isCurrent, true)
  })

  test('totalPages=1 → [{num:1, isCurrent:true}]', () => {
    const result = buildWindowedPages(1, 1, 2)
    assert.deepStrictEqual(result, [{ num: 1, isCurrent: true }])
  })

  test('totalPages=3, currentPage=2 → 省略なし全列挙', () => {
    const result = buildWindowedPages(3, 2, 2)
    const nums = result.map(p => p.isEllipsis ? '...' : p.num)
    assert.deepStrictEqual(nums, [1, 2, 3])
    assert.strictEqual(result.find(p => p.num === 2)?.isCurrent, true)
  })

  test('先頭ページが isCurrent のとき末尾に省略記号', () => {
    const result = buildWindowedPages(10, 1, 2)
    const nums = result.map(p => p.isEllipsis ? '...' : p.num)
    assert.deepStrictEqual(nums, [1, 2, 3, '...', 10])
  })

  test('末尾ページが isCurrent のとき先頭に省略記号', () => {
    const result = buildWindowedPages(10, 10, 2)
    const nums = result.map(p => p.isEllipsis ? '...' : p.num)
    assert.deepStrictEqual(nums, [1, '...', 8, 9, 10])
  })
})

// ─── P-09: ページネーションフィールドの格納 ───────────────────────────────

describe('P-09: ページネーションフィールドが仮想ページに格納される', () => {
  test('per_page あり: category_current_page, category_total_pages, category_per_page, category_pagination_base が設定される', async () => {
    const allData = {}
    for (let i = 1; i <= 4; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(3))

    const page1 = allData['tech/index']
    assert.strictEqual(page1.category_current_page, 1)
    assert.strictEqual(page1.category_total_pages, 2)
    assert.strictEqual(page1.category_per_page, 3)
    assert.ok(typeof page1.category_pagination_base === 'string', 'category_pagination_base が存在する')

    const page2 = allData['tech/2/index']
    assert.strictEqual(page2.category_current_page, 2)
    assert.strictEqual(page2.category_total_pages, 2)
  })

  test('per_page なし: category_current_page=1, category_total_pages=1, category_per_page=undefined が設定される', async () => {
    const allData = {}
    for (let i = 1; i <= 3; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(undefined))

    const page = allData['tech/index']
    assert.strictEqual(page.category_current_page, 1)
    assert.strictEqual(page.category_total_pages, 1)
    assert.strictEqual(page.category_per_page, undefined)
    assert.ok(typeof page.category_pagination_base === 'string', 'category_pagination_base が存在する')
  })

  test('per_page=false: ページネーション無効として扱われる', async () => {
    const allData = {}
    for (let i = 1; i <= 4; i++) {
      allData[`post/${i}`] = makePage(`post/${i}`, ['Tech'])
    }
    await afterIndexing(allData, makeConfig(false))

    assert.ok(allData['tech/index'], '1ページ目は生成される')
    assert.strictEqual(allData['tech/2/index'], undefined, '2ページ目は生成されない')
    assert.strictEqual(allData['tech/index'].category_total_pages, 1)
    assert.strictEqual(allData['tech/index'].category_per_page, undefined)
  })
})
