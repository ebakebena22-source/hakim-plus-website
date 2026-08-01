import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authClient, authConfiguration } from "./authClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(authConfiguration.configured ? "loading" : "unconfigured");

  useEffect(() => {
    if (!authConfiguration.configured) return;

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

  const value = useMemo(
    () => ({
      user,
      status,
      configured: authConfiguration.configured,
      mode: authConfiguration.mode,
      async signIn(credentials) {
        const result = await authClient.signIn(credentials);
        setUser(result.user);
        setStatus("authenticated");
        return result;
      },
      async signUp(details) {
        const result = await authClient.signUp(details);
        if (result.user && result.requiresVerification === false) {
          setUser(result.user);
          setStatus("authenticated");
        }
        return result;
      },
      async signOut() {
        await authClient.signOut();
        setUser(null);
        setStatus("anonymous");
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
