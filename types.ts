export interface User {
  email: string;
  role: 'student' | 'admin';
  registeredAt: string;
  isRevoked: boolean;
  reportsGenerated: number;
  customLimit?: number; // Added for admin overrides
  uid?: string; // Firebase UID
  displayName?: string; // User's display name
  emailVerified?: boolean; // Email verification status
  photoURL?: string; // Profile photo (from Google auth)
}

export interface Report {
  id: string;
  experimentCode: string;
  date: string;
  content: string; // JSON String of report data
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface Theme {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
}

export interface ManualPage {
  id: string;
  pageNumber: number;
  text: string;
  image?: string; // Base64 string of the page
}

// Simulated Database Structure stored in LocalStorage
export interface DbSchema {
  users: User[];
  reports: Record<string, Report[]>; // key is email
  manualPages: ManualPage[]; // Replaces simple references
}