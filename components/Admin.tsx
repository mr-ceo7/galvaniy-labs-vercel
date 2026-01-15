import React, { useEffect, useState, useRef } from 'react';
import { storageService } from '../services/storageService';
import { logService } from '../services/logService';
import { firestoreService } from '../services/firestoreService';
import { apiService, ApiProvider } from '../services/apiService';
import { User, Theme, ManualPage } from '../types';
import { Shield, RefreshCcw, Users, FileText, Trash2, Upload, AlertTriangle, Loader2, Search, Settings, Download, Network, CheckCircle2, XCircle } from 'lucide-react';
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
  
  // API Configuration States
  const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [parallelGeneration, setParallelGeneration] = useState(true);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    // Load users from Firestore
    const firestoreUsers = await firestoreService.getAllUsers();
    setUsers(firestoreUsers);
    
    // Load settings from Firestore
    const settings = await firestoreService.getSettings();
    setDefaultDailyLimit(settings?.defaultDailyLimit || 3);
    
    // Load API settings from Firestore
    if (settings?.apiProvider) {
      setApiProvider(settings.apiProvider);  
      apiService.setProvider(settings.apiProvider);
    }
    if (settings?.customApiUrl) {
      setCustomApiUrl(settings.customApiUrl);
    }
    if (typeof settings?.enableParallelGeneration !== 'undefined') {
      setParallelGeneration(!!settings.enableParallelGeneration);
    }
    
    try {
        setLoadingPages(true);
        // Load manual pages from Firestore
        const firestorePages = await firestoreService.getManualPages();
        setPages(firestorePages.sort((a,b) => a.pageNumber - b.pageNumber));
    } catch (err) {
        logService.error("Failed to load pages", err);
    } finally {
        setLoadingPages(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Subscribe to real-time user updates
    const unsubscribeUsers = firestoreService.subscribeToAllUsers((updatedUsers) => {
      setUsers(updatedUsers);
    });
    
    // Subscribe to manual updates
    const unsubscribeManual = firestoreService.subscribeToManual(async (metadata) => {
      if (metadata) {
        const pages = await firestoreService.getManualPages();
        setPages(pages.sort((a,b) => a.pageNumber - b.pageNumber));
      }
    });
    
    return () => {
      unsubscribeUsers();
      unsubscribeManual();
    };
  }, []);

  const toggleRevoke = async (email: string) => {
    const user = users.find(u => u.email === email);
    if (!user || !user.uid) return;
    
    await firestoreService.toggleUserRevoke(user.uid, !user.isRevoked);
    // Real-time listener will update UI automatically
  };

  const handleUpdateLimit = async (email: string, delta: number) => {
    const user = users.find(u => u.email === email);
    if (!user || !user.uid) return;
    const currentLimit = user.customLimit !== undefined ? user.customLimit : defaultDailyLimit;
    const newLimit = Math.max(0, currentLimit + delta);
    
    await firestoreService.updateUserProfile(user.uid, { customLimit: newLimit });
    // Real-time listener will update UI automatically
  };
  
  const handleUpdateDefaultLimit = async (newLimit: number) => {
      const val = Math.max(0, newLimit);
      setDefaultDailyLimit(val);
      
      // Update in Firestore
      const user = users.find(u => u.role === 'admin');
      if (user) {
        await firestoreService.updateSettings({ defaultDailyLimit: val }, user.email);
      }
  };

  const confirmClearManual = async () => {
    try {
      // Clear from Firestore
      await firestoreService.clearManual();
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

  const processPDF = async (file: File) => {
    setUploading(true);
    setUploadStatus('Processing PDF...');
    setUploadProgress(5);

    try {
        setUploadStatus('Extracting pages...');
        setUploadProgress(10);
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        
        loadingTask.onPassword = (callback, reason) => {
            throw new Error("PASSWORD_PROTECTED");
        };

        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages; 
        
        if (numPages === 0) {
            throw new Error("EMPTY_PDF");
        }
        
        const allPages: ManualPage[] = [];
        const batchSize = 5;

        for (let i = 1; i <= numPages; i += batchSize) {
            const batch: ManualPage[] = [];
            const end = Math.min(i + batchSize - 1, numPages);

            for (let j = i; j <= end; j++) {
                const percent = 10 + Math.floor((j / numPages) * 80);
                setUploadProgress(percent);
                setUploadStatus(`Processing Page ${j} of ${numPages}...`);
                
                try {
                    const page = await pdf.getPage(j);
                    const textContent = await page.getTextContent();
                    const text = textContent.items.map((item: any) => item.str).join(' ');

                    const viewport = page.getViewport({ scale: 1.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    
                    const scale = Math.min(1, 800 / viewport.width);
                    const scaledViewport = page.getViewport({ scale });
                    
                    canvas.height = scaledViewport.height;
                    canvas.width = scaledViewport.width;

                    if (context) {
                        await page.render({ canvasContext: context, viewport: scaledViewport } as any).promise;
                        const imageBase64 = canvas.toDataURL('image/jpeg', 0.5);
                        
                        batch.push({
                            id: `${Date.now()}-${j}`,
                            pageNumber: j,
                            text: text,
                            image: imageBase64
                        });
                    }
                } catch (pageError) {
                    logService.warn(`Failed to process page ${j}`, pageError);
                }
            }
            
            allPages.push(...batch);
        }
        
        setUploadProgress(90);
        setUploadStatus('Uploading to Firestore...');
        
        // Upload to Firestore
        const adminUser = users.find(u => u.role === 'admin');
        await firestoreService.uploadManual(allPages, file.name, adminUser?.email || 'admin');
        
        setUploadProgress(100);
        setUploadStatus('Complete!');
        
        setTimeout(() => {
            alert(`Successfully uploaded ${allPages.length} pages to cloud! All students will see the update.`);
            setUploading(false);
            setUploadStatus('');
            setUploadProgress(0);
        }, 500);

    } catch (error: any) {
        logService.error("PDF Processing Error", error);
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
        
        let errorMessage = "Failed to process PDF. An unexpected error occurred.";
        
        if (error.message === 'PASSWORD_PROTECTED' || error.name === 'PasswordException') {
            errorMessage = "This PDF is password protected. Please unlock it before uploading.";
        } else if (error.name === 'InvalidPDFException') {
            errorMessage = "The file is corrupted or not a valid PDF document.";
        } else if (error.message === 'EMPTY_PDF') {
            errorMessage = "The uploaded PDF appears to be empty.";
        } else if (error instanceof Error) {
            if (error.message.toLowerCase().includes("password")) {
                errorMessage = "This PDF is password protected. Please unlock it before uploading.";
            } else {
                errorMessage = `Error: ${error.message}`;
            }
        }

        alert(errorMessage);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
        processPDF(file);
    } else {
        alert("Please upload a PDF file.");
    }
    e.target.value = ''; // Reset input
  };

  const handleDeletePage = async (id: string) => {
      await storageService.removePage(id);
      loadData();
  };

  // API Configuration Handlers
  const handleProviderChange = async (provider: ApiProvider) => {
    apiService.setProvider(provider);
    setApiProvider(provider);
    setApiTestResult(null);
    
    // Save to Firestore
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      await firestoreService.updateSettings({ apiProvider: provider }, adminUser.email);
    }
  };

  const handleCustomApiUrlChange = async (url: string) => {
    setCustomApiUrl(url);
    setApiTestResult(null);
    
    // Save to Firestore
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      await firestoreService.updateSettings({ customApiUrl: url }, adminUser.email);
    }
  };

  const handleParallelGenerationToggle = async (val: boolean) => {
    setParallelGeneration(val);
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      await firestoreService.updateSettings({ enableParallelGeneration: val }, adminUser.email);
    }
    try {
      localStorage.setItem('enable_parallel_generation', val ? 'true' : 'false');
    } catch {}
  };

  const handleTestApi = async () => {
    if (!customApiUrl) {
      setApiTestResult({ success: false, message: 'Please enter a Custom API URL first' });
      return;
    }

    setTestingApi(true);
    setApiTestResult(null);

    try {
      // If running on HTTPS and the configured customApiUrl is insecure (http),
      // use a relative path so Vercel's proxy (vercel.json) will handle the request.
      let testBase = customApiUrl;
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && testBase && testBase.startsWith('http:')) {
        logService.warn('[Admin] Insecure custom API detected on HTTPS page - using relative /api path to route through proxy.');
        testBase = '';
      }
      // Normalize trailing slash to avoid double-slashes
      if (testBase && testBase.endsWith('/')) testBase = testBase.replace(/\/$/, '');

      // Test the API by checking if the base URL is reachable
      const response = await fetch(`${testBase}/api/auth/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok || response.status === 404) {
        // 404 is okay - it means the endpoint exists but might not be implemented
        setApiTestResult({ success: true, message: 'Custom API is reachable and responding' });
      } else {
        setApiTestResult({ success: false, message: `API returned status: ${response.status}` });
      }
    } catch (error: any) {
      setApiTestResult({ 
        success: false, 
        message: `Connection failed: ${error.message || 'Unable to reach API'}` 
      });
    } finally {
      setTestingApi(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStudents = users.filter(u => u.role === 'student').length;
  const totalReports = users.reduce((acc, curr) => acc + curr.reportsGenerated, 0);

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

      {/* Stats Row - Updated to include Default Limit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-blue-500/20">
          <div className="p-4 bg-blue-500/20 rounded-full text-blue-400">
            <Users size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wide">Total Students</p>
            <p className="text-3xl font-bold text-white">{totalStudents}</p>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl flex items-center gap-4 border border-purple-500/20">
          <div className="p-4 bg-purple-500/20 rounded-full text-purple-400">
            <FileText size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wide">Total Reports</p>
            <p className="text-3xl font-bold text-white">{totalReports}</p>
          </div>
        </div>
        {/* New Default Limit Control */}
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
      </div>

      {/* API Configuration */}
      <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Network className="text-cyan-400" /> API Configuration
          </h2>
          <div className="flex items-center gap-2">
            {apiService.isProviderConfigured(apiProvider) ? (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 size={16} />
                <span>Configured</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle size={16} />
                <span>Not Configured</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select API Provider
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Gemini Option */}
              <button
                onClick={() => handleProviderChange('gemini')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  apiProvider === 'gemini'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">Google Gemini</span>
                  {apiProvider === 'gemini' && (
                    <CheckCircle2 className="text-blue-400" size={20} />
                  )}
                </div>
                <p className="text-xs text-slate-400 text-left">
                  Uses Gemini SDK directly with API key
                </p>
                <div className="mt-2 text-xs">
                  {apiService.isProviderConfigured('gemini') ? (
                    <span className="text-green-400">✓ API Key configured</span>
                  ) : (
                    <span className="text-yellow-400">⚠ API Key missing</span>
                  )}
                </div>
              </button>

              {/* Custom API Option */}
              <button
                onClick={() => handleProviderChange('custom')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  apiProvider === 'custom'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">Custom API</span>
                  {apiProvider === 'custom' && (
                    <CheckCircle2 className="text-cyan-400" size={20} />
                  )}
                </div>
                <p className="text-xs text-slate-400 text-left">
                  Uses your custom AI Gateway API
                </p>
                <div className="mt-2 text-xs">
                  {apiService.isProviderConfigured('custom') ? (
                    <span className="text-green-400">✓ URL configured</span>
                  ) : (
                    <span className="text-yellow-400">⚠ URL missing</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Custom API URL Configuration */}
          {apiProvider === 'custom' && (
            <div className="space-y-3 p-4 bg-black/20 rounded-xl border border-cyan-500/20">
              <label className="block text-sm font-medium text-slate-300">
                Custom API Base URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customApiUrl}
                  onChange={(e) => handleCustomApiUrlChange(e.target.value)}
                  placeholder="http://localhost:5000"
                  className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono text-sm"
                />
                <button
                  onClick={handleTestApi}
                  disabled={testingApi || !customApiUrl}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    testingApi || !customApiUrl
                      ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }`}
                >
                  {testingApi ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
              {apiTestResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    apiTestResult.success
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {apiTestResult.success ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>{apiTestResult.message}</span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Enter the base URL of your AI Gateway API (e.g., http://localhost:5000)
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">Parallel Generation</p>
                  <p className="text-xs text-slate-500">Run report sections in parallel (faster) or queued (safer).</p>
                </div>
                <div>
                  <button
                    onClick={() => handleParallelGenerationToggle(!parallelGeneration)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${parallelGeneration ? 'bg-green-600 text-white' : 'bg-slate-700 text-white'}`}
                  >
                    {parallelGeneration ? 'Parallel' : 'Queued'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Provider Info */}
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm text-slate-400 mb-1">Current Active Provider:</p>
            <p className="text-lg font-bold text-white capitalize">
              {apiProvider === 'gemini' ? 'Google Gemini SDK' : 'Custom API Gateway'}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              All report generation will use this provider. Switch anytime from this panel.
            </p>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="glass-panel rounded-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Shield className="text-red-400" /> User Management
          </h2>
          <button onClick={() => setUsers(storageService.getAllUsers())} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"><RefreshCcw size={18} className="text-slate-400" /></button>
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