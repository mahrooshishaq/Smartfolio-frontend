# SmartFolio - AI Frontend

**SmartFolio Frontend** is a modern, responsive web application built with **Next.js 15.5.2**, **TypeScript**, and **Tailwind CSS**. This repository contains the frontend for the SmartFolio project, including reusable components and page layouts.  

---

## Table of Contents

- [Features](#features)  
- [Folder Structure](#folder-structure)  
- [Getting Started](#getting-started)  
- [Available Scripts](#available-scripts)  
- [Tech Stack](#tech-stack)  
- [Contributing](#contributing)  

---

## Features

- **Next.js 15.5.2 App Router** for modern routing  
- **TypeScript** for type safety  
- **Tailwind CSS** for utility-first styling  
- Reusable components (Button, Background, etc.)  
- Persistent layout with **Header** and **Footer**  
- Ready-to-use pages: Home, Login, Signup  

---

## Folder Structure

src/
├─ app/
│ ├─ layout.tsx <-- Root layout wrapping all pages
│ ├─ pages.tsx <-- All other pages 
├─ components/ <-- Reusable UI components
├─ styles/
│ └─ globals.css <-- Tailwind and global CSS


Other files:  
- `package.json` → Project dependencies and scripts  
- `tsconfig.json` → TypeScript configuration  
- `.gitignore` → Ignored files (`node_modules/`, `.next/`)  

---

## Getting Started

1. **Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/frontend-repo.git
cd frontend-repo

npm install

npm run dev



