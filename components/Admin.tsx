import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { User, Theme, ManualPage } from '../types';
import { Shield, Ban, CheckCircle, RefreshCcw, Users, FileText, Trash2, Plus, Upload, AlertTriangle, Loader2, Image as ImageIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker to match the library version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

interface AdminProps {
  theme?: Theme;
}

export const Admin: React.FC<AdminProps> = ({ theme }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<ManualPage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const loadData = () => {
    setUsers(storageService.getAllUsers());
    setPages(storageService.getManualPages());
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleRevoke = (email: string) => {
    storageService.revokeUser(email);
    loadData();
  };

  const handleUpdateLimit = (email: string, delta: number) => {
    const user = users.find(u => u.email === email);
    if (!user) return;
    const currentLimit = user.customLimit !== undefined ? user.customLimit : 3;
    const newLimit = Math.max(0, currentLimit + delta);
    storageService.updateUserLimit(email, newLimit);
    loadData();
  };

  const handleClearManual = () => {
    if (window.confirm("Are you sure you want to delete ALL manual content? This cannot be undone.")) {
      storageService.clearManual();
      loadData();
    }
  };

  const processPDF = async (file: File) => {
    setUploading(true);
    setUploadProgress('Loading PDF...');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = Math.min(pdf.numPages, 20); // Limit to 20 pages for demo to avoid LocalStorage overflow
        
        const newPages: ManualPage[] = [];

        for (let i = 1; i <= numPages; i++) {
            setUploadProgress(`Processing Page ${i} of ${numPages}...`);
            const page = await pdf.getPage(i);
            
            // Extract Text
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');

            // Render Image
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Resize for storage efficiency (Max width 800px)
            const scale = Math.min(1, 800 / viewport.width);
            const scaledViewport = page.getViewport({ scale });
            
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;

            if (context) {
                // Cast render parameters to any to resolve type mismatch with pdfjs-dist RenderParameters
                await page.render({ canvasContext: context, viewport: scaledViewport } as any).promise;
                const imageBase64 = canvas.toDataURL('image/jpeg', 0.6); // Compress JPEG
                
                newPages.push({
                    id: `${Date.now()}-${i}`,
                    pageNumber: i,
                    text: text,
                    image: imageBase64
                });
            }
        }
        
        storageService.addManualPages(newPages);
        loadData();
        alert(`Successfully uploaded ${newPages.length} pages.`);

    } catch (error) {
        console.error("PDF Processing Error", error);
        alert("Failed to process PDF. Ensure it is a valid file.");
    } finally {
        setUploading(false);
        setUploadProgress('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
        processPDF(file);
    } else {
        alert("Please upload a PDF file to enable diagram extraction.");
    }
    e.target.value = ''; // Reset input
  };

  const handleDeletePage = (id: string) => {
      storageService.removePage(id);
      loadData();
  };

  // Statistics
  const totalStudents = users.filter(u => u.role === 'student').length;
  const totalReports = users.reduce((acc, curr) => acc + curr.reportsGenerated, 0);

  return (
    <div className="mt-8 space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* User Management */}
      <div className="glass-panel rounded-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Shield className="text-red-400" /> User Management
          </h2>
          <button onClick={loadData} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"><RefreshCcw size={18} className="text-slate-400" /></button>
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
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">{u.email}</td>
                  <td className="px-4 py-3 text-xs"><span className="px-2 py-1 rounded border border-white/10">{u.role}</span></td>
                  <td className="px-4 py-3 text-center text-slate-300">{u.reportsGenerated}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleUpdateLimit(u.email, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-400">-</button>
                        <span className="text-yellow-400 font-mono">{u.customLimit ?? 3}</span>
                        <button onClick={() => handleUpdateLimit(u.email, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-400">+</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.isRevoked ? <span className="text-red-400 text-xs">Revoked</span> : <span className="text-green-400 text-xs">Active</span>}</td>
                  <td className="px-4 py-3">{u.role !== 'admin' && <button onClick={() => toggleRevoke(u.email)} className="text-xs underline text-slate-400 hover:text-white">{u.isRevoked ? 'Restore' : 'Revoke'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Management */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <FileText className="text-yellow-400" /> Lab Manual (Text & Diagrams)
            </h2>
            <div className="flex gap-2">
                <label className={`cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? uploadProgress : 'Upload PDF Manual'}
                    <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf" />
                </label>
                {pages.length > 0 && (
                    <button onClick={handleClearManual} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                        <Trash2 size={16} /> Clear
                    </button>
                )}
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
            {pages.map((page) => (
                <div key={page.id} className="bg-black/40 rounded-xl overflow-hidden border border-white/5 group relative">
                    {page.image ? (
                        <div className="aspect-[3/4] relative">
                             <img src={page.image} alt={`Page ${page.pageNumber}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                        </div>
                    ) : (
                        <div className="aspect-[3/4] flex items-center justify-center bg-slate-800 text-slate-600">
                            <FileText size={32} />
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-xs font-bold text-white">Page {page.pageNumber}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{page.text.substring(0, 50)}...</p>
                    </div>
                    <button 
                        onClick={() => handleDeletePage(page.id)}
                        className="absolute top-2 right-2 bg-red-500/80 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            {pages.length === 0 && (
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