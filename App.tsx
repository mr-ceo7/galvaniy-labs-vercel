import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SplashScreen } from './components/SplashScreen';
import { Auth } from './components/Auth';
import { Generator } from './components/Generator';
import { History } from './components/History';
import { Admin } from './components/Admin';
import { ReportView } from './components/ReportView';
import { User, Report } from './types';
import { storageService } from './services/storageService';
import { LogOut, User as UserIcon } from 'lucide-react';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'generator' | 'admin'>('generator');
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    // Check session
    const session = storageService.getSession();
    if (session) {
      setUser(session);
      loadReports(session.email);
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

  if (loading) {
    return <SplashScreen onComplete={() => setLoading(false)} />;
  }

  return (
    <Layout>
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 glass-panel p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-full">
                <UserIcon className="text-white" size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-400">Signed in as</p>
                <p className="font-semibold text-white">{user.email}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {user.role === 'admin' && (
                <button
                  onClick={() => setView(view === 'admin' ? 'generator' : 'admin')}
                  className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors"
                >
                  {view === 'admin' ? 'Open Generator' : 'Admin Panel'}
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-500/20 text-slate-300 hover:text-red-300 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
            {/* Main Content Area */}
            <div className="md:col-span-2 space-y-6">
              {view === 'generator' ? (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">
                      Galvaniy Labs
                    </h1>
                    <p className="text-slate-300">
                      Enter your experiment code to instantly generate a comprehensive report.
                    </p>
                    <p className="text-slate-400 text-sm mt-1 italic">
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
    </Layout>
  );
};

export default App;