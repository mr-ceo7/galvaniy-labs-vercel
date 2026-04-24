import { backendService, BackendLabSessionEvent } from './backendService';
import { LabSession, Report } from '../types';

interface SaveLabSessionPayload {
  experiment_code: string;
  mode: 'manual' | 'auto' | 'report_only';
  started_at: string;
  completed_at: string;
  data_points: Record<string, unknown>[];
  control_values: Record<string, number>;
  session_events?: BackendLabSessionEvent[];
}

const sessionCache = new Map<string, LabSession>();

export const labSessionService = {
  async saveSession(payload: SaveLabSessionPayload): Promise<string> {
    const response = await backendService.saveLabSession(payload);
    return response.session_id;
  },

  async listSessions(): Promise<LabSession[]> {
    const sessions = await backendService.listLabSessions();
    sessions.forEach((session) => sessionCache.set(session.id, session));
    return sessions;
  },

  async getSession(sessionId: string): Promise<LabSession> {
    const cached = sessionCache.get(sessionId);
    if (cached) {
      return cached;
    }

    const session = await backendService.getLabSession(sessionId);
    sessionCache.set(session.id, session);
    return session;
  },

  async generateReportFromSession(sessionId: string): Promise<Report> {
    return backendService.generateReportFromSession(sessionId);
  },

  clearCache(): void {
    sessionCache.clear();
  },
};
