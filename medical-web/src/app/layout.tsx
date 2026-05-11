import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { SocketProvider } from "@/context/SocketContext";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "MedAI Nexus — AI-Powered Medical Intelligence",
  description:
    "Transform medical analysis with AI agents. Upload reports, predict disease risk, and generate clinical insights with cutting-edge AI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
