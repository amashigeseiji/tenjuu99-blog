/**
 * @vocab 確認ダイアログ
 * @test tests/editor/confirmDialog.test.js
 * WKWebView は window.confirm() に応答しない（WKUIDelegate 未実装のため無反応になる）ので、
 * <dialog> による自前実装で置き換える。ブラウザでもネイティブアプリでも同じ見た目で動く。
 * DOM 要素は生成時に受け取る（モジュール読み込み時に DOM を参照しない）。
 * @param {{ dialog: HTMLDialogElement, message: HTMLElement, actions: HTMLElement }} elements
 * @returns {(text: string, choices?: Array<{ label: string, value: * }>) => Promise<*>}
 */
export function createConfirmDialog({ dialog, message, actions }) {
  return (text, choices = [{ label: 'OK', value: true }, { label: 'キャンセル', value: false }]) => {
    return new Promise((resolve) => {
      message.textContent = text
      actions.innerHTML = ''
      let settled = false
      const settle = (value) => {
        if (settled) return
        settled = true
        dialog.close()
        resolve(value)
      }
      choices.forEach(choice => {
        const btn = actions.ownerDocument.createElement('button')
        btn.type = 'button'
        btn.textContent = choice.label
        if (choice.value === null) btn.classList.add('confirm-dialog-cancel')
        btn.addEventListener('click', () => settle(choice.value))
        actions.appendChild(btn)
      })
      dialog.addEventListener('cancel', () => settle(false), { once: true })
      dialog.showModal()
    })
  }
}
