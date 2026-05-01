"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";

export type UserRole = "PATIENT" | "DOCTOR" | "ADMIN";

export type User = {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  age?: number;
  gender?: string;
} | null;

type RegisterData = {
  name: string;
  email: string;
  password: string;
  role?: "PATIENT" | "DOCTOR";
  age?: number;
  gender?: string;
  medicalBackground?: string;
  specialty?: string;
  licenseNo?: string;
};

type AuthContextValue = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isDoctor: boolean;
  isPatient: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    const token = data.access_token || data.accessToken || null;
    const u = data.user || null;

    if (token && typeof window !== "undefined") localStorage.setItem("accessToken", token);
    if (u && typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const register = async (regData: RegisterData) => {
    const { data } = await apiClient.post("/auth/register", regData);
    const token = data.access_token || data.accessToken || null;
    const u = data.user || null;

    if (token && typeof window !== "undefined") localStorage.setItem("accessToken", token);
    if (u && typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
    }
    setUser(null);
    router.push("/login");
  };

  const isDoctor = user?.role === "DOCTOR" || user?.role === "ADMIN";
  const isPatient = user?.role === "PATIENT";

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isDoctor, isPatient }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
