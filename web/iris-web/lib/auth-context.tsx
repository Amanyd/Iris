"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "./api";

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("iris_token");
    const userStr = localStorage.getItem("iris_user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setState({ token, user, isLoading: false });
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem("iris_token");
        localStorage.removeItem("iris_user");
        setState({ token: null, user: null, isLoading: false });
      }
    } else {
      setState({ token: null, user: null, isLoading: false });
    }
  }, []);

  // Redirect to login if not authenticated (once loading is done)
  useEffect(() => {
    if (!state.isLoading && !state.token && pathname?.startsWith("/dashboard")) {
      router.replace("/login");
    }
  }, [state.isLoading, state.token, pathname, router]);

  const setAuth = useCallback((token: string, user: User) => {
    localStorage.setItem("iris_token", token);
    localStorage.setItem("iris_user", JSON.stringify(user));
    setState({ token, user, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("iris_token");
    localStorage.removeItem("iris_user");
    setState({ token: null, user: null, isLoading: false });
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
