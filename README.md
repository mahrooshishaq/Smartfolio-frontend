# SmartFolio - AI Frontend

An AI-powered career counselling platform frontend built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Tech Stack

- **Framework**: Next.js 15.5.2 TypeScript
- **Styling**: Tailwind CSS 4.1.13
- **UI Components**: shadcn/ui

## 📁 Project Structure

```
smartfolio-frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx               # Root layout with font setup
│   │   ├── page.tsx                 # Home/landing page
│   │   ├── not-found.tsx            # 404 page
│   │   ├── login/
│   │   │   └── page.tsx             # Login page
│   │   ├── signup/
│   │   │   └── page.tsx             # Sign up page
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Main dashboard
│   │   ├── upload-resume/
│   │   │   └── page.tsx             # Resume upload page
│   │   ├── analysis-results/
│   │   │   └── page.tsx             # Analysis results page
│   │   ├── forgot-password/
│   │   │   └── page.tsx             # Password recovery
│   │   ├── reset-password/
│   │   │   └── page.tsx             # Password reset
│   │   └── verify-otp/
│   │       └── page.tsx             # OTP verification
│   ├── components/                  # Reusable React components
│   │   ├── AnimatedBackground.tsx   # Animated background component
│   │   └── Navbar.tsx               # Navigation bar
│   └── styles/
│       └── globals.css              # Global Tailwind and custom CSS
├── public/                          # Static assets
├── eslint.config.mjs                # ESLint configuration
├── next.config.ts                   # Next.js configuration
├── tailwind.config.js               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
├── postcss.config.mjs               # PostCSS configuration
├── package.json                     # Dependencies and scripts
├── README.md                        # Project documentation
└── .gitignore                       # Git ignore rules
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

## 🎨 Typography & Font Standards

This project uses a consistent font system across all pages for a unified and professional appearance:

### Font Families

- **`font-raleway`**: Primary font for body text, labels, and secondary content  
- **`font-century`**: Used for section headings, major titles, and emphasis  
- **`font-baloo`**: Brand/logo text (e.g., "SmartFolio - AI")  

### Font Size & Weight Hierarchy

| Element | Class | Font Family | Weight | Purpose |
|---------|-------|-------------|--------|---------|
| Page Hero | `text-7xl` | `font-century` | **bold** | Main page titles |
| Section Title | `text-3xl` | `font-century` or `font-bold` | **bold**/**black** | Major headings |
| Card Title | `text-2xl` | `font-century` | **bold** | Prominent headings |
| Body Text | `text-base` | `font-raleway` | **medium** | Regular content |
| Secondary Text | `text-sm` | `font-raleway` | **medium** | Labels and descriptions |
| Small Text | `text-xs` | `font-raleway` | **medium** | Badges and micro text |
| Micro Labels | `text-[10px]`, `text-[11px]` | `font-raleway` | **bold** | UI labels and captions |

### Color Standards

- **Primary Text**: `text-slate-800` (main content)  
- **Secondary Text**: `text-slate-600` (emphasis)  
- **Tertiary Text**: `text-slate-400` (muted)  
- **Labels**: `text-gray-400` or `text-gray-300` (very muted)  

### Implementation Notes

- All pages maintain consistent font usage through `font-raleway`, `font-century`, and `font-baloo` classes  
- Section headings in cards and content areas use `font-century font-bold`  
- Descriptive labels and small UI elements use smaller sizes with `font-raleway` and appropriate weights  
- All fonts are imported in `src/app/layout.tsx` using Next.js Google Fonts integration  

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


   




