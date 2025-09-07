// src/app/page.tsx
import React from "react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">
        Tailwind + Next.js Test Page 🎉
      </h1>
      <p className="text-lg text-gray-700 mb-6">
        If you can see this styled with Tailwind, your setup works!
      </p>
      <button className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
        Click Me
      </button>
    </main>
  );
}
