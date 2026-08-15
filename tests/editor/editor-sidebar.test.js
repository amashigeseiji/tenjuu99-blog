import { describe, it } from 'node:test'
import assert from 'node:assert'
import { buildTree, renderTreeHtml } from '../../packages/editor/js/tree.js'

const sampleFiles = [
  { name: 'index', __filetype: 'md', url: '/index' },
  { name: 'about', __filetype: 'md', url: '/about' },
  { name: 'posts/hello', __filetype: 'md', url: '/posts/hello' },
  { name: 'posts/world', __filetype: 'md', url: '/posts/world' },
  { name: 'posts/deep/nested', __filetype: 'md', url: '/posts/deep/nested' },
]

// ルートテスト: ツリーが完成するまで green にしない
describe('サイドバー は ディレクトリツリーでファイルナビゲーションができる', () => {
  it('ファイルリストがディレクトリ階層のHTMLに変換され、アクティブファイルがハイライトされる', () => {
    const tree = buildTree(sampleFiles)
    const html = renderTreeHtml(tree, 'posts/hello.md')
    // ディレクトリが <details> として出力されている
    assert.match(html, /<details/)
    // アクティブファイルに class="active" が付いている
    assert.match(html, /class="active"/)
    // ルートファイルのリンクが含まれている
    assert.match(html, /\/editor\?md=index\.md/)
    // ネストしたファイルのリンクが含まれている
    assert.match(html, /\/editor\?md=posts%2Fhello\.md/)
  })
})

// ─── ツリービルダー ───────────────────────────────────────────────

describe('ネスト変換 は フラットなファイルリストをネストオブジェクトに変換できる', () => {
  it('ルートレベルのファイルは root.files に含まれる', () => {
    const files = [{ name: 'index', __filetype: 'md', url: '/index' }]
    const tree = buildTree(files)
    assert.deepStrictEqual(tree.files, [{ path: 'index.md', label: 'index.md' }])
    assert.deepStrictEqual(tree.dirs, {})
  })

  it('ネストされたファイルはディレクトリノード下の files に含まれる', () => {
    const files = [{ name: 'posts/hello', __filetype: 'md', url: '/posts/hello' }]
    const tree = buildTree(files)
    assert.ok(tree.dirs['posts'], 'posts ディレクトリが存在する')
    assert.deepStrictEqual(tree.dirs['posts'].files, [{ path: 'posts/hello.md', label: 'hello.md' }])
  })

  it('URLが末尾スラッシュの index ファイルもファイル名だけでラベルされる', () => {
    const files = [{ name: 'book/index', __filetype: 'md', url: '/book/' }]
    const tree = buildTree(files)
    assert.deepStrictEqual(tree.dirs['book'].files, [{ path: 'book/index.md', label: 'index.md' }])
  })

  it('複数階層のディレクトリが再帰的に構築される', () => {
    const files = [{ name: 'a/b/c', __filetype: 'md', url: '/a/b/c' }]
    const tree = buildTree(files)
    assert.ok(tree.dirs['a'])
    assert.ok(tree.dirs['a'].dirs['b'])
    assert.strictEqual(tree.dirs['a'].dirs['b'].files.length, 1)
    assert.strictEqual(tree.dirs['a'].dirs['b'].files[0].path, 'a/b/c.md')
  })

  it('ファイルとディレクトリが混在するリストを正しく構築できる', () => {
    const tree = buildTree(sampleFiles)
    assert.strictEqual(tree.files.length, 2, 'ルートに index と about の2ファイル')
    assert.ok(tree.dirs['posts'], 'posts ディレクトリが存在する')
    assert.strictEqual(tree.dirs['posts'].files.length, 2, 'posts に hello と world の2ファイル')
    assert.ok(tree.dirs['posts'].dirs['deep'], 'posts/deep ディレクトリが存在する')
  })
})

// ─── ツリーレンダラー ─────────────────────────────────────────────

describe('ディレクトリノード は <details> タグとして出力できる', () => {
  it('ディレクトリが <details><summary>名前</summary>...</details> として出力される', () => {
    const tree = {
      dirs: { posts: { dirs: {}, files: [{ path: 'posts/hello.md', label: '/posts/hello.md' }] } },
      files: []
    }
    const html = renderTreeHtml(tree)
    assert.match(html, /<details[^>]*>/)
    assert.match(html, /<summary>posts<\/summary>/)
  })
})

