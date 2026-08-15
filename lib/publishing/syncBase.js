import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import nodePath from 'node:path'

/**
 * 同期の基点の既定の置き場所。コンテンツルート内の非公開の場所で、`.cache/` と違い
 * 消してよいものではない（消すと基点が失われ、手元で編集しただけの記事が「両側で変わった」に退化する）。
 * @param {string} contentRoot
 * @returns {string}
 */
export function defaultSyncBaseLocation(contentRoot) {
  return nodePath.join(contentRoot, '.blog', 'sync-base.json')
}

/**
 * @vocab 同期の基点
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * ファイルごとの「揃えた時点の内容」（フィンガープリント）の記録。git では refs（merge-base）が
 * 環境側で自動的に担っていた知識を、システム自身が保持する。進める・消す・参照するの三操作を持ち、
 * コンテンツルートごとにプロセスをまたいで保つ（毎回置き場所から読み、変更のたびに書き戻す）。
 * @param {{ location: string }} options - 置き場所（JSON ファイル）
 * @returns {{
 *   get: (filePath: string) => import('./fingerprint.js').Fingerprint|null,
 *   advance: (filePath: string, fingerprint: import('./fingerprint.js').Fingerprint) => void,
 *   forget: (filePath: string) => void,
 *   entries: () => Array<[string, import('./fingerprint.js').Fingerprint]>,
 * }}
 */
export function createSyncBase({ location }) {
  const load = () => {
    if (!existsSync(location)) return {}
    try {
      const parsed = JSON.parse(readFileSync(location, 'utf-8'))
      return parsed && typeof parsed.files === 'object' && parsed.files ? parsed.files : {}
    } catch {
      return {}
    }
  }
  const save = (files) => {
    mkdirSync(nodePath.dirname(location), { recursive: true })
    const tmp = `${location}.tmp`
    writeFileSync(tmp, JSON.stringify({ version: 1, files }, null, 2) + '\n')
    renameSync(tmp, location)
  }
  // 記録は毎回置き場所から読み直す（インスタンス内に持たない）。同じプロセス内で同じコンテンツルートを
  // 開く別のインスタンス（エンドポイント呼び出しごとに手段が組み立て直される）と記録がずれないため。
  // 読み直し→変更→書き戻しは同期的に一続きで行い、途中で他の処理が挟まらない。
  return {
    get: (filePath) => {
      const files = load()
      return Object.hasOwn(files, filePath) ? files[filePath] : null
    },
    advance: (filePath, fingerprint) => {
      const files = load()
      if (files[filePath] === fingerprint) return
      files[filePath] = fingerprint
      save(files)
    },
    forget: (filePath) => {
      const files = load()
      if (!Object.hasOwn(files, filePath)) return
      delete files[filePath]
      save(files)
    },
    entries: () => Object.entries(load()),
  }
}
