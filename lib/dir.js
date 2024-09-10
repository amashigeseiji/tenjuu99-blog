import config from './config.js'
import { watchers } from './watcher.js'
import fs from 'node:fs'

const rootDir = process.cwd()
const srcDir = `${rootDir}/${config.src_dir}`
const distDir = `${rootDir}/${config.dist_dir}`
const cacheDir = `${rootDir}/.cache`
const pageDir = `${cacheDir}/pages`
const templateDir = `${cacheDir}/template`
const cssDir = `${cacheDir}/css`
const serverDir = `${cacheDir}/server`
const helperDir = `${cacheDir}/helper`
const packageDir = `${srcDir}/packages`
const watch = {
  pageDir: `${srcDir}/pages`,
  templateDir: `${srcDir}/template`,
  cssDir: `${srcDir}/css`,
  serverDir: `${srcDir}/server`,
  helperDir: `${srcDir}/helper`,
}

const cache = () => {
  if (config.package) {
    const packages = config.packages.split(',')
    packages.forEach(dir => {
      if (!fs.existsSync(`${packageDir}/${dir}`)) {
        throw new Error(`"${dir}" package does not exist.`)
      }
      fs.cpSync(dir, cacheDir, { recursive: true })
    })
  }
  fs.cpSync(srcDir, cacheDir, { recursive: true })
}
cache()

watchers.push({
  paths: [srcDir],
  event: ['cange', 'add', 'remove'],
  callback: cache
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
