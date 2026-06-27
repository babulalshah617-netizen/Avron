import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, HospitalRole } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: HospitalRole[]) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializing = useRef(false);
  const initialLoginDone = useRef(false);

  const fetchProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, department:departments(id,name,floor)')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch profile:', error.message);
        return null;
      }

      if (data) {
        const { data: authUser, error: authErr } = await supabase.auth.getUser();
        if (authErr) {
          console.error('Failed to get auth user:', authErr.message);
        }
        return { ...data, email: authUser.user?.email ?? '' };
      }
      return null;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (initializing.current) return;
    initializing.current = true;

    const initAuth = async () => {
      try {
        const { data: { session: s }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          console.error('Session fetch error:', sessionErr.message);
        }

        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);

          // Log initial session login once
          if (!initialLoginDone.current) {
            initialLoginDone.current = true;
            await supabase.from('profiles').update({ last_login: new Date().toISOString() })
              .eq('id', s.user.id);
            await supabase.from('audit_logs').insert({
              user_id: s.user.id,
              action: 'login',
              entity_type: 'auth',
              details: { email: s.user.email, source: 'session_restore' },
            });
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // Update state synchronously first
      setSession(s);
      setUser(s?.user ?? null);

      // Schedule async work outside the callback to avoid deadlocks
      if (s?.user) {
        setTimeout(() => {
          fetchProfile(s.user.id).then(p => setProfile(p));

          if (event === 'SIGNED_IN') {
            supabase.from('profiles').update({ last_login: new Date().toISOString() })
              .eq('id', s.user.id);
            supabase.from('audit_logs').insert({
              user_id: s.user.id,
              action: 'login',
              entity_type: 'auth',
              details: { email: s.user.email },
            });
          }
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'logout',
        entity_type: 'auth',
        details: {},
      });
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const hasRole = (...roles: HospitalRole[]) =>
    profile ? roles.includes(profile.role) : false;

  const isAdmin = hasRole('super_admin', 'md', 'department_head');

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signIn, signOut, refreshProfile, hasRole, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
