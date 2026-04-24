import React, { useEffect, useState, useRef } from 'react';
import { storageService } from '../services/storageService';
import { logService } from '../services/logService';
import { backendService, BackendStats, BackendSettings } from '../services/backendService';
import { User, Theme, ManualPage, AdminLabSession } from '../types';
import { Shield, RefreshCcw, Users, FileText, Trash2, Upload, AlertTriangle, Loader2, Search, Settings, Download, CheckCircle2, FlaskConical, Bot, Clock3 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure the worker to match the library version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

interface AdminProps {
  theme?: Theme;
}

// Lazy Image Component for Performance
const LazyPageImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Load when within 100px of viewport
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900/50">
      {isVisible ? (
        <>
            <img 
                src={src} 
                alt={alt} 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none"></div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-700">
             <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/30 animate-spin" />
        </div>
      )}
    </div>
  );
};

export const Admin: React.FC<AdminProps> = ({ theme }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<ManualPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Progress State
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [uploadStatus, setUploadStatus] = useState(''); // Text status
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New States
  const [defaultDailyLimit, setDefaultDailyLimit] = useState(3);
  const [downloadingZip, setDownloadingZip] = useState(false);
  
  // Settings States
  const [parallelGeneration, setParallelGeneration] = useState(true);
  const [apiProvider, setApiProvider] = useState<string>('gemini');
  const [customApiUrl, setCustomApiUrl] = useState<string>('');
  const [labSessions, setLabSessions] = useState<AdminLabSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Stats
  const [stats, setStats] = useState<BackendStats>({ total_students: 0, total_reports: 0, active_students: 0, revoked_students: 0, total_lab_sessions: 0, manual_lab_sessions: 0, auto_lab_sessions: 0, students_using_virtual_lab: 0 });

  const loadData = async () => {
    try {
      // Load users from backend
      const backendUsers = await backendService.getUsers();
      setUsers(backendUsers);
      
      // Load settings from backend
      const settings = await backendService.getSettings();
      setDefaultDailyLimit(settings?.default_daily_limit || 3);
      if (typeof settings?.enable_parallel_generation !== 'undefined') {
        setParallelGeneration(!!settings.enable_parallel_generation);
      }
      setApiProvider(settings?.api_provider || 'gemini');
      setCustomApiUrl(settings?.custom_api_url || '');

      // Load stats
      const backendStats = await backendService.getStats();
      setStats(backendStats);

      setLoadingSessions(true);
      const backendSessions = await backendService.getAdminLabSessions(30);
      setLabSessions(backendSessions);
    } catch (err) {
      logService.error('Failed to load admin data:', err);
    } finally {
      setLoadingSessions(false);
    }
    
    try {
      setLoadingPages(true);
      // Check manual metadata via backend
      const metadata = await backendService.getManualMetadata();
      if (metadata && metadata.page_count && metadata.page_count > 0) {
        // We don't have page images from backend — show placeholder info
        const placeholderPages: ManualPage[] = [];
        for (let i = 1; i <= metadata.page_count; i++) {
          placeholderPages.push({
            id: `page_${i}`,
            pageNumber: i,
            text: `Page ${i} (stored on server)`,
          });
        }
        setPages(placeholderPages);
      } else {
        setPages([]);
      }
    } catch (err) {
        logService.error("Failed to load pages", err);
        setPages([]);
    } finally {
        setLoadingPages(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleRevoke = async (email: string) => {
    const user = users.find(u => u.email === email);
    if (!user || !user.uid) return;
    
    await backendService.updateUser(user.uid, { is_revoked: !user.isRevoked });
    // Refresh data
    await loadData();
  };

  const handleUpdateLimit = async (email: string, delta: number) => {
    const user = users.find(u => u.email === email);
    if (!user || !user.uid) return;
    const currentLimit = user.customLimit !== undefined ? user.customLimit : defaultDailyLimit;
    const newLimit = Math.max(0, currentLimit + delta);
    
    await backendService.updateUser(user.uid, { custom_limit: newLimit });
    // Refresh data
    await loadData();
  };
  
  const handleUpdateDefaultLimit = async (newLimit: number) => {
      const val = Math.max(0, newLimit);
      setDefaultDailyLimit(val);
      await backendService.updateSettings({ default_daily_limit: val });
  };

  const confirmClearManual = async () => {
    try {
      await backendService.clearManual();
      // Clear from localStorage (for legacy data)
      await storageService.clearManual();
      // Reload to update UI
      loadData();
      setShowClearConfirm(false);
    } catch (error) {
      logService.error('Error clearing manual:', error);
      alert('Failed to clear manual. Please try again.');
    }
  };

  // ZIP Download Handler
  const handleDownloadManual = async () => {
      if (pages.length === 0) return;
      setDownloadingZip(true);
      try {
          const zip = new JSZip();
          const folder = zip.folder("Lab_Manual");
          
          if (!folder) throw new Error("Failed to create zip folder");

          // Add metadata
          folder.file("metadata.txt", `Generated by Galvaniy Labs Admin\nTotal Pages: ${pages.length}\nDate: ${new Date().toISOString()}`);
          
          // Process pages
          for (const page of pages) {
             const fileName = `Page_${page.pageNumber}.jpg`;
             // Remove data URL prefix
             if (page.image) {
                 const base64Data = page.image.split(',')[1];
                 folder.file(fileName, base64Data, { base64: true });
             }
             // Save text content separately
             if (page.text) {
                 folder.file(`Page_${page.pageNumber}.txt`, page.text);
             }
          }

          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Galvaniy_Lab_Manual_${new Date().toISOString().split('T')[0]}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          logService.error("Zip Error", e);
          alert("Failed to create zip file.");
      } finally {
          setDownloadingZip(false);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        alert("Please upload a PDF file.");
        e.target.value = '';
        return;
    }

    setUploading(true);
    setUploadStatus('Uploading PDF to server...');
    setUploadProgress(30);

    try {
      // Upload raw PDF to the backend — backend handles text extraction
      const result = await backendService.uploadManual(file);
      
      setUploadProgress(100);
      setUploadStatus('Complete!');

      setTimeout(() => {
        alert(`Successfully uploaded ${result.page_count} pages! All students will see the update.`);
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
        loadData();
      }, 500);
    } catch (error: any) {
      logService.error("Upload Error", error);
      setUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
      alert(error.message || "Failed to upload manual.");
    }

    e.target.value = ''; // Reset input
  };

  const handleDeletePage = async (id: string) => {
      await storageService.removePage(id);
      loadData();
  };

  const handleParallelGenerationToggle = async (val: boolean) => {
    setParallelGeneration(val);
    await backendService.updateSettings({ enable_parallel_generation: val });
  };

  const handleApiProviderToggle = async (provider: string) => {
    setApiProvider(provider);
    await backendService.updateSettings({ api_provider: provider });
  };

  const handleCustomApiUrlChange = async (url: string) => {
    setCustomApiUrl(url);
    await backendService.updateSettings({ custom_api_url: url });
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mt-8 space-y-8 relative">
       {/* Confirmation Modal */}
       {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-red-900/20 transform scale-100 transition-all">
                <div className="flex items-center gap-4 mb-4 text-red-400">
                    <div className="p-3 bg-red-500/10 rounded-full">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Delete Manual?</h3>
                </div>
                <div className="text-slate-300 mb-8 space-y-2">
                    <p>Are you sure you want to delete <span className="text-white font-bold">ALL</span> manual content, including pages and the source PDF?</p>
                    <p className="text-red-400 text-sm font-semibold bg-red-950/30 p-2 rounded border border-red-900/50">
                        This action cannot be undone. All generative context will be lost.
                    </p>
                </div>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmClearManual}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors flex items-center gap-2 shadow-lg shadow-red-600/20"
                    >
                        <Trash2 size={18} />
                        Yes, Delete Everything
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-blue-500/20">
          <div className="p-4 bg-blue-500/20 rounded-full text-blue-400">
            <Users size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wide">Total Students</p>
            <p className="text-3xl font-bold text-white">{stats.total_students}</p>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-purple-500/20">
          <div className="p-4 bg-purple-500/20 rounded-full text-purple-400">
            <FileText size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wide">Total Reports</p>
            <p className="text-3xl font-bold text-white">{stats.total_reports}</p>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-green-500/20">
            <div className="p-4 bg-green-500/20 rounded-full text-green-400">
                <Settings size={28} />
            </div>
            <div className="flex-1">
                <p className="text-slate-400 text-sm uppercase tracking-wide">Default Daily Limit</p>
                <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => handleUpdateDefaultLimit(defaultDailyLimit - 1)} className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white">-</button>
                    <span className="text-2xl font-bold text-white w-8 text-center">{defaultDailyLimit}</span>
                    <button onClick={() => handleUpdateDefaultLimit(defaultDailyLimit + 1)} className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white">+</button>
                </div>
            </div>
        </div>
        <div className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-cyan-500/20">
          <div className="p-4 bg-cyan-500/20 rounded-full text-cyan-400">
            <FlaskConical size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wide">Virtual Lab Sessions</p>
            <p className="text-3xl font-bold text-white">{stats.total_lab_sessions || 0}</p>
            <p className="text-xs text-slate-500 mt-1">{stats.students_using_virtual_lab || 0} students used labs</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-cyan-500/10">
          <div className="flex items-center gap-3 text-cyan-300 mb-2">
            <Clock3 size={18} />
            <span className="text-sm uppercase tracking-wide">Manual Sessions</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.manual_lab_sessions || 0}</div>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-amber-500/10">
          <div className="flex items-center gap-3 text-amber-300 mb-2">
            <Bot size={18} />
            <span className="text-sm uppercase tracking-wide">Auto Sessions</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.auto_lab_sessions || 0}</div>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-slate-500/10">
          <div className="flex items-center gap-3 text-slate-300 mb-2">
            <Users size={18} />
            <span className="text-sm uppercase tracking-wide">Lab Adoption</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.students_using_virtual_lab || 0}</div>
          <div className="text-xs text-slate-500 mt-1">students with saved virtual-lab sessions</div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <FlaskConical className="text-cyan-400" /> Virtual Lab Activity
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Recent saved sessions. Admins can see who actually used the lab and whether the run was manual or auto.
            </p>
          </div>
          <button onClick={loadData} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-sm flex items-center gap-2">
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>

        {loadingSessions ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading virtual lab activity...
          </div>
        ) : labSessions.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            No virtual lab sessions have been saved yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/10">
                  <th className="py-3 pr-4 font-medium">Student</th>
                  <th className="py-3 pr-4 font-medium">Experiment</th>
                  <th className="py-3 pr-4 font-medium">Mode</th>
                  <th className="py-3 pr-4 font-medium">Data</th>
                  <th className="py-3 pr-4 font-medium">Saved</th>
                </tr>
              </thead>
              <tbody>
                {labSessions.map((session) => (
                  <tr key={session.id} className="border-b border-white/5 text-slate-200">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{session.displayName || session.userEmail || session.userUid}</div>
                      <div className="text-xs text-slate-500">{session.userEmail || session.userUid}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{session.experimentCode}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${session.mode === 'auto' ? 'bg-amber-500/15 text-amber-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
                        {session.mode}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {session.dataPointCount} points
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {new Date(session.savedAt || session.completedAt || session.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generation Settings */}
      <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white mb-4">
          <Settings className="text-cyan-400" /> Generation Settings
        </h2>
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <p className="text-sm font-medium text-slate-300">Parallel Generation</p>
                <p className="text-xs text-slate-500">Run report sections in parallel (faster) or queued (safer).</p>
              </div>
              <button
                onClick={() => handleParallelGenerationToggle(!parallelGeneration)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${parallelGeneration ? 'bg-green-600 text-white' : 'bg-slate-700 text-white'}`}
              >
                {parallelGeneration ? 'Parallel' : 'Queued'}
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <p className="text-sm font-medium text-slate-300">API Provider</p>
                <p className="text-xs text-slate-500">Choose between Google Gemini or a Custom API.</p>
              </div>
              <div className="flex bg-black/40 rounded-full p-1 border border-white/10">
                <button
                  onClick={() => handleApiProviderToggle('gemini')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${apiProvider === 'gemini' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Gemini
                </button>
                <button
                  onClick={() => handleApiProviderToggle('custom')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${apiProvider === 'custom' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Custom API
                </button>
              </div>
            </div>

            {apiProvider === 'custom' && (
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30 flex flex-col gap-2">
                <p className="text-sm font-medium text-purple-200">Custom API URL</p>
                <input
                    type="text"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    onBlur={(e) => handleCustomApiUrlChange(e.target.value)}
                    placeholder="http://localhost:5000"
                    className="w-full bg-black/40 border border-purple-500/30 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-purple-300/70">The backend will upload the manual and send prompts to this server.</p>
              </div>
            )}
        </div>
        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-sm text-slate-400 mb-1">Backend Status:</p>
          <p className="text-lg font-bold text-white">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-400" />
              Server-Side Generation (Python Backend)
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            All report generation is handled server-side. API keys and prompts are secured on the backend.
          </p>
        </div>
      </div>

      {/* User Management */}
      <div className="glass-panel rounded-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Shield className="text-red-400" /> User Management
          </h2>
          <button onClick={() => loadData()} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"><RefreshCcw size={18} className="text-slate-400" /></button>
        </div>

        {/* Search Bar */}
        <div className="mb-6 relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
             <input 
                type="text" 
                placeholder="Search users by email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
             />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs text-slate-400 uppercase bg-black/20">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Reports</th>
                <th className="px-4 py-3 text-center">Limit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u.email} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{u.email}</td>
                      <td className="px-4 py-3 text-xs"><span className="px-2 py-1 rounded border border-white/10">{u.role}</span></td>
                      <td className="px-4 py-3 text-center text-slate-300">{u.reportsGenerated}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleUpdateLimit(u.email, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-400">-</button>
                            {/* Use Default Limit Fallback Here */}
                            <span className="text-yellow-400 font-mono">{u.customLimit ?? defaultDailyLimit}</span>
                            <button onClick={() => handleUpdateLimit(u.email, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-400">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.isRevoked ? <span className="text-red-400 text-xs">Revoked</span> : <span className="text-green-400 text-xs">Active</span>}</td>
                      <td className="px-4 py-3">{u.role !== 'admin' && <button onClick={() => toggleRevoke(u.email)} className="text-xs underline text-slate-400 hover:text-white">{u.isRevoked ? 'Restore' : 'Revoke'}</button>}</td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No users found matching "{searchQuery}"
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Management */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <FileText className="text-yellow-400" /> Lab Manual
                </h2>
                <span className="bg-white/10 px-2 py-1 rounded text-xs text-slate-300">
                    {loadingPages ? 'Loading...' : `${pages.length} Pages Stored`}
                </span>
            </div>
            
            <div className="flex gap-2">
                 {/* Progress Bar Container - Shows only when uploading */}
                 {uploading && (
                    <div className="flex flex-col justify-center w-48 mr-2">
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                            <span>{uploadStatus}</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-300 ease-out" 
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                <label className={`cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? 'Processing...' : 'Upload Manual'}
                    <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf" />
                </label>
                
                {pages.length > 0 && (
                     <button 
                        onClick={handleDownloadManual} 
                        disabled={downloadingZip}
                        className={`bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-white/10 ${downloadingZip ? 'opacity-50 pointer-events-none' : ''}`}
                     >
                        {downloadingZip ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        Download All
                    </button>
                )}

                {pages.length > 0 && (
                    <button onClick={() => setShowClearConfirm(true)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <Trash2 size={16} /> Clear
                    </button>
                )}
            </div>
        </div>

        {/* Manual Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto custom-scrollbar p-1">
            {pages.map((page) => (
                <div key={page.id} className="bg-black/40 rounded-lg overflow-hidden border border-white/5 group relative">
                    {page.image ? (
                        <div className="aspect-[3/4] relative">
                             <LazyPageImage src={page.image} alt={`Page ${page.pageNumber}`} />
                        </div>
                    ) : (
                        <div className="aspect-[3/4] flex items-center justify-center bg-slate-800 text-slate-600">
                            <FileText size={32} />
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs font-bold text-white">Pg {page.pageNumber}</p>
                    </div>
                    <button 
                        onClick={() => handleDeletePage(page.id)}
                        className="absolute top-1 right-1 bg-red-500/80 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 size={10} />
                    </button>
                </div>
            ))}
            
            {!loadingPages && pages.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                    <AlertTriangle className="mx-auto mb-3 text-yellow-500/50" size={32} />
                    <p className="text-slate-400 font-medium">No Manual Uploaded</p>
                    <p className="text-slate-500 text-sm mt-1">Upload a PDF to extract text and diagrams for the AI.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
