import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createConfirmDialog } from '../../packages/editor/js/confirmDialog.js'

// DOM の最小フェイク: 確認ダイアログが使う showModal / close / createElement / イベント配線だけを持つ
const makeFakeElements = () => {
  const buttons = []
  const makeButton = () => {
    const listeners = {}
    return {
      type: '',
      textContent: '',
      classList: { classes: new Set(), add(c) { this.classes.add(c) } },
      addEventListener(ev, fn) { listeners[ev] = fn },
      click() { listeners.click?.() },
    }
  }
  const dialogListeners = {}
  const dialog = {
    opened: false,
    showModal() { this.opened = true },
    close() { this.opened = false },
    addEventListener(ev, fn) { dialogListeners[ev] = fn },
    cancel() { dialogListeners.cancel?.() },
  }
  const message = { textContent: '' }
  const actions = {
    innerHTML: '',
    ownerDocument: { createElement: () => { const b = makeButton(); buttons.push(b); return b } },
    appendChild() {},
  }
  return { dialog, message, actions, buttons }
}

describe('確認ダイアログ は メッセージと選択肢を提示し、選ばれた選択肢の値を返せる', () => {
  it('選択肢のボタンを押すと、その選択肢の値で解決される', async () => {
    const { dialog, message, actions, buttons } = makeFakeElements()
    const showConfirm = createConfirmDialog({ dialog, message, actions })
    const promise = showConfirm('取り込みますか？', [
      { label: '取り込む', value: 'pull' },
      { label: 'キャンセル', value: null },
    ])
    assert.strictEqual(message.textContent, '取り込みますか？')
    assert.strictEqual(dialog.opened, true)
    assert.strictEqual(buttons.length, 2)
    buttons[0].click()
    assert.strictEqual(await promise, 'pull')
    assert.strictEqual(dialog.opened, false)
  })

  it('ダイアログがキャンセルされたときは false で解決される', async () => {
    const { dialog, message, actions } = makeFakeElements()
    const showConfirm = createConfirmDialog({ dialog, message, actions })
    const promise = showConfirm('よろしいですか？')
    dialog.cancel()
    assert.strictEqual(await promise, false)
  })
})
