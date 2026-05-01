import type { AppProps } from "next/app";

import { AIAnalysisProvider } from "@/hooks/useAIAnalysis";
import { AuthProvider } from "@/hooks/useAuth";
import "@/app/globals.css";

export default function MedAINexusPagesApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AIAnalysisProvider>
        <Component {...pageProps} />
      </AIAnalysisProvider>
    </AuthProvider>
  );
}
