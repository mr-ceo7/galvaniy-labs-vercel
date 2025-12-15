import { User, Report, DbSchema, ManualPage } from '../types';

const DB_KEY = 'physics_labs_db';
const SESSION_KEY = 'physics_labs_session';

// --- IndexedDB Setup for Large Manuals ---
const IDB_NAME = 'GalvaniyLabsManualDB';
const IDB_VERSION = 2; // Incremented version for new store
const PAGE_STORE = 'pages';
const FILE_STORE = 'files'; // New store for raw PDF

const openIDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(PAGE_STORE)) {
        db.createObjectStore(PAGE_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- LocalStorage Helpers (Users/Reports) ---
const getDb = (): DbSchema => {
  const data = localStorage.getItem(DB_KEY);
  if (!data) {
    return { users: [], reports: {}, manualPages: [] };
  }
  return JSON.parse(data);
};

const saveDb = (data: DbSchema) => {
  try {
    // We strictly remove manualPages from LocalStorage payload to save space
    const payload = { ...data, manualPages: [] }; 
    localStorage.setItem(DB_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Storage Quota Exceeded", e);
    alert("Storage limit reached. Please clear some reports.");
  }
};

export const storageService = {
  // --- User & Session (Sync - LocalStorage) ---
  getUser: (email: string): User | undefined => {
    const db = getDb();
    return db.users.find((u: User) => u.email === email);
  },

  registerUser: (email: string): User => {
    const db = getDb();
    let user = db.users.find((u: User) => u.email === email);
    if (!user) {
      user = {
        email,
        role: email.includes('admin') ? 'admin' : 'student',
        registeredAt: new Date().toISOString(),
        isRevoked: false,
        reportsGenerated: 0,
        customLimit: 3
      };
      db.users.push(user);
      saveDb(db);
    }
    return user;
  },

  getAllUsers: (): User[] => {
    return getDb().users;
  },

  revokeUser: (email: string) => {
    const db = getDb();
    const user = db.users.find((u: User) => u.email === email);
    if (user) {
      user.isRevoked = !user.isRevoked;
      saveDb(db);
    }
  },

  updateUserLimit: (email: string, newLimit: number) => {
    const db = getDb();
    const user = db.users.find((u: User) => u.email === email);
    if (user) {
      user.customLimit = newLimit;
      saveDb(db);
    }
  },

  saveReport: (email: string, report: Report) => {
    const db = getDb();
    if (!db.reports[email]) {
      db.reports[email] = [];
    }
    db.reports[email].unshift(report);
    
    const user = db.users.find((u: User) => u.email === email);
    if (user) {
      user.reportsGenerated += 1;
    }
    saveDb(db);
  },

  getReports: (email: string): Report[] => {
    const db = getDb();
    return db.reports[email] || [];
  },

  checkDailyLimit: (email: string): boolean => {
    if (email.includes('admin')) return true;
    const db = getDb();
    const user = db.users.find(u => u.email === email);
    const limit = user?.customLimit !== undefined ? user.customLimit : 3;

    const today = new Date().toDateString();
    const key = `limit_${email}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0');
    return count < limit;
  },

  incrementDailyLimit: (email: string) => {
    const today = new Date().toDateString();
    const key = `limit_${email}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0');
    localStorage.setItem(key, (count + 1).toString());
  },

  getDailyCount: (email: string): number => {
     const today = new Date().toDateString();
    const key = `limit_${email}_${today}`;
    return parseInt(localStorage.getItem(key) || '0');
  },

  setSession: (user: User) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  },

  getSession: (): User | null => {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  clearSession: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  // --- Async Manual Pages (IndexedDB) ---
  
  // Save raw PDF blob
  saveFullManualBlob: async (file: File) => {
    const db = await openIDB();
    const tx = db.transaction(FILE_STORE, 'readwrite');
    const store = tx.objectStore(FILE_STORE);
    
    // We only store one manual at a time with ID 'current_manual'
    await new Promise((resolve, reject) => {
      const req = store.put({ id: 'current_manual', file: file });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // Retrieve raw PDF blob
  getFullManualBlob: async (): Promise<File | null> => {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const store = tx.objectStore(FILE_STORE);
      const req = store.get('current_manual');
      req.onsuccess = () => resolve(req.result ? req.result.file : null);
      req.onerror = () => reject(req.error);
    });
  },

  clearPages: async () => {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PAGE_STORE, 'readwrite');
      const store = tx.objectStore(PAGE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    });
  },

  addManualPages: async (pages: ManualPage[]) => {
    const db = await openIDB();
    const tx = db.transaction(PAGE_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_STORE);
    
    // Add all pages
    await Promise.all(pages.map(page => {
      return new Promise((resolve, reject) => {
        const req = store.put(page);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }));
  },

  getManualPages: async (): Promise<ManualPage[]> => {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PAGE_STORE, 'readonly');
      const store = tx.objectStore(PAGE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  removePage: async (id: string) => {
    const db = await openIDB();
    const tx = db.transaction(PAGE_STORE, 'readwrite');
    const store = tx.objectStore(PAGE_STORE);
    store.delete(id);
  },

  clearManual: async () => {
    const db = await openIDB();
    
    // Clear Pages
    const tx1 = db.transaction(PAGE_STORE, 'readwrite');
    tx1.objectStore(PAGE_STORE).clear();

    // Clear File
    const tx2 = db.transaction(FILE_STORE, 'readwrite');
    tx2.objectStore(FILE_STORE).clear();
  }
};