const rootDir = process.cwd()
const srcDir = `${rootDir}/${process.env.SRC_DIR}`
const distDir = `${rootDir}/${process.env.DIST_DIR}`
const templateDir = `${rootDir}/${process.env.TEMPLATE_DIR}`
const cacheDir = `${rootDir}/.cache`

export {
  rootDir,
  srcDir,
  distDir,
  templateDir,
  cacheDir,
}
