const pipe = require('pump')
const pify = require('pify')
const defer = require('pull-defer')
const ReadableStream = require('readable-stream')
const cbify = require('cb-ify')
const createIpfsPublisher = require('./ipfsPublisher')
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

start().catch(console.error)

async function start () {

  const publisher = createIpfsPublisher()

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
  setupAssetServer(currentDisk)
  // setupGithubAssetServer(currentDisk)

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

async function fetchJson(url) {
  const res = await fetch(url)
  const result = await res.json()
  return result
}

async function getGithubRepoBranch(repo, branch = 'master') {
  const res = await fetch(`https://api.github.com/repos/${repo}/branches/${branch}`)
  const result = await res.json()
  console.log(result)
  return result
}

// intercept requests from page
function setupAssetServer (db) {
  // console.log('hooking fetch')
  // global.addEventListener('fetch', (event) => {
  //   console.log('saw fetch')
  // //   fetchRequestQueue.push(event)
  // // })
  fetchRequestQueue.on('data', (event) => {
    const req = event.request
    const url = new URL(req.url)

    // only intercept same domain
    if (url.origin !== location.origin) return

    // respond with local content
    event.respondWith((async () => {
      const path = url.pathname.slice()
      console.log('asset server saw request:', path)
      const body = await db.get(path)
      return new Response(body)
    })())
  })
}

//
// setup remote interface
//

//
// establish connection
//

function setupRemoteInterface(handler){
  const connectionListener = new SwGlobalListener(global)
  connectionListener.on('remote', handler)
}

async function loadDefaultInitializer (db) {
  await Promise.all([
    preloadResource(db, '/'),
    preloadResource(db, '/initialize.js')
  ])
  // console.log('bootloader: default initializer loaded')
}

async function preloadResource (db, path) {
  const res = await fetch(path)
  const body = await res.text()
  await db.put(path, body)
}
