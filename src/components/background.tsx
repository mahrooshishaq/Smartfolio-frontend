// src/components/Background.tsx
import React from 'react';

interface BackgroundProps {
  children: React.ReactNode;
}

export default function Background({ children }: BackgroundProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      {children}
    </div>
  );
}

