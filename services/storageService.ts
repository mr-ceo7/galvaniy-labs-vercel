import { User, Report, DbSchema, ManualPage } from '../types';

const DB_KEY = 'physics_labs_db';
const SESSION_KEY = 'physics_labs_session';

const getDb = (): DbSchema => {
  const data = localStorage.getItem(DB_KEY);
  if (!data) {
    return { users: [], reports: {}, manualPages: [] };
  }
  const db = JSON.parse(data);
  // Migration for old DBs
  if (!db.manualPages) {
      db.manualPages = [];
      // If there were old references, migrate them as text-only pages
      if ((db as any).references) {
          (db as any).references.forEach((text: string, idx: number) => {
              db.manualPages.push({
                  id: `legacy-${idx}`,
                  pageNumber: idx + 1,
                  text: text
              });
          });
          delete (db as any).references;
      }
  }
  return db;
};

const saveDb = (data: DbSchema) => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Storage Quota Exceeded", e);
    alert("Storage limit reached. Please clear some manual pages or reports.");
  }
};

export const storageService = {
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
        customLimit: 3 // Default limit
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
    db.reports[email].unshift(report); // Add to top
    
    // Update user stats
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
    // Admin bypass
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

  // --- Manual Pages Management ---
  getManualPages: (): ManualPage[] => {
    return getDb().manualPages;
  },

  addManualPages: (pages: ManualPage[]) => {
    const db = getDb();
    db.manualPages.push(...pages);
    saveDb(db);
  },

  clearManual: () => {
    const db = getDb();
    db.manualPages = [];
    saveDb(db);
  },

  removePage: (id: string) => {
    const db = getDb();
    db.manualPages = db.manualPages.filter(p => p.id !== id);
    saveDb(db);
  },

  // Finds pages that contain the experiment code in their text
  // Returns top matches (limit 5 to save context)
  findRelevantPages: (experimentCode: string): ManualPage[] => {
    const db = getDb();
    const normalizedCode = experimentCode.toLowerCase().replace('-', '');
    
    // Filter pages containing the code
    const matches = db.manualPages.filter(p => {
        const text = p.text.toLowerCase().replace('-', '');
        return text.includes(normalizedCode);
    });

    // If matches found, return them (up to 5)
    if (matches.length > 0) return matches.slice(0, 5);

    // Fallback: If no exact matches, return first 3 pages (often index/content) + random sample
    // This is a last resort to provide some context
    return db.manualPages.slice(0, 3);
  },

  // --- Session Management ---
  setSession: (user: User) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  },

  getSession: (): User | null => {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  clearSession: () => {
    localStorage.removeItem(SESSION_KEY);
  }
};