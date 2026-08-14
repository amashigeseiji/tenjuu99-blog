const SIDEBAR_OPEN_KEY = 'sidebar-is-open'
const DIR_OPEN_KEY = 'sidebar-dir-open'

/**
 * @vocab 展開状態
 * @test tests/editor/editor-sidebar.test.js
 * @param {Pick<Storage, 'getItem'>} [storage]
 * @returns {Record<string, boolean>}
 */
export const loadDirOpenState = (storage = localStorage) => {
  try {
    return JSON.parse(storage.getItem(DIR_OPEN_KEY) || '{}')
  } catch {
    return {}
  }
}

/**
 * @vocab 展開状態
 * @test tests/editor/editor-sidebar.test.js
 * @param {Record<string, boolean>} state
 * @param {Pick<Storage, 'setItem'>} [storage]
 */
export const saveDirOpenState = (state, storage = localStorage) => {
  storage.setItem(DIR_OPEN_KEY, JSON.stringify(state))
}

/**
 * @vocab サイドバー
 * @vocab アクティブファイル
 * @vocab 展開状態
 * @test tests/editor/editor-sidebar.test.js
 * 保存済みの展開状態をツリーの <details> に反映し、toggle のたびに保存する。
 * アクティブファイルの親ディレクトリは開いた状態にし、アクティブ表示の付与は
 * #アクティブ状態同期器 に委ねる（SSG では静的に付与できないため JS で補完する）。
 * @param {string} activeFile
 * @param {{ doc?: Document, storage?: Storage,
 *           syncActive?: (target: { type: string, path: string }) => void }} [options]
 */
export const initSidebarTree = (activeFile, { doc = document, storage = localStorage, syncActive } = {}) => {
  const state = loadDirOpenState(storage)

  if (activeFile) {
    const parts = activeFile.split('/')
    let path = ''
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]
      state[path] = true
    }
  }

  doc.querySelectorAll('.sidebar details[data-dir]').forEach(details => {
    const dir = details.dataset.dir
    if (state[dir]) {
      details.open = true
    }
    details.addEventListener('toggle', () => {
      const current = loadDirOpenState(storage)
      current[dir] = details.open
      saveDirOpenState(current, storage)
    })
  })

  if (activeFile && syncActive) syncActive({ type: 'article', path: activeFile })
}

/**
 * @vocab サイドバー
 * @test tests/editor/editor-sidebar.test.js
 * #サイドバー取得エンドポイント からツリーのHTMLを取得して差し替え、ツリーを初期化する。
 * @param {string} activeFile
 * @param {{ doc?: Document, storage?: Storage,
 *           syncActive?: (target: { type: string, path: string }) => void,
 *           fetchFn?: typeof fetch }} [options]
 */
export const initSidebarContent = async (activeFile, { doc = document, storage = localStorage, syncActive, fetchFn = (...a) => fetch(...a) } = {}) => {
  try {
    const res = await fetchFn('/get_sidebar')
    if (!res.ok) return
    const { html } = await res.json()
    doc.querySelector('.sidebar-files').innerHTML = html
    initSidebarTree(activeFile, { doc, storage, syncActive })
  } catch (e) {
    console.log('[sidebar] init failed', e)
  }
}

/**
 * @vocab サイドバー
 * @test tests/editor/editor-sidebar.test.js
 * サイドバーの開閉トグルとハンバーガーメニューを配線し、開閉状態を保存・復元する。
 * @param {Document} [doc]
 * @param {Storage} [storage]
 */
export const initSidebarToggle = (doc = document, storage = localStorage) => {
  const sidebar = doc.querySelector('.sidebar')
  const main = doc.querySelector('main')
  const toggle = sidebar.querySelector('.sidebar-toggle')
  toggle.addEventListener('click', (e) => {
    e.preventDefault()
    main.classList.toggle('sidebar-close')
    storage.setItem(SIDEBAR_OPEN_KEY, !main.classList.contains('sidebar-close'))
  })
  if (storage.getItem(SIDEBAR_OPEN_KEY) === 'true') {
    main.classList.remove('sidebar-close')
  } else {
    main.classList.add('sidebar-close')
  }
  const hamburger = doc.querySelector('.hamburger-menu input[type="checkbox"]')
  hamburger.addEventListener('change', () => {
    main.classList.toggle('sidebar-close')
  })
}
