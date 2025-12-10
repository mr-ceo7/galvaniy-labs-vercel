import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { User, Theme } from '../types';
import { Shield, Ban, CheckCircle, RefreshCcw, Users, FileText, Trash2, Plus } from 'lucide-react';

interface AdminProps {
  theme?: Theme;
}

export const Admin: React.FC<AdminProps> = ({ theme }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [newRef, setNewRef] = useState('');

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

  const handleRemoveReference = (index: number) => {
    storageService.removeReference(index);
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
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
          <FileText className="text-yellow-400" /> Lab Manual References
        </h2>
        
        <form onSubmit={handleAddReference} className="mb-6 flex gap-2">
            <input 
                type="text" 
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                placeholder="Paste new experiment theory or lab instructions here..."
                className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-yellow-500/50 text-slate-200 placeholder:text-slate-500"
            />
            <button 
                type="submit"
                className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-600/30 px-6 rounded-xl flex items-center gap-2 font-medium transition-colors"
            >
                <Plus size={18} /> Add
            </button>
        </form>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {references.map((ref, idx) => (
                <div key={idx} className="bg-white/5 p-4 rounded-xl flex items-start justify-between group border border-white/5 hover:border-white/10 transition-colors">
                    <p className="text-xs text-slate-300 line-clamp-2 font-mono flex-1 mr-4 opacity-80 group-hover:opacity-100">{ref}</p>
                    <button 
                        onClick={() => handleRemoveReference(idx)}
                        className="text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded"
                        title="Remove Reference"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
            {references.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-xl">
                    <p className="text-slate-500 text-sm">No custom references added.</p>
                    <p className="text-slate-600 text-xs mt-1">The system is using the default 2025 Manual context.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};