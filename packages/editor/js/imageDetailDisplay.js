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

/**
 * @vocab: 画像詳細表示
 * @test tests/editor/image-library.test.js
 * #画像一覧表示 が保持済みの一覧データから選択された画像のエントリを受け取り、
 * プレビューとメタデータを表示する。追加のサーバーリクエストは発生しない。
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
    </dl>
  `
}
