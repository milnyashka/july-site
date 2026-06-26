'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Currency } from '@/lib/currency';
import { getPrimaryRole, resolveAccountRoles, type AccountRole } from '@/lib/roles';
import { getTierFromSpentUsd, sumPurchasesToUsd, type CustomerTier } from '@/lib/tiers';

type Profile = {
  balance: number;
  email: string;
  currency: Currency;
  avatarUrl: string | null;
  role: AccountRole;
  roles: AccountRole[];
  totalSpentUsd: number;
  tier: CustomerTier;
  accountFrozen: boolean;
  balanceFrozen: boolean;
  accountFreezeReason: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    await supabase.auth.refreshSession();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (!currentUser) {
      setProfile(null);
      return;
    }

    type ProfileRow = {
      balance: number | string;
      email: string;
      currency: string;
      avatar_url: string | null;
      role?: string | null;
      roles?: string[] | null;
      account_frozen?: boolean | null;
      balance_frozen?: boolean | null;
      account_freeze_reason?: string | null;
    };

    let data: ProfileRow | null = null;

    const primary = await supabase
      .from('profiles')
      .select('balance, email, currency, avatar_url, role, roles, account_frozen, balance_frozen, account_freeze_reason')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (primary.error?.message?.includes('role')) {
      const fallback = await supabase
        .from('profiles')
        .select('balance, email, currency, avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle();
      data = fallback.data;
    } else {
      data = primary.data;
    }

    if (!data && currentUser.email) {
      const currency =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/ru') ? 'rub' : 'usd';
      await supabase.from('profiles').insert({
        id: currentUser.id,
        email: currentUser.email.toLowerCase(),
        currency,
      });
      const refetch = await supabase
        .from('profiles')
        .select('balance, email, currency, avatar_url, role, roles, account_frozen, balance_frozen, account_freeze_reason')
        .eq('id', currentUser.id)
        .maybeSingle();
      data = refetch.data;
    }

    if (data) {
      const currency = (data.currency === 'rub' ? 'rub' : 'usd') as Currency;

      let purchaseRows: { amount: number; amount_usd?: number | null }[] = [];
      const purchasesRes = await supabase
        .from('purchases')
        .select('amount, amount_usd')
        .eq('user_id', currentUser.id);

      if (purchasesRes.error?.message?.includes('amount_usd')) {
        const fallback = await supabase
          .from('purchases')
          .select('amount')
          .eq('user_id', currentUser.id);
        purchaseRows = fallback.data ?? [];
      } else {
        purchaseRows = purchasesRes.data ?? [];
      }

      const totalSpentUsd = sumPurchasesToUsd(purchaseRows, currency);
      const tier = getTierFromSpentUsd(totalSpentUsd);

      setProfile({
        balance: Number(data.balance),
        email: data.email,
        currency,
        avatarUrl: data.avatar_url ?? null,
        roles: resolveAccountRoles(data.roles, data.role, currentUser),
        role: getPrimaryRole(resolveAccountRoles(data.roles, data.role, currentUser)),
        totalSpentUsd,
        tier,
        accountFrozen: Boolean(data.account_frozen),
        balanceFrozen: Boolean(data.balance_frozen),
        accountFreezeReason: data.account_freeze_reason ?? null,
      });
    } else {
      setProfile(null);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    refreshProfile().finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshProfile();
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshProfile]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void refreshProfile();
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const value = useMemo(
    () => ({ user, profile, loading, refreshProfile, signOut }),
    [user, profile, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}