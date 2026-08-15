/**
 * @vocab サイドバータブ
 * @test tests/editor/sidebarTabs.test.js
 * サイドバーのタブ切り替えを配線する。タブの選択表示と対応するコンテンツの表示を切り替え、
 * タブごとの副作用（画像一覧の取得・画像詳細からの離脱・新規作成フォームの初期化）は
 * コールバックに委ねる。
 * @param {{ doc?: Document, onImagesOpened?: () => void, onImagesLeft?: () => void,
 *           onNewFileOpened?: () => void }} [options]
 * @returns {{ switchTab: (tabName: string) => void }}
 */
export function initSidebarTabs({ doc = document, onImagesOpened = () => {}, onImagesLeft = () => {}, onNewFileOpened = () => {} } = {}) {
  const tabs = doc.querySelectorAll('.sidebar-tab')
  const contents = doc.querySelectorAll('.sidebar-tab-content')
  const switchTab = (tabName) => {
    tabs.forEach(t => {
      const selected = t.dataset.tab === tabName
      t.classList.toggle('active', selected)
      t.setAttribute('aria-selected', String(selected))
      t.tabIndex = selected ? 0 : -1
    })
    contents.forEach(c => {
      const selected = c.dataset.tab === tabName
      c.classList.toggle('active', selected)
      c.toggleAttribute('hidden', !selected)
    })
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab)
      if (tab.dataset.tab === 'images') {
        onImagesOpened()
      } else {
        onImagesLeft()
      }
      if (tab.dataset.tab === 'new-file') {
        onNewFileOpened()
      }
    })
  })
  return { switchTab }
}
