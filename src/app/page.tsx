"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import AnimatedBackground from "@/components/AnimatedBackground";
import { ChevronDown } from "lucide-react";

// --- Components ---

// Typewriter Component
const Typewriter = () => {
  const phrases = ["optimize your resume", "land your dream job", "automate cover letters"];
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  useEffect(() => {
    const handleTyping = () => {
      const i = loopNum % phrases.length;
      const fullText = phrases[i];

      setText(isDeleting 
        ? fullText.substring(0, text.length - 1) 
        : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 30 : 150);

      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 1500); // Pause at end
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, phrases, typingSpeed]);

  return (
    <span className="border-r-2 border-gray-800 pr-1 animate-pulse">
      {text}
    </span>
  );
};

export default function Home() {
  return (
    <main className="relative font-sans">
      
      {/* --- SECTION 1: HERO with Moving Gradient Background --- */}
      <section className="relative min-h-screen flex flex-col text-center overflow-hidden">
        <AnimatedBackground />
        
        <Navbar />
        
        <div className="flex-1 flex flex-col justify-center items-center px-4">
          <h1 className="font-century font-bold text-5xl md:text-7xl text-gray-800 drop-shadow-lg tracking-widest mb-6">
            smartfolio - ai
          </h1>
          
          <div className="h-8 font-raleway text-xl text-gray-800 tracking-widest uppercase">
            <Typewriter />
          </div>

          {/* Bobbing Arrow */}
          <div className="absolute bottom-10 animate-bounce">
            <ChevronDown className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </section>

      {/* --- SECTION 2: Resume Optimization --- */}
      <section id="features" className="relative min-h-screen bg-white flex flex-col justify-center px-6 md:px-20 py-20">
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-12 uppercase tracking-widest text-gray-600 font-raleway text-sm">
            Optimize your resume
          </div>

          <div className="bg-white/40 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-lg flex flex-col md:flex-row items-center gap-12 border border-gray-100">
            <div className="md:w-1/3">
              <h2 className="text-3xl font-bold font-century mb-4">Smart & Effortless</h2>
              <p className="text-gray-600 mb-6 leading-relaxed text-sm">
                SmartFolio transforms the way you prepare for applications. It removes 
                the need for endless manual edits. Instead, it uses AI to analyze your 
                resume, highlight skill gaps, and generate tailored outreach.
              </p>
              <ul className="space-y-3 text-sm font-medium text-gray-700">
                <li className="flex items-center gap-2">📄 Resume Analysis</li>
                <li className="flex items-center gap-2">⚡ Seamless Live Preview</li>
                <li className="flex items-center gap-2">👁️ Personalized Cover Letters</li>
              </ul>
              <button className="mt-8 px-8 py-2 bg-blue-200/50 hover:bg-blue-300/50 rounded-full text-blue-900 text-sm font-semibold tracking-wide transition-colors uppercase">
                Try Now
              </button>
            </div>
            <div className="md:w-2/3 w-full bg-gray-50 rounded-lg shadow-sm border p-2 h-64 md:h-96 flex items-center justify-center text-gray-400">
               {/* Placeholder for Image 393c71.png (Resume Editor) */}
               <span className="text-sm">[Insert Resume Editor Image Here]</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 3: Documents & Job Hunting --- */}
      <section className="relative min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col justify-center px-6 md:px-20 py-20">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center gap-12">
          
          {/* Left: Personalized Documents */}
          <div className="md:w-1/2 relative">
             <div className="absolute -top-10 -left-10 w-full h-full bg-orange-100 rounded-full blur-3xl -z-10 opacity-50"></div>
             <h3 className="mb-8 uppercase tracking-widest text-gray-600 font-raleway text-sm">Personalized Documents</h3>
             <div className="bg-white p-4 shadow-xl -rotate-2 w-3/4 mx-auto md:mx-0">
               {/* Placeholder for Letter Image */}
               <div className="h-64 bg-gray-50 border border-gray-100 p-4 text-[6px] text-gray-300 overflow-hidden">
                 [Document Preview Image]
               </div>
             </div>
          </div>
          
          {/* Right: Job Hunting */}
          <div className="md:w-1/2 bg-blue-100/50 rounded-3xl p-8 md:p-12 relative overflow-hidden">
             <h3 className="mb-6 uppercase tracking-widest text-gray-600 font-raleway text-sm text-right">Job Hunting Made Simple</h3>
             <h2 className="text-3xl font-bold font-century mb-4">Tailored Opportunities</h2>
             <ul className="space-y-2 mb-8 text-sm text-gray-600">
                <li>📊 Skill-based recommendations</li>
                <li>👤 Personalized job matches</li>
             </ul>
             
             {/* Abstract Cards UI */}
             <div className="flex flex-col gap-3">
                <div className="bg-white p-4 rounded-xl shadow-sm w-full ml-8">
                    <div className="h-2 w-1/3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-2 w-1/4 bg-gray-100 rounded"></div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm w-full ml-4">
                    <div className="h-2 w-1/3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-2 w-1/4 bg-gray-100 rounded"></div>
                </div>
             </div>
          </div>
        </div>
      </section>

       {/* --- SECTION 4: Courses Grid --- */}
       <section className="relative min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex flex-col justify-center px-6 md:px-20 py-20">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row gap-12 items-center">
          <div className="md:w-1/3">
             <h2 className="text-2xl font-bold font-century mb-4 uppercase">Find Hundreds of Updated Courses</h2>
             <p className="text-gray-600 mb-6 text-sm">
               Get recommendations and alerts for courses of your preference.
             </p>
             <button className="px-8 py-2 bg-blue-200/50 hover:bg-blue-300/50 rounded-full text-blue-900 text-sm font-semibold tracking-wide transition-colors uppercase">
                Try Now
              </button>
          </div>

          <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Course Cards */}
              {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-lg"></div> {/* Logo Placeholder */}
                          <div>
                              <div className="font-bold text-sm">UI/UX Design</div>
                              <div className="text-xs text-gray-400">Coursera</div>
                          </div>
                      </div>
                      <div className="text-xs text-gray-500">4 Months • $49/month</div>
                  </div>
              ))}
          </div>
        </div>
       </section>

    </main>
  );
}
