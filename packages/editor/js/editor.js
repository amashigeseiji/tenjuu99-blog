// composition root: DOM 要素の取得・イベント配線・装置の初期化と接続のみを行う。
// 状態と分岐は各装置が持ち、ここでは持たない。モジュール先頭で DOM を参照しない
// （DOM なしで import 可能）。
import { initAutoPreview } from './autoPreviewInitializer.js'
import { initAutoSave } from './autoSaveInitializer.js'
import { createAutoSave } from './autoSave.js'
import { createConfirmDialog } from './confirmDialog.js'
import { createTemplateResolver } from './templateResolver.js'
import { loadArticle } from './articleLoader.js'
import { createPreviewRenderer } from './previewRenderer.js'
import { createPublicationStatusView } from './publicationStatusView.js'
import { createOperationExecutor } from './operationExecutor.js'
import { createActiveStateSynchronizer } from './activeStateSynchronizer.js'
import { createDisplayTargetNavigator } from './displayTargetNavigator.js'
import { createImageLibraryView } from './imageLibraryView.js'
import { initDropReceiver } from './dropReceiver.js'
import { initNewFileCreationUI } from './newFileCreationUI.js'
import { initSidebarContent, initSidebarToggle } from './sidebar.js'
import { initSidebarTabs } from './sidebarTabs.js'
import { resolveDisplayTarget } from './displayTargetResolver.js'
import { initImageDelete } from './imageDeleteUI.js'
import { initImageMove } from './imageMoveUI.js'
import { initImageDeclaration } from './imageDeclarationUI.js'
import { initInlineFileNameEdit } from './inlineFileNameEditUI.js'

