import config from './config.js'
import { watchers } from './watcher.js'
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
        console.log(styleText('blue', `[cache] enable core package: ${dir}`))
        fs.cpSync(`${packageDirCore}/${dir}`, cacheDir, { recursive: true })
      }
      if (fs.existsSync(`${packageDir}/${dir}`)) {
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

let packageDirectoriesLoaded = []
const packageDirectories = () => {
  if (packageDirectoriesLoaded.length > 0) {
    return packageDirectoriesLoaded
  }
  const watchTargetDir = ['pages', 'template', 'css', 'helper', 'server', 'js']
  const packages = config.packages.split(',').reduce((prev, packageName) => {
    if (fs.existsSync(`${packageDir}/${packageName}`)) {
      prev.push(fs.realpathSync(`${packageDir}/${packageName}`))
    }
    prev.push(fs.realpathSync(`${packageDirCore}/${packageName}`))
    return prev
  }, [srcDir])

  for (const baseDir of packages) {
    for (const target of watchTargetDir) {
      if (!fs.existsSync(`${baseDir}/${target}`)) {
        continue;
      }
      const targetDir = `${baseDir}/${target}`
      packageDirectoriesLoaded.push(targetDir)
    }
  }
  return packageDirectoriesLoaded
}

const resolveDestinationPath = (path) => {
  for (const targetDir of packageDirectories()) {
    if (path.startsWith(targetDir)) {
      const dir = targetDir.split('/').pop()
      const srcFile = `${dir}${path.replace(targetDir, '')}`
      return `${cacheDir}/${srcFile}`
    }
  }
}
watchers.push({
  paths: [srcDir, packageDir, packageDirCore],
  event: ['change', 'add', 'unlink'],
  callback: ( path ) => {
    const dest = resolveDestinationPath(path)
    if (!dest) {
      console.log(styleText('red', `[watcher] cannot resolve destination path: ${path}`))
      alreadyCached = false
      cache()
      return true
    }
    if (fs.existsSync(path)) {
      fs.cpSync(path, dest, { force: true })
      console.log(styleText('blue', `update ${path} => ${dest}`))
    } else {
      fs.unlinkSync(dest)
      console.log(styleText('red', `unlink ${dest}`))
    }
  },
  watchOptions: {
    ignoreInitial: true
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
  watch,
  cache,
  packageDir,
  packageDirCore
}
