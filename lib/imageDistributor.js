import fs from 'node:fs'
import path from 'node:path'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'tiff', 'heic', 'bmp'])

/**
 * @vocab ビルド画像配布器
 * @test tests/ssg-core/imageDistributor.test.js
 */
export async function distributeImages(srcDir, distDir, { fn, ext }) {
  const files = await collectFiles(srcDir)
  for (const relPath of files) {
    const srcPath = path.join(srcDir, relPath)
    const fileExt = path.extname(relPath).slice(1).toLowerCase()
    const isImage = IMAGE_EXTENSIONS.has(fileExt)
    const baseName = path.basename(relPath, path.extname(relPath))
    const subDir = path.dirname(relPath)
    if (fn && isImage) {
      const outputName = ext ? `${baseName}.${ext}` : path.basename(relPath)
      const distPath = path.join(distDir, subDir, outputName)
      await writeConvertedFile(srcPath, distPath, fn)
    } else {
      const distPath = path.join(distDir, relPath)
      fs.mkdirSync(path.dirname(distPath), { recursive: true })
      fs.copyFileSync(srcPath, distPath)
    }
  }
}

/**
 * @vocab ビルド画像配布器
 * @test tests/ssg-core/imageDistributor.test.js
 */
export async function collectFiles(dir) {
  const result = []
  const walk = (current, rel) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relPath = rel ? path.join(rel, entry.name) : entry.name
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), relPath)
      } else {
        result.push(relPath)
      }
    }
  }
  walk(dir, '')
  return result
}

/**
 * @vocab ビルド画像配布器
 * @test tests/ssg-core/imageDistributor.test.js
 */
export async function writeConvertedFile(srcPath, distPath, fn) {
  const buffer = fs.readFileSync(srcPath)
  const converted = await fn(buffer)
  fs.mkdirSync(path.dirname(distPath), { recursive: true })
  fs.writeFileSync(distPath, converted)
}
