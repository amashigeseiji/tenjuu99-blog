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
      // TODO: 将来的には hookDir を導入し、hooks/ からフックを読み込む仕組みにする。
      // 現状はフックの解決が helperDir に依存しているため、config.hooks に登録済みのファイルを
      // helper 自動登録から除外することで helper として公開されないようにしている（workaround）。
      const hookFiles = new Set(
        config.hooks ? Object.values(config.hooks).flat() : []
      )
      if (fs.existsSync(`${packageDirCore}/${dir}`)) {
        const helper = config.helper.split(',').filter(Boolean)
        helper.push(`${dir}.js`)
        const pkgHelperDir = `${packageDirCore}/${dir}/helper`
        if (fs.existsSync(pkgHelperDir)) {
          fs.readdirSync(pkgHelperDir)
            .filter(f => f.endsWith('.js') && !helper.includes(f) && !hookFiles.has(f))
            .forEach(f => helper.push(f))
        }
        config.helper = helper.join(',')
        console.log(styleText('blue', `[cache] enable core package: ${dir}`))
        fs.cpSync(`${packageDirCore}/${dir}`, cacheDir, { recursive: true })
      }
      if (fs.existsSync(`${packageDir}/${dir}`)) {
        const helper = config.helper.split(',').filter(Boolean)
        helper.push(`${dir}.js`)
        const pkgHelperDir = `${packageDir}/${dir}/helper`
        if (fs.existsSync(pkgHelperDir)) {
          fs.readdirSync(pkgHelperDir)
            .filter(f => f.endsWith('.js') && !helper.includes(f) && !hookFiles.has(f))
            .forEach(f => helper.push(f))
        }
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
