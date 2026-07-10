import { initAutoPreview } from './autoPreviewInitializer.js'
import { initAutoSave } from './autoSaveInitializer.js'
import { matchTemplate, buildFrontmatterString, loadFrontmatterTemplate } from './frontmatter_template.js'
import { publishAvailability } from './publishAvailability.js'

// @vocab: テンプレートレゾルバー
// @test: tests/editor/editor-frontmatter-template.test.js
let _frontmatterTemplates = []
const initFrontmatterTemplate = async () => {
  try {
    const res = await fetch('/get_frontmatter_templates')
    if (res.ok) {
      const json = await res.json()
      _frontmatterTemplates = json.templates || []
    }
  } catch (e) {
    console.log('[frontmatter-template] 設定の取得に失敗しました', e)
  }
}

const fetchData = (target) => {
  return fetch(`/get_editor_target?md=${encodeURIComponent(target)}`)
    .then(async res => {
      if (!res.ok) {
        const baseName = target.split('/').pop().replace(/\.[^.]+$/, '')
        const initialContent = loadFrontmatterTemplate(target, _frontmatterTemplates)
          ?? `---\ntitle: ${baseName}\n---\n${baseName} についての記事を作成しましょう`
        document.querySelector('#editorTextArea').value = initialContent
        throw new Error(`${target} does not exist.`)
      } else {
        const json = await res.json()
        return json
      }
    })
}

