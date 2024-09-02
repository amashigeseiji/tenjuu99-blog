import chokidar from 'chokidar'

const container = []

const watchers = {
  push({ paths, event = 'change', callback, watchOptions }) {
    if (!paths || !callback || typeof callback !== 'function') {
      throw new Error('Invalid object type for watcher.')
    }
    container.push({ paths, event, callback, watchOptions })
  }
}

const watch = () => {
  container.forEach((watcher) => {
    const { paths, event, callback, watchOptions } = watcher
    const cwatcher = chokidar.watch(paths, watchOptions)
    if (Array.isArray(event)) {
      event.forEach(e => cwatcher.on(e, callback))
    } else if (typeof event === 'string') {
      cwatcher.on(event, callback)
    } else {
      throw new Error('Invalid event for watcher.')
    }
  })
}

export { watchers , watch }
