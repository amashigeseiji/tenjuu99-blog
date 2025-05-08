import helper from './helper.js'

const contentTypes = {
  'text': 'text/plain',
  'html': 'text/html',
  'css': 'text/css',
  'js': 'text/javascript',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'avif': 'image/avif',
  'svg': 'image/svg+xml',
  'json': 'application/json',
  'xml': 'application/xml',
  'rdf': 'application/rdf+xml',
  'rss': 'application/rss+xml',
  'pdf': 'application/pdf',
}

const contentType = (ext) => {
  if (helper['contentTypes']) {
    const additionalContentTypes = helper['contentTypes']
    if (additionalContentTypes[ext]) {
      return additionalContentTypes[ext]
    }
  }
  if (contentTypes[ext]) {
    return contentTypes[ext]
  }
  return 'application/octet-stream'
}

export default contentType
