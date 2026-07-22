// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Raleway, Baloo_Chettan_2, Didact_Gothic } from "next/font/google";
import '../styles/globals.css';
import React from 'react';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import InstallPrompt from '@/components/InstallPrompt';
import SplashScreen from '@/components/SplashScreen';
import AppleSplashLinks from '@/components/AppleSplashLinks';
import FoliLoader from '@/components/foli/FoliLoader';
import FoliBoot from '@/components/foli/FoliBoot';
import Script from 'next/script';


// Chrome fires beforeinstallprompt before React hydrates, so catch it here or the
// event is lost and no install banner can ever be shown.
const CAPTURE_INSTALL_PROMPT = `
window.__pwaPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  window.__pwaPrompt=e;
  window.dispatchEvent(new Event('pwa-installable'));
});`;

// Web "boot" loader for slow opens. Styles are inline (not from the CSS bundle,
// which may still be downloading) and visibility is toggled via element.style so
// React's hydration — which resets className/props — never wipes it.
const BOOT_CSS = `
#foli-boot{position:fixed;inset:0;z-index:9998;display:none;place-items:center;
  background:linear-gradient(160deg,#eef1ff,#f6f0ff 45%,#ffe6f0);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#foli-boot .fb-in{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}
#foli-boot svg{width:118px;height:118px;overflow:visible;animation:fb-bob 2.1s ease-in-out infinite}
@keyframes fb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-11px)}}
#foli-boot .fb-t{font-weight:800;color:#2b2440;font-size:20px;margin-top:10px}
#foli-boot .fb-s{font-size:13px;color:#6b6580;margin-top:2px}
#foli-boot .fb-bar{width:120px;height:4px;border-radius:99px;background:rgba(168,85,247,.18);overflow:hidden;margin-top:13px}
#foli-boot .fb-bar>span{display:block;height:100%;width:40%;border-radius:99px;
  background:linear-gradient(90deg,#818cf8,#c084fc,#ec4899);animation:fb-sl 1.1s ease-in-out infinite}
@keyframes fb-sl{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
@media(prefers-reduced-motion:reduce){#foli-boot svg{animation:none}}`;

const BOOT_HTML = `
<div class="fb-in">
<svg viewBox="0 0 200 200" role="img" aria-label="Loading SmartFolio">
<defs>
<linearGradient id="fbBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdfbff"/><stop offset="1" stop-color="#f2ecff"/></linearGradient>
<linearGradient id="fbLine" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#818cf8"/><stop offset=".5" stop-color="#c084fc"/><stop offset="1" stop-color="#ec4899"/></linearGradient>
</defs>
<ellipse cx="100" cy="178" rx="46" ry="8" fill="#7c5cc0" opacity="0.16"/>
<path d="M36 44 Q36 26 54 26 L128 26 L164 62 L164 150 Q164 168 146 168 L54 168 Q36 168 36 150 Z" fill="url(#fbBody)" stroke="#e4d8fb" stroke-width="2"/>
<path d="M128 26 L164 62 L128 62 Z" fill="#ffd7c2"/>
<path d="M150 40 L154 52 L166 56 L154 60 L150 72 L146 60 L134 56 L146 52 Z" fill="#a855f7"/>
<rect x="66" y="72" width="20" height="5" rx="2.5" fill="#b8a6e0"/><rect x="114" y="72" width="20" height="5" rx="2.5" fill="#b8a6e0"/>
<circle cx="78" cy="92" r="13" fill="#fff" stroke="#e4d8fb" stroke-width="1.5"/><circle cx="122" cy="92" r="13" fill="#fff" stroke="#e4d8fb" stroke-width="1.5"/>
<circle cx="78" cy="92" r="6" fill="#3a2e5c"/><circle cx="122" cy="92" r="6" fill="#3a2e5c"/>
<circle cx="81" cy="89" r="2" fill="#fff"/><circle cx="125" cy="89" r="2" fill="#fff"/>
<path d="M88 118 Q100 126 112 118" fill="none" stroke="url(#fbLine)" stroke-width="5" stroke-linecap="round"/>
<circle cx="52" cy="150" r="15" fill="#efe6ff" stroke="#e0d3f8" stroke-width="2"/><circle cx="148" cy="150" r="15" fill="#efe6ff" stroke="#e0d3f8" stroke-width="2"/>
</svg>
<div class="fb-t">SmartFolio</div>
<div class="fb-s">Getting things ready…</div>
<div class="fb-bar"><span></span></div>
</div>`;

// Reveal only if the app hasn't become interactive within 700ms — so a fast open
// never flashes the overlay, while a slow one gets Foli instead of a blank screen.
const BOOT_REVEAL = `
window.__appReady=false;
window.__foliBootTimer=setTimeout(function(){
  if(!window.__appReady){var b=document.getElementById('foli-boot');if(b)b.style.display='grid';}
},700);`;

// Fonts
const raleway = Raleway({ 
  subsets: ["latin"], 
  variable: "--font-raleway" 
});

const baloo = Baloo_Chettan_2({ 
  subsets: ["latin"], 
  variable: "--font-baloo" 
});

// Using Didact Gothic as a free alternative to Century Gothic
const century = Didact_Gothic({ 
  weight: "400", 
  subsets: ["latin"], 
  variable: "--font-century" 
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef1ff",
};

export const metadata: Metadata = {
  title: "SmartFolio - AI",
  description: "Job Hunting Made Simple",
  applicationName: "SmartFolio",
  // iOS ignores the web app manifest; standalone launch is driven by these instead.
  appleWebApp: {
    capable: true,
    title: "SmartFolio",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <AppleSplashLinks />
        <style dangerouslySetInnerHTML={{ __html: BOOT_CSS }} />
      </head>
      <body className={`${raleway.variable} ${baloo.variable} ${century.variable} font-sans`}>
        {/* Pre-hydration boot overlay for slow opens. Visibility is driven by
            BOOT_REVEAL + FoliBoot via element.style, never React props. The reveal
            is a RAW inline <script> so it runs during HTML parse — a next/script
            beforeInteractive tag loads through Next's own JS, which is exactly what
            is slow on a bad connection, so the timer would never start in time. */}
        <div id="foli-boot" dangerouslySetInnerHTML={{ __html: BOOT_HTML }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_REVEAL }} />
        <Script
          id="pwa-install-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALL_PROMPT }}
        />
        <FoliBoot />
        <SplashScreen />
        <React.Suspense fallback={<FoliLoader />}>
          {children}
        </React.Suspense>
        <ServiceWorkerRegistrar />
        <InstallPrompt />
      </body>
    </html>
  );
}