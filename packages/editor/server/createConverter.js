import nodePath from 'node:path'

const rootDir = process.cwd()

/**
 * @vocab: コンバーターファクトリー
 * @vocab: 画像コンバーター
 * @test: tests/editor/editor-image-upload.test.js
 * @param {Function|string|null} converterOrName - 関数、ユーザーパス（./で始まる）、またはビルトイン名
 * @returns {Promise<{ fn: Function, ext: string|null }>}
 */
export async function createConverter(converterOrName = null) {
  if (!converterOrName) return { fn: (buffer) => buffer, ext: null }
  if (typeof converterOrName === 'function') return { fn: converterOrName, ext: null }
  try {
    let module
    if (converterOrName.startsWith('.') || nodePath.isAbsolute(converterOrName)) {
      module = await import(nodePath.resolve(rootDir, converterOrName))
    } else {
      module = await import(`./converters/${converterOrName}.js`)
    }
    return { fn: module.default, ext: module.ext ?? null }
  } catch {
    return { fn: (buffer) => buffer, ext: null }
  }
}
