import { escapeHtml } from './tree.js'
import { labelFor } from './publicationStatusLabel.js'

function formatBytes(bytes) {
  if (bytes == null) return '不明'
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
 * プレビューとメタデータを表示する。ファイル名・公開状態・サイズ・解像度・追加日時は追加の
 * サーバーリクエストなしに描画する。参照記事一覧のみ、既存の参照記事一覧エンドポイントから
 * 個別に取得する必要があるため（画像1件あたり記事横断のgit問い合わせを伴う）、呼び出し側
 * （editor.js の openImageDetail）が別途取得して #renderReferencingArticles で反映する。
 * ファイル名変更（移動）・検出外参照宣言の付与解除・削除の操作は、ヘッダーではなくこの
 * メタデータ欄にまとめて表示する。画像自身の #公開ステータス は、参照記事一覧の各記事が持つ
 * 公開状態と区別できるよう別の行・別のクラス名で表示し、表示語は記事と共通の
 * #公開ステータスラベル から取る（US-09 S4）。
 * #検出外参照宣言 は語彙用語を見出しに出さず、公開状態の欄の中のチェックボックスとして示す
 * （宣言は「参照が無くなっても非公開にしない」という公開状態についての断りであるため）。
 * DOM描画に依存するため自動テストを持たない（手動確認のみ）。
 * @param {HTMLElement} panelEl
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry} entry
 */
export function showImageDetail(panelEl, entry) {
  const resolution = entry.width != null && entry.height != null ? `${entry.width} × ${entry.height}` : '不明'
  const addedAt = entry.addedAt ? new Date(entry.addedAt).toLocaleString('ja-JP') : '不明'
  const fileName = entry.path.split('/').pop()
  const publicationStatusAttr = entry.status ?? 'unknown'
  const publicationStatus = labelFor(publicationStatusAttr)
  panelEl.innerHTML = `
    <img class="image-detail-preview" src="${escapeHtml(entry.url)}" alt="${escapeHtml(fileName)}">
    <dl class="image-detail-meta">
      <dt>ファイル名</dt>
      <dd class="image-detail-filename">
        <span class="image-detail-filename-display">${escapeHtml(fileName)}</span>
        <button type="button" class="image-detail-filename-edit-btn">編集</button>
        <span class="image-detail-filename-form" hidden>
          <input type="text" class="image-detail-filename-input" autocomplete="off" placeholder="移動先（image/ 配下のパス）">
          <button type="button" class="image-detail-filename-save-btn">保存</button>
          <button type="button" class="image-detail-filename-cancel-btn">キャンセル</button>
        </span>
      </dd>
      <dt>公開状態</dt>
      <dd class="image-detail-publication-status" data-status="${publicationStatusAttr}">
        <span class="image-detail-publication-status-label">${escapeHtml(publicationStatus)}</span>
        <label class="image-detail-declaration-label"><input type="checkbox" class="image-detail-declaration-toggle"> 参照がなくても非公開にしない</label>
      </dd>
      <dt>ファイルサイズ</dt><dd>${escapeHtml(formatBytes(entry.size))}</dd>
      <dt>解像度</dt><dd>${escapeHtml(resolution)}</dd>
      <dt>追加日時</dt><dd>${escapeHtml(addedAt)}</dd>
      <dt>参照記事</dt><dd class="image-detail-references">読み込み中...</dd>
    </dl>
    <button type="button" class="image-detail-delete-btn">削除する</button>
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