describe('ファイルノード は エディタリンクとして出力できる', () => {
  it('ファイルが /editor?md=パス のリンクとして出力される', () => {
    const tree = { dirs: {}, files: [{ path: 'index.md', label: 'index.md' }] }
    const html = renderTreeHtml(tree)
    assert.match(html, /href="\/editor\?md=index\.md"/)
    assert.match(html, />index\.md<\/a>/)
  })
})

describe('アクティブファイル は class="active" 付きで出力できる', () => {
  it('アクティブファイルのリンクに class="active" が付く', () => {
    const tree = {
      dirs: {},
      files: [
        { path: 'index.md', label: '/index.md' },
        { path: 'about.md', label: '/about.md' },
      ]
    }
    const html = renderTreeHtml(tree, 'index.md')
    assert.match(html, /href="\/editor\?md=index\.md" class="active"/)
  })

  it('アクティブでないファイルには class="active" が付かない', () => {
    const tree = {
      dirs: {},
      files: [
        { path: 'index.md', label: '/index.md' },
        { path: 'about.md', label: '/about.md' },
      ]
    }
    const html = renderTreeHtml(tree, 'index.md')
    assert.doesNotMatch(html, /href="\/editor\?md=about\.md" class="active"/)
  })

  it('ネストしたファイルにも class="active" が付く', () => {
    const tree = {
      dirs: {
        posts: {
          dirs: {},
          files: [{ path: 'posts/hello.md', label: '/posts/hello.md' }]
        }
      },
      files: []
    }
    const html = renderTreeHtml(tree, 'posts/hello.md')
    assert.match(html, /href="\/editor\?md=posts%2Fhello\.md" class="active"/)
  })
})

// ─── 展開状態・サイドバーツリー初期化（sidebar.js） ───────────────────────────

import { loadDirOpenState, saveDirOpenState, initSidebarTree } from '../../packages/editor/js/sidebar.js'

const makeFakeStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
  }
}

const makeFakeDetails = (dir) => ({
  dataset: { dir },
  open: false,
  listeners: {},
  addEventListener(ev, fn) { this.listeners[ev] = fn },
})

describe('展開状態 は ディレクトリの開閉状態を保持して管理できる', () => {
  it('保存した開閉状態が読み戻せる', () => {
    const storage = makeFakeStorage()
    saveDirOpenState({ posts: true, drafts: false }, storage)
    assert.deepStrictEqual(loadDirOpenState(storage), { posts: true, drafts: false })
  })

  it('保存値が壊れていても空の状態として読める', () => {
    const storage = makeFakeStorage({ 'sidebar-dir-open': '{invalid' })
    assert.deepStrictEqual(loadDirOpenState(storage), {})
  })
})

describe('サイドバー は 保存済みの開閉状態を復元し、アクティブファイルの親ディレクトリを開ける', () => {
  it('保存済みの開閉状態が <details> に反映され、アクティブファイルの親が開く', () => {
    const storage = makeFakeStorage()
    saveDirOpenState({ drafts: true }, storage)
    const details = [makeFakeDetails('posts'), makeFakeDetails('posts/deep'), makeFakeDetails('drafts')]
    const doc = { querySelectorAll: () => details }
    const synced = []
    initSidebarTree('posts/deep/nested.md', { doc, storage, syncActive: (t) => synced.push(t) })
    assert.strictEqual(details[0].open, true)  // posts: アクティブファイルの親
    assert.strictEqual(details[1].open, true)  // posts/deep: アクティブファイルの親
    assert.strictEqual(details[2].open, true)  // drafts: 保存済みの状態
    // アクティブ表示の付与はアクティブ状態同期器へ委ねられる
    assert.deepStrictEqual(synced, [{ type: 'article', path: 'posts/deep/nested.md' }])
  })

  it('開閉を切り替えるたびに状態が保存される', () => {
    const storage = makeFakeStorage()
    const details = [makeFakeDetails('posts')]
    const doc = { querySelectorAll: () => details }
    initSidebarTree('', { doc, storage })
    details[0].open = true
    details[0].listeners.toggle()
    assert.deepStrictEqual(loadDirOpenState(storage), { posts: true })
    details[0].open = false
    details[0].listeners.toggle()
    assert.deepStrictEqual(loadDirOpenState(storage), { posts: false })
  })
})

// ─── サイドバー内容の取得・差し替え（initSidebarContent） ───────────────────

import { initSidebarContent, initSidebarToggle } from '../../packages/editor/js/sidebar.js'

