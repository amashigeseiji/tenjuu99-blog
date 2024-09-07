import config from './config.js'

const rootDir = process.cwd()
const srcDir = `${rootDir}/${config.src_dir}`
const distDir = `${rootDir}/${config.dist_dir}`
const pageDir = `${srcDir}/pages`
const templateDir = `${srcDir}/template`
const cssDir = `${srcDir}/css`
const cacheDir = `${rootDir}/.cache`
const serverDir = `${srcDir}/server`

export {
  rootDir,
  srcDir,
  distDir,
  pageDir,
  templateDir,
  cssDir,
  cacheDir,
  serverDir
}
