import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, limit, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Search, UserCheck, UserMinus, Shield, Mail, Calendar, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  diamonds: number;
  createdAt: any;
  lastUsed: any;
  usageCount: number;
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('lastUsed', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        fetchedUsers.push({ ...doc.data() as UserProfile });
      });
      setUsers(fetchedUsers);
    } catch (err: any) {
      setError("Failed to load users. You might not have permission.");
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      fetchUsers();
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const usersRef = collection(db, 'users');
      // Simple prefix search
      const q = query(
        usersRef, 
        where('email', '>=', searchTerm.toLowerCase()), 
        where('email', '<=', searchTerm.toLowerCase() + '\uf8ff'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const fetchedUsers: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        fetchedUsers.push({ ...doc.data() as UserProfile });
      });
      setUsers(fetchedUsers);
      if (fetchedUsers.length === 0) {
        setError("No users found with that email.");
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setIsSearching(false);
    }
  };

  const updateDiamonds = async (user: UserProfile, amount: number) => {
    const userRef = doc(db, 'users', user.uid);
    setError(null);
    try {
      await updateDoc(userRef, {
        diamonds: amount,
        lastUsed: serverTimestamp()
      });
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, diamonds: amount } : u));
    } catch (err: any) {
      setError("Failed to update diamonds. Please check if you have the correct permission levels.");
      fetchUsers(); // Rollback visual edits to original DB values
      console.error('Update diamonds error:', err);
    }
  };

  const toggleRole = async (user: UserProfile) => {
    const userRef = doc(db, 'users', user.uid);
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setError(null);
    try {
      await updateDoc(userRef, {
        role: newRole,
        lastUsed: serverTimestamp()
      });
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
    } catch (err: any) {
      setError("Failed to change user roles or permissions.");
      fetchUsers(); // Rollback visual edits to original DB values
      console.error('Toggle role error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <button 
              onClick={onBack}
              className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium uppercase tracking-widest">Back to Portal</span>
            </button>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
              Admin Control Center
            </h1>
            <p className="text-zinc-400 font-medium">Manage users, permissions, and service tiers.</p>
          </div>
          
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 px-6 pr-12 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-medium placeholder:text-zinc-600"
            />
            <button 
              type="submit"
              disabled={isSearching}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
            >
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </button>
          </form>
        </header>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3 font-medium"
            >
              <Shield size={20} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Table */}
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-[2rem] overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="px-8 py-6 text-zinc-500 text-xs font-bold uppercase tracking-widest">User</th>
                  <th className="px-8 py-6 text-zinc-500 text-xs font-bold uppercase tracking-widest">Role & Tier</th>
                  <th className="px-8 py-6 text-zinc-500 text-xs font-bold uppercase tracking-widest">Activity</th>
                  <th className="px-8 py-6 text-zinc-500 text-xs font-bold uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-8 py-10">
                        <div className="h-12 bg-zinc-800/50 rounded-2xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  users.map((user) => (
                    <motion.tr 
                      layout
                      key={user.uid} 
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          {user.photoURL ? (
                            <img src={user.photoURL} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-zinc-800" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center font-bold text-zinc-500">
                              {(user.email?.[0] || user.displayName?.[0] || 'U').toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-lg">{user.displayName || 'Anonymous'}</div>
                            <div className="text-zinc-500 text-sm flex items-center gap-1">
                              <Mail size={12} />
                              {user.email || 'No email provided'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border ${
                            user.role === 'admin' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
                          }`}>
                            {user.role}
                          </span>
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border bg-blue-500/10 border-blue-500/30 text-blue-400">
                             <Sparkles size={10} /> {user.diamonds || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm text-zinc-400">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <Calendar size={14} className="text-zinc-600" />
                            Used: {user.usageCount} times
                          </span>
                          <span className="text-[10px] text-zinc-600 uppercase font-bold">
                            Last Active: {user.lastUsed?.toDate ? new Date(user.lastUsed.toDate()).toLocaleDateString() : 'Never'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-blue-500/50 transition-colors">
                            <input 
                              type="number"
                              className="w-16 bg-transparent outline-none text-xs font-bold text-blue-400"
                              placeholder="Dms"
                              defaultValue={user.diamonds}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== user.diamonds) {
                                  updateDiamonds(user, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseInt((e.target as HTMLInputElement).value);
                                  if (!isNaN(val)) updateDiamonds(user, val);
                                }
                              }}
                            />
                            <Sparkles size={14} className="text-blue-500/50" />
                          </div>
                          <button
                            onClick={() => toggleRole(user)}
                            className={`p-3 rounded-xl border transition-all ${
                              user.role === 'admin'
                                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                            }`}
                            title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          >
                            <Shield size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {!loading && users.length === 0 && !error && (
            <div className="py-20 text-center text-zinc-600">
              <UserMinus size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xl font-medium tracking-tight">No users found.</p>
            </div>
          )}
        </div>

        {/* Footer Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Total Users', value: users.length, icon: UserMinus },
            { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Shield },
          ].map((stat, i) => (
            <div key={i} className="p-8 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl">
              <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
                {stat.label}
                <stat.icon size={14} />
              </div>
              <div className="text-4xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
