import { renderImageList } from './imageListDisplay.js'
import { renderRemoteOnlyImages } from './remoteOnlyImageDisplay.js'
import { showImageDetail, renderReferencingArticles } from './imageDetailDisplay.js'

/**
 * @vocab 画像ライブラリビュー
 * @test tests/editor/imageLibraryView.test.js
 * #画像リストコレクター の結果を一度だけ取得して保持し、一覧と詳細の表示を最新の状態に
 * 描き直す（個別画像の詳細表示のために追加のサーバーリクエストは発生しない）。
 * 参照記事一覧は画像1件ごとに問い合わせを伴うため、一覧取得時ではなく選択時に個別取得する。
 * 詳細パネルの操作の配線（削除・移動・宣言・ファイル名編集）は wireDetailOperations に委ねる。
 * @param {{ doc: Document, fetchFn?: typeof fetch,
 *           getDisplayTarget?: () => ({ type: string, path: string } | null),
 *           syncActive?: (target: { type: string, path: string }) => void,
 *           wireDetailOperations?: (panel: HTMLElement) => void,
 *           wireRemoteOnlyRemoval?: (container: HTMLElement) => void,
 *           renderList?: typeof renderImageList,
 *           renderRemoteOnly?: typeof renderRemoteOnlyImages,
 *           renderDetail?: typeof showImageDetail,
 *           renderReferences?: typeof renderReferencingArticles }} deps
 * @returns {{ refresh: () => Promise<void>, openDetail: (imagePath: string) => void,
 *             closeDetail: () => void, entries: Array<object>, currentEntry: object | null }}
 */
export function createImageLibraryView({
  doc,
  fetchFn = (...a) => fetch(...a),
  getDisplayTarget = () => null,
  syncActive = () => {},
  wireDetailOperations = () => {},
  wireRemoteOnlyRemoval = () => {},
  renderList = renderImageList,
  renderRemoteOnly = renderRemoteOnlyImages,
  renderDetail = showImageDetail,
  renderReferences = renderReferencingArticles,
}) {
  let entries = []
  let currentDetailEntry = null

  const openDetail = (imagePath) => {
    const entry = entries.find(e => e.path === imagePath)
    const panel = doc.querySelector('#imageDetailPanel')
    if (!entry || !panel) return
    currentDetailEntry = entry
    syncActive({ type: 'image', path: imagePath })
    // 記事編集画面のヘッダーを流用する: 左側にファイルパスのかわりに画像パスを表示する
    renderDetail(panel, entry)
    panel.hidden = false
    doc.querySelector('.textareaAndPreview')?.setAttribute('hidden', '')
    doc.querySelector('#fileStatus')?.setAttribute('hidden', '')
    doc.querySelector('#articleOptionsRight')?.setAttribute('hidden', '')
    const declarationToggle = panel.querySelector('.image-detail-declaration-toggle')
    if (declarationToggle) declarationToggle.checked = !!entry.declared
    const imageFileNameEl = doc.querySelector('#imageDetailFileName')
    if (imageFileNameEl) {
      imageFileNameEl.textContent = entry.path
      imageFileNameEl.hidden = false
    }
    // メタデータ欄は描画のたびに作り直されるため、操作の配線もそのたびにやり直す
    wireDetailOperations(panel)
    // 参照記事一覧は選択時に個別取得する
    fetchFn(`/get_image_references?imagePath=${encodeURIComponent(entry.path)}`)
      .then(res => res.json())
      .then(json => {
        // 取得中に別の画像へ選択が切り替わっていたら、古い結果は反映しない
        if (currentDetailEntry?.path !== entry.path) return
        renderReferences(panel, json.articles || [])
      })
      .catch(() => {})
  }

  const closeDetail = () => {
    currentDetailEntry = null
    doc.querySelector('#imageDetailPanel')?.setAttribute('hidden', '')
    doc.querySelector('.textareaAndPreview')?.removeAttribute('hidden')
    doc.querySelector('#fileStatus')?.removeAttribute('hidden')
    doc.querySelector('#articleOptionsRight')?.removeAttribute('hidden')
    doc.querySelector('#imageDetailFileName')?.setAttribute('hidden', '')
  }

  const refresh = async () => {
    const container = doc.querySelector('.sidebar-images')
    const remoteOnlyContainer = doc.querySelector('.sidebar-remote-only-images')
    if (!container) return
    try {
      const res = await fetchFn('/get_image_library')
      if (!res.ok) throw new Error(`unexpected status: ${res.status}`)
      const json = await res.json()
      entries = json.images || []
      // 選択中の画像はURLから導出する（表示はURLから再構成される）
      const target = getDisplayTarget()
      renderList(container, entries, target?.type === 'image' ? target.path : '')
      // ローカルに実体がない画像はツリーに混ぜず、別枠に出す
      if (remoteOnlyContainer) {
        renderRemoteOnly(remoteOnlyContainer, json.remoteOnly || [])
        wireRemoteOnlyRemoval(remoteOnlyContainer)
      }
      // 開いている詳細は取得前のエントリで描かれているため、再取得が届いた時点で描き直す
      // （公開ステータスはリモートへの問い合わせを伴い、一覧より遅れて確定する）。
      // ファイル名を編集中のときは入力を捨てないよう、そのままにする。
      const openDetailPath = currentDetailEntry?.path
      const editing = doc.querySelector('#imageDetailPanel .image-detail-filename-form:not([hidden])')
      if (openDetailPath && !editing && entries.some(e => e.path === openDetailPath)) {
        openDetail(openDetailPath)
      }
    } catch (e) {
      entries = []
      container.innerHTML = '<p class="image-library-error">画像一覧を取得できませんでした</p>'
      if (remoteOnlyContainer) remoteOnlyContainer.innerHTML = ''
    }
  }

  return {
    refresh,
    openDetail,
    closeDetail,
    get entries() { return entries },
    get currentEntry() { return currentDetailEntry },
  }
}
