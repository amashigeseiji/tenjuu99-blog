import { initAutoPreview } from './autoPreviewInitializer.js'
import { initAutoSave } from './autoSaveInitializer.js'
import { matchTemplate, buildFrontmatterString, loadFrontmatterTemplate } from './frontmatter_template.js'
import { publishAvailability, resolveOperations } from './publishAvailability.js'
import { labelFor } from './publicationStatusLabel.js'
import { renderImageList } from './imageListDisplay.js'
import { renderRemoteOnlyImages } from './remoteOnlyImageDisplay.js'
import { resolveDisplayTarget } from './displayTargetResolver.js'
import { showImageDetail, renderReferencingArticles } from './imageDetailDisplay.js'
import { initImageDelete } from './imageDeleteUI.js'
import { initImageMove } from './imageMoveUI.js'
import { initImageDeclaration } from './imageDeclarationUI.js'
import { initInlineFileNameEdit } from './inlineFileNameEditUI.js'

// @vocab: 確認ダイアログ
// WKWebView は window.confirm() に応答しない（WKUIDelegate 未実装のため無反応になる）ので、
// <dialog> による自前実装で置き換える。ブラウザでもネイティブアプリでも同じ見た目で動く。
const confirmDialogEl = document.querySelector('#confirmDialog')
const confirmDialogMessage = document.querySelector('#confirmDialogMessage')
const confirmDialogActions = document.querySelector('#confirmDialogActions')
const showConfirm = (message, choices = [{ label: 'OK', value: true }, { label: 'キャンセル', value: false }]) => {
  return new Promise((resolve) => {
    confirmDialogMessage.textContent = message
    confirmDialogActions.innerHTML = ''
    let settled = false
    const settle = (value) => {
      if (settled) return
      settled = true
      confirmDialogEl.close()
      resolve(value)
    }
    choices.forEach(choice => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = choice.label
      if (choice.value === null) btn.classList.add('confirm-dialog-cancel')
      btn.addEventListener('click', () => settle(choice.value))
      confirmDialogActions.appendChild(btn)
    })
    confirmDialogEl.addEventListener('cancel', () => settle(false), { once: true })
    confirmDialogEl.showModal()
  })
}

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

  // @vocab: 公開可否判定器
  // 記事の状態に応じて、公開・非公開・削除の各操作の提供を切り替える
  const applyPublishAvailability = (status) => {
    const btn = document.querySelector('#publishBtn')
    const unpublishBtn = document.querySelector('#unpublishBtn')
    const deleteBtn = document.querySelector('#deleteBtn')
    const ops = resolveOperations(status)
    if (btn) {
      const { disabled, label } = publishAvailability(status)
      btn.disabled = disabled || !ops.publish
      btn.title = label ?? ''
    }
    // 非公開・削除はどちらか一方を必ず表示する（既定は非公開にする）
    if (deleteBtn) deleteBtn.hidden = !ops.delete
    if (unpublishBtn) {
      unpublishBtn.hidden = !!ops.delete
      unpublishBtn.disabled = !ops.unpublish
    }
  }
  const renderPublicationStatus = (statusEl, filePath, status) => {
    const { label } = publishAvailability(status)
    const statusLabel = labelFor(status)
    statusEl.textContent = label ?? (statusLabel ? `(${statusLabel})` : '')
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
    const feedback = document.querySelector('#operationFeedback')
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
      feedback.textContent = json.success
        ? `公開しました${json.warning ? `（${json.warning}）` : ''}`
        : `公開失敗: ${json.error ?? '不明なエラー'}`
      if (json.success) fetchPublicationStatus(filePath)
    } catch (e) {
      feedback.textContent = 'サーバーに接続できませんでした。しばらくしてからお試しください。'
    } finally {
      btn.disabled = false
    }
  }

  // @vocab: 非公開にする
  // リモートから取り除く。原稿は手元に残るため確認なしで実行できる（再公開で戻せる）
  const unpublishWithFeedback = async () => {
    const feedback = document.querySelector('#operationFeedback')
    const filePath = inputFileName.value
    if (!filePath) return
    feedback.textContent = '非公開にしています...'
    try {
      const res = await fetch('/unpublish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      })
      const json = await res.json().catch(() => ({}))
      feedback.textContent = json.success
        ? `非公開にしました${json.warning ? `（${json.warning}）` : ''}`
        : `非公開にできませんでした: ${json.error ?? '不明なエラー'}`
      if (json.success) {
        fetchPublicationStatus(filePath)
        refreshSidebar()
      }
    } catch {
      feedback.textContent = 'サーバーに接続できませんでした。しばらくしてからお試しください。'
    }
  }
  document.querySelector('#unpublishBtn')?.addEventListener('click', unpublishWithFeedback)

  // @vocab: 削除する
  // 手元から取り除く不可逆の操作のため、実行前に確認する
  const deleteWithFeedback = async () => {
    const feedback = document.querySelector('#operationFeedback')
    const filePath = inputFileName.value
    if (!filePath) return
    if (!(await showConfirm(`「${filePath}」を手元から削除します。よろしいですか？`))) return
    try {
      const res = await fetch('/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      })
      const json = await res.json().catch(() => ({}))
      if (!json.success) {
        feedback.textContent = `削除できませんでした: ${json.error ?? '不明なエラー'}`
        return
      }
      feedback.textContent = '削除しました'
      textarea.value = ''
      setCurrentFile('')
      url.searchParams.delete('md')
      history.pushState({}, '', url)
      const statusEl = document.querySelector('#publicationStatus')
      if (statusEl) {
        statusEl.textContent = ''
        statusEl.dataset.status = ''
      }
      applyPublishAvailability('')
      refreshSidebar()
    } catch {
      feedback.textContent = 'サーバーに接続できませんでした。しばらくしてからお試しください。'
    }
  }
  document.querySelector('#deleteBtn')?.addEventListener('click', deleteWithFeedback)

  // @vocab: 自動保存
  // @vocab: 自動保存初期化器
  // @test: tests/editor/editor-ui-cleanup.test.js
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
  // @test: tests/editor/editor-ui-cleanup.test.js
  // @test: tests/editor/editor-image-upload.test.js
  const newFileNameInput = document.querySelector('#newFileName')
  const newFileTemplateSelect = document.querySelector('#newFileTemplate')
  const newFileImageInput = document.querySelector('#newFileImage')
  const newFileError = document.querySelector('#newFileError')
  const confirmNewFile = document.querySelector('#confirmNewFile')

  const refreshSidebar = () => initSidebarContent(inputFileName.value)

  // 画像ファイルの選択有無がモードを決める: 選択済みなら画像追加（ファイル名入力は image/ 相対の配置パス）、
  // 未選択なら従来どおり記事作成（src/pages/ 相対）
  newFileImageInput.addEventListener('change', () => {
    const file = newFileImageInput.files[0]
    if (file) {
      newFileNameInput.value = file.name
      newFileTemplateSelect.value = ''
      newFileTemplateSelect.disabled = true
    } else {
      newFileTemplateSelect.disabled = false
    }
  })

  // ファイル名入力に応じてテンプレートを auto-select
  newFileNameInput.addEventListener('input', () => {
    if (newFileImageInput.files[0]) return
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

    // 画像モード: 記事作成ではなく画像ライブラリへの追加として扱う
    const imageFile = newFileImageInput.files[0]
    if (imageFile) {
      const result = await addLibraryImage(imageFile, filename)
      if (!result.ok) {
        newFileError.textContent = result.message ?? '画像の追加に失敗しました'
        return
      }
      newFileImageInput.value = ''
      newFileTemplateSelect.disabled = false
      // 追加した画像を表示対象にする（画像リンククリックと同じその場の資源切り替え）
      const newUrl = new URL(location)
      newUrl.searchParams.delete('md')
      newUrl.searchParams.set('image', result.imagePath)
      history.pushState({}, '', newUrl)
      switchSidebarTab('images')
      await initImageLibrary()
      openImageDetail(result.imagePath)
      return
    }

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

    closeImageDetail()
    switchSidebarTab('files')
    textarea.value = content
    setCurrentFile(filename)
    url.searchParams.set('md', filename)
    url.searchParams.delete('image')
    history.pushState({}, '', url)
    submit('/preview', form)
    fetchPublicationStatus(filename)
    refreshSidebar()
  })

  // インプレースファイル読み込み
  // サイドバーリンクのクリックやブラウザ履歴移動で呼ばれる。
  // turbolink によるページ全体の差し替えではなく、エディタ状態をその場で更新することでちらつきを防ぐ。
  const loadFileInPlace = async (newTarget) => {
    closeImageDetail()
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
  // 画像削除UI・画像改名UIが「参照も更新」を選んだ後、開いている記事をサーバー側の最新内容に揃えるために使う
  reloadCurrentArticle = async () => {
    if (inputFileName.value) await loadFileInPlace(inputFileName.value)
  }

  // @vocab: 取り込む
  // リモートの内容を手元に取り込む。見送られた記事はその理由を表示する
  const pullBtn = document.querySelector('#pullBtn')
  const pullFeedback = document.querySelector('#operationFeedback')
  const pullWithFeedback = async () => {
    if (!pullBtn) return
    pullBtn.disabled = true
    pullFeedback.textContent = '取り込んでいます...'
    try {
      const res = await fetch('/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        pullFeedback.textContent = `取り込めませんでした: ${json.error ?? 'サーバーに接続できませんでした'}`
        return
      }
      const lines = [json.applied.length ? `${json.applied.length}件を取り込みました` : '新しく取り込むものはありませんでした']
      for (const s of json.skipped ?? []) {
        lines.push(`見送り: ${s.file.split('/').pop()} — ${s.reason}`)
      }
      pullFeedback.textContent = lines.join(' ／ ')
      refreshSidebar()
      // 開いている記事が取り込みで更新されたときは、開き直して最新にする
      const current = inputFileName.value
      if (current && json.applied.some(p => p.endsWith(`/pages/${current}`))) {
        await loadFileInPlace(current)
      }
    } catch {
      pullFeedback.textContent = 'サーバーに接続できませんでした。しばらくしてからお試しください。'
    } finally {
      pullBtn.disabled = false
    }
  }
  pullBtn?.addEventListener('click', pullWithFeedback)
  // 初期 disabled はハンドラー登録前の空クリックを防ぐため。登録できたここで操作可能にする
  if (pullBtn) pullBtn.disabled = false

  // サイドバーのリンクをインターセプトしてインプレース読み込みに切り替える。
  // サイドバーは動的に生成されるため、個別リンクへのバインドではなく .sidebar へのデリゲーションで処理する。
  document.querySelector('.sidebar').addEventListener('click', async (e) => {
    const link = e.target.closest('a')
    if (!link) return
    let linkUrl
    try { linkUrl = new URL(link.href) } catch { return }
    if (linkUrl.pathname !== '/editor') return

    // 画像リンク: 記事リンクと同じその場の資源切り替えとして扱う（URLも遷移する）
    const linkTarget = resolveDisplayTarget(linkUrl)
    if (linkTarget?.type === 'image') {
      e.preventDefault()
      if (_currentImageDetailEntry?.path === linkTarget.path) return
      const newUrl = new URL(location)
      newUrl.searchParams.delete('md')
      newUrl.searchParams.set('image', linkTarget.path)
      history.pushState({}, '', newUrl)
      openImageDetail(linkTarget.path)
      return
    }

    const newTarget = linkUrl.searchParams.get('md')
    if (!newTarget) return
    e.preventDefault()

    // リモートのみの記事は手元に無いため開けない。取り込むか、サイトから取り除くかを選べる
    if (link.dataset.status === 'remote-only') {
      const choice = await showConfirm(`「${newTarget}」はまだ手元にありません。`, [
        { label: 'リモートから取り込む', value: 'pull' },
        { label: '取り除く（手元には取り込みません）', value: 'remove' },
        { label: 'キャンセル', value: null }
      ])
      if (choice === 'pull') {
        await pullWithFeedback()
      } else if (choice === 'remove') {
        try {
          const res = await fetch('/unpublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: newTarget })
          })
          const json = await res.json().catch(() => ({}))
          pullFeedback.textContent = json.success ? `「${newTarget}」をサイトから取り除きました` : `取り除けませんでした: ${json.error ?? '不明なエラー'}`
          if (json.success) refreshSidebar()
        } catch {
          pullFeedback.textContent = 'サーバーに接続できませんでした。しばらくしてからお試しください。'
        }
      }
      return
    }

    const currentTarget = inputFileName.value || url.searchParams.get('md')
    // 画像詳細を表示中は、同じ記事へのリンクでも記事表示への切り替えとして扱う
    if (newTarget === currentTarget && !_currentImageDetailEntry) return

    const newUrl = new URL(location)
    newUrl.searchParams.set('md', newTarget)
    newUrl.searchParams.delete('image')
    history.pushState({}, '', newUrl)

    await loadFileInPlace(newTarget)
  })

  // ブラウザの戻る/進むに対応: URLから表示対象を再構成する
  window.addEventListener('popstate', async () => {
    const target = resolveDisplayTarget(new URL(location))
    if (target?.type === 'image') {
      switchSidebarTab('images')
      if (!_imageLibraryEntries.some(en => en.path === target.path)) await initImageLibrary()
      openImageDetail(target.path)
    } else if (target?.type === 'article') {
      await loadFileInPlace(target.path)
    } else {
      closeImageDetail()
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
// 画像削除UI・画像改名UIから、開いている記事の再読み込みをトリガーするために公開する
let reloadCurrentArticle = async () => {}
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
      if (tab.dataset.tab === 'images') {
        initImageLibrary()
      } else {
        leaveImageDetail()
      }
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
        document.querySelector('#newFileImage').value = ''
        select.disabled = false
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
// @test: tests/editor/editor-image-upload.test.js
// 記事に紐づかない追加（画像ライブラリからの追加）。mdFile を送らず、
// 配置パス（image/ 相対・ディレクトリ階層可）を imageFilename として送る
const addLibraryImage = async (file, destPath) => {
  const buffer = await file.arrayBuffer()
  const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''))
  const res = await fetch('/upload-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageData: base64, imageFilename: destPath })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, message: json.message }
  return { ok: true, imagePath: json.imagePath }
}

// @vocab: 画像アップローダー
// @test: tests/editor/editor-image-upload.test.js
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
// @test: tests/editor/editor-image-upload.test.js
// @test: tests/editor/auto-preview.test.js
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

// @vocab: 画像ライブラリ
// #画像リストコレクター の結果を一度だけ取得し、リスト表示・詳細表示の両方がこの結果を参照する
// （個別画像の詳細表示のために追加のサーバーリクエストは発生しない）。
let _imageLibraryEntries = []
const initImageLibrary = async () => {
  const container = document.querySelector('.sidebar-images')
  const remoteOnlyContainer = document.querySelector('.sidebar-remote-only-images')
  if (!container) return
  try {
    const res = await fetch('/get_image_library')
    if (!res.ok) throw new Error(`unexpected status: ${res.status}`)
    const json = await res.json()
    _imageLibraryEntries = json.images || []
    // 選択中の画像はURLから導出する（表示はURLから再構成される）
    const target = resolveDisplayTarget(new URL(location))
    renderImageList(container, _imageLibraryEntries, target?.type === 'image' ? target.path : '')
    // ローカルに実体がない画像はツリーに混ぜず、別枠に出す
    if (remoteOnlyContainer) {
      renderRemoteOnlyImages(remoteOnlyContainer, json.remoteOnly || [])
      wireRemoteOnlyImageRemoval(remoteOnlyContainer)
    }
    // 開いている詳細は取得前のエントリで描かれているため、再取得が届いた時点で描き直す
    // （公開ステータスはリモートへの問い合わせを伴い、一覧より遅れて確定する）。
    // ファイル名を編集中のときは入力を捨てないよう、そのままにする。
    const openDetailPath = _currentImageDetailEntry?.path
    const editing = document.querySelector('#imageDetailPanel .image-detail-filename-form:not([hidden])')
    if (openDetailPath && !editing && _imageLibraryEntries.some(e => e.path === openDetailPath)) {
      openImageDetail(openDetailPath)
    }
  } catch (e) {
    _imageLibraryEntries = []
    container.innerHTML = '<p class="image-library-error">画像一覧を取得できませんでした</p>'
    if (remoteOnlyContainer) remoteOnlyContainer.innerHTML = ''
  }
}

// @vocab: リモートのみ画像表示
// 別枠の各画像に付いた「取り除く」操作を #画像除去エンドポイント につなぐ。
// 一覧は描画のたびに作り直されるため、配線もそのたびにやり直す。
const wireRemoteOnlyImageRemoval = (container) => {
  container.querySelectorAll('.remote-only-image-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const imagePath = btn.dataset.imagePath
      const confirmed = await showConfirm(
        `${imagePath} を公開先から取り除きます。手元にファイルはないため、元に戻せません。`,
        [{ label: '取り除く', value: true }, { label: '中止', value: null }]
      )
      if (confirmed !== true) return
      btn.disabled = true
      setImageOperationFeedback('取り除いています...')
      try {
        const res = await fetch('/remove_remote_image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagePath }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) {
          setImageOperationFeedback(`取り除けませんでした: ${json.error ?? 'サーバーに接続できませんでした'}`)
          btn.disabled = false
          return
        }
        setImageOperationFeedback(`${imagePath} を取り除きました`)
        await initImageLibrary()
      } catch (e) {
        setImageOperationFeedback(`取り除けませんでした: ${e.message}`)
        btn.disabled = false
      }
    })
  })
}

// @vocab: 画像詳細表示
// 記事編集画面のヘッダー（editor-options）を流用する: 左側にファイルパスのかわりに画像パスを表示する。
// 操作（ファイル名変更・公開状態確認・検出外参照宣言・削除）はヘッダーではなく、
// showImageDetail が描画するメタデータ欄にまとめて表示する（成層ツリー実験フェーズ F-03）。
let _currentImageDetailEntry = null
const openImageDetail = (imagePath) => {
  const entry = _imageLibraryEntries.find(e => e.path === imagePath)
  const panel = document.querySelector('#imageDetailPanel')
  if (!entry || !panel) return
  _currentImageDetailEntry = entry
  // サイドバーのアクティブ状態を更新（Filesタブと同じ href マッチング）
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'))
  const activeLink = document.querySelector(`.sidebar a[href="/editor?image=${encodeURIComponent(imagePath)}"]`)
  if (activeLink) activeLink.classList.add('active')
  showImageDetail(panel, entry)
  panel.hidden = false
  document.querySelector('.textareaAndPreview')?.setAttribute('hidden', '')
  document.querySelector('#fileStatus')?.setAttribute('hidden', '')
  document.querySelector('#articleOptionsRight')?.setAttribute('hidden', '')
  const declarationToggle = panel.querySelector('.image-detail-declaration-toggle')
  if (declarationToggle) declarationToggle.checked = !!entry.declared
  const imageFileNameEl = document.querySelector('#imageDetailFileName')
  if (imageFileNameEl) {
    imageFileNameEl.textContent = entry.path
    imageFileNameEl.hidden = false
  }
  // メタデータ欄はshowImageDetailのたびに作り直されるため、操作の配線もそのたびにやり直す
  wireImageDetailOperations(panel)
  // 参照記事一覧は画像1件ごとにgit問い合わせを伴うため、一覧取得時ではなく選択時に個別取得する
  fetch(`/get_image_references?imagePath=${encodeURIComponent(entry.path)}`)
    .then(res => res.json())
    .then(json => {
      // 取得中に別の画像へ選択が切り替わっていたら、古い結果は反映しない
      if (_currentImageDetailEntry?.path !== entry.path) return
      renderReferencingArticles(panel, json.articles || [])
    })
    .catch(() => {})
}

const closeImageDetail = () => {
  _currentImageDetailEntry = null
  document.querySelector('#imageDetailPanel')?.setAttribute('hidden', '')
  document.querySelector('.textareaAndPreview')?.removeAttribute('hidden')
  document.querySelector('#fileStatus')?.removeAttribute('hidden')
  document.querySelector('#articleOptionsRight')?.removeAttribute('hidden')
  document.querySelector('#imageDetailFileName')?.setAttribute('hidden', '')
}

// 画像詳細から離れる: 表示を閉じたうえで、URLから画像の特定を取り除き、
// 開いていた記事があればその記事を特定するURLに戻す（URLと表示の一致を保つ）
const leaveImageDetail = () => {
  if (!_currentImageDetailEntry) return
  closeImageDetail()
  const newUrl = new URL(location)
  if (!newUrl.searchParams.get('image')) return
  newUrl.searchParams.delete('image')
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'))
  const currentArticle = document.querySelector('#inputFileName')?.value
  if (currentArticle) {
    newUrl.searchParams.set('md', currentArticle)
    const link = document.querySelector(`.sidebar a[href="/editor?md=${encodeURIComponent(currentArticle)}"]`)
    if (link) link.classList.add('active')
  }
  history.pushState({}, '', newUrl)
}

// @vocab: 画像削除UI
// @vocab: 画像移動UI
const setImageOperationFeedback = (message) => {
  const feedback = document.querySelector('#operationFeedback')
  if (feedback) feedback.textContent = message
}

// 画像詳細のメタデータ欄（ファイル名編集・公開状態・検出外参照宣言・削除）は
// showImageDetail のたびに作り直されるため、要素への配線もそのたびにここから呼び直す。
const wireImageDetailOperations = (panel) => {
  initInlineFileNameEdit(panel, () => _currentImageDetailEntry)
  initImageDelete(
    panel.querySelector('.image-detail-delete-btn'),
    () => _currentImageDetailEntry,
    showConfirm,
    setImageOperationFeedback,
    async (deletedPath, referenceHandling) => {
      // 削除された画像はもう表示対象にならないため、URLからも取り除く
      leaveImageDetail()
      await initImageLibrary()
      if (referenceHandling === 'update') await reloadCurrentArticle()
    }
  )
  initImageMove(
    panel.querySelector('.image-detail-filename-save-btn'),
    () => _currentImageDetailEntry,
    () => panel.querySelector('.image-detail-filename-input')?.value.trim(),
    showConfirm,
    setImageOperationFeedback,
    async (newPath, referenceHandling) => {
      // 同じ資源が新しいパスになっただけなので、履歴を積まずにURLを付け替える
      const newUrl = new URL(location)
      newUrl.searchParams.set('image', newPath)
      newUrl.searchParams.delete('md')
      history.replaceState({}, '', newUrl)
      await initImageLibrary()
      if (referenceHandling === 'update') await reloadCurrentArticle()
      openImageDetail(newPath)
    }
  )
  initImageDeclaration(
    panel.querySelector('.image-detail-declaration-toggle'),
    () => _currentImageDetailEntry,
    setImageOperationFeedback,
    (imagePath, declared) => {
      const entry = _imageLibraryEntries.find(e => e.path === imagePath)
      if (entry) entry.declared = declared
      if (_currentImageDetailEntry?.path === imagePath) _currentImageDetailEntry.declared = declared
      setImageOperationFeedback(declared ? '宣言を付与しました' : '宣言を解除しました')
    }
  )
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const url = new URL(location)
  const activeFile = url.searchParams.get('md') || ''
  // 静的要素へのイベント配線はフェッチを待たずに行う
  // （フェッチ完了前のクリックが無反応になるのを防ぐ）
  initSidebarTabs()
  sidebarToggle(event)
  await initSidebarContent(activeFile)
  await initFrontmatterTemplate()
  await initImageLibrary()
  onloadFunction(event)
  // URLが画像を特定していれば、直打ち・リロードでも同じ画像詳細を再構成する
  const target = resolveDisplayTarget(url)
  if (target?.type === 'image') {
    switchSidebarTab('images')
    openImageDetail(target.path)
  }
})
