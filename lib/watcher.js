import chokidar from 'chokidar'

const container = []
const containerPrior = []

const watchers = {
  push({ paths, event = 'change', callback, watchOptions, prior = false }) {
    if (!paths || !callback || typeof callback !== 'function') {
      throw new Error('Invalid object type for watcher.')
    }
    if (prior) {
      containerPrior.push({ paths, event, callback, watchOptions })
    } else {
      container.push({ paths, event, callback, watchOptions })
    }
  }
}

const watch = () => {
  const callback = (watcher) => {
    const { paths, event, callback, watchOptions } = watcher
    const cwatcher = chokidar.watch(paths, watchOptions)
    if (Array.isArray(event)) {
      event.forEach(e => cwatcher.on(e, callback))
    } else if (typeof event === 'string') {
      cwatcher.on(event, callback)
    } else {
      throw new Error('Invalid event for watcher.')
    }
  }
  containerPrior.forEach(callback)
  container.forEach(callback)
}

export { watchers , watch }
