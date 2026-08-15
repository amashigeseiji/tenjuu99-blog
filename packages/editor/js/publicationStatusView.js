import { publishAvailability, resolveOperations } from './publishAvailability.js'
import { labelFor } from './publicationStatusLabel.js'

/**
 * @vocab 公開ステータス表示器
 * @test tests/editor/publicationStatusView.test.js
 * 記事の公開ステータスを取得し、ステータス表示のラベルと各操作（公開・非公開・削除）の
 * 可否に反映する。ステータスが取得できないときは参照不能（unknown）と同等に扱い、
 * 公開ボタンを無効化する。サイドバーリンクの data-status の同期は #アクティブ状態同期器 に委ねる。
 * @param {{ statusEl: HTMLElement|null, publishBtn: HTMLButtonElement|null,
 *           unpublishBtn: HTMLButtonElement|null, deleteBtn: HTMLButtonElement|null,
 *           syncLinkStatus?: (path: string, status: string) => void }} elements
 * @param {typeof fetch} [fetchFn]
 * @returns {{ refresh: (filePath: string) => Promise<void>,
 *             render: (filePath: string, status: string) => void,
 *             applyAvailability: (status: string) => void }}
 */
export function createPublicationStatusView({ statusEl, publishBtn, unpublishBtn, deleteBtn, syncLinkStatus }, fetchFn = (...a) => fetch(...a)) {
  const applyAvailability = (status) => {
    const ops = resolveOperations(status)
    if (publishBtn) {
      const { disabled, label } = publishAvailability(status)
      publishBtn.disabled = disabled || !ops.publish
      publishBtn.title = label ?? ''
    }
    // 非公開・削除はどちらか一方を必ず表示する（既定は非公開にする）
    if (deleteBtn) deleteBtn.hidden = !ops.delete
    if (unpublishBtn) {
      unpublishBtn.hidden = !!ops.delete
      unpublishBtn.disabled = !ops.unpublish
    }
  }

  const render = (filePath, status) => {
    const { label } = publishAvailability(status)
    const statusLabel = labelFor(status)
    statusEl.textContent = label ?? (statusLabel ? `(${statusLabel})` : '')
    statusEl.dataset.status = status
    applyAvailability(status)
    if (syncLinkStatus) syncLinkStatus(filePath, status)
  }

  const refresh = async (filePath) => {
    if (!filePath || !statusEl) return
    statusEl.textContent = ''
    statusEl.dataset.status = ''
    try {
      const res = await fetchFn(`/publication-status?md=${encodeURIComponent(filePath)}`)
      const status = res.ok ? (await res.json()).status : 'unknown'
      render(filePath, status)
    } catch {
      render(filePath, 'unknown')
    }
  }

  return { refresh, render, applyAvailability }
}
