// =============================================
// NextUI + SWR Provider 包装
// =============================================

"use client";

import { NextUIProvider } from "@nextui-org/react";
import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 5000,
      }}
    >
      <NextUIProvider>
        {children}
      </NextUIProvider>
    </SWRConfig>
  );
}
