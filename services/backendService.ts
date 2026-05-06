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
import { Report, User, ManualPage, LabSession, LabSessionEvent, AdminLabSession } from '../types';

// ==================== Configuration ====================

// Resolve base URL: Vite env → relative (for Vercel proxy)
const resolveBaseUrl = (): string => {
  // @ts-ignore - Vite injects import.meta.env
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // In production (Vercel), use relative path - the rewrite proxy handles routing
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
  total_lab_sessions?: number;
  manual_lab_sessions?: number;
  auto_lab_sessions?: number;
  students_using_virtual_lab?: number;
}

export interface BackendManualMetadata {
  name: string;
  uploaded_at?: string;
  uploaded_by?: string;
  version?: number;
  page_count?: number;
}

export interface BackendLabSetupResponse {
  experiment_code: string;
  mode: 'builtin' | 'composable' | 'legacy';
  requested_by: string;
  lab_config: Record<string, unknown>;
}

export interface BackendLabSessionEvent {
  time: number;
  type: string;
  data: Record<string, unknown>;
}

export interface BackendLabSession {
  id: string;
  user_uid: string;
  experiment_code: string;
  mode: 'manual' | 'auto' | 'report_only';
  started_at: string;
  completed_at: string;
  saved_at: string;
  data_points: Record<string, unknown>[];
  control_values: Record<string, number>;
  session_events: BackendLabSessionEvent[];
  data_point_count: number;
  event_count: number;
}

export interface BackendAdminLabSession extends BackendLabSession {
  user_email: string;
  display_name?: string;
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
 * Fetch the built-in virtual lab configuration for an experiment.
 */
const getLabSetup = async (experimentCode: string): Promise<BackendLabSetupResponse> => {
  const res = await apiFetch('/api/lab-setup', {
    method: 'POST',
    body: JSON.stringify({ experiment_code: experimentCode }),
  });
  return res.json();
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
      // Note: Do NOT set Content-Type for FormData - the browser sets it with the boundary
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

// ==================== Lab Sessions ====================

interface LabSessionPayload {
  experiment_code: string;
  mode: 'manual' | 'auto' | 'report_only';
  started_at: string;
  completed_at: string;
  data_points: Record<string, unknown>[];
  control_values: Record<string, number>;
  session_events?: BackendLabSessionEvent[];
}

const mapLabSession = (session: BackendLabSession): LabSession => ({
  id: session.id,
  userUid: session.user_uid,
  experimentCode: session.experiment_code,
  mode: session.mode,
  startedAt: session.started_at,
  completedAt: session.completed_at,
  savedAt: session.saved_at,
  dataPoints: session.data_points || [],
  controlValues: session.control_values || {},
  sessionEvents: (session.session_events || []).map((event): LabSessionEvent => ({
    time: event.time,
    type: event.type,
    data: event.data || {},
  })),
  dataPointCount: session.data_point_count || 0,
  eventCount: session.event_count || 0,
});

const mapAdminLabSession = (session: BackendAdminLabSession): AdminLabSession => ({
  ...mapLabSession(session),
  userEmail: session.user_email,
  displayName: session.display_name,
});

/**
 * Save a Virtual Lab session to Firestore via the backend.
 */
const saveLabSession = async (session: LabSessionPayload): Promise<{ session_id: string }> => {
  const res = await apiFetch('/api/reports/lab-session', {
    method: 'POST',
    body: JSON.stringify(session),
  });
  return res.json();
};

const listLabSessions = async (): Promise<LabSession[]> => {
  const res = await apiFetch('/api/reports/lab-sessions');
  const data: BackendLabSession[] = await res.json();
  return data.map(mapLabSession);
};

const getLabSession = async (sessionId: string): Promise<LabSession> => {
  const res = await apiFetch(`/api/reports/lab-sessions/${sessionId}`);
  const data: BackendLabSession = await res.json();
  return mapLabSession(data);
};

const generateReportFromSession = async (sessionId: string): Promise<Report> => {
  const res = await apiFetch(`/api/reports/lab-sessions/${sessionId}/generate-report`, {
    method: 'POST',
  });
  const data = await res.json();
  return {
    id: data.id,
    experimentCode: data.experiment_code,
    date: data.date,
    content: data.content,
  };
};

const getAdminLabSessions = async (limit = 50): Promise<AdminLabSession[]> => {
  const res = await apiFetch(`/api/admin/lab-sessions?limit=${limit}`);
  const data: BackendAdminLabSession[] = await res.json();
  return data.map(mapAdminLabSession);
};

// ==================== Lab Assistant ====================

const chatWithAssistant = async (experimentCode: string, message: string, chatHistory: any[], labState?: any): Promise<any> => {
  const res = await apiFetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experiment_code: experimentCode,
      message,
      chat_history: chatHistory,
      lab_state: labState || null,
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Chat failed: ${res.status}`);
  }
  
  const data = await res.json();
  // Return full structured response: { reply, actions, awaitAction }
  return data;
};
// ==================== Exports ====================

export const backendService = {
  // Auth
  syncProfile,
  getProfile,

  // Reports
  generateReport,
  listReports,
  getLabSetup,

  // Lab Sessions
  saveLabSession,
  listLabSessions,
  getLabSession,
  generateReportFromSession,
  getAdminLabSessions,

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

  // Lab Assistant
  chatWithAssistant,
};