const onloadFunction = async (e) => {
  const form = document.querySelector('#editor')
  const textarea = form.querySelector('#editorTextArea')
  const inputFileName = form.querySelector('#inputFileName')
  const currentFileName = document.querySelector('#currentFileName')
  const preview = document.querySelector('#previewContent')
  const url = new URL(location)
  const target = url.searchParams.get('md')

  const setCurrentFile = (filename) => {
    inputFileName.value = filename
    currentFileName.textContent = filename
  }

  if (target) {
    fetchData(target).then(json => {
      textarea.value = json.content
      setCurrentFile(json.filename)
      submit('/preview', form)
      fetchPublicationStatus(target)
    }).catch(e => {
      console.log('error!!!')
      console.log(e)
      setCurrentFile(target)
    })
  }

  const submit = (fetchUrl, form) => {
    const formData = new FormData(form)
    const obj = {}
    formData.forEach((v, k) => {
      obj[k] = v
    })
    return fetch(fetchUrl, {
      method: 'post',
      body: JSON.stringify(obj)
    }).then(async response => {
      const json = await response.json()
      if (!response.ok) {
        alert(json.message)
        return
      }
      if (json.preview) {
        const old = preview.querySelector('iframe')
        if (!old) {
          const iframe = document.createElement('iframe')
          iframe.setAttribute('srcdoc', json.preview)
          iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')
          preview.appendChild(iframe)
        } else {
          old.setAttribute('srcdoc', json.preview)
        }
      }
    }).catch(e => {
      console.log(e.message)
    })
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    publishWithFeedback(form)
  })

  const statusLabels = { new: '未公開', modified: '更新あり', published: '公開済み' }
  const applyPublishAvailability = (status) => {
    const btn = document.querySelector('#publishBtn')
    if (!btn) return
    const { disabled, label } = publishAvailability(status)
    btn.disabled = disabled
    btn.title = label ?? ''
  }
  const renderPublicationStatus = (statusEl, filePath, status) => {
    const { label } = publishAvailability(status)
    statusEl.textContent = label ?? (statusLabels[status] ? `(${statusLabels[status]})` : '')
    statusEl.dataset.status = status
    applyPublishAvailability(status)
    // サイドバーリンクの data-status も同期する
    const sidebarLink = document.querySelector(`.sidebar a[href="/editor?md=${encodeURIComponent(filePath)}"]`)
    if (sidebarLink) sidebarLink.dataset.status = status || ''
  }
  const fetchPublicationStatus = async (filePath) => {
    if (!filePath) return
    const statusEl = document.querySelector('#publicationStatus')
    if (!statusEl) return
    statusEl.textContent = ''
    statusEl.dataset.status = ''
    // ステータスが取得できないときは参照不能（unknown）と同等に扱い、公開ボタンを無効化する
    try {
      const res = await fetch(`/publication-status?md=${encodeURIComponent(filePath)}`)
      const status = res.ok ? (await res.json()).status : 'unknown'
      renderPublicationStatus(statusEl, filePath, status)
    } catch {
      renderPublicationStatus(statusEl, filePath, 'unknown')
    }
  }

  const publishWithFeedback = async (form) => {
    const feedback = document.querySelector('#publishFeedback')
    const btn = document.querySelector('#publishBtn')
    const filePath = form.querySelector('#inputFileName').value
    const fileContent = form.querySelector('textarea').value
    btn.disabled = true
    try {
      feedback.textContent = '公開中...'
      const publishRes = await fetch('/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, fileContent })
      })
      if (!publishRes.ok) {
        const json = await publishRes.json().catch(() => ({}))
        feedback.textContent = `公開失敗: ${json.error ?? 'サーバーに接続できませんでした'}`
        return
      }
      const json = await publishRes.json()
      feedback.textContent = json.success ? '公開しました' : `公開失敗: ${json.error ?? '不明なエラー'}`
      if (json.success) fetchPublicationStatus(filePath)
    } catch (e) {
      feedback.textContent = 'サーバーに接続できませんでした。しばらくしてからお試しください。'
    } finally {
      btn.disabled = false
    }
  }

  // @vocab: 自動保存
  // @vocab: 自動保存初期化器
  const autoSave = async () => {
    const filename = inputFileName.value
    if (!filename) return
    try {
      const res = await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: textarea.value })
      })
      if (!res.ok) {
        console.log('[auto-save] 保存に失敗しました', res.status)
        return
      }
      fetchPublicationStatus(filename)
    } catch (e) {
      console.log('[auto-save] ネットワークエラー', e)
    }
  }

  // @vocab: プレビュー自動更新器
  const debouncedUpdate = initAutoPreview(textarea, () => submit('/preview', form), 500)
  initAutoSave(textarea, autoSave, 500)
  initDropReceiver(textarea, () => inputFileName.value, () => submit('/preview', form), () => debouncedUpdate.cancel())

  // @vocab: 新規作成UI
  const newFileNameInput = document.querySelector('#newFileName')
  const newFileTemplateSelect = document.querySelector('#newFileTemplate')
  const newFileError = document.querySelector('#newFileError')
  const confirmNewFile = document.querySelector('#confirmNewFile')

  const refreshSidebar = () => initSidebarContent(inputFileName.value)

  // ファイル名入力に応じてテンプレートを auto-select
  newFileNameInput.addEventListener('input', () => {
    const filename = newFileNameInput.value
    const template = matchTemplate(filename, _frontmatterTemplates)
    newFileTemplateSelect.value = template ? template.path_prefix : ''
  })

  // F-01: Enter キーで確定
  newFileNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmNewFile.click()
    }
  })

  // F-02: 重複チェック付き作成。エラー時はタブを閉じない
  confirmNewFile.addEventListener('click', async () => {
    const filename = newFileNameInput.value.trim()
    if (!filename) return

    const selectedPrefix = newFileTemplateSelect.value
    const selectedTemplate = selectedPrefix
      ? _frontmatterTemplates.find(t => t.path_prefix === selectedPrefix)
      : null
    const baseName = filename.split('/').pop().replace(/\.[^.]+$/, '')
    const content = selectedTemplate
      ? buildFrontmatterString(selectedTemplate, baseName)
      : `---\ntitle: ${baseName}\n---\n`

    const res = await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content, createOnly: true })
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      newFileError.textContent = json.error ?? 'ファイルの作成に失敗しました'
      return
    }

    switchSidebarTab('files')
    textarea.value = content
    setCurrentFile(filename)
    url.searchParams.set('md', filename)
    history.pushState({}, '', url)
    submit('/preview', form)
    fetchPublicationStatus(filename)
    refreshSidebar()
  })

  // インプレースファイル読み込み
  // サイドバーリンクのクリックやブラウザ履歴移動で呼ばれる。
  // turbolink によるページ全体の差し替えではなく、エディタ状態をその場で更新することでちらつきを防ぐ。
  const loadFileInPlace = async (newTarget) => {
    // サイドバーのアクティブ状態を更新
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'))
    const activeLink = document.querySelector(`.sidebar a[href="/editor?md=${encodeURIComponent(newTarget)}"]`)
    if (activeLink) activeLink.classList.add('active')

    try {
      const json = await fetchData(newTarget)
      textarea.value = json.content
      setCurrentFile(json.filename)
      submit('/preview', form)
      fetchPublicationStatus(newTarget)
    } catch (e) {
      // ファイルが存在しない場合、fetchData 内でテキストエリアに初期内容を設定済み
      setCurrentFile(newTarget)
    }
  }

  // サイドバーのリンクをインターセプトしてインプレース読み込みに切り替える。
  // サイドバーは動的に生成されるため、個別リンクへのバインドではなく .sidebar へのデリゲーションで処理する。
  document.querySelector('.sidebar').addEventListener('click', async (e) => {
    const link = e.target.closest('a')
    if (!link) return
    let linkUrl
    try { linkUrl = new URL(link.href) } catch { return }
    if (linkUrl.pathname !== '/editor') return
    const newTarget = linkUrl.searchParams.get('md')
    if (!newTarget) return
    e.preventDefault()

    const currentTarget = inputFileName.value || url.searchParams.get('md')
    if (newTarget === currentTarget) return

    const newUrl = new URL(location)
    newUrl.searchParams.set('md', newTarget)
    history.pushState({}, '', newUrl)

    await loadFileInPlace(newTarget)
  })

  // ブラウザの戻る/進むに対応
  window.addEventListener('popstate', async () => {
    const newTarget = new URL(location).searchParams.get('md') || ''
    if (newTarget) {
      await loadFileInPlace(newTarget)
    }
  })
}

