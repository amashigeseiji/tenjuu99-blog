import fs from "node:fs/promises";
import { templateDir, cssDir } from './dir.js'
import { watchers } from './watcher.js'

let staticFilesContainer = {}
let loaded = false

const warmUp = async () => {
  if (loaded) {
    return
  }
  const templateFiles = await fs.readdir(templateDir).then(files => files.map(f => [`template/${f}`, `${templateDir}/${f}`]))
  const cssFiles = await fs.readdir(cssDir).then(files => files.map(f => [`css/${f}`, `${cssDir}/${f}`]))
  const files = [...templateFiles, ...cssFiles]
  const loadFiles = files.map(file => fs.readFile(file[1], 'utf8').then(content => [file[0], content]))
  staticFilesContainer = Object.fromEntries(await Promise.all(loadFiles))
  loaded = true
}

const staticFile = (name) => {
  if (!loaded) {
    throw new Error('not initialized')
  }
  if (staticFilesContainer[name]) {
    return staticFilesContainer[name]
  }
  if (name.indexOf('template/') === 0) {
    return fs.readFile(templateDir + '/' + name.replace('template/', ''))
  }
}

const staticFiles = () => {
  return Object.entries(staticFilesContainer)
}
watchers.push({
  paths: [cssDir, templateDir],
  callback: async () => {
    loaded = false
    await warmUp()
  }
})

export { staticFile, staticFiles, warmUp }
