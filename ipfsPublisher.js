const ipfsAPI = require('ipfs-api')

module.exports = createIpfsPublisher


function createIpfsPublisher() {
  const ipfs = ipfsAPI('ipfs.infura.io', '443', { protocol: 'https' })
  global.ipfs = ipfs

  return {
    ipfs,
    resolveLatest: async () => {
      const result = await ipfs.name.resolve('/ipns/QmNadfNHENpEu5GDwKSJBK19tXf9i9K4R6i8FGe1Xraagg')
      return result.Path
    },
    downloadVersion: async (versionName, currentDisk) => {
      // const stream = await ipfs.files.get(versionName)
      // stream.on('data', console.log)
      const result = await ipfs.dag.tree(versionName)
      console.log('ipfs.dag.tree', result)
    },
  }
}