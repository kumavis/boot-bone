const IpfsAPI = require('ipfs-api')
const Ipfs = require('ipfs')
const through = require('through2').obj
const endOfStream = require('end-of-stream')
const concatStream = require('concat-stream')
const pipe = require('pump')
const pipeline = require('pumpify').obj
const pify = require('pify')

module.exports = createIpfsPublisher


function createIpfsPublisher() {
  const ipfsApi = IpfsAPI('ipfs.infura.io', '443', { protocol: 'https' })
  global.ipfsApi = ipfsApi

  const ipfs = new Ipfs({
    config: {
      Addresses: {
        // disable webrtc
        Swarm: [],
      }
    }
  })
  const ipfsReady = new Promise((resolve) => ipfs.once('ready', resolve))
  
  ipfs.on('ready', (...args) => console.log('ipfs ready', args))
  ipfs.on('error', (...args) => console.log('ipfs error', args))
  ipfs.on('init', (...args) => console.log('ipfs init', args))
  ipfs.on('start', (...args) => console.log('ipfs start', args))
  ipfs.on('stop', (...args) => console.log('ipfs stop', args))
  global.ipfs = ipfs

  return {
    ipfsApi,
    resolveLatest: async () => {
      const result = await ipfsApi.name.resolve('/ipns/QmNadfNHENpEu5GDwKSJBK19tXf9i9K4R6i8FGe1Xraagg')
      const path = result.Path
      const cid = path.slice('/ipfs/'.length)
      return cid
    },
    downloadVersion: async (versionName, currentDisk) => {
      // wait for ipfs init
      await ipfsReady

      // prepare streams
      const filesStream = await ipfs.files.get(versionName)
      const fileDownloadStream = through((file, _, cb) => {
        streamToEnd(file.content, (err, fileContent) => {
          if (err) return cb(err)
          file.data = fileContent
          cb(null, file)
        })
      })
      const fileWriteStream = through((file, _, cb) => {
        const path = file.path.slice(versionName.length)
        console.log(`writing ${path}...`)
        currentDisk.put(path, file.data, cb)
      })

      const pipelineComplete = pify(endOfStream)(fileWriteStream, { readable: false })
      
      pipe(
        // read all nodes
        filesStream,
        // ignore directories
        filter((file) => file.content),
        // load file contents
        fileDownloadStream,
        // write to disk
        fileWriteStream
      )

      await pipelineComplete
    },
  }
}

function filter(testFn) {
  return through((chunk, enc, cb) => {
    const passed = testFn(chunk)
    if (passed) {
      cb(null, chunk)
    } else {
      cb()
    }
  })
}

function streamToEnd(inputStream, cb){
  const stream = concatStream((result) => {
    cb(null, result)
  })
  stream.once('error', cb)
  inputStream.pipe(stream)
}