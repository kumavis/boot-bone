const pipe = require('pump')
const pify = require('pify')
const defer = require('pull-defer')
const ReadableStream = require('readable-stream')
const cbify = require('cb-ify')
const { dnodeGetFirstRemote, mapObject } = require('./util')
const noop = function(){}

const dnode = require('dnode')
const SwGlobalListener = require('sw-stream/lib/sw-global-listener.js')
const createMultidisk = require('./multidisk')

// listen for clients
const remoteConnectionQueue = new ReadableStream({ objectMode: true })
remoteConnectionQueue._read = noop
setupRemoteInterface((portStream) => {
  remoteConnectionQueue.push(portStream)
})

// listen for requests
const fetchRequestQueue = new ReadableStream({ objectMode: true })
fetchRequestQueue._read = noop
global.addEventListener('fetch', (event) => {
  fetchRequestQueue.push(event)
})

module.exports = createBootloader

function createBootloader({ publisher }){
  return { start }

  async function start () {

    // setup dbs
    const multidisk = createMultidisk()
    global.multidisk = multidisk
    const metaDb = multidisk.getDisk('meta')

    let versionName = await multidisk.getCurrentDiskName()
    const isInitialized = Boolean(versionName)
    let currentDisk

    // first time init
    if (isInitialized) {
      console.log(`loaded version: "${versionName}"`)
      currentDisk = multidisk.getDisk(versionName)
    } else {
      console.log('fetching latest...')
      versionName = await publisher.resolveLatest()
      console.log('resolved latest version:', versionName)
      currentDisk = await multidisk.createNewDisk(versionName)
      console.log('downloading...')
      await publisher.downloadVersion(versionName, currentDisk)
      console.log('download complete.')
      await multidisk.setCurrentDisk(versionName)
    }

    // setup asset server
    const backgroundAppSrc = (await currentDisk.get('/back.js')).toString()
    console.log(backgroundAppSrc)
    const defineBackground = new Function(backgroundAppSrc)
    console.log(defineBackground)
    // umd build - export gets set on global
    defineBackground()
    const background = global.createBackgroundProcess({ currentDisk, fetchRequestQueue })

    // establish connections with clients
    remoteConnectionQueue.on('data', async (portStream) => {
      const host = createRemoteInterface()
      pipe(
        portStream,
        host,
        portStream,
        console.error
      )
      const remoteClient = await dnodeGetFirstRemote(host)
      console.log('bootloader: dnode connected')
    })


    function createRemoteInterface () {
      let interface = {
        // // root db access
        // root: {
        //   put: db.put.bind(db),
        //   get: db.get.bind(db),
        // },
        // // meta
        // meta: {
        //   put: meta.put.bind(meta),
        //   get: meta.get.bind(meta),
        // },
        // // currentDisk
        // current: {
        //   put: currentDisk.put.bind(currentDisk),
        //   get: currentDisk.get.bind(currentDisk),
        // },
      }
      // add promise support
      interface = mapObject(interface, (key, value) => cbify(value))
      const host = dnode(interface, { emit: 'object' })

      return host
    }

  }
}


//
// setup remote interface
//

function setupRemoteInterface(handler){
  const connectionListener = new SwGlobalListener(global)
  connectionListener.on('remote', handler)
}
