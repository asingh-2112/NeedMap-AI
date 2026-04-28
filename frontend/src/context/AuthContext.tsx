import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { authApi } from "../services/api";
import type { AuthUser } from "../types/api";

type AuthContextShape = {
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  user: AuthUser | null;
  token: string;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  registerOrganization: (payload: {
    organizationName: string;
    address?: string;
    phone?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginBypass: (email?: string, password?: string) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const getDefaultUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return envUrl;

  if (Platform.OS === "web") {
    return "http://localhost:8000";
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) {
      return `http://${host}:8000`;
    }
  }

  return "http://127.0.0.1:8000";
};

const DEFAULT_URL = getDefaultUrl();

const AuthContext = createContext<AuthContextShape | undefined>(undefined);
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const auth = await authApi.login(baseUrl, email.trim(), password);
      const me = await authApi.me(baseUrl, auth.access_token);
      setToken(auth.access_token);
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const loginBypass = (email = "murli12@gmail.com", _password = "murli123") => {
    const safeName = email.split("@")[0] || "murli12";
    const localUser: AuthUser = {
      id: 9999,
      user_name: safeName,
      email,
      role: "volunteer",
      phone: null,
      organization_id: null,
    };
    setToken("dev-bypass-token");
    setUser(localUser);
  };

  const signup = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      await authApi.signup(baseUrl, {
        user_name: name.trim(),
        email: email.trim(),
        password,
        role: "volunteer",
      });
      const auth = await authApi.login(baseUrl, email.trim(), password);
      const me = await authApi.me(baseUrl, auth.access_token);
      setToken(auth.access_token);
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const registerOrganization = async (payload: {
    organizationName: string;
    address?: string;
    phone?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }) => {
    setLoading(true);
    try {
      const result = await authApi.registerOrganization(baseUrl, {
        organization_name: payload.organizationName.trim(),
        address: payload.address?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
        owner_name: payload.ownerName.trim(),
        owner_email: payload.ownerEmail.trim(),
        owner_password: payload.ownerPassword,
      });
      const me = await authApi.me(baseUrl, result.access_token);
      setToken(result.access_token);
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  const refreshMe = async () => {
    if (!token) return;
    const me = await authApi.me(baseUrl, token);
    setUser(me);
  };

  const logout = () => {
    setToken("");
    setUser(null);
  };

  const value = useMemo(
    () => ({ baseUrl, setBaseUrl, user, token, loading, signup, registerOrganization, login, loginBypass, refreshMe, logout }),
    [baseUrl, user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};
