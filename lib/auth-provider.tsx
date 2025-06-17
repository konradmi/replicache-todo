"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
} 
