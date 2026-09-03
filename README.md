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

## Environment

`.env.example` is gitignored, so the one variable production genuinely cannot
run without is documented here instead.

### `NEXT_PUBLIC_API_URL` — required in production

Set it in the Vercel project settings to the backend's own origin:

```
NEXT_PUBLIC_API_URL=https://mahrooshishaq-smartfoliobackend.hf.space
```

`NEXT_PUBLIC_*` values are inlined at build time, so changing it needs a
redeploy to take effect. Leave it **unset** locally.

**Why it matters.** Most of the app reaches the backend through the rewrites in
`next.config.ts`, and for ordinary requests nobody cares which machine made the
outbound call. The verification check is the exception. That check judges the
*candidate's* IP address — it is how a VPN is told apart from a home connection.
A rewrite is a server-side proxy, so without this variable the backend sees the
address of the Vercel server that forwarded the request, which lives in a
datacenter, which is exactly what the hosting-provider rule blocks.

Unset in production, therefore: **every candidate is judged to be on a hosting
IP and comes back `blocked`.** Nothing errors — the verdicts are well-formed and
the admin dashboard fills with findings, all of them measuring our own
deployment rather than any applicant. The collector logs a console error if it
ever finds itself proxying from a non-localhost host, because that failure
produces no error of its own.

Locally the frontend and backend share `localhost`, so the proxied address is
`127.0.0.1` either way and the distinction does not exist.

### `NEXT_PUBLIC_LIVE_CAPTIONS`

Optional. On-device MoonshineJS streaming captions are on by default in the mock
interview, with the browser recognizer as the automatic fallback. Set to
`browser` to use only the latter.
