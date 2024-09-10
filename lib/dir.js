import config from './config.js'
import { watchers } from './watcher.js'

const rootDir = process.cwd()
const srcDir = `${rootDir}/${config.src_dir}`
const distDir = `${rootDir}/${config.dist_dir}`
const cacheDir = `${rootDir}/.cache`
const pageDir = `${cacheDir}/pages`
const templateDir = `${cacheDir}/template`
const cssDir = `${cacheDir}/css`
const serverDir = `${cacheDir}/server`
const helperDir = `${cacheDir}/helper`
const watch = {
  pageDir: `${srcDir}/pages`,
  templateDir: `${srcDir}/template`,
  cssDir: `${srcDir}/css`,
  serverDir: `${srcDir}/server`,
  helperDir: `${srcDir}/helper`,
}

fs.cpSync(srcDir, cacheDir, { recursive: true })

watchers.push({
  paths: [srcDir],
  callback: () => {
    fs.cpSync(srcDir, cacheDir, { recursive: true })
  }
})
export {
  rootDir,
  srcDir,
  distDir,
  pageDir,
  templateDir,
  cssDir,
  cacheDir,
  serverDir,
  helperDir,
  watch
}
