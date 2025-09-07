// src/app/layout.tsx
import '../styles/globals.css'; // Tailwind imported once here
import React from 'react';

export const metadata = {
  title: 'SmartFolio',
  description: 'Next.js + Tailwind + TypeScript Starter',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-800">
        {children}
      </body>
    </html>
  );
}
