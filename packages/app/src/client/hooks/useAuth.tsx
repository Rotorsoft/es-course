import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { trpc } from "../trpc.js";

type AuthUser = {
  id: string;
  name: string;
  picture?: string;
  role: "admin" | "user";
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  providers: ("local" | "google")[];
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, name: string, password: string) => Promise<void>;
  signInWithGoogle: () => void;
  signOut: () => void;
  isAdmin: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "auth_token";

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== "undefined" && google.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-gis-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<("local" | "google")[]>(["local"]);
  const [googleReady, setGoogleReady] = useState(false);

  // Fetch auth config
  const configQuery = trpc.getAuthConfig.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Mutations
  const loginMutation = trpc.login.useMutation();
  const signupMutation = trpc.signup.useMutation();
  const googleLoginMutation = trpc.loginWithGoogle.useMutation();
  const meQuery = trpc.me.useQuery(undefined, {
    enabled: !!localStorage.getItem(TOKEN_KEY),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Set providers from config
  useEffect(() => {
    if (configQuery.data) {
      setProviders(configQuery.data.providers);
    }
  }, [configQuery.data]);

  // Initialize Google Identity Services when google provider available
  useEffect(() => {
    if (!providers.includes("google")) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    if (!clientId) return;

    loadGoogleScript().then(() => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            setError(null);
            const result = await googleLoginMutation.mutateAsync({ idToken: response.credential });
            localStorage.setItem(TOKEN_KEY, result.token);
            setUser(result.user);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Google sign-in failed");
          }
        },
      });
      setGoogleReady(true);
    });
  }, [providers]);

  // Restore session from stored token
  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data as AuthUser);
      setLoading(false);
    } else if (meQuery.isError || !localStorage.getItem(TOKEN_KEY)) {
      if (meQuery.isError) localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
    }
  }, [meQuery.data, meQuery.isError]);

  const signIn = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const result = await loginMutation.mutateAsync({ username, password });
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }, [loginMutation]);

  const signUp = useCallback(async (username: string, name: string, password: string) => {
    setError(null);
    try {
      const result = await signupMutation.mutateAsync({ username, name, password });
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed");
    }
  }, [signupMutation]);

  const signInWithGoogle = useCallback(() => {
    if (googleReady) {
      google.accounts.id.prompt();
    }
  }, [googleReady]);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setError(null);
    if (googleReady) {
      google.accounts.id.disableAutoSelect();
    }
  }, [googleReady]);

  const value: AuthContextValue = {
    user,
    loading,
    providers,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    isAdmin: user?.role === "admin",
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