describe('サイドバー は サイドバー取得エンドポイントからツリーを取得して差し替えられる', () => {
  const makeDoc = (details = []) => {
    const files = { innerHTML: '<p>before</p>' }
    return {
      files,
      querySelector: (sel) => sel === '.sidebar-files' ? files : null,
      querySelectorAll: () => details,
    }
  }

  it('取得したHTMLで .sidebar-files を差し替え、ツリーを初期化してアクティブ表示を同期する', async () => {
    const doc = makeDoc([makeFakeDetails('posts')])
    const storage = makeFakeStorage()
    const synced = []
    const calledUrls = []
    const fetchFn = async (url) => {
      calledUrls.push(url)
      return { ok: true, json: async () => ({ html: '<ul>tree</ul>' }) }
    }
    await initSidebarContent('posts/a.md', { doc, storage, syncActive: (t) => synced.push(t), fetchFn })
    assert.deepStrictEqual(calledUrls, ['/get_sidebar'])
    assert.strictEqual(doc.files.innerHTML, '<ul>tree</ul>')
    assert.strictEqual(doc.querySelectorAll()[0].open, true)  // アクティブファイルの親が開く
    assert.deepStrictEqual(synced, [{ type: 'article', path: 'posts/a.md' }])
  })

  it('取得に失敗した応答では既存の内容を保つ', async () => {
    const doc = makeDoc()
    const fetchFn = async () => ({ ok: false, json: async () => ({}) })
    await initSidebarContent('posts/a.md', { doc, storage: makeFakeStorage(), fetchFn })
    assert.strictEqual(doc.files.innerHTML, '<p>before</p>')
  })

  it('取得が例外を投げても呼び出し側へは伝播しない', async () => {
    const doc = makeDoc()
    const fetchFn = async () => { throw new Error('network') }
    const origLog = console.log
    console.log = () => {}
    try {
      await assert.doesNotReject(() => initSidebarContent('', { doc, storage: makeFakeStorage(), fetchFn }))
    } finally {
      console.log = origLog
    }
    assert.strictEqual(doc.files.innerHTML, '<p>before</p>')
  })
})

// ─── サイドバーの開閉トグル（initSidebarToggle） ─────────────────────────────

describe('サイドバー は 開閉トグルとハンバーガーメニューで開閉し、開閉状態を保存・復元できる', () => {
  const makeClassList = () => {
    const set = new Set()
    return {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
      toggle: (c) => set.has(c) ? set.delete(c) : set.add(c),
    }
  }
  const makeListenable = () => ({
    listeners: {},
    addEventListener(ev, fn) { this.listeners[ev] = fn },
  })
  const makeDoc = () => {
    const main = { classList: makeClassList() }
    const toggle = makeListenable()
    const hamburger = makeListenable()
    const sidebar = { querySelector: (sel) => sel === '.sidebar-toggle' ? toggle : null }
    const doc = {
      main, toggle, hamburger,
      querySelector: (sel) => ({
        '.sidebar': sidebar,
        'main': main,
        '.hamburger-menu input[type="checkbox"]': hamburger,
      })[sel] ?? null,
    }
    return doc
  }

  it('保存済みの開状態があれば開いた状態で復元される', () => {
    const doc = makeDoc()
    initSidebarToggle(doc, makeFakeStorage({ 'sidebar-is-open': 'true' }))
    assert.strictEqual(doc.main.classList.contains('sidebar-close'), false)
  })

  it('保存済みの状態がなければ閉じた状態になる', () => {
    const doc = makeDoc()
    initSidebarToggle(doc, makeFakeStorage())
    assert.strictEqual(doc.main.classList.contains('sidebar-close'), true)
  })

  it('トグルをクリックするたびに開閉が切り替わり、状態が保存される', () => {
    const doc = makeDoc()
    const storage = makeFakeStorage()
    initSidebarToggle(doc, storage)
    let prevented = false
    doc.toggle.listeners.click({ preventDefault: () => { prevented = true } })
    assert.strictEqual(prevented, true)
    assert.strictEqual(doc.main.classList.contains('sidebar-close'), false)
    assert.strictEqual(storage.getItem('sidebar-is-open'), 'true')
    doc.toggle.listeners.click({ preventDefault: () => {} })
    assert.strictEqual(doc.main.classList.contains('sidebar-close'), true)
    assert.strictEqual(storage.getItem('sidebar-is-open'), 'false')
  })

  it('ハンバーガーメニューの変更でも開閉が切り替わる', () => {
    const doc = makeDoc()
    initSidebarToggle(doc, makeFakeStorage())
    doc.hamburger.listeners.change()
    assert.strictEqual(doc.main.classList.contains('sidebar-close'), false)
    doc.hamburger.listeners.change()
    assert.strictEqual(doc.main.classList.contains('sidebar-close'), true)
  })
})
