export interface User {
  email: string;
  role: 'student' | 'admin';
  registeredAt: string;
  isRevoked: boolean;
  reportsGenerated: number;
  customLimit?: number; // Added for admin overrides
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

// Simulated Database Structure stored in LocalStorage
export interface DbSchema {
  users: User[];
  reports: Record<string, Report[]>; // key is email
  references: string[]; // Added for dynamic AI context
}