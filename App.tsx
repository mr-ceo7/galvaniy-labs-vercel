import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SplashScreen } from './components/SplashScreen';
import { Auth } from './components/Auth';
import { Generator } from './components/Generator';
import { History } from './components/History';
import { Admin } from './components/Admin';
import { ReportView } from './components/ReportView';
import { InstallPrompt } from './components/InstallPrompt';
import { User, Report } from './types';
import { storageService } from './services/storageService';
import { LogOut, User as UserIcon } from 'lucide-react';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'generator' | 'admin'>('generator');
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  console.log('[App] Render - loading:', loading, 'user:', user?.email || 'none');

  useEffect(() => {
    console.log('[App] Component mounted, checking session...');
    // Check session
    const session = storageService.getSession();
    if (session) {
      console.log('[App] Session found:', session.email);
      setUser(session);
      loadReports(session.email);
    } else {
      console.log('[App] No session found, user will need to login');
    }
  }, []);

  const loadReports = (email: string) => {
    const userReports = storageService.getReports(email);
    setReports(userReports);
  };

  const handleLogin = (u: User) => {
    setUser(u);
    loadReports(u.email);
  };

  const handleLogout = () => {
    storageService.clearSession();
    setUser(null);
    setReports([]);
  };

  const handleReportGenerated = (report: Report) => {
    if (user) {
      loadReports(user.email);
      setSelectedReport(report);
    }
  };

  useEffect(() => {
    // Safety fallback: force complete splash after 5 seconds
    if (loading) {
      const fallbackTimer = setTimeout(() => {
        console.warn('[App] Force completing splash screen after 5 second timeout');
        setLoading(false);
      }, 5000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [loading]);

  if (loading) {
    return <SplashScreen onComplete={() => {
      console.log('[App] SplashScreen completed, setting loading to false');
      setLoading(false);
    }} />;
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
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 flex-grow">
            {/* Main Content Area */}
            <div className="md:col-span-2 space-y-4 md:space-y-6">
              {view === 'generator' ? (
                <>
                  <div className="text-center mb-4 md:mb-8">
                    <h1 className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">
                      Galvaniy Labs
                    </h1>
                    <p className="text-sm md:text-base text-slate-300 px-4">
                      Enter your experiment code to instantly generate a comprehensive report.
                    </p>
                    <p className="text-slate-400 text-xs md:text-sm mt-1 italic">
                      "your lab companion"
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
               <History reports={reports} onSelect={setSelectedReport} />
            </div>
          </div>
          
          {/* Modal for viewing report */}
          <ReportView 
            report={selectedReport} 
            onClose={() => setSelectedReport(null)} 
          />
        </div>
      )}
      <InstallPrompt />
    </Layout>
  );
};

export default App;