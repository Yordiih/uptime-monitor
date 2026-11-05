import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "./api";

interface AuthState {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => api.tokenStore.get());

  const logout = useCallback(() => {
    api.tokenStore.clear();
    setToken(null);
  }, []);

  useEffect(() => {
    api.setUnauthorizedHandler(logout);
  }, [logout]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      async login(email, password) {
        const result = await api.login(email, password);
        api.tokenStore.set(result.token);
        setToken(result.token);
      },
      async register(email, password) {
        const result = await api.register(email, password);
        api.tokenStore.set(result.token);
        setToken(result.token);
      },
      logout,
    }),
    [token, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
