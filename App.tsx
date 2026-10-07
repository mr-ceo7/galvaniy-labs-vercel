import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { SplashScreen } from './components/SplashScreen';
import { Auth } from './components/Auth';
import { Generator } from './components/Generator';
import { History } from './components/History';
import { Admin } from './components/Admin';
import { ReportView } from './components/ReportView';
import { InstallPrompt } from './components/InstallPrompt';
import { VirtualLab } from './components/VirtualLab';
import { LabBrowser } from './components/LabBrowser';
import { User, Report } from './types';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { backendService } from './services/backendService';
import { logService } from './services/logService';
import { LogOut, User as UserIcon, FlaskConical, Zap } from 'lucide-react';

const getInitialLabFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('lab') || params.get('exp') || params.get('experiment');
  if (raw) {
    const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
    return cleaned.replace(/^([A-Z])(\d+)$/, '$1-$2');
  }
  const match = window.location.pathname.match(/\/lab\/([A-Za-z0-9_-]+)/i);
  if (match && match[1]) {
    const cleaned = match[1].trim().toUpperCase().replace(/\s+/g, '');
    return cleaned.replace(/^([A-Z])(\d+)$/, '$1-$2');
  }
  return null;
};

const App: React.FC = () => {
  const initialLab = getInitialLabFromUrl();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'generator' | 'admin' | 'labs'>(initialLab ? 'labs' : 'generator');
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [labExperiment, setLabExperiment] = useState<string | null>(initialLab);

  logService.log('[App] Render - loading:', loading, 'user:', user?.email || 'none', 'lab:', labExperiment);

  // Sync current experiment with browser URL query parameter
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (labExperiment) {
      url.searchParams.set('lab', labExperiment);
      window.history.replaceState({}, '', url.toString());
    } else {
      if (url.searchParams.has('lab') || url.searchParams.has('exp') || url.searchParams.has('experiment')) {
        url.searchParams.delete('lab');
        url.searchParams.delete('exp');
        url.searchParams.delete('experiment');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    }
  }, [labExperiment]);

  useEffect(() => {
    logService.log('[App] Component mounted, setting up auth listener...');
    
    // Listen to Firebase Auth state changes (handles page reload persistence)
    const unsubscribe = authService.onAuthStateChange((user) => {
      if (user) {
        logService.log('[App] Auth state: User signed in:', user.email);
        setUser(user);
        loadReports(user.email);
        storageService.setSession(user); // Sync to localStorage
      } else {
        const stored = storageService.getSession();
        if (stored) {
          logService.log('[App] Auth state: Restoring stored session:', stored.email);
          setUser(stored);
          loadReports(stored.email);
        } else if (initialLab) {
          // Direct lab link: grant immediate guest access to explore experiment
          const guestUser: User = {
            email: 'guest@galvaniy.local',
            name: 'Guest Comrade',
            role: 'student',
          };
          logService.log('[App] Direct lab link: providing guest access');
          setUser(guestUser);
          storageService.setSession(guestUser);
        } else {
          logService.log('[App] Auth state: No user');
          setUser(null);
          setReports([]);
        }
      }
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const loadReports = async (email: string) => {
    // Try loading from backend first, fall back to localStorage
    try {
      const backendReports = await backendService.listReports();
      if (backendReports.length > 0) {
        setReports(backendReports);
        // Cache in localStorage for offline access
        backendReports.forEach(r => {
          storageService.saveReport(email, r);
        });
        return;
      }
    } catch (err) {
      logService.warn('[App] Failed to load reports from backend, using localStorage:', err);
    }
    // Fallback to localStorage
    const userReports = storageService.getReports(email);
    setReports(userReports);
  };

  const handleLogin = (u: User) => {
    setUser(u);
    storageService.setSession(u);
    loadReports(u.email);
  };

  const handleLogout = async () => {
    await authService.logout();
    storageService.clearSession();
    setUser(null);
    setReports([]);
  };

  const handleReportGenerated = (report: Report) => {
    if (user) {
      // Add to local state immediately for instant UI update
      setReports(prev => [report, ...prev]);
      setSelectedReport(report);
    }
  };

  const handleDeleteReport = (reportId: string) => {
    if (user) {
      storageService.deleteReport(user.email, reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
    }
  };

  const handleClearAllReports = () => {
    if (user) {
      storageService.clearAllReports(user.email);
      setReports([]);
    }
  };

  useEffect(() => {
    // Safety fallback: force complete splash after 5 seconds
    if (loading) {
      const fallbackTimer = setTimeout(() => {
        logService.warn('[App] Force completing splash screen after 5 second timeout');
        setLoading(false);
      }, 5000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [loading]);

  if (loading) {
    return <SplashScreen onComplete={() => {
      logService.log('[App] SplashScreen completed, setting loading to false');
      setLoading(false);
    }} />;
  }

  if (user && view === 'labs' && labExperiment) {
    return (
      <VirtualLab
        experimentCode={labExperiment}
        onBack={() => setLabExperiment(null)}
        onReportGenerated={handleReportGenerated}
      />
    );
  }

  return (
    <Layout>
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4 md:mb-6 glass-panel p-3 md:p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-full">
                <UserIcon className="text-white" size={18} />
              </div>
              <div>
                <p className="text-xs md:text-sm text-slate-400">Signed in as</p>
                <p className="text-sm md:text-base font-semibold text-white truncate max-w-[200px] md:max-w-none">{user.email}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => { setView(view === 'labs' ? 'generator' : 'labs'); setLabExperiment(null); }}
                className={`px-3 md:px-4 py-2 min-h-[44px] ${view === 'labs' ? 'bg-cyan-600 shadow-cyan-500/30 shadow-lg' : 'bg-cyan-600/30 hover:bg-cyan-600/50'} text-white rounded-lg text-xs md:text-sm transition-all flex items-center gap-1.5`}
                aria-label={view === 'labs' ? 'Switch to Reports Generator' : 'Switch to Virtual Labs'}
              >
                <FlaskConical size={14} />
                <span className="hidden md:inline">{view === 'labs' ? 'Reports' : 'Virtual Labs'}</span>
                <span className="md:hidden font-mono text-[11px] tracking-wider uppercase">{view === 'labs' ? 'Reports' : 'Labs'}</span>
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => setView(view === 'admin' ? 'generator' : 'admin')}
                  className="px-3 md:px-4 py-2 min-h-[44px] bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-xs md:text-sm transition-colors flex items-center"
                >
                  {view === 'admin' ? 'Generator' : 'Admin'}
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-2 min-h-[44px] min-w-[44px] hover:bg-red-500/20 text-slate-300 hover:text-red-300 rounded-lg transition-colors flex items-center justify-center"
                title="Logout"
                aria-label="Logout from account"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {view === 'labs' ? (
            /* Virtual Labs - full width, no sidebar */
            <div className="flex-grow">
              {labExperiment ? (
                <VirtualLab
                  experimentCode={labExperiment}
                  onBack={() => setLabExperiment(null)}
                  onReportGenerated={handleReportGenerated}
                />
              ) : (
                <div className="glass-panel rounded-2xl overflow-hidden max-w-3xl mx-auto" style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                  <LabBrowser onSelectExperiment={(code) => setLabExperiment(code)} />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 flex-grow">
              {/* Main Content Area */}
              <div className="md:col-span-2 space-y-4 md:space-y-6">
                {view === 'generator' ? (
                  <>
                    <div className="text-center mb-4 md:mb-8">
                      <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
                        Galvaniy Labs
                      </h1>
                      <p className="text-sm md:text-base text-slate-300 px-4 font-normal">
                        Enter your experiment code to instantly generate an authenticated laboratory report.
                      </p>
                      <p className="text-slate-400 text-xs md:text-sm mt-1 font-mono tracking-widest uppercase">
                        University of Nairobi Physics Companion
                      </p>
                    </div>
                    <Generator user={user} onReportGenerated={handleReportGenerated} />
                  </>
                ) : (
                  <Admin />
                )}
              </div>

              {/* Sidebar / History */}
              <div className="md:col-span-1">
                <History 
                  reports={reports} 
                  onSelect={setSelectedReport} 
                  onDelete={handleDeleteReport}
                  onClearAll={handleClearAllReports}
                />
              </div>
            </div>
          )}
          
          {/* Modal for viewing report */}
          <ReportView 
            report={selectedReport} 
            onClose={() => setSelectedReport(null)}
            onOpenLab={(code) => {
              setSelectedReport(null);
              setLabExperiment(code);
              setView('labs');
            }}
          />
        </div>
      )}
      {!labExperiment && <InstallPrompt />}
      <Analytics />
    </Layout>
  );
};

export default App;
