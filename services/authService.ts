import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  UserCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebaseConfig';
import { ADMIN_CONFIG } from '../config/adminConfig';
import { logService } from './logService';
import { backendService } from './backendService';
import { storageService } from './storageService';
import { User } from '../types';

export const GOOGLE_CLIENT_ID = "664033502342-9sijfg71v3c0i0riah1hhhgdufalfvk5.apps.googleusercontent.com";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const authService = {
  // Sign up with email and password
  signup: async (email: string, password: string, displayName?: string): Promise<User> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update display name if provided
      if (displayName && firebaseUser) {
        await updateProfile(firebaseUser, { displayName });
      }

      // Send verification email
      if (firebaseUser) {
        await sendEmailVerification(firebaseUser);
      }

      const user: User = {
        email: firebaseUser.email || email,
        role: ADMIN_CONFIG.isAdmin(firebaseUser.email || email) ? 'admin' : 'student',
        registeredAt: new Date().toISOString(),
        isRevoked: false,
        reportsGenerated: 0,
        customLimit: 3,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || undefined,
        emailVerified: firebaseUser.emailVerified
      };

      // Sync user profile with backend
      try {
        await backendService.syncProfile();
      } catch (err) {
        logService.warn('[Auth Service] Profile sync failed (non-blocking):', err);
      }

      return user;
    } catch (error: any) {
      throw new Error(authService.getErrorMessage(error.code));
    }
  },

  // Sign in with email and password
  signin: async (email: string, password: string, rememberMe: boolean = false): Promise<User> => {
    try {
      // Set persistence based on "remember me"
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const user: User = {
        email: firebaseUser.email || email,
        role: ADMIN_CONFIG.isAdmin(firebaseUser.email || email) ? 'admin' : 'student',
        registeredAt: new Date().toISOString(),
        isRevoked: false,
        reportsGenerated: 0,
        customLimit: 3,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || undefined,
        emailVerified: firebaseUser.emailVerified
      };

      // Sync profile with backend (updates last login)
      try {
        await backendService.syncProfile();
      } catch (err) {
        logService.warn('[Auth Service] Profile sync failed (non-blocking):', err);
      }

      return user;
    } catch (error: any) {
      throw new Error(authService.getErrorMessage(error.code));
    }
  },

  // Sign in with Google (popup method with robust error handling)
  signInWithGoogle: async (): Promise<User> => {
    try {
      logService.log('[Auth Service] Starting Google Sign-In with popup...');
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!result || !result.user) {
        throw new Error('No user returned from Google Sign-In');
      }
      
      const firebaseUser = result.user;
      logService.log('[Auth Service] Google auth successful for:', firebaseUser.email);

      // Sync profile with backend (creates on first login, updates last_login)
      logService.log('[Auth Service] Syncing profile with backend for:', firebaseUser.uid);
      let profile: any;
      try {
        const backendProfile = await backendService.syncProfile();
        profile = {
          uid: backendProfile.uid,
          email: backendProfile.email,
          role: backendProfile.role,
          displayName: backendProfile.display_name,
          photoURL: backendProfile.photo_url,
          customLimit: backendProfile.custom_limit,
          isRevoked: backendProfile.is_revoked || false,
          reportsGenerated: backendProfile.reports_generated || 0,
          createdAt: new Date(backendProfile.created_at || Date.now()),
          lastLogin: new Date(backendProfile.last_login || Date.now()),
        };
        logService.log('[Auth Service] Backend profile synced successfully');
      } catch (err) {
        logService.warn('[Auth Service] Backend sync failed, using local fallback:', err);
        profile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: ADMIN_CONFIG.isAdmin(firebaseUser.email || '') ? 'admin' : 'student',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          customLimit: undefined,
          isRevoked: false,
          reportsGenerated: 0,
          createdAt: new Date(),
          lastLogin: new Date(),
        };
      }

      // Check if user is revoked
      if (profile.isRevoked) {
        logService.log('[Auth Service] User is revoked');
        await authService.logout();
        throw new Error('Your account has been revoked. Please contact an administrator.');
      }

      logService.log('[Auth Service] Login successful, returning user object');
      return {
        email: profile.email,
        role: profile.role,
        registeredAt: profile.createdAt.toISOString(),
        isRevoked: profile.isRevoked,
        reportsGenerated: profile.reportsGenerated,
        customLimit: profile.customLimit,
        uid: profile.uid,
        displayName: profile.displayName,
        emailVerified: firebaseUser.emailVerified,
        photoURL: profile.photoURL
      };
    } catch (error: any) {
      logService.error('[Auth Service] Sign-in error:', error);
      
      // Provide helpful error messages
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by your browser.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection and try again.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please wait a moment and try again.');
      } else if (error.message) {
        throw error; // Re-throw with original message
      }
      
      throw new Error('An unexpected error occurred. Please try again.');
    }
  },

  // Sign in using Google OAuth ID token credential (Global Orators GIS flow)
  signInWithGoogleCredential: async (credential: string): Promise<User> => {
    try {
      logService.log('[Auth Service] Authenticating with Google OAuth credential...');
      localStorage.setItem('google_auth_token', credential);

      // Call backend directly with Google credential
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential}`,
        },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to authenticate with Google');
      }

      const backendProfile = await response.json();
      const user: User = {
        email: backendProfile.email,
        role: backendProfile.role,
        registeredAt: backendProfile.created_at || new Date().toISOString(),
        isRevoked: backendProfile.is_revoked || false,
        reportsGenerated: backendProfile.reports_generated || 0,
        customLimit: backendProfile.custom_limit,
        uid: backendProfile.uid,
        displayName: backendProfile.display_name,
        emailVerified: true,
        photoURL: backendProfile.photo_url,
      };

      storageService.setSession(user);
      logService.log('[Auth Service] Google GIS login succeeded for:', user.email);
      return user;
    } catch (err: any) {
      localStorage.removeItem('google_auth_token');
      logService.error('[Auth Service] Google GIS login failed:', err);
      throw err;
    }
  },

  // Sign out
  logout: async (): Promise<void> => {
    try {
      localStorage.removeItem('google_auth_token');
      storageService.clearSession();
      await signOut(auth);
    } catch (error: any) {
      throw new Error('Failed to sign out. Please try again.');
    }
  },

  // Send password reset email
  resetPassword: async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(authService.getErrorMessage(error.code));
    }
  },

  // Resend verification email
  resendVerification: async (): Promise<void> => {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      await sendEmailVerification(user);
    } else {
      throw new Error('No user logged in or email already verified');
    }
  },

  // Get current user
  getCurrentUser: (): FirebaseUser | null => {
    return auth.currentUser;
  },

  // Auth state listener
  onAuthStateChange: (callback: (user: User | null) => void) => {
    // Check if user has an active session from Google GIS
    const sessionUser = storageService.getSession();
    const googleToken = localStorage.getItem('google_auth_token');
    if (sessionUser && googleToken && !auth.currentUser) {
      callback(sessionUser);
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user profile from backend to get latest customLimit, reportsGenerated, etc.
        try {
          const profile = await backendService.getProfile();
          const user: User = {
            email: profile.email,
            role: profile.role,
            registeredAt: profile.created_at || new Date().toISOString(),
            isRevoked: profile.is_revoked || false,
            reportsGenerated: profile.reports_generated || 0,
            customLimit: profile.custom_limit,
            uid: profile.uid,
            displayName: profile.display_name,
            emailVerified: firebaseUser.emailVerified,
            photoURL: profile.photo_url
          };
          callback(user);
        } catch {
          // Fallback if backend is unreachable
          const user: User = {
            email: firebaseUser.email || '',
            role: ADMIN_CONFIG.isAdmin(firebaseUser.email || '') ? 'admin' : 'student',
            registeredAt: new Date().toISOString(),
            isRevoked: false,
            reportsGenerated: 0,
            customLimit: undefined,
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || undefined,
            emailVerified: firebaseUser.emailVerified,
            photoURL: firebaseUser.photoURL || undefined
          };
          callback(user);
        }
      } else {
        const activeGoogleToken = localStorage.getItem('google_auth_token');
        const activeSession = storageService.getSession();
        if (activeGoogleToken && activeSession) {
          callback(activeSession);
        } else {
          callback(null);
        }
      }
    });
  },


  // Validate password strength
  validatePassword: (password: string): { valid: boolean; message: string; strength: number } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters', strength: 0 };
    }

    let strength = 0;
    
    // Check for lowercase
    if (/[a-z]/.test(password)) strength += 1;
    // Check for uppercase
    if (/[A-Z]/.test(password)) strength += 1;
    // Check for numbers
    if (/[0-9]/.test(password)) strength += 1;
    // Check for special characters
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    // Length bonus
    if (password.length >= 12) strength += 1;

    if (strength < 3) {
      return {
        valid: false,
        message: 'Password must contain uppercase, lowercase, and numbers',
        strength
      };
    }

    return { valid: true, message: 'Strong password', strength };
  },

  // Convert Firebase error codes to user-friendly messages
  getErrorMessage: (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled. Please contact support.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a stronger password.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please sign up.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed. Please try again.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
};
