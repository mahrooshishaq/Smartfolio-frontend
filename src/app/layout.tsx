// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Raleway, Baloo_Chettan_2, Didact_Gothic } from "next/font/google";
import '../styles/globals.css';
import React from 'react';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import InstallPrompt from '@/components/InstallPrompt';
import Script from 'next/script';

// Chrome fires beforeinstallprompt before React hydrates, so catch it here or the
// event is lost and no install banner can ever be shown.
const CAPTURE_INSTALL_PROMPT = `
window.__pwaPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  window.__pwaPrompt=e;
  window.dispatchEvent(new Event('pwa-installable'));
});`;

// Fonts
const raleway = Raleway({ 
  subsets: ["latin"], 
  variable: "--font-raleway" 
});

const baloo = Baloo_Chettan_2({ 
  subsets: ["latin"], 
  variable: "--font-baloo" 
});

// Using Didact Gothic as a free alternative to Century Gothic
const century = Didact_Gothic({ 
  weight: "400", 
  subsets: ["latin"], 
  variable: "--font-century" 
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "SmartFolio - AI",
  description: "Job Hunting Made Simple",
  applicationName: "SmartFolio",
  // iOS ignores the web app manifest; standalone launch is driven by these instead.
  appleWebApp: {
    capable: true,
    title: "SmartFolio",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${raleway.variable} ${baloo.variable} ${century.variable} font-sans`}>
        <Script
          id="pwa-install-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALL_PROMPT }}
        />
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          {children}
        </React.Suspense>
        <ServiceWorkerRegistrar />
        <InstallPrompt />
      </body>
    </html>
  );
}