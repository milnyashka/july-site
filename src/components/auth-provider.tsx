'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Currency } from '@/lib/currency';
import { getPrimaryRole, resolveAccountRoles, type AccountRole } from '@/lib/roles';
import { getTierFromSpentUsd, sumProductPurchasesToUsd, type CustomerTier } from '@/lib/tiers';
import { computeAvailableBalance } from '@/lib/wallet-balance';
import { validateUsername } from '@/lib/username';

type Profile = {
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  email: string;
  username: string | null;
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

type RefreshProfileOptions = {
  full?: boolean;
  force?: boolean;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: (options?: RefreshProfileOptions) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string';

const REFRESH_THROTTLE_MS = 15_000;
const FOCUS_REFRESH_MS = 120_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  const lastRefreshAtRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const usernameAppliedRef = useRef(false);
  const lastFocusRefreshRef = useRef(0);
  const tierCacheRef = useRef<{ totalSpentUsd: number; tier: CustomerTier }>({
    totalSpentUsd: 0,
    tier: 'basic',
  });
  const lastSeenTouchRef = useRef(0);
  const initialLoadDoneRef = useRef(false);

  const refreshProfile = useCallback(
    async (options?: RefreshProfileOptions) => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const now = Date.now();
      if (!options?.force && refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }
      if (!options?.force && now - lastRefreshAtRef.current < REFRESH_THROTTLE_MS) {
        return;
      }

      const run = (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (!currentUser) {
          setProfile(null);
          setLoading(false);
          lastRefreshAtRef.current = Date.now();
          return;
        }

        type ProfileRow = {
          balance: number | string;
          email: string;
          currency: string;
          avatar_url: string | null;
          username?: string | null;
          role?: string | null;
          roles?: string[] | null;
          account_frozen?: boolean | null;
          balance_frozen?: boolean | null;
          account_freeze_reason?: string | null;
        };

        const [primary, walletRes] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              'balance, email, currency, avatar_url, username, role, roles, account_frozen, balance_frozen, account_freeze_reason'
            )
            .eq('id', currentUser.id)
            .maybeSingle(),
          supabase.rpc('get_wallet_balance', { p_user_id: currentUser.id }),
        ]);

        let data: ProfileRow | null = primary.data;

        if (primary.error?.message?.includes('role')) {
          const fallback = await supabase
            .from('profiles')
            .select('balance, email, currency, avatar_url')
            .eq('id', currentUser.id)
            .maybeSingle();
          data = fallback.data;
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
            .select(
              'balance, email, currency, avatar_url, username, role, roles, account_frozen, balance_frozen, account_freeze_reason'
            )
            .eq('id', currentUser.id)
            .maybeSingle();
          data = refetch.data;
        }

        if (data && !data.username && !usernameAppliedRef.current) {
          const pending = currentUser.user_metadata?.username;
          if (typeof pending === 'string' && !validateUsername(pending.trim())) {
            usernameAppliedRef.current = true;
            void supabase.rpc('set_username', {
              p_user_id: currentUser.id,
              p_username: pending.trim(),
            });
          }
        }

        if (!data) {
          setProfile(null);
          setLoading(false);
          lastRefreshAtRef.current = Date.now();
          return;
        }

        const currency = (data.currency === 'rub' ? 'rub' : 'usd') as Currency;

        let lockedBalance = 0;
        let availableBalance = Number(data.balance);

        if (!walletRes.error && walletRes.data) {
          const w = walletRes.data as { balance?: number; locked?: number; available?: number };
          lockedBalance = Number(w.locked ?? 0);
          availableBalance = Number(
            w.available ?? computeAvailableBalance(Number(data.balance), lockedBalance)
          );
        } else {
          availableBalance = computeAvailableBalance(Number(data.balance), 0);
        }

        let totalSpentUsd = tierCacheRef.current.totalSpentUsd;
        let tier: CustomerTier = tierCacheRef.current.tier;

        if (options?.full) {
          const purchasesRes = await supabase
            .from('purchases')
            .select('amount, amount_usd')
            .eq('user_id', currentUser.id);

          let purchaseRows: { amount: number; amount_usd?: number | null }[] = [];
          if (purchasesRes.error?.message?.includes('amount_usd')) {
            const fallback = await supabase
              .from('purchases')
              .select('amount')
              .eq('user_id', currentUser.id);
            purchaseRows = fallback.data ?? [];
          } else {
            purchaseRows = purchasesRes.data ?? [];
          }

          totalSpentUsd = sumProductPurchasesToUsd(purchaseRows, currency);
          tier = getTierFromSpentUsd(totalSpentUsd);
          tierCacheRef.current = { totalSpentUsd, tier };
        }

        setProfile({
          balance: Number(data.balance),
          lockedBalance,
          availableBalance,
          email: data.email,
          username: data.username ? String(data.username) : null,
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

        setLoading(false);

        const touchNow = Date.now();
        if (touchNow - lastSeenTouchRef.current > 5 * 60_000) {
          lastSeenTouchRef.current = touchNow;
          void supabase.rpc('touch_last_seen', { p_user_id: currentUser.id });
        }

        lastRefreshAtRef.current = touchNow;
      })();

      refreshInFlightRef.current = run;
      try {
        await run;
      } finally {
        refreshInFlightRef.current = null;
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    refreshProfile({ force: true }).finally(() => {
      initialLoadDoneRef.current = true;
    });

    let authTimer: ReturnType<typeof setTimeout> | null = null;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      if (!initialLoadDoneRef.current && event === 'SIGNED_IN') return;
      if (authTimer) clearTimeout(authTimer);
      authTimer = setTimeout(() => {
        void refreshProfile({ force: event === 'SIGNED_IN' || event === 'SIGNED_OUT' });
      }, 500);
    });

    return () => {
      subscription.unsubscribe();
      if (authTimer) clearTimeout(authTimer);
    };
  }, [supabase, refreshProfile]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < FOCUS_REFRESH_MS) return;
      lastFocusRefreshRef.current = now;
      void refreshProfile();
    };

    document.addEventListener('visibilitychange', refresh);
    return () => {
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