import { resolveDisplayTarget } from './displayTargetResolver.js'

/**
 * @vocab 表示対象ナビゲーター
 * @test tests/editor/displayTargetNavigator.test.js
 * 表示対象の切り替えをURLに宣言し（URLが資源を特定する）、URLから表示を再構成する。
 * 表示の実体（記事を開く・画像詳細を開く・何も選ばない）はコールバックとして受け取り、
 * ナビゲーターはURLと表示の一致だけを引き受ける。
 * @param {{ win: Pick<Window, 'location' | 'history' | 'addEventListener'>,
 *           showArticle: (path: string) => Promise<void> | void,
 *           showImage: (path: string) => Promise<void> | void,
 *           showNone: () => void }} options
 * @returns {{ declareTarget: (target: { type: string, path: string } | null, options?: { replace?: boolean }) => void,
 *             restoreFromUrl: (url?: URL) => Promise<void>,
 *             currentTarget: () => { type: string, path: string } | null,
 *             init: () => void }}
 */
export function createDisplayTargetNavigator({ win, showArticle, showImage, showNone }) {
  const declareTarget = (target, { replace = false } = {}) => {
    const newUrl = new URL(win.location)
    if (target?.type === 'image') {
      newUrl.searchParams.delete('md')
      newUrl.searchParams.set('image', target.path)
    } else if (target?.type === 'article') {
      newUrl.searchParams.set('md', target.path)
      newUrl.searchParams.delete('image')
    } else {
      newUrl.searchParams.delete('md')
      newUrl.searchParams.delete('image')
    }
    win.history[replace ? 'replaceState' : 'pushState']({}, '', newUrl)
  }

  const restoreFromUrl = async (url = new URL(win.location)) => {
    const target = resolveDisplayTarget(url)
    if (target?.type === 'image') {
      await showImage(target.path)
    } else if (target?.type === 'article') {
      await showArticle(target.path)
    } else {
      showNone()
    }
  }

  const currentTarget = () => resolveDisplayTarget(new URL(win.location))

  return {
    declareTarget,
    restoreFromUrl,
    currentTarget,
    init() {
      // ブラウザの戻る/進むに対応: URLから表示対象を再構成する
      win.addEventListener('popstate', () => restoreFromUrl())
    },
  }
}