const SIDEBAR_OPEN_KEY = 'sidebar-is-open'
const DIR_OPEN_KEY = 'sidebar-dir-open'

// @vocab: 展開状態
// @test: tests/editor/editor-sidebar.test.js
const loadDirOpenState = () => {
  try {
    return JSON.parse(localStorage.getItem(DIR_OPEN_KEY) || '{}')
  } catch {
    return {}
  }
}

// @vocab: 展開状態
// @test: tests/editor/editor-sidebar.test.js
const saveDirOpenState = (state) => {
  localStorage.setItem(DIR_OPEN_KEY, JSON.stringify(state))
}

// @vocab: サイドバー
// @vocab: アクティブファイル
// @vocab: 展開状態
// @test: tests/editor/editor-sidebar.test.js
const initSidebarTree = (activeFile) => {
  const state = loadDirOpenState()

  // アクティブファイルの親ディレクトリを開いた状態にする
  if (activeFile) {
    const parts = activeFile.split('/')
    let path = ''
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]
      state[path] = true
    }
  }

  // localStorage の状態を <details> に反映し、toggle イベントで保存する
  document.querySelectorAll('.sidebar details[data-dir]').forEach(details => {
    const dir = details.dataset.dir
    if (state[dir]) {
      details.open = true
    }
    details.addEventListener('toggle', () => {
      const current = loadDirOpenState()
      current[dir] = details.open
      saveDirOpenState(current)
    })
  })

  // アクティブファイルに class="active" を付与（SSG では静的に付与できないため JS で補完）
  if (activeFile) {
    const link = document.querySelector(`.sidebar a[href="/editor?md=${encodeURIComponent(activeFile)}"]`)
    if (link) {
      link.classList.add('active')
    }
  }
}