const bootstrap = async () => {
  // ── DOM 要素の取得 ──────────────────────────────────────────────
  const form = document.querySelector('#editor')
  const textarea = form.querySelector('#editorTextArea')
  const inputFileName = form.querySelector('#inputFileName')
  const currentFileName = document.querySelector('#currentFileName')
  const previewEl = document.querySelector('#previewContent')
  const statusEl = document.querySelector('#publicationStatus')
  const publishBtn = document.querySelector('#publishBtn')
  const unpublishBtn = document.querySelector('#unpublishBtn')
  const deleteBtn = document.querySelector('#deleteBtn')
  const pullBtn = document.querySelector('#pullBtn')
  const feedbackEl = document.querySelector('#operationFeedback')

  // ── 装置の生成 ──────────────────────────────────────────────────
  const showConfirm = createConfirmDialog({
    dialog: document.querySelector('#confirmDialog'),
    message: document.querySelector('#confirmDialogMessage'),
    actions: document.querySelector('#confirmDialogActions'),
  })
  const templateResolver = createTemplateResolver()
  const synchronizer = createActiveStateSynchronizer(document)
  const statusView = createPublicationStatusView({
    statusEl, publishBtn, unpublishBtn, deleteBtn,
    syncLinkStatus: synchronizer.syncStatus,
  })
  const renderPreview = createPreviewRenderer(previewEl)
  const setFeedback = (message) => { if (feedbackEl) feedbackEl.textContent = message }
  const execute = createOperationExecutor(setFeedback)

  // ── 装置間の接続 ────────────────────────────────────────────────
  const setCurrentFile = (filename) => {
    inputFileName.value = filename
    currentFileName.textContent = filename
  }
  const collectFormFields = () => {
    const fields = {}
    new FormData(form).forEach((v, k) => { fields[k] = v })
    return fields
  }
  const updatePreview = () => renderPreview(collectFormFields())

  // 記事のインプレース読み込み: turbolink によるページ全体の差し替えではなく、
  // エディタ状態をその場で更新することでちらつきを防ぐ
  const showArticleInPlace = async (target, { syncActive = true } = {}) => {
    imageLibrary.closeDetail()
    if (syncActive) synchronizer.syncActive({ type: 'article', path: target })
    let article
    try {
      article = await loadArticle(target, templateResolver.templates)
    } catch (e) {
      // 取得自体に失敗（ネットワーク断など）: 編集中の内容は触らず、対象の表示だけ合わせる
      console.log(e)
      setCurrentFile(target)
      return
    }
    textarea.value = article.content
    setCurrentFile(article.filename)
    if (article.exists) {
      updatePreview()
      statusView.refresh(target)
    }
  }
  // 画像削除UI・画像改名UIが「参照も更新」を選んだ後、開いている記事をサーバー側の最新内容に揃えるために使う
  const reloadCurrentArticle = async () => {
    if (inputFileName.value) await showArticleInPlace(inputFileName.value)
  }
  const refreshSidebar = () => initSidebarContent(inputFileName.value, {
    doc: document,
    syncActive: synchronizer.syncActive,
  })

  // 画像詳細から離れる: 表示を閉じたうえで、URLから画像の特定を取り除き、
  // 開いていた記事があればその記事を特定するURLに戻す（URLと表示の一致を保つ）
  const leaveImageDetail = () => {
    if (!imageLibrary.currentEntry) return
    imageLibrary.closeDetail()
    if (!new URL(location).searchParams.get('image')) return
    const currentArticle = inputFileName.value
    if (currentArticle) {
      navigator.declareTarget({ type: 'article', path: currentArticle })
      synchronizer.syncActive({ type: 'article', path: currentArticle })
    } else {
      navigator.declareTarget(null)
      synchronizer.syncActive(null)
    }
  }

  // 画像詳細のメタデータ欄（ファイル名編集・公開状態・検出外参照宣言・削除）は
  // 描画のたびに作り直されるため、要素への配線もそのたびにここから呼び直す
  const wireDetailOperations = (panel) => {
    initInlineFileNameEdit(panel, () => imageLibrary.currentEntry)
    initImageDelete(
      panel.querySelector('.image-detail-delete-btn'),
      () => imageLibrary.currentEntry,
      showConfirm,
      setFeedback,
      async (deletedPath, referenceHandling) => {
        // 削除された画像はもう表示対象にならないため、URLからも取り除く
        leaveImageDetail()
        await imageLibrary.refresh()
        if (referenceHandling === 'update') await reloadCurrentArticle()
      }
    )
    initImageMove(
      panel.querySelector('.image-detail-filename-save-btn'),
      () => imageLibrary.currentEntry,
      () => panel.querySelector('.image-detail-filename-input')?.value.trim(),
      showConfirm,
      setFeedback,
      async (newPath, referenceHandling) => {
        // 同じ資源が新しいパスになっただけなので、履歴を積まずにURLを付け替える
        navigator.declareTarget({ type: 'image', path: newPath }, { replace: true })
        await imageLibrary.refresh()
        if (referenceHandling === 'update') await reloadCurrentArticle()
        imageLibrary.openDetail(newPath)
      }
    )
    initImageDeclaration(
      panel.querySelector('.image-detail-declaration-toggle'),
      () => imageLibrary.currentEntry,
      setFeedback,
      (imagePath, declared) => {
        const entry = imageLibrary.entries.find(e => e.path === imagePath)
        if (entry) entry.declared = declared
        if (imageLibrary.currentEntry?.path === imagePath) imageLibrary.currentEntry.declared = declared
        setFeedback(declared ? '宣言を付与しました' : '宣言を解除しました')
      }
    )
  }

  // 別枠の各画像に付いた「取り除く」操作。一覧は描画のたびに作り直されるため、配線もそのたびにやり直す
  const wireRemoteOnlyRemoval = (container) => {
    container.querySelectorAll('.remote-only-image-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => execute({
        confirm: async () => (await showConfirm(
          `${btn.dataset.imagePath} を公開先から取り除きます。手元にファイルはないため、元に戻せません。`,
          [{ label: '取り除く', value: true }, { label: '中止', value: null }]
        )) === true,
        button: btn,
        progress: '取り除いています...',
        endpoint: '/remove_remote_image',
        body: { imagePath: btn.dataset.imagePath },
        success: () => `${btn.dataset.imagePath} を取り除きました`,
        failure: (json) => `取り除けませんでした: ${json.error ?? 'サーバーに接続できませんでした'}`,
        onSuccess: () => imageLibrary.refresh(),
      }))
    })
  }

  const imageLibrary = createImageLibraryView({
    doc: document,
    getDisplayTarget: () => resolveDisplayTarget(new URL(location)),
    syncActive: synchronizer.syncActive,
    wireDetailOperations,
    wireRemoteOnlyRemoval,
  })

  const navigator = createDisplayTargetNavigator({
    win: window,
    showArticle: (path) => showArticleInPlace(path),
    showImage: async (path) => {
      tabs.switchTab('images')
      if (!imageLibrary.entries.some(en => en.path === path)) await imageLibrary.refresh()
      imageLibrary.openDetail(path)
    },
    showNone: () => imageLibrary.closeDetail(),
  })

  const tabs = initSidebarTabs({
    doc: document,
    onImagesOpened: () => imageLibrary.refresh(),
    onImagesLeft: () => leaveImageDetail(),
    onNewFileOpened: () => newFileUI.resetForm(),
  })

  const newFileUI = initNewFileCreationUI({
    nameInput: document.querySelector('#newFileName'),
    templateSelect: document.querySelector('#newFileTemplate'),
    imageInput: document.querySelector('#newFileImage'),
    errorEl: document.querySelector('#newFileError'),
    confirmBtn: document.querySelector('#confirmNewFile'),
    getTemplates: () => templateResolver.templates,
    onImageAdded: async (imagePath) => {
      // 追加した画像を表示対象にする（画像リンククリックと同じその場の資源切り替え）
      navigator.declareTarget({ type: 'image', path: imagePath })
      tabs.switchTab('images')
      await imageLibrary.refresh()
      imageLibrary.openDetail(imagePath)
    },
    onArticleCreated: async (filename, content) => {
      imageLibrary.closeDetail()
      tabs.switchTab('files')
      textarea.value = content
      setCurrentFile(filename)
      navigator.declareTarget({ type: 'article', path: filename })
      updatePreview()
      statusView.refresh(filename)
      refreshSidebar()
    },
  })

  // ── 操作の配線 ──────────────────────────────────────────────────
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const filePath = inputFileName.value
    execute({
      button: publishBtn,
      progress: '公開中...',
      endpoint: '/publish',
      body: { filePath, fileContent: textarea.value },
      success: (json) => `公開しました${json.warning ? `（${json.warning}）` : ''}`,
      failure: (json, resOk) => `公開失敗: ${json.error ?? (resOk ? '不明なエラー' : 'サーバーに接続できませんでした')}`,
      onSuccess: () => statusView.refresh(filePath),
    })
  })

  // @vocab: 非公開にする
  // リモートから取り除く。原稿は手元に残るため確認なしで実行できる（再公開で戻せる）
  unpublishBtn?.addEventListener('click', () => {
    const filePath = inputFileName.value
    if (!filePath) return
    execute({
      progress: '非公開にしています...',
      endpoint: '/unpublish',
      body: { filePath },
      success: (json) => `非公開にしました${json.warning ? `（${json.warning}）` : ''}`,
      failure: (json) => `非公開にできませんでした: ${json.error ?? '不明なエラー'}`,
      onSuccess: () => {
        statusView.refresh(filePath)
        refreshSidebar()
      },
    })
  })

  // @vocab: 削除する
  // 手元から取り除く不可逆の操作のため、実行前に確認する
  deleteBtn?.addEventListener('click', () => {
    const filePath = inputFileName.value
    if (!filePath) return
    execute({
      confirm: () => showConfirm(`「${filePath}」を手元から削除します。よろしいですか？`),
      endpoint: '/delete',
      body: { filePath },
      success: () => '削除しました',
      failure: (json) => `削除できませんでした: ${json.error ?? '不明なエラー'}`,
      onSuccess: () => {
        textarea.value = ''
        setCurrentFile('')
        navigator.declareTarget(null)
        if (statusEl) {
          statusEl.textContent = ''
          statusEl.dataset.status = ''
        }
        statusView.applyAvailability('')
        refreshSidebar()
      },
    })
  })

  // @vocab: 取り込む
  // リモートの内容を手元に取り込む。見送られた記事はその理由を表示する
  const pullOperation = () => execute({
    button: pullBtn,
    progress: '取り込んでいます...',
    endpoint: '/pull',
    success: (json) => {
      const lines = [json.applied.length ? `${json.applied.length}件を取り込みました` : '新しく取り込むものはありませんでした']
      for (const s of json.skipped ?? []) {
        lines.push(`見送り: ${s.file.split('/').pop()} — ${s.reason}`)
      }
      return lines.join(' ／ ')
    },
    failure: (json) => `取り込めませんでした: ${json.error ?? 'サーバーに接続できませんでした'}`,
    onSuccess: async (json) => {
      refreshSidebar()
      // 開いている記事が取り込みで更新されたときは、開き直して最新にする
      const current = inputFileName.value
      if (current && json.applied.some(p => p.endsWith(`/pages/${current}`))) {
        await showArticleInPlace(current)
      }
    },
  })
  pullBtn?.addEventListener('click', pullOperation)
  // 初期 disabled はハンドラー登録前の空クリックを防ぐため。登録できたここで操作可能にする
  if (pullBtn) pullBtn.disabled = false

  // サイドバーのリンクをインターセプトしてインプレース読み込みに切り替える。
  // サイドバーは動的に生成されるため、個別リンクへのバインドではなく .sidebar へのデリゲーションで処理する
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
      if (imageLibrary.currentEntry?.path === linkTarget.path) return
      navigator.declareTarget({ type: 'image', path: linkTarget.path })
      imageLibrary.openDetail(linkTarget.path)
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
        await pullOperation()
      } else if (choice === 'remove') {
        await execute({
          endpoint: '/unpublish',
          body: { filePath: newTarget },
          success: () => `「${newTarget}」をサイトから取り除きました`,
          failure: (json) => `取り除けませんでした: ${json.error ?? '不明なエラー'}`,
          onSuccess: () => refreshSidebar(),
        })
      }
      return
    }

    const currentTarget = inputFileName.value || new URL(location).searchParams.get('md')
    // 画像詳細を表示中は、同じ記事へのリンクでも記事表示への切り替えとして扱う
    if (newTarget === currentTarget && !imageLibrary.currentEntry) return

    navigator.declareTarget({ type: 'article', path: newTarget })
    await showArticleInPlace(newTarget)
  })

  // ── 自動更新・自動保存・ドロップの配線 ────────────────────────────
  const autoSave = createAutoSave({
    getFilename: () => inputFileName.value,
    getContent: () => textarea.value,
    onSaved: (filename) => statusView.refresh(filename),
  })
  const debouncedUpdate = initAutoPreview(textarea, updatePreview, 500)
  initAutoSave(textarea, autoSave, 500)
  initDropReceiver(textarea, () => inputFileName.value, updatePreview, () => debouncedUpdate.cancel())

  // ── 初期化 ──────────────────────────────────────────────────────
  const url = new URL(location)
  const activeFile = url.searchParams.get('md') || ''
  // 静的要素へのイベント配線はフェッチを待たずに済ませてある
  // （フェッチ完了前のクリックが無反応になるのを防ぐ）
  initSidebarToggle(document)
  await initSidebarContent(activeFile, { doc: document, syncActive: synchronizer.syncActive })
  await templateResolver.init()
  await imageLibrary.refresh()
  if (activeFile) {
    // 初期表示: アクティブ表示は initSidebarContent が済ませているため、同期は行わない
    await showArticleInPlace(activeFile, { syncActive: false })
  }
  navigator.init()
  // URLが画像を特定していれば、直打ち・リロードでも同じ画像詳細を再構成する
  const target = resolveDisplayTarget(url)
  if (target?.type === 'image') {
    tabs.switchTab('images')
    imageLibrary.openDetail(target.path)
  }
}

// ブラウザ実行時のみ配線する（DOM なしの環境でも import 自体は可能に保つ）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', bootstrap)
}
