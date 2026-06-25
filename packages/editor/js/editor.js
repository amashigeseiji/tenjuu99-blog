const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );

// @vocab: デバウンサー (plans/editor-realtime-preview/dictionary.md#デバウンサー)
// @test: tests/editor/auto-preview.test.js
const createDebounce = (fn, delay) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }
}

// @vocab: テンプレートマッチャー (docs/dictionary.md#テンプレートマッチャー)
// @test: tests/editor/editor-frontmatter-template.test.js
const matchTemplate = (filePath, templates) => {
  if (!filePath || !templates || templates.length === 0) return null
  let best = null
  for (const tmpl of templates) {
    if (filePath.startsWith(tmpl.path_prefix)) {
      if (!best || tmpl.path_prefix.length > best.path_prefix.length) {
        best = tmpl
      }
    }
  }
  return best
}

// @vocab: テンプレートインジェクター (docs/dictionary.md#テンプレートインジェクター)
// @test: tests/editor/editor-frontmatter-template.test.js
const buildFrontmatterString = (template, baseName) => {
  const fields = { ...template.fields }
  fields.title = baseName
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`)
  return `---\n${lines.join('\n')}\n---\n`
}

// @vocab: フロントマターテンプレートローダー (docs/dictionary.md#フロントマターテンプレートローダー)
// @test: tests/editor/editor-frontmatter-template.test.js
const loadFrontmatterTemplate = (filePath, templates) => {
  const matched = matchTemplate(filePath, templates)
  if (!matched) return null
  const baseName = filePath.split('/').pop().replace(/\.[^.]+$/, '')
  return buildFrontmatterString(matched, baseName)
}

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
        document.querySelector('#inputFileName').value = target
        const baseName = target.split('/').pop().replace(/\.[^.]+$/, '')
        const initialContent = loadFrontmatterTemplate(target, _frontmatterTemplates)
          ?? `---\ntitle: ${baseName}\n---\n${baseName} についての記事を作成しましょう`
        document.querySelector('#editorTextArea').value = initialContent
        // submit('/preview', form)
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
  const select = form.querySelector('#selectDataFile')
  const inputFileName = form.querySelector('#inputFileName')
  const preview = document.querySelector('#previewContent')
  const url = new URL(location)
  const target = url.searchParams.get('md')
  if (target) {
    fetchData(target).then(json => {
      textarea.value = json.content
      select.value = json.filename
      inputFileName.value = json.filename
      inputFileName.setAttribute('disabled', true)
      submit('/preview', form)
    }).catch(e => {
      console.log('error!!!')
      console.log(e)
    })
  }
  select.addEventListener('change', async (event) => {
    if (select.value) {
      const json = await fetchData(select.value)
      textarea.value = json.content
      inputFileName.value = json.filename
      inputFileName.setAttribute('disabled', true)
      url.searchParams.set('md', select.value)
      submit('/preview', form)
    } else {
      inputFileName.value = ""
      inputFileName.removeAttribute('disabled')
      textarea.value = ''
      url.searchParams.set('md', "")
      const iframe = preview.querySelector('iframe')
      if (iframe) {
        iframe.srcdoc = ''
      }
    }
    history.pushState({}, "", url)
  })

  inputFileName.addEventListener('blur', async () => {
    if (inputFileName.value && !select.value) {
      fetchData(inputFileName.value).catch(() => {})
    }
  })

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
        const iframe = document.createElement('iframe')
        iframe.setAttribute('srcdoc', json.preview)
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')
        const old = preview.querySelector('iframe')
        if (!old) {
          preview.appendChild(iframe)
        }
        old.setAttribute('srcdoc', json.preview)
      }
    }).catch(e => {
      console.log(e.message)
    })
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fetchUrl = event.submitter.dataset.url
    submit(fetchUrl, event.target)
  })

  // @vocab: プレビュー自動更新器 (plans/editor-realtime-preview/dictionary.md#プレビュー自動更新器)
  textarea.addEventListener('input', createDebounce(() => submit('/preview', form), 500))
  initDropReceiver(textarea, () => inputFileName.value, () => submit('/preview', form))
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
const initDropReceiver = (textarea, getMdFile, onUpdate) => {
  textarea.addEventListener('dragover', (e) => {
    e.preventDefault()
  })
  textarea.addEventListener('drop', async (e) => {
    e.preventDefault()
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
    for (const file of files) {
      const markdownUrl = await uploadImage(file, getMdFile())
      if (markdownUrl) {
        const start = textarea.selectionStart
        const content = textarea.value
        textarea.value = content.slice(0, start) + `![](${markdownUrl})` + content.slice(start)
        textarea.selectionStart = textarea.selectionEnd = start + `![](${markdownUrl})`.length
      }
    }
    if (onUpdate) onUpdate()
  })
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const url = new URL(location)
  const activeFile = url.searchParams.get('md') || ''
  await initFrontmatterTemplate()
  onloadFunction(event)
  sidebarToggle(event)
  initSidebarTree(activeFile)
})
