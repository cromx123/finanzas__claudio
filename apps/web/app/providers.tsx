"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { PortfolioPreferencesProvider } from "../context/PortfolioPreferences";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PortfolioPreferencesProvider>{children}</PortfolioPreferencesProvider>
    </QueryClientProvider>
  );
}
