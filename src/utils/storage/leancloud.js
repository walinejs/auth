const AV = require('leancloud-storage');
const {LEAN_ID, LEAN_KEY, LEAN_SERVER}  = process.env;

if(LEAN_ID && LEAN_KEY) {
  AV.init({
    appId: LEAN_ID,
    appKey: LEAN_KEY,
    // required for leancloud china
    serverURL: LEAN_SERVER
  });
}
module.exports = class {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async get(hashKey) {
    const instance = new AV.Query(this.tableName);
    instance.equalTo('hashKey', hashKey);
    const data = await instance.find().catch(e => {
      if(e.code === 101) {
        return [];
      }
      throw e;
    });

    if(!data.length) {
      return null;
    }

    return data[0].toJSON().hashValue;
  }

  async set(hashKey, hashValue) {
    const Table = AV.Object.extend(this.tableName);
    const instance = new Table();
    instance.set({hashKey, hashValue});

    const acl = new AV.ACL();
    acl.setPublicReadAccess(true);
    acl.setPublicWriteAccess(false);
    instance.setACL(acl);

    return instance.save().then(resp => resp.toJSON());
  }
}