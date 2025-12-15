import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { User, Theme } from '../types';
import { Shield, Ban, CheckCircle, RefreshCcw, Users, FileText, Trash2, Plus, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker to match the library version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

interface AdminProps {
  theme?: Theme;
}

export const Admin: React.FC<AdminProps> = ({ theme }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [newRef, setNewRef] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadData = () => {
    setUsers(storageService.getAllUsers());
    setReferences(storageService.getReferences());
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
    
    // Default is 3 if customLimit is undefined
    const currentLimit = user.customLimit !== undefined ? user.customLimit : 3;
    const newLimit = Math.max(0, currentLimit + delta);
    
    storageService.updateUserLimit(email, newLimit);
    loadData();
  };

  const handleAddReference = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRef.trim()) {
      storageService.addReference(newRef);
      setNewRef('');
      loadData();
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    // Load the document using pdfjs-dist
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += `--- PDF Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    // Reset the input so the same file can be selected again if needed
    e.target.value = '';

    try {
        if (file.type === 'application/pdf') {
            const text = await extractTextFromPDF(file);
            if (text.trim().length === 0) {
                 alert("Could not extract text from this PDF. It might be an image-only PDF.");
            } else if (text.length > 500000) {
                 alert("PDF content too large. Please split it.");
            } else {
                 storageService.addReference(`[PDF: ${file.name}]\n\n${text}`);
                 loadData();
            }
        } else {
            // Default text handling for other types
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (text) {
                    if (text.length > 500000) {
                        alert("File too large. Please split it.");
                        return;
                    }
                    storageService.addReference(`[File: ${file.name}]\n\n${text}`);
                    loadData();
                }
            };
            reader.readAsText(file);
        }
    } catch (error) {
        console.error("Upload error:", error);
        alert("Failed to read file. If it is a PDF, ensure it contains selectable text.");
    } finally {
        setUploading(false);
    }
  };

  const handleRemoveReference = (index: number) => {
    storageService.removeReference(index);
    loadData();
  };

  const handleClearAllRefs = () => {
    if (window.confirm("Are you sure you want to delete ALL manual content? This cannot be undone.")) {
      storageService.clearReferences();
      loadData();
    }
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
            <p className="text-slate-400 text-sm uppercase tracking-wide">Total Reports Generated</p>
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
          <button 
            onClick={loadData} 
            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            title="Refresh Data"
          >
            <RefreshCcw size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs text-slate-400 uppercase bg-black/20">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Reports</th>
                <th className="px-4 py-3 text-center">Daily Limit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">{u.email}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-1 rounded border ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-300">{u.reportsGenerated}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3">
                        <button 
                            onClick={() => handleUpdateLimit(u.email, -1)}
                            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs text-slate-400 hover:text-white transition-colors border border-white/10"
                        >-</button>
                        <span className="w-6 text-center font-mono font-bold text-yellow-400">
                            {u.customLimit !== undefined ? u.customLimit : 3}
                        </span>
                        <button 
                            onClick={() => handleUpdateLimit(u.email, 1)}
                            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs text-slate-400 hover:text-white transition-colors border border-white/10"
                        >+</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.isRevoked ? (
                      <span className="text-red-400 text-xs flex items-center gap-1 font-medium bg-red-500/10 px-2 py-1 rounded border border-red-500/20 w-fit"><Ban size={12}/> Revoked</span>
                    ) : (
                      <span className="text-green-400 text-xs flex items-center gap-1 font-medium bg-green-500/10 px-2 py-1 rounded border border-green-500/20 w-fit"><CheckCircle size={12}/> Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => toggleRevoke(u.email)}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors ${u.isRevoked ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
                      >
                        {u.isRevoked ? 'Restore Access' : 'Revoke Access'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reference Material Management */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <FileText className="text-yellow-400" /> Lab Manual Management
            </h2>
            <div className="flex gap-2">
                <label className={`cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? 'Processing...' : 'Upload File'}
                    <input type="file" onChange={handleFileUpload} className="hidden" accept=".txt,.md,.json,.csv,.pdf" />
                </label>
                {references.length > 0 && (
                    <button 
                        onClick={handleClearAllRefs}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={16} /> Clear Manual
                    </button>
                )}
            </div>
        </div>
        
        <form onSubmit={handleAddReference} className="mb-6">
            <div className="relative">
                <textarea 
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    placeholder="Or paste experiment theory, procedures, or instructions here..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-yellow-500/50 text-slate-200 placeholder:text-slate-500 min-h-[120px]"
                />
                <button 
                    type="submit"
                    disabled={!newRef.trim()}
                    className="absolute bottom-3 right-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-600/30 px-4 py-1.5 rounded-lg flex items-center gap-2 font-medium transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus size={14} /> Add Text
                </button>
            </div>
        </form>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {references.map((ref, idx) => (
                <div key={idx} className="bg-white/5 p-4 rounded-xl flex items-start justify-between group border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex-1 mr-4">
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Entry #{idx + 1}</span>
                         <p className="text-sm text-slate-300 line-clamp-3 font-mono opacity-80 group-hover:opacity-100 whitespace-pre-wrap">{ref}</p>
                    </div>
                    <button 
                        onClick={() => handleRemoveReference(idx)}
                        className="text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-lg"
                        title="Remove Entry"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
            {references.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                    <AlertTriangle className="mx-auto mb-3 text-yellow-500/50" size={32} />
                    <p className="text-slate-400 font-medium">Manual is Empty</p>
                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                        The AI has no context. Upload a manual (PDF, Text) to enable report generation.
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};