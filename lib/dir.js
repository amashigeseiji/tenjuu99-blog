const rootDir = process.cwd()
const srcDir = `${rootDir}/${process.env.SRC_DIR}`
const distDir = `${rootDir}/${process.env.DIST_DIR}`
const pageDir = `${srcDir}/pages`
const templateDir = `${srcDir}/template`
const cssDir = `${srcDir}/css`
const cacheDir = `${rootDir}/.cache`

export {
  rootDir,
  srcDir,
  distDir,
  pageDir,
  templateDir,
  cssDir,
  cacheDir,
}
