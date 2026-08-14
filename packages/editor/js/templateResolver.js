/**
 * @vocab テンプレートレゾルバー
 * @test tests/editor/editor-frontmatter-template.test.js
 * テンプレート設定をサーバーから取得して保持する。取得に失敗しても
 * エディタ本体は動作を続ける（テンプレートなしとして扱う）。
 * @param {typeof fetch} [fetchFn]
 * @returns {{ init: () => Promise<void>, templates: Array<object> }}
 */
export function createTemplateResolver(fetchFn = (...a) => fetch(...a)) {
  let templates = []
  return {
    async init() {
      try {
        const res = await fetchFn('/get_frontmatter_templates')
        if (res.ok) {
          const json = await res.json()
          templates = json.templates || []
        }
      } catch (e) {
        console.log('[frontmatter-template] 設定の取得に失敗しました', e)
      }
    },
    get templates() { return templates },
  }
}
