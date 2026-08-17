"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, currentIdentity } from "../lib/auth-api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const value = await currentIdentity();
    setIdentity(value);
    setLoading(false);
    return value;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    identity,
    loading,
    refresh,
    async login({ contact, password }) {
      const result = await authApi.login({ contact, password });
      if (result?.data?.status === "mfa_required") {
        const challenge = result.data.challenge;
        return {
          mfaRequired: true,
          verify: async (credential) => {
            await authApi.verifyMfa({ challengeId: challenge.id, credential });
            await refresh();
          }
        };
      }
      await refresh();
      return { mfaRequired: false };
    },
    async register({ email, phone, password }) {
      await authApi.register({ email, phone, password });
      return { ok: true };
    },
    async logout() {
      try { await authApi.logout(); } catch { /* best-effort; clear local state regardless */ }
      setIdentity(null);
      router.replace("/login");
    }
  }), [identity, loading, refresh, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
