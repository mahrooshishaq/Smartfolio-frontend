# Smartfolio Web Application

Smartfolio is an AI-powered career companion that helps users discover jobs, upskill with relevant courses, refine their resumes, practice mock interviews, and generate tailored professional documents. The frontend is built using **Next.js**, **React**, and **Tailwind CSS**.

## 🚀 Live Deployment
- **Web App**: [https://smartfolio-frontend-five.vercel.app](https://smartfolio-frontend-five.vercel.app)

## 🏗 Architecture & Stack
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **State Management & API**: React Hooks, Axios
- **Authentication**: JWT-based auth via backend API (with Google OAuth integration)
- **Routing/Proxy**: Next.js API Rewrites to securely forward requests to the cloud backend

---

## 🛠 Features & Screenshots

### Dashboard
The central command center. Provides an overview of job applications, recommended courses, recent mock interview scores, and document generation history.
![Dashboard](screenshots%20for%20readme/Dashboard.png)

### Jobs & Courses Discovery
Real-time web scraping provides users with tailored jobs and courses based on their onboarding profile goals.
![Jobs](screenshots%20for%20readme/Jobs.png)
![Courses](screenshots%20for%20readme/Courses.png)

### Resume Analysis
Upload your resume (PDF) to get actionable AI feedback on structure, impact, and missing skills.
![Resume Analysis](screenshots%20for%20readme/ResumeAnalysis.png)
![Resume Analyzed](screenshots%20for%20readme/ResumeAnalysed.png)

### Mock Interviews
Interactive technical and behavioral interview practice sessions with the AI. Get instant grading and feedback.
![Mock Interviews](screenshots%20for%20readme/Mock%20Interviews.png)
![Mock Interview Session](screenshots%20for%20readme/MockInterview3.png)

### Document Generation
Generate cover letters and cold emails dynamically tailored to specific job postings using the Groq API.
![Document Generation](screenshots%20for%20readme/Document%20Generation.png)
![AI Document Generated](screenshots%20for%20readme/AI%20Document%20Generated.png)

---

## ⚙️ Environment Configuration

To run the frontend locally, you need a `.env` file at the root of the project:

```env
# Optional: Set this to force the API proxy base URL in production
NEXT_PUBLIC_API_URL=https://smartfolio-frontend-five.vercel.app
```

*Note: In `next.config.ts`, the application uses Next.js rewrites to proxy all API requests to the `BACKEND_URL` environment variable. This avoids cross-origin (CORS) issues.*

---

## 📦 Deployment (Vercel)

This application is optimized for deployment on **Vercel**.

1. Import your GitHub repository into Vercel.
2. In the Project Settings -> Environment Variables, add the following:
   - **`BACKEND_URL`**: The public URL of your Hugging Face backend (e.g., `https://mahrooshishaq-smartfolio-backend.hf.space`) *Make sure there is no trailing slash!*
   - **`NEXT_PUBLIC_API_URL`**: Your Vercel production domain.
3. Click Deploy. Vercel will automatically build the Next.js application and configure the serverless proxy routes.

### Running Locally
```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
npm start
```
