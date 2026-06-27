import { initAutoPreview } from './autoPreviewInitializer.js'
import { initAutoSave } from './autoSaveInitializer.js'
import { matchTemplate, buildFrontmatterString, loadFrontmatterTemplate } from './frontmatter_template.js'

const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );

// @vocab: テンプレートレゾルバー (docs/dictionary.md#テンプレートレゾルバー)
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
      if (json.href) {
        await sleep(300)
        location.href = json.href
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
  const fetchPublicationStatus = async (filePath) => {
    if (!filePath) return
    const statusEl = document.querySelector('#publicationStatus')
    if (!statusEl) return
    statusEl.textContent = ''
    statusEl.dataset.status = ''
    try {
      const res = await fetch(`/publication-status?md=${encodeURIComponent(filePath)}`)
      if (!res.ok) { statusEl.textContent = ''; return }
      const { status } = await res.json()
      const label = statusLabels[status]
      statusEl.textContent = label ? `(${label})` : ''
      statusEl.dataset.status = status
    } catch {
      statusEl.textContent = ''
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

  // @vocab: 自動保存 (plans/editor-ui-cleanup/dictionary.md#自動保存)
  // @vocab: 自動保存初期化器 (plans/editor-ui-cleanup/dictionary.md#自動保存初期化器)
  const autoSave = async () => {
    const filename = inputFileName.value
    if (!filename) return
    await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: textarea.value })
    })
  }

  // @vocab: プレビュー自動更新器 (plans/editor-realtime-preview/dictionary.md#プレビュー自動更新器)
  const debouncedUpdate = initAutoPreview(textarea, () => submit('/preview', form), 500)
  initAutoSave(textarea, autoSave, 500)
  initDropReceiver(textarea, () => inputFileName.value, () => submit('/preview', form), () => debouncedUpdate.cancel())

  // @vocab: 新規作成UI (plans/editor-ui-cleanup/dictionary.md#新規作成UI)
  const newFileBtn = document.querySelector('#newFileBtn')
  const newFileDialog = document.querySelector('#newFileDialog')
  const newFileNameInput = document.querySelector('#newFileName')
  const newFileTemplateSelect = document.querySelector('#newFileTemplate')
  const newFileError = document.querySelector('#newFileError')
  const confirmNewFile = document.querySelector('#confirmNewFile')
  const cancelNewFile = document.querySelector('#cancelNewFile')

  // @vocab: 作成後にサイドバーを更新できる (plans/editor-ui-cleanup/dictionary.md#サイドバー取得エンドポイント)
  const refreshSidebar = () => initSidebarContent(inputFileName.value)

  newFileBtn.addEventListener('click', () => {
    newFileNameInput.value = ''
    newFileError.textContent = ''
    // テンプレート選択肢を再構築して auto-select をリセット
    newFileTemplateSelect.innerHTML = '<option value="">テンプレートなし</option>'
    for (const tmpl of _frontmatterTemplates) {
      const option = document.createElement('option')
      option.value = tmpl.path_prefix
      option.textContent = `テンプレート: ${tmpl.path_prefix}`
      newFileTemplateSelect.appendChild(option)
    }
    newFileTemplateSelect.value = ''
    newFileDialog.showModal()
  })

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

  // F-02: 重複チェック付き作成。エラー時はダイアログを閉じない
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

    newFileDialog.close()
    textarea.value = content
    setCurrentFile(filename)
    url.searchParams.set('md', filename)
    history.pushState({}, '', url)
    submit('/preview', form)
    fetchPublicationStatus(filename)
    refreshSidebar()
  })

  cancelNewFile.addEventListener('click', () => newFileDialog.close())
}

const SIDEBAR_OPEN_KEY = 'sidebar-is-open'
const DIR_OPEN_KEY = 'sidebar-dir-open'

// @vocab: 展開状態 (docs/dictionary.md#展開状態)
// @test: tests/editor/editor-sidebar.test.js
const loadDirOpenState = () => {
  try {
    return JSON.parse(localStorage.getItem(DIR_OPEN_KEY) || '{}')
  } catch {
    return {}
  }
}

// @vocab: 展開状態 (docs/dictionary.md#展開状態)
// @test: tests/editor/editor-sidebar.test.js
const saveDirOpenState = (state) => {
  localStorage.setItem(DIR_OPEN_KEY, JSON.stringify(state))
}

// @vocab: サイドバー (docs/dictionary.md#サイドバー)
// @vocab: アクティブファイル (docs/dictionary.md#アクティブファイル)
// @vocab: 展開状態 (docs/dictionary.md#展開状態)
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
    const link = document.querySelector(`.sidebar a[href="/editor?md=${CSS.escape(activeFile)}"]`)
    if (link) {
      link.classList.add('active')
    }
  }
}

// @vocab: サイドバー取得エンドポイント (plans/editor-ui-cleanup/dictionary.md#サイドバー取得エンドポイント)
const initSidebarContent = async (activeFile) => {
  try {
    const res = await fetch('/get_sidebar')
    if (!res.ok) return
    const { html } = await res.json()
    const sidebar = document.querySelector('.sidebar')
    const toggle = sidebar.querySelector('.sidebar-toggle')
    sidebar.innerHTML = html
    sidebar.appendChild(toggle)
    initSidebarTree(activeFile)
  } catch (e) {
    console.log('[sidebar] init failed', e)
  }
}

// @vocab: サイドバー (docs/dictionary.md#サイドバー)
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

// @vocab: 画像アップローダー (docs/dictionary.md#画像アップローダー)
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

// @vocab: ドロップレシーバー (docs/dictionary.md#ドロップレシーバー)
// @vocab: ドロップ後更新 (plans/editor-realtime-preview/dictionary.md#ドロップレシーバー拡張)
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
  await initSidebarContent(activeFile)
  await initFrontmatterTemplate()
  onloadFunction(event)
  sidebarToggle(event)
})
