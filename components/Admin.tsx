import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { User, Theme } from '../types';
import { Shield, Ban, CheckCircle, RefreshCcw } from 'lucide-react';

interface AdminProps {
  theme?: Theme;
}

export const Admin: React.FC<AdminProps> = ({ theme }) => {
  const [users, setUsers] = useState<User[]>([]);

  const loadUsers = () => {
    setUsers(storageService.getAllUsers());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleRevoke = (email: string) => {
    storageService.revokeUser(email);
    loadUsers();
  };

  return (
    <div className="mt-8 glass-panel rounded-2xl p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="text-red-400" /> Admin Dashboard
        </h2>
        <button 
          onClick={loadUsers} 
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10"
        >
          <RefreshCcw size={18} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-slate-400 uppercase bg-black/20">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Generated</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`px-2 py-1 rounded ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">{u.reportsGenerated}</td>
                <td className="px-4 py-3">
                  {u.isRevoked ? (
                    <span className="text-red-400 text-xs flex items-center gap-1"><Ban size={12}/> Revoked</span>
                  ) : (
                    <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle size={12}/> Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => toggleRevoke(u.email)}
                      className={`text-xs px-3 py-1 rounded border transition-colors ${u.isRevoked ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
                    >
                      {u.isRevoked ? 'Restore' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-sm text-yellow-200">
        <h4 className="font-bold mb-1">Manual Reference Control</h4>
        <p className="opacity-80">
          The AI Context is currently hardcoded in <code>constants.ts</code> (Version 2025 Edition). 
          To update materials, a developer update is required in the codebase.
        </p>
      </div>
    </div>
  );
};