// src/app/layout.tsx
import type { Metadata } from "next";
import { Raleway, Baloo_Chettan_2, Didact_Gothic } from "next/font/google";
import '../styles/globals.css';
import React from 'react';

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

export const metadata: Metadata = {
  title: "SmartFolio - AI",
  description: "Job Hunting Made Simple",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${raleway.variable} ${baloo.variable} ${century.variable} font-sans`}>
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          {children}
        </React.Suspense>
      </body>
    </html>
  );
}