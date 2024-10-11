import config from './config.js'
import fs from 'node:fs'
import { styleText } from 'node:util'
import path from 'path'
import { fileURLToPath } from 'url';

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
  jsDir: `${srcDir}/js`,
}
const __filename = fileURLToPath(import.meta.url);
const packageDirCore = path.dirname(__filename) + '/../packages'

let alreadyCached = false

const cache = () => {
  if (alreadyCached) {
    return
  }
  if (config.packages) {
    const packages = config.packages.split(',')
    packages.forEach(dir => {
      if (fs.existsSync(`${packageDirCore}/${dir}`)) {
        const helper = config.helper.split(',')
        helper.push(`${dir}.js`)
        config.helper = helper.join(',')
        console.log(styleText('blue', `[cache] enable core package: ${dir}`))
        fs.cpSync(`${packageDirCore}/${dir}`, cacheDir, { recursive: true })
      }
      if (fs.existsSync(`${packageDir}/${dir}`)) {
        const helper = config.helper.split(',')
        helper.push(`${dir}.js`)
        config.helper = helper.join(',')
        console.log(styleText('blue', `[cache] enable package: ${dir}`))
        fs.cpSync(`${packageDir}/${dir}`, cacheDir, { recursive: true })
      }
    })
  }
  fs.cpSync(srcDir, cacheDir, {
    recursive: true,
    force: true,
    filter: (src, dist) => !src.startsWith(packageDir)
  })
  console.log(styleText('blue', '[cache] finish copy'))
  alreadyCached = true
}
// import パスの解決の関係上、関数コールより前にファイルが読まれることがあるためここで呼んでおく
// 子プロセスで起動する場合は二度呼ばれることになる
// generate の中でもコールしているが、同一プロセスであれば alreadyCached 変数で制御される
cache()

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
  watch,
  cache,
  packageDir,
  packageDirCore
}
