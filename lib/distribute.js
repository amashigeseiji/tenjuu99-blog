"use strict"
import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from 'path'
import { minifyHtml } from './minify.js'
import render from './render.js'
import { styleText } from 'node:util'
import config from './config.js'
import { cacheDir } from './dir.js'
import { applyTemplate, warmUpTemplate } from './applyTemplate.js'

const indexFile = `${cacheDir}/index.json`

const renderPage = async (page) => {
  const template = page.template
  return [page.name, await render(template, page)]
}

const distribute = async (data, srcDir, distDir) => {
  await warmUpTemplate()
  const promises = []
  const newIndex = []
  for (const name in data) {
    if (!data[name].distribute) {
      continue
    }
    promises.push(renderPage(data[name]))
    newIndex.push({ name: data[name].name, url: data[name].url, __output: data[name].__output })
  }
  const renderedString = await Promise.all(promises)
  for (const page of renderedString) {
    const [ pageName, rendered ] = page
    let writeTo = `${distDir}${data[pageName].__output}`
    fs.mkdir(path.dirname(writeTo), { recursive: true}).then(() => {
      fs.writeFile(writeTo, minifyHtml(rendered))
      console.log(styleText('green', '[generate]'), writeTo)
    })
  }
  const distributeRaw = config.distribute_raw.split(',')
  distributeRaw.forEach((copyDir) => {
    fs.readdir(`${srcDir}/${copyDir}/`).then(async files => {
      await fs.stat(`${distDir}/${copyDir}/`).catch(async err => await fs.mkdir(`${distDir}/${copyDir}/`))
      files.forEach(file => {
        fs.copyFile(`${srcDir}/${copyDir}/${file}`, `${distDir}/${copyDir}/${file}`)
        console.log(styleText('green', '[copy]'), `${srcDir}/${copyDir}/${file} => ${distDir}/${copyDir}/${file}`)
      })
    })
  })

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir)
  }
  fs.readFile(indexFile, 'utf8')
    .then(text => {
      const oldIndex = JSON.parse(text)
      deleted = oldIndex.filter(oi => !newIndex.map(ni => ni.__output).includes(oi.__output))
      fs.writeFile(indexFile, JSON.stringify(newIndex))
      if (deleted) {
        for (const obj of deleted) {
          console.log(styleText('red', '[unlink]'), `${distDir}${obj.__output}`)
          fs.unlink(`${distDir}${obj.__output}`)
        }
      }
    })
    .catch(error => {
      fs.writeFile(indexFile, JSON.stringify(newIndex))
    })
}

export default distribute
