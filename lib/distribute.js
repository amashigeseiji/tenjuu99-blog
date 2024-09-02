"use strict"
import fs from "node:fs/promises";
import path from 'path'
import { minifyHtml } from './minify.js'
import render from './render.js'
import { styleText } from 'node:util'

const distribute = async (data, deleted, srcDir, distDir) => {
  if (deleted) {
    for (const obj of deleted) {
      console.log(styleText('red', '[unlink]'), `${distDir}${obj.__output}`)
      fs.unlink(`${distDir}${obj.__output}`)
    }
    delete data['__deleted']
  }
  for (const name in data) {
    const template = data[name].template
    const rendered = await render(template, data[name])
    let writeTo = `${distDir}${data[name].__output}`
    fs.mkdir(path.dirname(writeTo), { recursive: true}).then(() => {
      fs.writeFile(writeTo, minifyHtml(rendered))
      console.log(styleText('green', '[generate]'), writeTo)
    })
  }
  const distributeRaw = process.env.DISTRIBUTE_RAW.split(',')
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
