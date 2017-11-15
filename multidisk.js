// const leveljs = require('level-js')
const memdown = require('memdown')
const levelup = require('levelup')

module.exports = createMultidisk

function createMultidisk () {
  // const rootDb = new levelup(leveljs('root-disk'))
  const rootDb = new levelup(new memdown())
  const metaDb = simpleSublevel(rootDb, 'meta')
  const disksDb = simpleSublevel(rootDb, 'disks')

  const interface = {
    getCurrentDiskName: async () => {
      const diskName = await gentleGet(metaDb, 'currentDisk')
      return diskName
    },
    getCurrentDisk: async () => {
      const diskName = await interface.getCurrentDiskName()
      return interface.getDisk(diskName)
    },
    setCurrentDisk: async (diskName) => {
      return await metaDb.put('currentDisk', diskName)
    },
    createNewDisk: async (diskName) => {
      const disk = interface.getDisk(diskName)
      return disk
    },
    getDisk: (diskName) => {
      return simpleSublevel(disksDb, diskName)
    },
  }

  return interface
}


function simpleSublevel (db, prefix) {
  return {
    put: (key, value, opts, cb) => db.put(prefix + '/' + key, value, opts, cb),
    get: (key, opts, cb) => db.get(prefix + '/' + key, opts, cb),
  }
}

async function gentleGet (db, key) {
  try {
    return await db.get(key)
  } catch (err) {
    return null
  }
}
