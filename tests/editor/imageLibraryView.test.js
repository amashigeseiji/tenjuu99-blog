import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createImageLibraryView } from '../../packages/editor/js/imageLibraryView.js'

const makeFakeDoc = () => {
  const container = { innerHTML: '' }
  const remoteOnlyContainer = { innerHTML: '' }
  const panel = {
    hidden: true,
    querySelector: () => null,
    setAttribute(name) { if (name === 'hidden') this.hidden = true },
  }
  const elements = {
    '.sidebar-images': container,
    '.sidebar-remote-only-images': remoteOnlyContainer,
    '#imageDetailPanel': panel,
  }
  return {
    container,
    remoteOnlyContainer,
    panel,
    doc: { querySelector: (sel) => elements[sel] ?? null },
  }
}

describe('画像ライブラリビュー は 画像一覧を取得・保持し、一覧と詳細の表示を最新の状態に描き直せる', () => {
  it('一覧を取得して保持し、URLで選択中の画像を添えて一覧を描ける', async () => {
    const { doc, container, remoteOnlyContainer } = makeFakeDoc()
    const images = [{ path: 'a.png' }, { path: 'b.png' }]
    const listCalls = []
    const remoteCalls = []
    const wired = []
    const view = createImageLibraryView({
      doc,
      fetchFn: async () => ({ ok: true, json: async () => ({ images, remoteOnly: [{ path: 'r.png' }] }) }),
      getDisplayTarget: () => ({ type: 'image', path: 'b.png' }),
      renderList: (el, entries, selected) => listCalls.push({ el, entries, selected }),
      renderRemoteOnly: (el, remoteOnly) => remoteCalls.push({ el, remoteOnly }),
      wireRemoteOnlyRemoval: (el) => wired.push(el),
    })
    await view.refresh()
    assert.deepStrictEqual(view.entries, images)
    assert.deepStrictEqual(listCalls, [{ el: container, entries: images, selected: 'b.png' }])
    assert.deepStrictEqual(remoteCalls, [{ el: remoteOnlyContainer, remoteOnly: [{ path: 'r.png' }] }])
    assert.deepStrictEqual(wired, [remoteOnlyContainer])
  })

  it('取得に失敗したときは一覧を空にしてエラー表示に描き直す', async () => {
    const { doc, container, remoteOnlyContainer } = makeFakeDoc()
    remoteOnlyContainer.innerHTML = 'old'
    const view = createImageLibraryView({
      doc,
      fetchFn: async () => ({ ok: false, status: 500 }),
      renderList: () => {},
    })
    await view.refresh()
    assert.deepStrictEqual(view.entries, [])
    assert.match(container.innerHTML, /画像一覧を取得できませんでした/)
    assert.strictEqual(remoteOnlyContainer.innerHTML, '')
  })

  it('詳細を開くと保持中のエントリで描かれ、アクティブ状態の同期と操作の配線が行われる', async () => {
    const { doc, panel } = makeFakeDoc()
    const detailCalls = []
    const synced = []
    const wiredPanels = []
    const fetched = []
    const view = createImageLibraryView({
      doc,
      fetchFn: async (url) => {
        fetched.push(url)
        if (url === '/get_image_library') return { ok: true, json: async () => ({ images: [{ path: 'a.png', declared: false }] }) }
        return { ok: true, json: async () => ({ articles: [] }) }
      },
      renderList: () => {},
      renderDetail: (el, entry) => detailCalls.push(entry),
      syncActive: (target) => synced.push(target),
      wireDetailOperations: (el) => wiredPanels.push(el),
    })
    await view.refresh()
    view.openDetail('a.png')
    assert.deepStrictEqual(detailCalls, [{ path: 'a.png', declared: false }])
    assert.strictEqual(panel.hidden, false)
    assert.deepStrictEqual(synced, [{ type: 'image', path: 'a.png' }])
    assert.deepStrictEqual(wiredPanels, [panel])
    assert.ok(fetched.includes('/get_image_references?imagePath=a.png'))
    assert.strictEqual(view.currentEntry.path, 'a.png')
  })

  it('詳細を開いたまま再取得すると、届いた最新のエントリで詳細が描き直される', async () => {
    const { doc } = makeFakeDoc()
    const detailCalls = []
    let libraryResponse = { images: [{ path: 'a.png', declared: false }] }
    const view = createImageLibraryView({
      doc,
      fetchFn: async (url) => {
        if (url === '/get_image_library') return { ok: true, json: async () => libraryResponse }
        return { ok: true, json: async () => ({ articles: [] }) }
      },
      renderList: () => {},
      renderDetail: (el, entry) => detailCalls.push(entry),
    })
    await view.refresh()
    view.openDetail('a.png')
    libraryResponse = { images: [{ path: 'a.png', declared: true }] }
    await view.refresh()
    assert.strictEqual(detailCalls.length, 2)
    assert.strictEqual(detailCalls[1].declared, true)
  })

  it('詳細を閉じると選択中のエントリがなくなる', async () => {
    const { doc, panel } = makeFakeDoc()
    const view = createImageLibraryView({
      doc,
      fetchFn: async (url) => url === '/get_image_library'
        ? { ok: true, json: async () => ({ images: [{ path: 'a.png' }] }) }
        : { ok: true, json: async () => ({ articles: [] }) },
      renderList: () => {},
      renderDetail: () => {},
    })
    await view.refresh()
    view.openDetail('a.png')
    view.closeDetail()
    assert.strictEqual(view.currentEntry, null)
    assert.strictEqual(panel.hidden, true)
  })
})
