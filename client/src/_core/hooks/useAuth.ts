import { useState } from "react";

export interface User {
  id: string;
  name?: string;
  email?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>({ id: "ncpor-ops", name: "NCPOR Operator", email: "ops@ncpor.res.in" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logout = async () => {
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    logout,
  };
}
