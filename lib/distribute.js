"use strict"
import fs from "node:fs/promises";
import path from 'path'
import { minifyHtml } from './minify.js'
import render from './render.js'
import { styleText } from 'node:util'
import config from './config.js'
import { templateDir } from './dir.js'
import { applyTemplate, warmUpTemplate } from './applyTemplate.js'

const renderPage = async (page) => {
  const template = page.template
  return [page.name, await render(template, page)]
}

const distribute = async (data, deleted, srcDir, distDir) => {
  if (deleted) {
    for (const obj of deleted) {
      console.log(styleText('red', '[unlink]'), `${distDir}${obj.__output}`)
      fs.unlink(`${distDir}${obj.__output}`)
    }
    delete data['__deleted']
  }
  await warmUpTemplate()
  const promises = []
  for (const name in data) {
    promises.push(renderPage(data[name]))
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
}

export default distribute
