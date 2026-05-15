import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db, logout } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  usageCount: number;
  role: string | null;
  isPremium: boolean;
  incrementUsage: () => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageCount, setUsageCount] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user?.uid);
      setUser(user);
      if (user) {
        try {
          await syncUser(user);
        } catch (error) {
          console.error("User sync failed:", error);
          // Don't log out here, just let it be. 
          // The error handler already logged the JSON error details.
        }
      } else {
        setUsageCount(0);
        setRole(null);
        setIsPremium(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const syncUser = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          usageCount: 0,
          role: user.email === 'uploadadd.com@gmail.com' ? 'admin' : 'user',
          isPremium: false,
          createdAt: serverTimestamp(),
          lastUsed: serverTimestamp()
        });
        setRole(user.email === 'uploadadd.com@gmail.com' ? 'admin' : 'user');
        setIsPremium(false);
      } else {
        const data = userSnap.data();
        setUsageCount(data.usageCount || 0);
        // Force admin role for the specific owner email even if DB hasn't synced it yet
        const effectiveRole = user.email === 'uploadadd.com@gmail.com' ? 'admin' : (data.role || 'user');
        setRole(effectiveRole);
        setIsPremium(data.isPremium || false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    }
  };

  const incrementUsage = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        usageCount: increment(1),
        lastUsed: serverTimestamp()
      });
      setUsageCount(prev => prev + 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, usageCount, role, isPremium, incrementUsage, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
