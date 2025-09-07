# SmartFolio - AI Frontend

An AI-powered career counselling platform frontend built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Tech Stack

- **Framework**: Next.js 15.5.2 TypeScript
- **Styling**: Tailwind CSS 4.1.13
- **UI Components**: shadcn/ui

## 📁 Project Structure

```
/src
├── /app              # Page components
│   └── /layout.tsx   # Root layout wrapping all pages 
│   └── /pages.tsx    # Other pages
├── /components       # Reusable components
├── /styles           
│   └── /global.css   # Tailwind and global CSS
├── /package.json     # Project dependencies and scripts  
├── /tsconfig.json    # TypeScript configuration  
└── /.gitignore       # Ignored files 
```
## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm (comes with Node.js) or Yarn
- Git (for cloning the repository)
- Code editor (VS Code recommended) with ESLint, Prettier, and Tailwind CSS IntelliSense extensions

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/hajrahrehan/smartfolio-frontent.git
   cd smartfolio-frontend
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start development server**:
   ```bash
   npm run dev
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```
5. **Preview production build**:
   ```bash
   npm run preview
   ```
## 🎯 Code Standards

This project follows strict coding standards for maintainability and scalability:

- **TypeScript**: Strict typing, avoid `any` types  
- **Component Structure**: One component per file, maximum ~150 lines per file  
- **Naming Conventions**:  
  - PascalCase for React components  
  - camelCase for functions and variables  
  - kebab-case for folders  
- **API Calls**: Abstracted in `/apis` folder, using Axios with interceptors for error handling and authentication  
- **State Management**: Custom hooks for data fetching and state handling  
- **UI Components**: Reusable components using [shadcn/ui](https://shadcn.dev/) or your own library  
- **Styling**: Tailwind CSS utility classes, minimal custom CSS  
- **Formatting**: Prettier and ESLint enforced to maintain a consistent code style

## 🔧 Configuration

### Tailwind CSS

- Configured with shadcn/ui design system variables and custom theme extensions.  
- Global styles are imported in `src/styles/globals.css`.

### TypeScript

- Strict TypeScript configuration (`strict: true` in `tsconfig.json`)  
- Path mapping for clean imports using `@/` alias (e.g., `@/components/Button`)  

### ESLint

- Comprehensive linting rules for React, TypeScript, and code quality  

---

## 📦 Key Dependencies

- **react** - UI library  
- **react-dom** - DOM renderer for React  
- **next** - Framework for server-side rendering and routing  
- **typescript** - Type safety  
- **tailwindcss** - Utility-first CSS  
- **@radix-ui** - Headless UI components  
- **axios** - HTTP client for API calls  
- **lucide-react** - Icons  
- **shadcn/ui** - Reusable UI components  

> Note: No Vite or `react-router-dom` is used because Next.js handles routing and builds.  

---

## 🚀 Deployment

The application can be deployed to any static hosting service or Next.js-friendly platform like **Vercel** or **Netlify**.

### Production Build

```bash
npm run build
npm run start





   




