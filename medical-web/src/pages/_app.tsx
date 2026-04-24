import type { AppProps } from "next/app";

import { AIAnalysisProvider } from "@/hooks/useAIAnalysis";
import "@/app/globals.css";

export default function MedAINexusPagesApp({ Component, pageProps }: AppProps) {
  return (
    <AIAnalysisProvider>
      <Component {...pageProps} />
    </AIAnalysisProvider>
  );
}
