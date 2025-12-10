import { User, Report } from '../types';

const DB_KEY = 'physics_labs_db';
const SESSION_KEY = 'physics_labs_session';

const getDb = () => {
  const data = localStorage.getItem(DB_KEY);
  if (!data) {
    return { users: [], reports: {} };
  }
  return JSON.parse(data);
};

const saveDb = (data: any) => {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
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
        reportsGenerated: 0
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

    const today = new Date().toDateString();
    const key = `limit_${email}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0');
    return count < 3;
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
  }
};