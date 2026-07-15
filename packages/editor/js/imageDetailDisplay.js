import { escapeHtml } from './tree.js'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

function formatReferencingArticles(referencingArticles) {
  if (!referencingArticles || referencingArticles.length === 0) return '参照なし'
  return referencingArticles
    .map(a => `${escapeHtml(a.path)}${a.status !== 'new' ? '（公開済み）' : ''}`)
    .join('<br>')
}

/**
 * @vocab: 画像詳細表示
 * @test tests/editor/image-library.test.js
 * #画像リスト表示 が保持済みのリストデータから選択された画像のエントリを受け取り、
 * プレビューとメタデータを表示する。ファイル名・サイズ・解像度・追加日時は追加のサーバー
 * リクエストなしに描画する。参照記事一覧のみ、既存の参照記事一覧エンドポイントから個別に
 * 取得する必要があるため（画像1件あたり記事横断のgit問い合わせを伴う）、呼び出し側
 * （editor.js の openImageDetail）が別途取得して #renderReferencingArticles で反映する。
 * ファイルパス・操作ボタンは記事編集画面と共通の editor-options に表示するため、
 * このパネル自体はプレビューとメタデータのみを描画する。
 * DOM描画に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLElement} panelEl
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry} entry
 */
export function showImageDetail(panelEl, entry) {
  const resolution = entry.width != null && entry.height != null ? `${entry.width} × ${entry.height}` : '不明'
  const addedAt = entry.addedAt ? new Date(entry.addedAt).toLocaleString('ja-JP') : '不明'
  const fileName = entry.path.split('/').pop()
  panelEl.innerHTML = `
    <img class="image-detail-preview" src="${escapeHtml(entry.url)}" alt="${escapeHtml(fileName)}">
    <dl class="image-detail-meta">
      <dt>ファイル名</dt><dd>${escapeHtml(fileName)}</dd>
      <dt>ファイルサイズ</dt><dd>${escapeHtml(formatBytes(entry.size))}</dd>
      <dt>解像度</dt><dd>${escapeHtml(resolution)}</dd>
      <dt>追加日時</dt><dd>${escapeHtml(addedAt)}</dd>
      <dt>参照記事</dt><dd class="image-detail-references">読み込み中...</dd>
    </dl>
  `
}

/**
 * 参照記事一覧エンドポイントの結果を、showImageDetail が描画済みのパネルに反映する。
 * DOM描画に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLElement} panelEl
 * @param {{ path: string, status: 'new'|'modified'|'published'|'unknown' }[]} referencingArticles
 */
export function renderReferencingArticles(panelEl, referencingArticles) {
  const el = panelEl.querySelector('.image-detail-references')
  if (el) el.innerHTML = formatReferencingArticles(referencingArticles)
}
