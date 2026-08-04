import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authClient, authConfiguration } from "./authClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(authConfiguration.configured ? "loading" : "unconfigured");

  useEffect(() => {
    if (!authConfiguration.configured) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("neon_auth_session_verifier")) return;

    let active = true;
    authClient
      .getSession()
      .then((result) => {
        if (active) {
          setUser(result.user || null);
          setStatus(result.user ? "authenticated" : "anonymous");
        }
      })
      .catch(() => {
        if (active) setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const result = await authClient.signIn(credentials);
    setUser(result.user);
    setStatus("authenticated");
    return result;
  }, []);

  const signUp = useCallback(async (details) => {
    const result = await authClient.signUp(details);
    if (result.user && result.requiresVerification === false) {
      setUser(result.user);
      setStatus("authenticated");
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await authClient.getSession();
    setUser(result.user || null);
    setStatus(result.user ? "authenticated" : "anonymous");
    return result.user || null;
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus(nextUser ? "authenticated" : "anonymous");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      configured: authConfiguration.configured,
      mode: authConfiguration.mode,
      signIn,
      signUp,
      signOut,
      refreshSession,
      updateUser,
    }),
    [refreshSession, signIn, signOut, signUp, status, updateUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
