"use strict"
import fs from "node:fs/promises";
import path from 'path'
import { minifyHtml } from './minify.js'
import render from './applyTemplate.js'

const distribute = async (data, srcDir, distDir) => {
  for (const name in data) {
    const template = data[name].template ? data[name].template : 'default.html'
    const rendered = await render(template, data[name])
    let writeTo = ''
    if (name === 'index') {
      writeTo = `${distDir}/index.html`
    } else {
      writeTo = `${distDir}${data[name].url}.` + (data[name]?.ext ? data[name]?.ext : 'html')
    }
    fs.mkdir(path.dirname(writeTo), { recursive: true}).then(() => {
      fs.writeFile(writeTo, minifyHtml(rendered))
      console.log(`generate ${writeTo}`)
    })
  }
  fs.readdir(`${srcDir}/image/`).then(async images => {
    await fs.stat(`${distDir}/image/`).catch(async err => await fs.mkdir(`${distDir}/image/`))
    images.forEach(image => {
      fs.copyFile(`${srcDir}/image/${image}`, `${distDir}/image/${image}`)
    })
  })
}

export default distribute
