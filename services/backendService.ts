/**
 * Backend API Service
 *
 * Central client for all communication with the Python FastAPI backend.
 * All requests include the Firebase ID token for authentication.
 *
 * Replaces direct Firestore/Gemini calls with authenticated HTTP requests.
 */

import { getAuth } from 'firebase/auth';
import { logService } from './logService';
import { Report, User, ManualPage } from '../types';

// ==================== Configuration ====================

// Resolve base URL: Vite env → relative (for Vercel proxy)
const resolveBaseUrl = (): string => {
  // @ts-ignore — Vite injects import.meta.env
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // In production (Vercel), use relative path — the rewrite proxy handles routing
  return '';
};

const BASE_URL = resolveBaseUrl();

// ==================== HTTP Helpers ====================

/**
 * Get the current user's Firebase ID token.
 */
const getAuthToken = async (): Promise<string> => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated. Please sign in.');
  return user.getIdToken();
};

/**
 * Authenticated fetch wrapper.
 */
const apiFetch = async (
  path: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getAuthToken();
  const url = `${BASE_URL}${path}`;

  logService.log(`[Backend] ${options.method || 'GET'} ${path}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    const message = body.detail || body.message || `Request failed (${response.status})`;
    logService.error(`[Backend] ${response.status}: ${message}`);
    throw new Error(message);
  }

  return response;
};

// ==================== Types ====================

export interface BackendUserProfile {
  uid: string;
  email: string;
  role: 'student' | 'admin';
  display_name?: string;
  photo_url?: string;
  custom_limit?: number;
  is_revoked?: boolean;
  reports_generated?: number;
  created_at?: string;
  last_login?: string;
}

export interface BackendSettings {
  default_daily_limit: number;
  custom_instructions?: string;
  api_provider?: string;
  custom_api_url?: string;
  enable_parallel_generation?: boolean;
}

export interface BackendStats {
  total_students: number;
  total_reports: number;
  active_students: number;
  revoked_students: number;
}

export interface BackendManualMetadata {
  name: string;
  uploaded_at?: string;
  uploaded_by?: string;
  version?: number;
  page_count?: number;
}

// ==================== Auth & Profile ====================

/**
 * Sync user profile with the backend (create on first login, update last_login on subsequent).
 */
const syncProfile = async (): Promise<BackendUserProfile> => {
  const res = await apiFetch('/api/auth/profile', { method: 'POST' });
  return res.json();
};

/**
 * Get current user's profile from backend.
 */
const getProfile = async (): Promise<BackendUserProfile> => {
  const res = await apiFetch('/api/auth/me');
  return res.json();
};

// ==================== Reports ====================

/**
 * Generate a lab report via the backend.
 * The backend handles: manual fetching, Gemini calls, rate limiting, Firestore storage.
 */
const generateReport = async (experimentCode: string): Promise<Report> => {
  const res = await apiFetch('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ experiment_code: experimentCode }),
  });

  const data = await res.json();

  // Map backend response to frontend Report type
  return {
    id: data.id,
    experimentCode: data.experiment_code,
    date: data.date,
    content: data.content,
  };
};

/**
 * List all reports for the current user.
 */
const listReports = async (): Promise<Report[]> => {
  const res = await apiFetch('/api/reports');
  const data = await res.json();

  return data.map((r: any) => ({
    id: r.id,
    experimentCode: r.experiment_code,
    date: r.date,
    content: r.content,
  }));
};

// ==================== Admin: Users ====================

/**
 * List all users (admin only).
 */
const getUsers = async (): Promise<User[]> => {
  const res = await apiFetch('/api/admin/users');
  const data: BackendUserProfile[] = await res.json();

  return data.map((u) => ({
    uid: u.uid,
    email: u.email,
    role: u.role,
    displayName: u.display_name,
    photoURL: u.photo_url,
    customLimit: u.custom_limit,
    isRevoked: u.is_revoked || false,
    reportsGenerated: u.reports_generated || 0,
    registeredAt: u.created_at || '',
  }));
};

/**
 * Update a user's profile (admin only).
 */
const updateUser = async (
  uid: string,
  updates: { custom_limit?: number; is_revoked?: boolean; role?: string }
): Promise<void> => {
  await apiFetch(`/api/admin/users/${uid}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

// ==================== Admin: Stats ====================

const getStats = async (): Promise<BackendStats> => {
  const res = await apiFetch('/api/admin/stats');
  return res.json();
};

// ==================== Admin: Settings ====================

const getSettings = async (): Promise<BackendSettings> => {
  const res = await apiFetch('/api/admin/settings');
  return res.json();
};

const updateSettings = async (updates: Partial<BackendSettings>): Promise<void> => {
  await apiFetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

// ==================== Admin: Manual ====================

const getManualMetadata = async (): Promise<BackendManualMetadata | null> => {
  try {
    const res = await apiFetch('/api/admin/manual/metadata');
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
};

/**
 * Upload a lab manual PDF to the backend.
 * The backend handles PDF text extraction and Firestore storage.
 */
const uploadManual = async (file: File): Promise<{ page_count: number }> => {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append('file', file);

  const url = `${BASE_URL}/api/admin/manual/upload`;
  logService.log(`[Backend] POST /api/admin/manual/upload (${file.name})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Note: Do NOT set Content-Type for FormData — the browser sets it with the boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail || `Upload failed (${response.status})`);
  }

  return response.json();
};

const clearManual = async (): Promise<void> => {
  await apiFetch('/api/admin/manual', { method: 'DELETE' });
};

// ==================== Health ====================

const checkHealth = async (): Promise<boolean> => {
  try {
    const url = `${BASE_URL}/api/health`;
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
};

// ==================== Exports ====================

export const backendService = {
  // Auth
  syncProfile,
  getProfile,

  // Reports
  generateReport,
  listReports,

  // Admin
  getUsers,
  updateUser,
  getStats,
  getSettings,
  updateSettings,

  // Manual
  getManualMetadata,
  uploadManual,
  clearManual,

  // Health
  checkHealth,
};
