import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createDisplayTargetNavigator } from '../../packages/editor/js/displayTargetNavigator.js'

const makeFakeWin = (href) => {
  const win = {
    location: href,
    history: {
      pushed: [],
      replaced: [],
      pushState(_, __, url) { win.history.pushed.push(String(url)); win.location = String(url) },
      replaceState(_, __, url) { win.history.replaced.push(String(url)); win.location = String(url) },
    },
    listeners: {},
    addEventListener(ev, fn) { win.listeners[ev] = fn },
  }
  return win
}

describe('表示対象ナビゲーター は 表示対象の切り替えをURLに宣言し、URLから表示を再構成できる', () => {
  it('画像への切り替えをURLに宣言すると、image が特定され md は消える', () => {
    const win = makeFakeWin('http://localhost/editor?md=post%2Fa.md')
    const nav = createDisplayTargetNavigator({ win, showArticle() {}, showImage() {}, showNone() {} })
    nav.declareTarget({ type: 'image', path: 'icons/logo.png' })
    const url = new URL(win.location)
    assert.strictEqual(url.searchParams.get('image'), 'icons/logo.png')
    assert.strictEqual(url.searchParams.get('md'), null)
    assert.strictEqual(win.history.pushed.length, 1)
  })

  it('履歴を積まない宣言（replace）では履歴が置き換えられる', () => {
    const win = makeFakeWin('http://localhost/editor?image=a.png')
    const nav = createDisplayTargetNavigator({ win, showArticle() {}, showImage() {}, showNone() {} })
    nav.declareTarget({ type: 'image', path: 'b.png' }, { replace: true })
    assert.strictEqual(win.history.pushed.length, 0)
    assert.strictEqual(win.history.replaced.length, 1)
    assert.strictEqual(new URL(win.location).searchParams.get('image'), 'b.png')
  })

  it('表示対象なしの宣言では md と image の特定が消える', () => {
    const win = makeFakeWin('http://localhost/editor?md=a.md')
    const nav = createDisplayTargetNavigator({ win, showArticle() {}, showImage() {}, showNone() {} })
    nav.declareTarget(null)
    const url = new URL(win.location)
    assert.strictEqual(url.searchParams.get('md'), null)
    assert.strictEqual(url.searchParams.get('image'), null)
  })

  it('URLから表示を再構成するとき、特定された資源に応じた表示が呼ばれる', async () => {
    const calls = []
    const win = makeFakeWin('http://localhost/editor?md=post%2Fa.md')
    const nav = createDisplayTargetNavigator({
      win,
      showArticle: (path) => calls.push(['article', path]),
      showImage: (path) => calls.push(['image', path]),
      showNone: () => calls.push(['none']),
    })
    await nav.restoreFromUrl()
    win.location = 'http://localhost/editor?image=icons%2Flogo.png'
    await nav.restoreFromUrl()
    win.location = 'http://localhost/editor'
    await nav.restoreFromUrl()
    assert.deepStrictEqual(calls, [['article', 'post/a.md'], ['image', 'icons/logo.png'], ['none']])
  })

  it('ブラウザの戻る/進む（popstate）でURLから表示が再構成される', async () => {
    const calls = []
    const win = makeFakeWin('http://localhost/editor?md=post%2Fa.md')
    const nav = createDisplayTargetNavigator({
      win,
      showArticle: (path) => calls.push(path),
      showImage() {},
      showNone() {},
    })
    nav.init()
    await win.listeners.popstate()
    assert.deepStrictEqual(calls, ['post/a.md'])
  })
})
