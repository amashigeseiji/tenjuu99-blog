import { describe, it } from 'node:test'
import assert from 'node:assert'
import { initSidebarTabs } from '../../packages/editor/js/sidebarTabs.js'

const makeFakeTab = (tab) => ({
  dataset: { tab },
  attrs: {},
  tabIndex: -1,
  classList: {
    classes: new Set(),
    toggle(c, on) { on ? this.classes.add(c) : this.classes.delete(c) },
  },
  setAttribute(name, value) { this.attrs[name] = value },
  listeners: {},
  addEventListener(ev, fn) { this.listeners[ev] = fn },
  click() { this.listeners.click?.() },
})

const makeFakeContent = (tab) => ({
  dataset: { tab },
  hidden: false,
  classList: {
    classes: new Set(),
    toggle(c, on) { on ? this.classes.add(c) : this.classes.delete(c) },
  },
  toggleAttribute(name, on) { if (name === 'hidden') this.hidden = on },
})

const makeFakeDoc = (tabNames) => {
  const tabs = tabNames.map(makeFakeTab)
  const contents = tabNames.map(makeFakeContent)
  return {
    tabs,
    contents,
    doc: {
      querySelectorAll: (sel) => sel === '.sidebar-tab' ? tabs : contents,
    },
  }
}

describe('サイドバータブ は タブの選択と対応するコンテンツの表示を切り替えられる', () => {
  it('選んだタブだけが選択表示になり、対応するコンテンツだけが見える', () => {
    const { doc, tabs, contents } = makeFakeDoc(['files', 'images', 'new-file'])
    const ui = initSidebarTabs({ doc })
    ui.switchTab('images')
    assert.ok(tabs[1].classList.classes.has('active'))
    assert.ok(!tabs[0].classList.classes.has('active'))
    assert.strictEqual(tabs[1].attrs['aria-selected'], 'true')
    assert.strictEqual(tabs[1].tabIndex, 0)
    assert.strictEqual(contents[1].hidden, false)
    assert.strictEqual(contents[0].hidden, true)
  })

  it('タブごとの副作用がコールバックへ届く', () => {
    const { doc, tabs } = makeFakeDoc(['files', 'images', 'new-file'])
    const events = []
    initSidebarTabs({
      doc,
      onImagesOpened: () => events.push('images-opened'),
      onImagesLeft: () => events.push('images-left'),
      onNewFileOpened: () => events.push('new-file-opened'),
    })
    tabs[1].click()
    tabs[2].click()
    tabs[0].click()
    assert.deepStrictEqual(events, ['images-opened', 'images-left', 'new-file-opened', 'images-left'])
  })
})
