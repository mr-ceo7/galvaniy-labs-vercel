import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User as FirebaseUser,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebaseConfig';
import { ADMIN_CONFIG } from '../config/adminConfig';
import { User } from '../types';

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

      // Convert Firebase user to app User
      return {
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

      return {
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
    } catch (error: any) {
      throw new Error(authService.getErrorMessage(error.code));
    }
  },

  // Sign in with Google
  signInWithGoogle: async (): Promise<User> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      return {
        email: firebaseUser.email || '',
        role: ADMIN_CONFIG.isAdmin(firebaseUser.email || '') ? 'admin' : 'student',
        registeredAt: new Date().toISOString(),
        isRevoked: false,
        reportsGenerated: 0,
        customLimit: 3,
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || undefined,
        emailVerified: firebaseUser.emailVerified,
        photoURL: firebaseUser.photoURL || undefined
      };
    } catch (error: any) {
      throw new Error(authService.getErrorMessage(error.code));
    }
  },

  // Sign out
  logout: async (): Promise<void> => {
    try {
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
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const user: User = {
          email: firebaseUser.email || '',
          role: ADMIN_CONFIG.isAdmin(firebaseUser.email || '') ? 'admin' : 'student',
          registeredAt: new Date().toISOString(),
          isRevoked: false,
          reportsGenerated: 0,
          customLimit: 3,
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || undefined,
          emailVerified: firebaseUser.emailVerified,
          photoURL: firebaseUser.photoURL || undefined
        };
        callback(user);
      } else {
        callback(null);
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
