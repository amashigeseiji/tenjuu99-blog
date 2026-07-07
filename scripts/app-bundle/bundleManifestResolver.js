import path from 'node:path'

/**
 * @vocab: 配置マッピング解決器
 * @test: tests/app-bundle/bundleManifestResolver.test.js
 * @param {{entries: Array<{src: string, dest: string}>}} manifest
 * @param {Record<string, string>} roots - ルートキー -> 絶対パス
 * @param {string} appOutputPath - 組み立て先 .app の絶対パス
 * @returns {Array<{src: string, dest: string}>}
 */
export function resolve(manifest, roots, appOutputPath) {
  return manifest.entries.map(({ src, dest }) => {
    const [rootKey, ...restParts] = src.split('/')
    const root = roots[rootKey]
    if (!root) {
      throw new Error(`unknown manifest root: "${rootKey}"`)
    }
    const rest = restParts.join('/')
    return {
      src: ensureWithin(root, rest ? path.join(root, rest) : root, `src "${src}"`),
      dest: ensureWithin(appOutputPath, path.join(appOutputPath, dest), `dest "${dest}"`),
    }
  })
}

// マニフェストの記述ミス（`../` によるルート外への脱出）をビルド時に検出する
function ensureWithin(base, resolved, label) {
  const relative = path.relative(base, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`manifest ${label} escapes its root: resolved to "${resolved}"`)
  }
  return resolved
}
