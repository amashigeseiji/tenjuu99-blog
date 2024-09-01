#!/usr/bin/env node

import http from 'http'
import url from 'url'
import fs from 'node:fs/promises'
import { srcDir, distDir } from './lib/dir.js'
import chokidar from 'chokidar'
import generate from './lib/generate.js'
import { watchTemplate } from './lib/applyTemplate.js'

chokidar.watch(srcDir).on('change', (event, path) => {
  generate()
})
watchTemplate()
generate()
const contentType = (ext) => {
    switch (ext) {
      case 'html':
        return 'text/html'
      case 'css':
        return 'text/css'
      case 'js':
      case 'javascript':
        return 'text/javascript'
      case 'json':
        return 'application/json'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'svg':
        return 'image/svg+xml'
      case 'xml':
        return 'application/xml'
      case 'rdf':
        return 'application/rdf+xml.rdf'
      default:
        return 'application/octet-stream'
    }
}

http.createServer((request, response) => {
  console.log(request.method, request.url)
  const url = new URL(`http://${request.headers.host}${request.url}`)
  let path = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
  if (!path.includes('.')) {
    path += '.html'
  }
  fs.readFile(`${distDir}${path}`, 'binary').catch(async (error) => {
    const errorContent = await fs.readFile(`${distDir}/404.html`)
    console.log(error)
    response.writeHead(404)
    response.end(errorContent)
  }).then(file => {
    const ext = path.split('.')[1]
    response.writeHead(200, { 'Content-Type': `${contentType(ext)}; charset=utf-8` })
    response.end(file, 'binary')
  })
}).listen(process.env.PORT || 8000)
