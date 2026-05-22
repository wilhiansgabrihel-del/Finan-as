const FinDB = {
  name: "financas_db",
  version: 1,
  store: "users",

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(FinDB.name, FinDB.version);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(FinDB.store)) {
          db.createObjectStore(FinDB.store, { keyPath: "loginName" });
        }
      };
    });
  },

  async syncUser(loginName, snapshot) {
    if (!window.indexedDB) return;
    try {
      const db = await FinDB.open();
      const tx = db.transaction(FinDB.store, "readwrite");
      tx.objectStore(FinDB.store).put({ loginName, snapshot, updatedAt: Date.now() });
    } catch {
      /* IndexedDB opcional */
    }
  },
};