// @vocab: サイドバー取得エンドポイント
const initSidebarContent = async (activeFile) => {
  try {
    const res = await fetch('/get_sidebar')
    if (!res.ok) return
    const { html } = await res.json()
    const sidebar = document.querySelector('.sidebar-files')
    sidebar.innerHTML = html
    initSidebarTree(activeFile)
  } catch (e) {
    console.log('[sidebar] init failed', e)
  }
}

// @vocab: サイドバータブ
let switchSidebarTab = () => {}
const initSidebarTabs = () => {
  const tabs = document.querySelectorAll('.sidebar-tab')
  const contents = document.querySelectorAll('.sidebar-tab-content')
  switchSidebarTab = (tabName) => {
    tabs.forEach(t => {
      const selected = t.dataset.tab === tabName
      t.classList.toggle('active', selected)
      t.setAttribute('aria-selected', String(selected))
      t.tabIndex = selected ? 0 : -1
    })
    contents.forEach(c => {
      const selected = c.dataset.tab === tabName
      c.classList.toggle('active', selected)
      c.toggleAttribute('hidden', !selected)
    })
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchSidebarTab(tab.dataset.tab)
      if (tab.dataset.tab === 'new-file') {
        const select = document.querySelector('#newFileTemplate')
        select.innerHTML = '<option value="">テンプレートなし</option>'
        for (const tmpl of _frontmatterTemplates) {
          const option = document.createElement('option')
          option.value = tmpl.path_prefix
          option.textContent = `テンプレート: ${tmpl.path_prefix}`
          select.appendChild(option)
        }
        document.querySelector('#newFileName').value = ''
        document.querySelector('#newFileError').textContent = ''
        document.querySelector('#newFileName').focus()
      }
    })
  })
}

// @vocab: サイドバー
// @test: tests/editor/editor-sidebar.test.js
const sidebarToggle = (e) => {
  const sidebar = document.querySelector('.sidebar')
  const main = document.querySelector('main')
  const toggle = sidebar.querySelector('.sidebar-toggle')
  toggle.addEventListener('click', (e) => {
    e.preventDefault()
    main.classList.toggle('sidebar-close')
    localStorage.setItem(SIDEBAR_OPEN_KEY, !main.classList.contains('sidebar-close'))
  })
  if (localStorage.getItem(SIDEBAR_OPEN_KEY) === 'true') {
    main.classList.remove('sidebar-close')
  } else {
    main.classList.add('sidebar-close')
  }
  const hamburger = document.querySelector('.hamburger-menu input[type="checkbox"]')
  hamburger.addEventListener('change', (e) => {
    main.classList.toggle('sidebar-close')
  })
}

// @vocab: 画像アップローダー
const uploadImage = async (file, mdFile) => {
  const buffer = await file.arrayBuffer()
  const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''))
  const res = await fetch('/upload-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageData: base64, imageFilename: file.name, mdFile })
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.markdownUrl
}

// @vocab: ドロップレシーバー
// @vocab: ドロップレシーバー拡張
const initDropReceiver = (textarea, getMdFile, onUpdate, cancelPendingDebounce) => {
  textarea.addEventListener('dragover', (e) => {
    e.preventDefault()
  })
  textarea.addEventListener('drop', async (e) => {
    e.preventDefault()
    if (cancelPendingDebounce) cancelPendingDebounce()
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
    let inserted = false
    for (const file of files) {
      const markdownUrl = await uploadImage(file, getMdFile())
      if (markdownUrl) {
        const start = textarea.selectionStart
        const content = textarea.value
        textarea.value = content.slice(0, start) + `![](${markdownUrl})` + content.slice(start)
        textarea.selectionStart = textarea.selectionEnd = start + `![](${markdownUrl})`.length
        inserted = true
      }
    }
    if (inserted && onUpdate) onUpdate()
  })
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const url = new URL(location)
  const activeFile = url.searchParams.get('md') || ''
  initSidebarTabs()
  await initSidebarContent(activeFile)
  await initFrontmatterTemplate()
  onloadFunction(event)
  sidebarToggle(event)
})
