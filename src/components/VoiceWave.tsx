'use client';

import React from 'react';

interface VoiceWaveProps {
  isActive: boolean;
  color?: string;
  mode?: 'speaking' | 'listening';
}

export default function VoiceWave({ isActive, color = 'bg-indigo-500', mode = 'listening' }: VoiceWaveProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full ${color} transition-all duration-300 ease-in-out ${
            isActive 
              ? 'animate-bounce' 
              : 'h-2 opacity-30'
          }`}
          style={{
            height: isActive ? `${Math.random() * 40 + 20}px` : '8px',
            animationDelay: isActive ? `${i * 0.1}s` : '0s',
            animationDuration: mode === 'speaking' ? '0.8s' : '1.2s'
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
      `}</style>
    </div>
  );
}
