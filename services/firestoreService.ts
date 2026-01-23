import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  enableIndexedDbPersistence,
  writeBatch
} from 'firebase/firestore';
import { firebaseConfig } from '../config/firebaseConfig';
import { errorService } from './errorService';
import { ManualPage } from '../types';

// Initialize Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    logService.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    logService.warn('Browser does not support offline persistence.');
  }
});

// Types
export interface GlobalSettings {
  defaultDailyLimit: number;
  customInstructions: string;
  apiProvider: 'gemini' | 'custom';
  customApiUrl: string;
  enableParallelGeneration?: boolean;
  lastUpdated: Date;
  updatedBy: string;
}

export interface ManualMetadata {
  name: string;
  uploadedAt: Date;
  uploadedBy: string;
  version: number;
  pageCount: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'student' | 'admin';
  displayName?: string;
  photoURL?: string;
  customLimit?: number;
  isRevoked: boolean;
  reportsGenerated: number;
  createdAt: Date;
  lastLogin: Date;
}

export const firestoreService = {
  // ==================== SETTINGS ====================
  
  /**
   * Get global settings
   */
  getSettings: async (): Promise<GlobalSettings | null> => {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          defaultDailyLimit: data.defaultDailyLimit,
          customInstructions: data.customInstructions || '',
          apiProvider: data.apiProvider || 'gemini',
          customApiUrl: data.customApiUrl || '',
          enableParallelGeneration: data.enableParallelGeneration,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          updatedBy: data.updatedBy || ''
        };
      }
      
      // Return defaults if not exists
      return {
        defaultDailyLimit: 3,
        customInstructions: '',
        apiProvider: 'gemini',
        customApiUrl: '',
        lastUpdated: new Date(),
        updatedBy: ''
      };
    } catch (error) {
      logService.error('Error getting settings:', error);
      // For settings retrieval, use defaults gracefully rather than throwing
      return {
        defaultDailyLimit: 3,
        customInstructions: '',
        apiProvider: 'gemini',
        customApiUrl: '',
        lastUpdated: new Date(),
        updatedBy: ''
      };
    }
  },

  /**
   * Update global settings
   */
  updateSettings: async (settings: Partial<GlobalSettings>, adminEmail: string): Promise<void> => {
    try {
      const docRef = doc(db, 'settings', 'global');
      await setDoc(docRef, {
        ...settings,
        lastUpdated: Timestamp.now(),
        updatedBy: adminEmail
      }, { merge: true });
    } catch (error) {
      logService.error('Error updating settings:', error);
      throw errorService.wrapError('Firestore: Update Settings', error);
    }
  },

  /**
   * Subscribe to settings changes (real-time)
   */
  subscribeToSettings: (callback: (settings: GlobalSettings | null) => void) => {
    const docRef = doc(db, 'settings', 'global');
    
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          defaultDailyLimit: data.defaultDailyLimit,
          customInstructions: data.customInstructions || '',
          apiProvider: data.apiProvider || 'gemini',
          customApiUrl: data.customApiUrl || '',
          enableParallelGeneration: data.enableParallelGeneration,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          updatedBy: data.updatedBy || ''
        });
      } else {
        callback({
          defaultDailyLimit: 3,
          customInstructions: '',
          apiProvider: 'gemini',
          customApiUrl: '',
          lastUpdated: new Date(),
          updatedBy: ''
        });
      }
    }, (error) => {
      logService.error('Error in settings subscription:', error);
    });
  },

  // ==================== MANUAL ====================

  /**
   * Get manual metadata
   */
  getManualMetadata: async (): Promise<ManualMetadata | null> => {
    try {
      const docRef = doc(db, 'manual', 'metadata');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          name: data.name,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          uploadedBy: data.uploadedBy,
          version: data.version,
          pageCount: data.pageCount
        };
      }
      return null;
    } catch (error) {
      logService.error('Error getting manual metadata:', error);
      return null;
    }
  },

  /**
   * Get manual pages from subcollection
   */
  getManualPages: async (): Promise<ManualPage[]> => {
    try {
      const pagesRef = collection(db, 'manual', 'metadata', 'pages');
      const snapshot = await getDocs(pagesRef);
      
      return snapshot.docs.map(doc => doc.data() as ManualPage)
        .sort((a, b) => a.pageNumber - b.pageNumber);
    } catch (error) {
      logService.error('Error getting manual pages:', error);
      return [];
    }
  },

  /**
   * Upload manual (metadata + pages in subcollection)
   */
  uploadManual: async (
    pages: ManualPage[],
    fileName: string,
    adminEmail: string
  ): Promise<void> => {
    try {
      // Get current version
      const currentMeta = await firestoreService.getManualMetadata();
      const newVersion = currentMeta ? currentMeta.version + 1 : 1;

      // Upload metadata
      const metaRef = doc(db, 'manual', 'metadata');
      await setDoc(metaRef, {
        name: fileName,
        uploadedAt: Timestamp.now(),
        uploadedBy: adminEmail,
        version: newVersion,
        pageCount: pages.length
      });

      // Upload pages to subcollection in batches (Firestore batch limit is 500)
      const pagesRef = collection(db, 'manual', 'metadata', 'pages');
      const batchSize = 500;
      
      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchPages = pages.slice(i, i + batchSize);
        
        for (const page of batchPages) {
          const pageDocRef = doc(pagesRef, `page_${page.pageNumber}`);
          batch.set(pageDocRef, page);
        }
        
        await batch.commit();
      }
    } catch (error) {
      logService.error('Error uploading manual:', error);
      throw error;
    }
  },

  /**
   * Subscribe to manual changes (real-time)
   */
  subscribeToManual: (callback: (metadata: ManualMetadata | null) => void) => {
    const docRef = doc(db, 'manual', 'metadata');
    
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          name: data.name,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
          uploadedBy: data.uploadedBy,
          version: data.version,
          pageCount: data.pageCount
        });
      } else {
        callback(null);
      }
    }, (error) => {
      logService.error('Error in manual subscription:', error);
    });
  },

  /**
   * Clear manual (delete metadata and all pages)
   */
  clearManual: async (): Promise<void> => {
    try {
      // Delete metadata
      const metaRef = doc(db, 'manual', 'metadata');
      await deleteDoc(metaRef);
      
      // Delete all pages from subcollection
      const pagesRef = collection(db, 'manual', 'metadata', 'pages');
      const snapshot = await getDocs(pagesRef);
      
      // Delete in batches
      const batchSize = 500;
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        for (const pageDoc of batchDocs) {
          batch.delete(pageDoc.ref);
        }
        
        await batch.commit();
      }
      
      logService.log('[Firestore] Manual cleared successfully');
    } catch (error) {
      logService.error('Error clearing manual:', error);
      throw error;
    }
  },

  // ==================== USER PROFILES ====================

  /**
   * Create or update user profile
   */
  createUserProfile: async (profile: UserProfile): Promise<void> => {
    try {
      const docRef = doc(db, 'users', profile.uid);
      
      // Filter out undefined values (Firestore doesn't accept them)
      const cleanProfile: any = {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
        isRevoked: profile.isRevoked || false,
        reportsGenerated: profile.reportsGenerated || 0,
        createdAt: Timestamp.now(),
        lastLogin: Timestamp.now()
      };
      
      // Only add optional fields if they're not undefined
      if (profile.displayName !== undefined) cleanProfile.displayName = profile.displayName;
      if (profile.photoURL !== undefined) cleanProfile.photoURL = profile.photoURL;
      if (profile.customLimit !== undefined) cleanProfile.customLimit = profile.customLimit;
      
      await setDoc(docRef, cleanProfile);
    } catch (error) {
      logService.error('Error creating user profile:', error);
      throw error;
    }
  },

  /**
   * Get user profile
   */
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          uid: data.uid,
          email: data.email,
          role: data.role,
          displayName: data.displayName,
          photoURL: data.photoURL,
          customLimit: data.customLimit,
          isRevoked: data.isRevoked || false,
          reportsGenerated: data.reportsGenerated || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || new Date()
        };
      }
      return null;
    } catch (error) {
      logService.error('Error getting user profile:', error);
      return null;
    }
  },

  /**
   * Update user profile
   */
  updateUserProfile: async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
    try {
      const docRef = doc(db, 'users', uid);
      const updateData: any = { ...updates };
      
      // Convert Date objects to Timestamps
      if (updates.lastLogin) {
        updateData.lastLogin = Timestamp.now();
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      logService.error('Error updating user profile:', error);
      throw error;
    }
  },

  /**
   * Get all users (for admin panel)
   */
  getAllUsers: async (): Promise<UserProfile[]> => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: data.uid,
          email: data.email,
          role: data.role,
          displayName: data.displayName,
          photoURL: data.photoURL,
          customLimit: data.customLimit,
          isRevoked: data.isRevoked || false,
          reportsGenerated: data.reportsGenerated || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || new Date()
        };
      });
    } catch (error) {
      logService.error('Error getting all users:', error);
      return [];
    }
  },

  /**
   * Subscribe to all users (real-time for admin panel)
   */
  subscribeToAllUsers: (callback: (users: UserProfile[]) => void) => {
    const usersRef = collection(db, 'users');
    
    return onSnapshot(usersRef, (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: data.uid,
          email: data.email,
          role: data.role,
          displayName: data.displayName,
          photoURL: data.photoURL,
          customLimit: data.customLimit,
          isRevoked: data.isRevoked || false,
          reportsGenerated: data.reportsGenerated || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || new Date()
        };
      });
      callback(users);
    }, (error) => {
      logService.error('Error in users subscription:', error);
    });
  },

  /**
   * Revoke/Unrevoke user
   */
  toggleUserRevoke: async (uid: string, isRevoked: boolean): Promise<void> => {
    try {
      await firestoreService.updateUserProfile(uid, { isRevoked });
    } catch (error) {
      logService.error('Error toggling user revoke:', error);
      throw error;
    }
  },

  /**
   * Increment report count for user
   */
  incrementReportCount: async (uid: string): Promise<void> => {
    try {
      const profile = await firestoreService.getUserProfile(uid);
      if (profile) {
        await firestoreService.updateUserProfile(uid, {
          reportsGenerated: profile.reportsGenerated + 1
        });
      }
    } catch (error) {
      logService.error('Error incrementing report count:', error);
      throw error;
    }
  },

  /**
   * Update user last login
   */
  updateLastLogin: async (uid: string): Promise<void> => {
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        lastLogin: Timestamp.now()
      });
    } catch (error) {
      logService.error('Error updating last login:', error);
    }
  },

  // ==================== ADMIN STATS ====================

  /**
   * Get admin dashboard stats
   */
  getAdminStats: async (): Promise<{
    totalStudents: number;
    totalReports: number;
    activeStudents: number;
    revokedStudents: number;
  }> => {
    try {
      const users = await firestoreService.getAllUsers();
      const students = users.filter(u => u.role === 'student');
      
      return {
        totalStudents: students.length,
        totalReports: students.reduce((sum, u) => sum + u.reportsGenerated, 0),
        activeStudents: students.filter(u => !u.isRevoked).length,
        revokedStudents: students.filter(u => u.isRevoked).length
      };
    } catch (error) {
      logService.error('Error getting admin stats:', error);
      return {
        totalStudents: 0,
        totalReports: 0,
        activeStudents: 0,
        revokedStudents: 0
      };
    }
  }
};
