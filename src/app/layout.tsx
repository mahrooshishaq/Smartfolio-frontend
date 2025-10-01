// src/app/layout.tsx
import '../styles/globals.css';
import React from 'react';

export const metadata = {
  title: 'SmartFolio AI',
  description: 'AI-powered portfolio management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}