import { escapeHtml } from './tree.js'
import { labelFor } from './publicationStatusLabel.js'

/**
 * @vocab リモートのみ画像表示
 * @test tests/editor/image-library.test.js
 * ローカルに実体がなく #リモート にのみ存在する画像の一覧HTMLを生成する（純粋関数）。
 * サイドバーの画像ツリーはローカルのファイルシステムを模したものなので、そこには混ぜず
 * 別の枠として描く。該当する画像がなければ枠そのものを出さない。
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry[]} entries
 * @returns {string}
 */
export function renderRemoteOnlyImagesHtml(entries) {
  if (!entries || entries.length === 0) return ''
  const items = entries.map(entry => `
      <li class="remote-only-image">
        <span class="remote-only-image-path" data-status="remote-only">${escapeHtml(entry.path)}</span>
        <button type="button" class="remote-only-image-remove-btn" data-image-path="${escapeHtml(entry.path)}">取り除く</button>
      </li>`).join('')
  return `<section class="remote-only-images">
    <h3 class="remote-only-images-title">${labelFor('remote-only')}の画像</h3>
    <p class="remote-only-images-description">手元にファイルがなく、公開先にだけ残っている画像です。</p>
    <ul class="remote-only-images-list">${items}
    </ul>
  </section>`
}

/**
 * @vocab リモートのみ画像表示
 * @test tests/editor/image-library.test.js
 * #画像リストコレクター が返したリモートのみの画像を、サイドバーの画像タブの
 * 画像ツリーとは別の枠に描画する。
 * DOM描画に依存するため自動テストを持たない（HTML生成は renderRemoteOnlyImagesHtml が担う）。
 * @param {HTMLElement} container
 * @param {import('../server/imageLibraryCollector.js').ImageLibraryEntry[]} entries
 */
export function renderRemoteOnlyImages(container, entries) {
  container.innerHTML = renderRemoteOnlyImagesHtml(entries)
}
