import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createActiveStateSynchronizer } from '../../packages/editor/js/activeStateSynchronizer.js'

const makeFakeSidebar = (hrefs) => {
  const links = hrefs.map(href => ({
    href,
    dataset: {},
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c) },
      remove(c) { this.classes.delete(c) },
    },
  }))
  const doc = {
    querySelectorAll: () => links,
    querySelector: (selector) => {
      const m = selector.match(/href="([^"]+)"/)
      return links.find(l => l.href === m[1]) ?? null
    },
  }
  return { doc, links }
}

describe('アクティブ状態同期器 は サイドバーのアクティブ表示を現在の表示対象に一致させられる', () => {
  it('表示対象の記事リンクだけがアクティブになり、他のアクティブ表示は消える', () => {
    const { doc, links } = makeFakeSidebar([
      '/editor?md=post%2Fa.md',
      '/editor?md=post%2Fb.md',
    ])
    links[1].classList.add('active')
    const sync = createActiveStateSynchronizer(doc)
    sync.syncActive({ type: 'article', path: 'post/a.md' })
    assert.ok(links[0].classList.classes.has('active'))
    assert.ok(!links[1].classList.classes.has('active'))
  })

  it('表示対象が画像のときは画像リンクがアクティブになる', () => {
    const { doc, links } = makeFakeSidebar([
      '/editor?md=post%2Fa.md',
      '/editor?image=icons%2Flogo.png',
    ])
    const sync = createActiveStateSynchronizer(doc)
    sync.syncActive({ type: 'image', path: 'icons/logo.png' })
    assert.ok(links[1].classList.classes.has('active'))
    assert.ok(!links[0].classList.classes.has('active'))
  })

  it('表示対象がないときはすべてのアクティブ表示が消える', () => {
    const { doc, links } = makeFakeSidebar(['/editor?md=post%2Fa.md'])
    links[0].classList.add('active')
    const sync = createActiveStateSynchronizer(doc)
    sync.syncActive(null)
    assert.ok(!links[0].classList.classes.has('active'))
  })

  it('リンクの data-status を表示対象の照合と同じ規則で同期できる', () => {
    const { doc, links } = makeFakeSidebar(['/editor?md=post%2Fa.md'])
    const sync = createActiveStateSynchronizer(doc)
    sync.syncStatus('post/a.md', 'published')
    assert.strictEqual(links[0].dataset.status, 'published')
    sync.syncStatus('post/a.md', undefined)
    assert.strictEqual(links[0].dataset.status, '')
  })
})
