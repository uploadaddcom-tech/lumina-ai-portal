/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ArrowRight,
  ArrowLeft,
  Bell, 
  Camera, 
  Clapperboard,
  Cpu, 
  Library, 
  Music, 
  Play, 
  Star, 
  Maximize,
  Subtitles, 
  Type,
  Zap,
  CloudUpload,
  Sparkles,
  ListOrdered,
  Briefcase,
  Smile,
  Trophy,
  BookOpen,
  Lightbulb,
  Check,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  LogIn,
  Settings,
  Lock,
  User,
  Menu,
  Home,
  X,
  Trash2,
  History,
  FileVideo,
  FileText,
  Mic,
  Download,
  LayoutGrid,
  CreditCard
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { translations, Language } from "./translations";
import Markdown from "react-markdown";
import { useFirebase } from "./components/FirebaseProvider";
import { loginWithGoogle, logout } from "./lib/firebase";
import { DiamondIcon } from "./components/DiamondIcon";
import { AdminDashboard } from "./components/AdminDashboard";
import { HistoryCard } from "./components/HistoryCard";

// Internal API Helpers to replace GeminiService.ts
const api = {
  async recap(videoBase64: string, mimeType: string, style: string, lang: Language, duration?: number, apiKey?: string, freezeFrameZoomEnabled?: boolean, isNarrationRecap?: boolean) {
    const res = await fetch("/api/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64, mimeType, style, lang, duration, apiKey, freezeFrameZoomEnabled, isNarrationRecap }),
    });
    if (!res.ok) throw new Error("Recap request failed");
    return (await res.json()).jobId;
  },
  async transcribe(videoBase64: string, mimeType: string, lang: Language, apiKey?: string) {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64, mimeType, lang, apiKey }),
    });
    if (!res.ok) throw new Error("Transcription request failed");
    return (await res.json()).jobId;
  },
  async videotosrt(videoBase64: string, mimeType: string, apiKey?: string) {
    const res = await fetch("/api/videotosrt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64, mimeType, apiKey }),
    });
    if (!res.ok) throw new Error("Video to SRT translation request failed");
    return (await res.json()).jobId;
  },
  async voiceactor(videoBase64: string, mimeType: string, voiceName: string, apiKey?: string) {
    const res = await fetch("/api/voiceactor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64, mimeType, voiceName, apiKey }),
    });
    if (!res.ok) throw new Error("AI Video Voice Actor request failed");
    return (await res.json()).jobId;
  },
  async voiceover(text: string, voiceName: string, apiKey?: string) {
    const res = await fetch("/api/voiceover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName, apiKey }),
    });
    if (!res.ok) throw new Error("Voiceover request failed");
    return (await res.json()).jobId;
  },
  async merge(
    videoBase64: string, 
    audioBase64: string, 
    logoBase64?: string, 
    logoSize?: number, 
    logoPosition?: string, 
    videoRatio?: string, 
    videoScale?: number, 
    cropTop?: number,
    cropBottom?: number,
    cropLeft?: number,
    cropRight?: number,
    bgColor?: string,
    bgBlurEnabled?: boolean,
    blurEnabled?: boolean, 
    blurWidth?: number, 
    blurHeight?: number, 
    blurY?: number,
    blurIntensity?: number,
    subtitleEnabled?: boolean,
    subtitleText?: string,
    subtitleColor?: string,
    subtitleFontSize?: number,
    subtitleFont?: string,
    subtitleBoxColor?: string,
    subtitleY?: number,
    glowingSweepEnabled?: boolean,
    freezeFrameZoomEnabled?: boolean,
    apiKey?: string
  ) {
    const res = await fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        videoBase64, 
        audioBase64, 
        logoBase64, 
        logoSize, 
        logoPosition, 
        videoRatio, 
        videoScale,
        cropTop,
        cropBottom,
        cropLeft,
        cropRight,
        bgColor,
        bgBlurEnabled,
        blurEnabled,
        blurWidth,
        blurHeight,
        blurY,
        blurIntensity,
        subtitleEnabled,
        subtitleText,
        subtitleColor,
        subtitleFontSize,
        subtitleFont,
        subtitleBoxColor,
        subtitleY,
        glowingSweepEnabled,
        freezeFrameZoomEnabled,
        apiKey
      }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Merge failed");
    }
    return (await res.json()).jobId;
  },
  status: async (jobId: string) => {
    const res = await fetch(`/api/status/${jobId}`);
    if (!res.ok) throw new Error("Failed to check status");
    return res.json();
  }
};

const pollForCompletion = async (jobId: string, maxAttempts = 300): Promise<any> => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const job = await api.status(jobId);
    if (job.status === "completed") {
      return job;
    } else if (job.status === "error") {
      throw new Error(job.error || "Operation failed");
    }
    attempts++;
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
  }
  throw new Error("Operation timed out");
};

const getTools = (lang: Language) => [
  {
    id: "recapmaster",
    title: translations[lang].tools.recapMaster.title,
    description: translations[lang].tools.recapMaster.desc,
    icon: Zap,
    color: "bg-gradient-to-r from-purple-600 to-[#6D3DF3]",
    iconColor: "text-white",
    borderColor: "border-purple-500/20 hover:border-[#6D3DF3]/50",
    shadowColor: "shadow-purple-500/20",
  },
  {
    id: "subtitle-editor",
    title: translations[lang].tools.subtitleEditor.title,
    description: translations[lang].tools.subtitleEditor.desc,
    icon: Subtitles,
    color: "bg-indigo-600",
    iconColor: "text-white",
    borderColor: "border-indigo-500/20 hover:border-indigo-500/50",
    shadowColor: "shadow-indigo-500/20",
  },
  {
    id: "videotranscribe",
    title: translations[lang].tools.videoTranscribe.title,
    description: translations[lang].tools.videoTranscribe.desc,
    icon: Type,
    color: "bg-violet-600",
    iconColor: "text-white",
    borderColor: "border-violet-500/20 hover:border-violet-500/50",
    shadowColor: "shadow-violet-500/20",
    badge: "FREE"
  },
  {
    id: "aivoiceover",
    title: translations[lang].tools.aiVoiceover.title,
    description: translations[lang].tools.aiVoiceover.desc,
    icon: Music,
    color: "bg-fuchsia-600",
    iconColor: "text-white",
    borderColor: "border-fuchsia-500/20 hover:border-fuchsia-500/50",
    shadowColor: "shadow-fuchsia-500/20"
  },
  {
    id: "videotosrt",
    title: translations[lang].tools.videoToSrt.title,
    description: translations[lang].tools.videoToSrt.desc,
    icon: FileText,
    color: "bg-blue-600",
    iconColor: "text-white",
    borderColor: "border-blue-500/20 hover:border-blue-500/50",
    shadowColor: "shadow-blue-500/20",
    badge: "FREE"
  },
  {
    id: "aivideovoiceactor",
    title: translations[lang].tools.aiVideoVoiceActor.title,
    description: translations[lang].tools.aiVideoVoiceActor.desc,
    icon: Mic,
    color: "bg-sky-600",
    iconColor: "text-white",
    borderColor: "border-sky-500/20 hover:border-sky-500/50",
    shadowColor: "shadow-sky-500/20",
    badge: "AI EXCLUSIVE"
  }
];

const getRecapStyles = (lang: Language) => [
  {
    id: "step-by-step",
    title: translations[lang].styles.stepByStep.title,
    description: translations[lang].styles.stepByStep.desc,
    icon: ListOrdered,
    color: "bg-cyan-500/10",
    iconColor: "text-cyan-400"
  },
  {
    id: "material-list",
    title: translations[lang].styles.materialList.title,
    description: translations[lang].styles.materialList.desc,
    icon: Briefcase,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  },
  {
    id: "funny-commentary",
    title: translations[lang].styles.funnyCommentary.title,
    description: translations[lang].styles.funnyCommentary.desc,
    icon: Smile,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  },
  {
    id: "epic-exaggerated",
    title: translations[lang].styles.epicExaggerated.title,
    description: translations[lang].styles.epicExaggerated.desc,
    icon: Trophy,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  },
  {
    id: "project-story",
    title: translations[lang].styles.projectStory.title,
    description: translations[lang].styles.projectStory.desc,
    icon: BookOpen,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  },
  {
    id: "pro-tips",
    title: translations[lang].styles.proTips.title,
    description: translations[lang].styles.proTips.desc,
    icon: Lightbulb,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  },
  {
    id: "quick-summary",
    title: translations[lang].styles.quickSummary.title,
    description: translations[lang].styles.quickSummary.desc,
    icon: Zap,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  },
  {
    id: "real-time-narration",
    title: translations[lang].styles.realTimeNarration.title,
    description: translations[lang].styles.realTimeNarration.desc,
    icon: Play,
    color: "bg-blue-500/10",
    iconColor: "text-blue-400"
  },
  {
    id: "fairytale-humor",
    title: translations[lang].styles.fairytaleHumor.title,
    description: translations[lang].styles.fairytaleHumor.desc,
    icon: Sparkles,
    color: "bg-slate-100",
    iconColor: "text-slate-400"
  }
];

interface ViewProps {
  onBack: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  onAdminClick?: () => void;
}

interface ApiKeyConfig {
  source: "app" | "own";
  value: string;
}

function ApiKeySelector({ config, setConfig, lang }: { 
  config: ApiKeyConfig, 
  setConfig: (c: ApiKeyConfig) => void,
  lang: Language 
}) {
  const t = translations[lang].api;
  const [showInput, setShowInput] = useState(config.source === "own");

  useEffect(() => {
    setShowInput(config.source === "own");
  }, [config.source]);

  return (
    <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-text-primary dark:text-slate-500 uppercase tracking-[0.3em]">
          {t.title}
        </label>
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-border dark:border-white/5">
          <button
            onClick={() => setConfig({ ...config, source: "app" })}
            className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all uppercase tracking-widest ${
              config.source === "app" 
                ? "bg-white dark:bg-white/10 text-blue-500 shadow-sm" 
                : "text-slate-500 hover:text-slate-400"
            }`}
          >
            {t.optionApp}
          </button>
          <button
            onClick={() => setConfig({ ...config, source: "own" })}
            className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all uppercase tracking-widest ${
              config.source === "own" 
                ? "bg-white dark:bg-white/10 text-emerald-500 shadow-sm" 
                : "text-slate-500 hover:text-slate-400"
            }`}
          >
            {t.optionOwn}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              <input
                type="password"
                value={config.value}
                onChange={(e) => setConfig({ ...config, value: e.target.value })}
                placeholder={t.inputPlaceholder}
                className="w-full h-11 bg-white/5 border border-border dark:border-white/10 rounded-xl px-4 text-xs font-bold text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserHeader({ onAdminClick }: { onAdminClick?: () => void }) {
  const { user, logout, usageCount, role, diamonds } = useFirebase();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [localDark, setLocalDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    const handler = () => {
      setLocalDark(document.documentElement.classList.contains('dark'));
    };
    window.addEventListener('theme-changed', handler);
    return () => window.removeEventListener('theme-changed', handler);
  }, []);

  const toggleTheme = () => {
    const nextDark = !localDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setLocalDark(nextDark);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const navigate = useNavigate();

  const handleAdminAction = () => {
    setIsOpen(false);
    if (onAdminClick) onAdminClick();
  };

  const handleLogoutAction = () => {
    setIsOpen(false);
    logout();
  };

  return (
    <div className="relative">
      {/* 1. Desktop Layout */}
      <div className="hidden md:flex items-center gap-4">
        {/* Modern high-contrast Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 transition-all active:scale-95 shadow-sm hover:scale-105"
          title={localDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {localDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {!user ? (
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-purple-600 hover:bg-[#6D3DF3] text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-purple-500/20"
          >
            {isLoggingIn ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-3.5 h-3.5" />
            )}
            Sign In
          </button>
        ) : (
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 transition-all shadow-md"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 font-sans text-xs flex items-center justify-center">
              <img src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <Menu className="w-4 h-4 text-slate-300 mr-0.5" />
          </button>
        )}
      </div>

      {/* 2. Mobile Layout with High Fidelity Full-height Slide-drawer (Sophia Rose mockup) */}
      <div className="flex md:hidden items-center gap-2">
        {/* Modern Mobile Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-all active:scale-95 shadow-sm"
          title={localDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {localDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Toggle Trigger */}
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 p-1.5 rounded-xl bg-white/5 active:scale-95 border border-white/10 transition-all shadow-md"
        >
          {user ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
              <img src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="avatar" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
              <User className="w-4 h-4" />
            </div>
          )}
          <Menu className="w-4 h-4 text-slate-300 mr-0.5" />
        </button>

        {/* Full screen Drawer Overlay - Portal inside AnimatePresence or AnimatePresence inside Portal */}
        {typeof document !== "undefined" && createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Opaque dark background blurring list */}
                <motion.div
                  key="menu-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9999] backdrop-blur-xl cursor-pointer"
                  style={{ backgroundColor: "rgba(3, 7, 18, 0.96)" }}
                  onClick={() => setIsOpen(false)}
                />

                {/* Sidebar Menu matching Sophia Rose mockup format exactly */}
                <motion.div
                  key="menu-drawer"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 26, stiffness: 190 }}
                  className="fixed right-0 top-0 bottom-0 z-[10000] w-[85%] max-w-[340px] border-l border-white/[0.08] p-8 flex flex-col justify-between shadow-2xl rounded-l-[2rem] text-left"
                  style={{ backgroundColor: "#0b0f19" }}
                >
                  {/* 1. Header controls (Close button) */}
                  <div className="absolute top-6 right-6">
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 text-slate-400 hover:text-white transition-all shadow-md"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  {/* 2. Top Profile Details with Large Avatar (aligned with mockup) */}
                  <div className="flex flex-col items-start mt-6 w-full">
                    <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-purple-500 via-[#6D3DF3] to-cyan-400 shadow-[0_0_20px_rgba(109,61,243,0.30)] mb-5">
                      <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-950">
                        <img 
                          src={user?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} 
                          alt="avatar" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold tracking-tight text-white mb-1 truncate max-w-full">
                      {user ? (user.displayName || 'Neural Member') : 'Guest Member'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono tracking-wide truncate max-w-full">
                      {user ? (user.email || 'One Click Creator') : 'Sign in to access tools'}
                    </p>
                  </div>

                  {/* Divider Line */}
                  <div className="w-full h-[1px] bg-white/[0.06] my-6" />

                  {/* 3. Dropdown Menu List items with large hit targets (like mockup) */}
                  <div className="flex-1 flex flex-col gap-2 mt-2">
                    {/* Home Option */}
                    <button 
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full flex items-center gap-4 px-4 h-14 rounded-2xl text-slate-300 hover:bg-white/5 active:bg-white/10 transition-all font-sans font-medium text-[15px] tracking-wide"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                        <Home className="w-4.5 h-4.5" />
                      </div>
                      <span>Home</span>
                    </button>

                    {/* Tools Option */}
                    <button 
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/');
                        setTimeout(() => {
                          document.getElementById('workspace-tools')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="w-full flex items-center gap-4 px-4 h-14 rounded-2xl text-slate-300 hover:bg-white/5 active:bg-white/10 transition-all font-sans font-medium text-[15px] tracking-wide"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                        <LayoutGrid className="w-4.5 h-4.5" />
                      </div>
                      <span>Tools</span>
                    </button>

                    {/* Pricing Option */}
                    <button 
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/');
                        setTimeout(() => {
                          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="w-full flex items-center gap-4 px-4 h-14 rounded-2xl text-slate-300 hover:bg-white/5 active:bg-white/10 transition-all font-sans font-medium text-[15px] tracking-wide"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                        <CreditCard className="w-4.5 h-4.5" />
                      </div>
                      <span>Pricing</span>
                    </button>

                    {/* Diamond Balance Segment */}
                    <div className="w-full flex items-center justify-between px-4 h-14 rounded-2xl bg-[#0E1524]/60 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.06)] font-sans font-medium text-[15px] tracking-wide">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                          <DiamondIcon className="w-5 h-5 drop-shadow-[0_0_5px_rgba(59,130,246,0.4)] animate-pulse" />
                        </div>
                        <span className="text-slate-300">Diamonds</span>
                      </div>
                      <span className="font-tech font-black text-blue-400 text-[14px] pr-1">{diamonds}</span>
                    </div>

                    {/* Admin dashboard action (guarded) */}
                    {(role === 'admin' || user?.email?.toLowerCase() === 'uploadadd.com@gmail.com') && (
                      <button 
                        onClick={handleAdminAction}
                        className="w-full flex items-center gap-4 px-4 h-14 rounded-2xl text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-all font-sans font-medium text-[15px] tracking-wide"
                      >
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Lock className="w-4.5 h-4.5" />
                        </div>
                        <span className="font-tech font-black text-[11px] tracking-wider uppercase">ADMIN PANEL</span>
                      </button>
                    )}
                  </div>

                  {/* 4. Footer Segment (Sign out or Sign In toggle) */}
                  <div className="mt-auto pt-6 border-t border-white/[0.06] w-full">
                    {user ? (
                      <button 
                        onClick={handleLogoutAction}
                        className="w-full flex items-center gap-4 px-4 h-14 rounded-2xl text-red-400 hover:bg-red-500/5 active:bg-red-500/10 transition-all font-sans font-medium text-[15px] tracking-wide"
                      >
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center text-red-400">
                          <LogOut className="w-4.5 h-4.5" />
                        </div>
                        <span className="font-black text-xs uppercase tracking-wider">Sign Out</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setIsOpen(false);
                          handleLogin();
                        }}
                        disabled={isLoggingIn}
                        className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-[#6D3DF3] disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-purple-500/10 flex items-center justify-center gap-3"
                      >
                        {isLoggingIn ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <LogIn className="w-4.5 h-4.5" />
                            <span>Sign In with Google</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </div>
  );
}

function VoiceoverView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage, deductDiamonds, refundDiamonds, diamonds } = useFirebase();
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedMood, setSelectedMood] = useState("story");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  const [showDiamondModal, setShowDiamondModal] = useState(false);

  const t = translations[lang].voiceover;

  const getWordCount = (txt: string): number => {
    const trimmed = txt.trim();
    if (!trimmed) return 0;
    
    const hasMyanmar = /[\u1000-\u109F]/.test(trimmed);
    if (hasMyanmar) {
      const myanmarSyllables = (trimmed.match(/[\u1000-\u1021\u1023-\u102a\u103f\u1040-\u1049]/g) || []).length;
      const nonMyanmarText = trimmed.replace(/[\u1000-\u109F]/g, " ").trim();
      const englishWordCount = nonMyanmarText.split(/\s+/).filter(Boolean).length;
      return myanmarSyllables + englishWordCount;
    }
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const isAppApiKey = apiKeyConfig.source === "app";
  const wordCount = getWordCount(text);

  const getRequiredCost = (): number => {
    if (!isAppApiKey || wordCount <= 0) return 0;
    if (wordCount < 100) return 1;
    if (wordCount < 200) return 2;
    if (wordCount < 300) return 3;
    return Math.floor(wordCount / 100) + 1;
  };

  const requiredCost = getRequiredCost();

  const handleGenerate = async () => {
    if (!text.trim()) return;

    if (requiredCost > 0 && diamonds < requiredCost) {
      setShowDiamondModal(true);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
    let deducted = false;

    try {
      if (requiredCost > 0) {
        const success = await deductDiamonds(requiredCost);
        if (!success) {
          setShowDiamondModal(true);
          setIsGenerating(false);
          return;
        }
        deducted = true;
      }

      const jobId = await api.voiceover(text, selectedVoice, apiKey);
      const jobResult = await pollForCompletion(jobId);
      const base64 = jobResult.audioData;
      
      if (base64) {
        await incrementUsage();
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    } catch (err: any) {
      console.error(err);
      setError(lang === "EN" ? `Failed to generate voiceover: ${err.message}` : `Voiceover ထုတ်လုပ်ရန် အဆင်မပြေပါ။ ${err.message}`);
      
      if (deducted && requiredCost > 0) {
        console.log(`Error occurred. Auto-refunding ${requiredCost} diamonds.`);
        await refundDiamonds(requiredCost);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-page-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 border border-transparent hover:border-border">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Music className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-text-primary dark:text-white tracking-tighter">{t.headline}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <UserHeader onAdminClick={onAdminClick} />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-10 space-y-10">
        <ApiKeySelector config={apiKeyConfig} setConfig={setApiKeyConfig} lang={lang} />
        
        <section className="space-y-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.inputPlaceholder}
            className="w-full h-40 bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 text-base font-medium text-text-primary dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30 transition-all resize-none shadow-xl"
          />
          
          <div className="bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-sm rounded-2xl p-6 border border-border dark:border-white/5 shadow-xl flex flex-wrap gap-8">
            <div className="flex-1 space-y-3 min-w-[200px]">
              <label className="text-[10px] font-black text-text-primary dark:text-slate-500 uppercase tracking-[0.3em]">{t.selectVoice}</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(t.voices).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedVoice(key)}
                    className={`px-4 py-2 rounded-lg border text-[10px] font-black transition-all ${
                      selectedVoice === key 
                        ? "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20" 
                        : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-text-secondary dark:text-slate-500 hover:border-slate-300 dark:hover:border-white/10 hover:text-text-primary dark:hover:text-slate-300"
                    }`}
                  >
                    {(label as string).split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button 
              onClick={handleGenerate}
              disabled={!text.trim() || isGenerating}
              className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-3 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
                !text.trim() || isGenerating 
                  ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                  : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white"
              }`}
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {isGenerating ? (lang === "EN" ? "SYNCING..." : "ထုတ်လုပ်နေသည်...") : (requiredCost > 0 ? `${t.generate} (${requiredCost} Dia)` : t.generate)}
            </button>
          </div>
          {error && <p className="text-[9px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>}
        </section>

        <AnimatePresence>
          {audioUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl flex flex-col items-center gap-4 max-w-xs mx-auto group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 opacity-50">
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>
              
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center group relative cursor-pointer border border-blue-500/20" onClick={playAudio}>
                <div className="absolute inset-0 bg-blue-500/20 rounded-2xl animate-ping opacity-10" />
                <Music className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform duration-500" />
              </div>

              <div className="flex flex-col items-center gap-2.5 w-full text-center">
                <button 
                  onClick={playAudio}
                  className="w-full h-11 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest text-white shadow-lg active:scale-[0.98]"
                >
                  <Play className="w-3.5 h-3.5 fill-white/20" /> {t.preview}
                </button>
                <a 
                  href={audioUrl} 
                  download="voiceover.wav"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                >
                  <CloudUpload className="w-3.5 h-3.5" /> {t.download}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <OutOfDiamondsModal isOpen={showDiamondModal} onClose={() => setShowDiamondModal(false)} lang={lang} requiredCost={requiredCost} />
      </div>
    </div>
  );
}

function VideoRecapperView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage } = useFirebase();
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].transcribe; // Reuse transcribe translations as they are very similar
  const toolTitle = translations[lang].tools.videoRecapper.title;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 300 * 1024 * 1024) {
        setError(lang === "EN" ? "File size must be under 300MB." : "ဖိုင်အရွယ်အစားသည် 300MB အောက်သာ ဖြစ်ရပါမည်။");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    
    setIsGenerating(true);
    setError(null);
    setResult(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const jobId = await api.transcribe(base64, file.type, lang, apiKey);
          const jobResult = await pollForCompletion(jobId);
          await incrementUsage();
          setResult(jobResult.text || "");
        } catch (err: any) {
          console.error(err);
          setError(lang === "EN" ? `Analysis failed: ${err.message}` : `စစ်ဆေးရန် အဆင်မပြေပါ။ ${err.message}`);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (err) {
      console.error(err);
      setError(lang === "EN" ? "Failed to analyze video. Please try again." : "ဗီဒီယိုကို စစ်ဆေးရန် အဆင်မပြေပါ။ ပြန်လည်ကြိုးစားပေးပါ။");
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-page-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 border border-transparent hover:border-border">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Play className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-text-primary dark:text-white tracking-tighter">{toolTitle}</h1>
            </div>
          </div>
          <div className="flex items-center">
            <UserHeader onAdminClick={onAdminClick} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 space-y-10">
        <section className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-2 border border-white/5 shadow-2xl max-w-sm mx-auto group hover:border-blue-500/20 transition-all">
          <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group ${
              file ? "border-blue-500/50 bg-blue-500/5" : "border-white/10 hover:border-blue-500/30 hover:bg-white/5"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              file ? "bg-blue-600 shadow-xl shadow-blue-500/20" : "bg-white/5 group-hover:bg-blue-500/10"
            }`}>
              {file ? <Check className="w-4 h-4 text-white" /> : <CloudUpload className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />}
            </div>
            <div className="space-y-0.5 text-center">
              <h3 className={`text-xs font-black tracking-wider uppercase transition-colors ${file ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
                {file ? file.name : translations[lang].recapMaster.browseFiles}
              </h3>
              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest leading-none">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : translations[lang].recapMaster.fileLimit}
              </p>
            </div>
          </div>
          {error && <p className="mt-2 text-[9px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>}
        </section>

        <div className="flex justify-center pt-2">
          <button 
            onClick={handleGenerate}
            disabled={!file || isGenerating}
            className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-4 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
              !file || isGenerating 
                ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white"
            }`}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? (lang === "EN" ? "ANALYZING..." : "စစ်ဆေးနေသည်...") : (lang === "EN" ? "START RECAP" : "Recap စတင်မည်")}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-lg rounded-[2.5rem] p-10 border border-border dark:border-white/5 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                    <Sparkles className="w-6 h-6 text-blue-400/50" />
                  </div>
                </div>
                
                <div className="prose dark:prose-invert prose-slate max-w-none prose-lg md:prose-xl prose-p:leading-relaxed prose-headings:text-text-primary dark:prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter dark:prose-li:text-slate-300 font-medium selection:bg-blue-500/30">
                  <Markdown>{result}</Markdown>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TranscribeView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage, deductDiamonds, refundDiamonds, diamonds } = useFirebase();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [srtResult, setSrtResult] = useState<string | null>(null);
  const [freeUsesToday, setFreeUsesToday] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(`free_transcribe_uses_${todayStr}`);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].transcribe;

  // Load duration of video
  useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setDuration(video.duration);
    };
    video.src = URL.createObjectURL(file);
    return () => {
      URL.revokeObjectURL(video.src);
    };
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 300 * 1024 * 1024) {
        setError(lang === "EN" ? "File size must be under 300MB." : "ဖိုင်အရွယ်အစားသည် 300MB အောက်သာ ဖြစ်ရပါမည်။");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setSrtResult(null);
    }
  };

  const isAppApiKey = apiKeyConfig.source === "app";
  const requiredCost = isAppApiKey && file 
    ? (freeUsesToday < 3 ? 0 : Math.max(2, Math.ceil((duration || 0) / 60) * 2)) 
    : 0;

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.readAsDataURL(f);
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = (e) => reject(e);
    });
  };

  const handleGenerate = async () => {
    if (!file) return;

    if (requiredCost > 0 && diamonds < requiredCost) {
      setShowDiamondModal(true);
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setSrtResult(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
    let deducted = false;

    try {
      if (requiredCost > 0) {
        const success = await deductDiamonds(requiredCost);
        if (!success) {
          setShowDiamondModal(true);
          setIsGenerating(false);
          return;
        }
        deducted = true;
      }

      const base64 = await fileToBase64(file);
      const jobId = await api.transcribe(base64, file.type, lang, apiKey);
      const jobResult = await pollForCompletion(jobId);
      
      await incrementUsage();
      setResult(jobResult.text || "");
      setSrtResult(jobResult.srt || null);

      if (isAppApiKey && freeUsesToday < 3) {
        const todayStr = new Date().toISOString().split('T')[0];
        const nextVal = freeUsesToday + 1;
        localStorage.setItem(`free_transcribe_uses_${todayStr}`, String(nextVal));
        setFreeUsesToday(nextVal);
      }
    } catch (err: any) {
      console.error(err);
      setError(lang === "EN" ? `Transcription failed: ${err.message}` : `ဘာသာပြန်ရန် အဆင်မပြေပါ။ ${err.message}`);
      
      if (deducted && requiredCost > 0) {
        console.log(`Error occurred. Auto-refunding ${requiredCost} diamonds.`);
        await refundDiamonds(requiredCost);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-page-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 border border-transparent hover:border-border">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Type className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-text-primary dark:text-white tracking-tighter">{t.headline}</h1>
            </div>
          </div>

          <div className="flex items-center">
            <UserHeader onAdminClick={onAdminClick} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 space-y-10">
        <div className="max-w-sm mx-auto">
          <ApiKeySelector config={apiKeyConfig} setConfig={setApiKeyConfig} lang={lang} />
        </div>
        <section className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-2xl p-2 border border-slate-200 dark:border-white/5 shadow-2xl max-w-sm mx-auto group hover:border-blue-500/30 transition-all">
          <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group ${
              file ? "border-blue-500/50 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200/60 dark:border-white/10 hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              file ? "bg-blue-600 shadow-xl shadow-blue-500/20" : "bg-slate-100 dark:bg-white/5 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30"
            }`}>
              {file ? <Check className="w-4 h-4 text-white" /> : <CloudUpload className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />}
            </div>
            <div className="space-y-0.5 text-center">
              <h3 className={`text-xs font-black tracking-wider uppercase transition-colors ${file ? "text-slate-800 dark:text-slate-200" : "text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"}`}>
                {file ? file.name : "CLICK TO BROWSE FILES"}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "MP4, MOV (MAX 300MB)"}
              </p>
            </div>
          </div>
          {error && <p className="mt-2 text-[9px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>}
        </section>

        <div className="flex flex-col items-center justify-center pt-2 gap-2">
          <button 
            onClick={handleGenerate}
            disabled={!file || isGenerating}
            className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-4 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
              !file || isGenerating 
                ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white shadow-blue-500/30"
            }`}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? (lang === "EN" ? "SYNCING..." : "ဘာသာပြန်နေသည်...") : (requiredCost > 0 ? `${t.generate} (${requiredCost} Dia)` : `${t.generate} (FREE)`)}
          </button>
          
          {isAppApiKey && file && (
            <p className="text-[10px] text-blue-500 font-extrabold uppercase tracking-wider">
              Free Daily Uses: {Math.max(0, 3 - freeUsesToday)} of 3 left
            </p>
          )}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-lg rounded-[2.5rem] p-10 border border-border dark:border-white/5 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                    <Sparkles className="w-6 h-6 text-blue-400/50" />
                  </div>
                </div>
                
                <div className="prose dark:prose-invert prose-slate max-w-none prose-lg md:prose-xl prose-p:leading-relaxed prose-headings:text-text-primary dark:prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter dark:prose-li:text-slate-300 font-medium selection:bg-blue-500/30">
                  <Markdown>{result}</Markdown>
                </div>
              </div>

              {srtResult && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([srtResult], { type: "text/srt;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const originalName = file?.name || "subtitles.srt";
                      const baseName = originalName.includes(".") 
                        ? originalName.substring(0, originalName.lastIndexOf(".")) 
                        : originalName;
                      a.download = `${baseName}.srt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="h-12 px-8 rounded-2xl bg-teal-600 hover:bg-teal-700 hover:scale-105 transition-all text-white font-black text-xs uppercase tracking-widest flex items-center gap-3 active:scale-[0.98] shadow-2xl shadow-teal-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {lang === "EN" ? "Download Subtitles (.SRT)" : ".SRT စာတမ်းထိုးဖိုင် ဒေါင်းလုဒ်ဆွဲရန်"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <OutOfDiamondsModal isOpen={showDiamondModal} onClose={() => setShowDiamondModal(false)} lang={lang} requiredCost={requiredCost} />
      </div>
    </div>
  );
}

function VideoToSrtView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage, deductDiamonds, refundDiamonds, diamonds } = useFirebase();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [srtResult, setSrtResult] = useState<string | null>(null);
  const [freeUsesToday, setFreeUsesToday] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(`free_srt_uses_${todayStr}`);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].videoToSrt;

  // Load duration of video
  useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setDuration(video.duration);
    };
    video.src = URL.createObjectURL(file);
    return () => {
      URL.revokeObjectURL(video.src);
    };
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 300 * 1024 * 1024) {
        setError("File size must be under 300MB.");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setSrtResult(null);
    }
  };

  const isAppApiKey = apiKeyConfig.source === "app";
  const requiredCost = isAppApiKey && file 
    ? (freeUsesToday < 3 ? 0 : Math.max(2, Math.ceil((duration || 0) / 60) * 2)) 
    : 0;

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.readAsDataURL(f);
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = (e) => reject(e);
    });
  };

  const handleGenerate = async () => {
    if (!file) return;

    if (requiredCost > 0 && diamonds < requiredCost) {
      setShowDiamondModal(true);
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setSrtResult(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
    let deducted = false;

    try {
      if (requiredCost > 0) {
        const success = await deductDiamonds(requiredCost);
        if (!success) {
          setShowDiamondModal(true);
          setIsGenerating(false);
          return;
        }
        deducted = true;
      }

      const base64 = await fileToBase64(file);
      const jobId = await api.videotosrt(base64, file.type, apiKey);
      const jobResult = await pollForCompletion(jobId);
      
      await incrementUsage();
      setResult(jobResult.text || "");
      setSrtResult(jobResult.srt || null);

      if (isAppApiKey && freeUsesToday < 3) {
        const todayStr = new Date().toISOString().split('T')[0];
        const nextVal = freeUsesToday + 1;
        localStorage.setItem(`free_srt_uses_${todayStr}`, String(nextVal));
        setFreeUsesToday(nextVal);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Translation failed: ${err.message}`);
      
      if (deducted && requiredCost > 0) {
        console.log(`Error occurred. Auto-refunding ${requiredCost} diamonds.`);
        await refundDiamonds(requiredCost);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-page-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 border border-transparent hover:border-border">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-text-primary dark:text-white tracking-tighter">{t.headline}</h1>
            </div>
          </div>

          <div className="flex items-center">
            <UserHeader onAdminClick={onAdminClick} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 space-y-10">
        <div className="max-w-sm mx-auto">
          <ApiKeySelector config={apiKeyConfig} setConfig={setApiKeyConfig} lang={lang} />
        </div>
        <section className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-2xl p-2 border border-slate-200 dark:border-white/5 shadow-2xl max-w-sm mx-auto group hover:border-blue-500/30 transition-all">
          <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group ${
              file ? "border-blue-500/50 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200/60 dark:border-white/10 hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              file ? "bg-blue-600 shadow-xl shadow-blue-500/20" : "bg-slate-100 dark:bg-white/5 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30"
            }`}>
              {file ? <Check className="w-4 h-4 text-white" /> : <CloudUpload className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />}
            </div>
            <div className="space-y-0.5 text-center">
              <h3 className={`text-xs font-black tracking-wider uppercase transition-colors ${file ? "text-slate-800 dark:text-slate-200" : "text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"}`}>
                {file ? file.name : "CLICK TO BROWSE FILES"}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "MP4, MOV (MAX 300MB)"}
              </p>
            </div>
          </div>
          {error && <p className="mt-2 text-[9px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>}
        </section>

        <div className="flex flex-col items-center justify-center pt-2 gap-2">
          <button 
            onClick={handleGenerate}
            disabled={!file || isGenerating}
            className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-4 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
              !file || isGenerating 
                ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white shadow-blue-500/30"
            }`}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? "SYNCING..." : (requiredCost > 0 ? `${t.generate} (${requiredCost} Dia)` : `${t.generate} (FREE)`)}
          </button>
          
          {isAppApiKey && file && (
            <p className="text-[10px] text-blue-500 font-extrabold uppercase tracking-wider">
              Free Daily Uses: {Math.max(0, 3 - freeUsesToday)} of 3 left
            </p>
          )}
        </div>

        <AnimatePresence>
          {srtResult && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    const blob = new Blob([srtResult], { type: "text/srt;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const originalName = file?.name || "subtitles.srt";
                    const baseName = originalName.includes(".") 
                      ? originalName.substring(0, originalName.lastIndexOf(".")) 
                      : originalName;
                    a.download = `${baseName}.srt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all text-white font-black text-xs uppercase tracking-widest flex items-center gap-3 active:scale-[0.98] shadow-2xl shadow-blue-500/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Subtitles (.SRT)
                </button>
              </div>
            </motion.div>
          )}
         </AnimatePresence>

         <OutOfDiamondsModal isOpen={showDiamondModal} onClose={() => setShowDiamondModal(false)} lang={lang} requiredCost={requiredCost} />
       </div>
     </div>
   );
 }

function AIVideoVoiceActorView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage, deductDiamonds, refundDiamonds, diamonds } = useFirebase();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [result, setResult] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].aiVideoVoiceActor;

  // Load duration of video
  useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setDuration(video.duration);
    };
    video.src = URL.createObjectURL(file);
    return () => {
      URL.revokeObjectURL(video.src);
    };
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 300 * 1024 * 1024) {
        setError("File size must be under 300MB.");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setDownloadUrl(null);
    }
  };

  const isAppApiKey = true; // Force app API key
  const requiredCost = file ? Math.max(1, Math.ceil((duration || 0) / 10)) : 10;

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.readAsDataURL(f);
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = (e) => reject(e);
    });
  };

  const handleGenerate = async () => {
    if (!file) return;

    if (requiredCost > 0 && diamonds < requiredCost) {
      setShowDiamondModal(true);
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setDownloadUrl(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
    let deducted = false;

    try {
      if (requiredCost > 0) {
        const success = await deductDiamonds(requiredCost);
        if (!success) {
          setShowDiamondModal(true);
          setIsGenerating(false);
          return;
        }
        deducted = true;
      }

      const base64 = await fileToBase64(file);
      const jobId = await api.voiceactor(base64, file.type, selectedVoice, apiKey);
      const jobResult = await pollForCompletion(jobId);
      
      await incrementUsage();
      setResult(jobResult.text || "");
      setDownloadUrl(jobResult.downloadUrl || null);
    } catch (err: any) {
      console.error(err);
      setError(`Voice acting generation failed: ${err.message}`);
      
      if (deducted && requiredCost > 0) {
        console.log(`Error occurred. Auto-refunding ${requiredCost} diamonds.`);
        await refundDiamonds(requiredCost);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const voiceOptions = [
    { name: "Kore", label: "Kore (Friendly/Bright)" },
    { name: "Puck", label: "Puck (Deep/Bold)" },
    { name: "Charon", label: "Charon (Technical/Clear)" },
    { name: "Fenrir", label: "Fenrir (Rugged/Warm)" },
    { name: "Zephyr", label: "Zephyr (Soft/Calm)" }
  ];

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-page-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 border border-transparent hover:border-border">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-text-primary dark:text-white tracking-tighter">{t.headline}</h1>
            </div>
          </div>

          <div className="flex items-center">
            <UserHeader onAdminClick={onAdminClick} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 space-y-10">
        {/* Video Upload Section */}
        <section className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-2xl p-2 border border-slate-200 dark:border-white/5 shadow-2xl max-w-sm mx-auto group hover:border-blue-500/30 transition-all">
          <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group ${
              file ? "border-blue-500/50 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200/60 dark:border-white/10 hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              file ? "bg-blue-600 shadow-xl shadow-blue-500/20" : "bg-slate-100 dark:bg-white/5 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30"
            }`}>
              {file ? <Check className="w-4 h-4 text-white" /> : <CloudUpload className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />}
            </div>
            <div className="space-y-0.5 text-center">
              <h3 className={`text-xs font-black tracking-wider uppercase transition-colors ${file ? "text-slate-800 dark:text-slate-200" : "text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"}`}>
                {file ? file.name : "CLICK TO BROWSE FILES"}
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "MP4, MOV (MAX 300MB)"}
              </p>
            </div>
          </div>
          {error && <p className="mt-2 text-[9px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>}
        </section>

        {/* Voice Option Picker */}
        <section className="max-w-md mx-auto space-y-3">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">
            {t.selectVoice}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {voiceOptions.map((v) => {
              const isActive = selectedVoice === v.name;
              return (
                <button
                  key={v.name}
                  onClick={() => setSelectedVoice(v.name)}
                  className={`relative flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer select-none overflow-hidden ${
                    isActive
                      ? "border-blue-500 bg-blue-500/[0.08] text-blue-600 dark:text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)] font-black"
                      : "border-slate-200 dark:border-white/5 hover:border-blue-500/20 hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-700 dark:text-slate-300 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3 relative z-10 w-full overflow-hidden">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
                      isActive ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105" : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500"
                    }`}>
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 pr-6">
                      <span className="text-xs font-black tracking-wide truncate">{v.label.split("(")[0].trim()}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">
                        {v.label.includes("(") ? `(${v.label.split("(")[1]}` : ""}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <div className="flex items-end gap-0.5 h-3.5 shrink-0 absolute right-4">
                      <span className="w-0.5 bg-blue-500 rounded-full animate-pulse h-3" />
                      <span className="w-0.5 bg-blue-500 rounded-full animate-pulse h-2" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 bg-blue-500 rounded-full animate-pulse h-4" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Generate / Processing Actions */}
        <div className="flex flex-col items-center gap-4 justify-center pt-2">
          <button 
            onClick={handleGenerate}
            disabled={!file || isGenerating}
            className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-4 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
              !file || isGenerating 
                ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white shadow-blue-500/30"
            }`}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? "SYNCING..." : (requiredCost > 0 ? `${t.generate} (${requiredCost} Dia)` : t.generate)}
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {/* Transcript Display */}
              <div className="bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-lg rounded-[2.5rem] p-10 border border-border dark:border-white/5 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                    <Sparkles className="w-6 h-6 text-blue-400/50" />
                  </div>
                </div>
                
                <h2 className="text-sm font-black uppercase tracking-widest text-blue-500/80 mb-6">
                  Translated Burmese Script
                </h2>

                <div className="prose dark:prose-invert prose-slate max-w-none prose-lg md:prose-xl prose-p:leading-relaxed prose-headings:text-text-primary dark:prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter dark:prose-li:text-slate-300 font-medium selection:bg-blue-500/30">
                  <Markdown>{result}</Markdown>
                </div>
              </div>

              {/* Download Combos */}
              {downloadUrl && (
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-2">
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = downloadUrl;
                      const originalName = file?.name || "voice_acted_video.mp4";
                      const baseName = originalName.includes(".") 
                        ? originalName.substring(0, originalName.lastIndexOf(".")) 
                        : originalName;
                      a.download = `${baseName}_BurmeseVoice.mp4`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="h-14 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all text-white font-black text-xs uppercase tracking-widest flex items-center gap-3 active:scale-[0.98] shadow-2xl shadow-blue-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Final Video (.mp4)
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <OutOfDiamondsModal isOpen={showDiamondModal} onClose={() => setShowDiamondModal(false)} lang={lang} requiredCost={requiredCost} />
      </div>
    </div>
  );
}

function OutOfDiamondsModal({ isOpen, onClose, lang, requiredCost = 10 }: { isOpen: boolean, onClose: () => void, lang: Language, requiredCost?: number }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#0f172a] border border-blue-500/30 rounded-[32px] p-8 max-w-sm w-full text-center space-y-6 shadow-[0_0_50px_rgba(59,130,246,0.2)]"
        >
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <DiamondIcon className="w-14 h-14 drop-shadow-[0_0_15px_rgba(59,130,246,0.4)] animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white italic tracking-tighter">
              {lang === "EN" ? "Diamond Required" : "Diamond လိုအပ်နေပါသည်"}
            </h2>
            <p className="text-slate-400 text-xs font-bold tracking-widest leading-relaxed">
              {lang === "EN" 
                ? `You need at least ${requiredCost} diamonds to generate a recap. Please contact us to buy more.` 
                : `Recap ထုတ်လုပ်ရန် Diamond ${requiredCost} ခု လိုအပ်ပါသည်။ Diamond ထပ်ဝယ်ရန် ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ။`}
            </p>
          </div>
          <div className="space-y-3">
            <a 
              href="https://t.me/akhptn" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-center gap-3 w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/20"
            >
              Telegram @akhptn
            </a>
            <button 
              onClick={onClose}
              className="w-full h-12 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AccessDeniedView({ onBack, lang }: { onBack: () => void, lang: Language }) {
  return (
    <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)] text-red-500">
        <Lock className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">
          {lang === "EN" ? "Access Denied" : "Access Denied"}
        </h2>
        <p className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase max-w-xs mx-auto">
          {lang === "EN" 
            ? "You do not have administrative privileges to access this neural sector."
            : "You do not have administrative privileges to access this neural sector."}
        </p>
      </div>
      <button 
        onClick={onBack}
        className="flex items-center gap-3 px-8 h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border border-white/10"
      >
        <ArrowLeft className="w-4 h-4" /> {lang === "EN" ? "Return to Portal" : "Return to Portal"}
      </button>
    </div>
  );
}

function AdminSecondaryLoginView({ onSuccess, onBack, lang }: { onSuccess: () => void, onBack: () => void, lang: Language }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "Aungkohtet97529318@") {
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="hero-glow opacity-20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card-bg/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 mb-4">
            <Lock className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
            {lang === "EN" ? "Neural Verification" : "Neural Verification"}
          </h2>
          <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-2">
            {lang === "EN" ? "Secondary authentication required" : "Secondary authentication required"}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold tracking-widest uppercase ml-1">Username</label>
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-medium"
              placeholder="Admin ID..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-bold tracking-widest uppercase ml-1">Password</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-medium"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center"
            >
              Invalid Credentials Access Denied
            </motion.p>
          )}

          <button 
            type="submit"
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            {lang === "EN" ? "Authorize Access" : "Authorize Access"}
          </button>

          <button 
            type="button"
            onClick={onBack}
            className="w-full h-14 bg-transparent text-slate-500 hover:text-white transition-colors font-bold text-[10px] uppercase tracking-widest"
          >
            Cancel Request
          </button>
        </form>
      </motion.div>
    </div>
  );
}

interface HistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  style: string;
  recapResult: string;
  voiceoverAudioUrl?: string | null;
  mergedVideoUrl?: string | null;
  status?: "recap" | "voiceover" | "merge" | "completed" | "failed";
}

function RecapMasterView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage, deductDiamonds, refundDiamonds, diamonds } = useFirebase();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Load history based on user
  useEffect(() => {
    const userKey = user?.uid || "guest";
    try {
      const saved = localStorage.getItem(`recap_history_${userKey}`);
      if (saved) {
        setHistory(JSON.parse(saved));
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, [user]);

  // Helper to update state and localStorage
  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    const userKey = user?.uid || "guest";
    setHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      localStorage.setItem(`recap_history_${userKey}`, JSON.stringify(updated));
      return updated;
    });
  };

  const [selectedStyle, setSelectedStyle] = useState("step-by-step");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<"recap" | "voiceover" | "merge" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  const [showDiamondModal, setShowDiamondModal] = useState(false);

  // Voiceover Integration
  const [isVoiceoverGenerating, setIsVoiceoverGenerating] = useState(false);
  const [voiceoverAudioUrl, setVoiceoverAudioUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedMood, setSelectedMood] = useState("story");

  const [isMerging, setIsMerging] = useState(false);
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  
  // Logo Settings
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoSize, setLogoSize] = useState(100);
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [showLogoSettings, setShowLogoSettings] = useState(false);
  
  // Video Ratio Settings
  const [videoRatio, setVideoRatio] = useState("9:16");
  const [videoScale, setVideoScale] = useState(100);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [bgColor, setBgColor] = useState("#000000");
  const [bgBlurEnabled, setBgBlurEnabled] = useState(false);
  const [showRatioSettings, setShowRatioSettings] = useState(false);
  
  // Blur Settings
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurWidth, setBlurWidth] = useState(400);
  const [blurHeight, setBlurHeight] = useState(100);
  const [blurY, setBlurY] = useState(400);
  const [blurIntensity, setBlurIntensity] = useState(10);
  const [showBlurSettings, setShowBlurSettings] = useState(false);
  
  // Glow Light Sweep Setting
  const [glowingSweepEnabled, setGlowingSweepEnabled] = useState(false);
  
  // Freeze Frame Zoom Setting
  const [freezeFrameZoomEnabled, setFreezeFrameZoomEnabled] = useState(false);
  
  // Narration original audio processing switch
  const [isNarrationRecap, setIsNarrationRecap] = useState(true);
  
    // Subtitle Settings
    const [subtitleEnabled, setSubtitleEnabled] = useState(false);
    const [subtitleColor, setSubtitleColor] = useState("#ffffff");
    const [subtitleFontSize, setSubtitleFontSize] = useState(13);
    const [subtitleFont, setSubtitleFont] = useState("Tharlon");
    const [subtitleBoxColor, setSubtitleBoxColor] = useState("#000000");
    const [subtitleY, setSubtitleY] = useState(75);
    const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);

    // Dynamic Live Preview Tracking
    const previewRef = useRef<HTMLDivElement>(null);
    const [previewSize, setPreviewSize] = useState({ w: 400, h: 225 });

    useEffect(() => {
      if (!previewRef.current) return;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            setPreviewSize({
              w: entry.contentRect.width,
              h: entry.contentRect.height
            });
          }
        }
      });
      observer.observe(previewRef.current);
      return () => observer.disconnect();
    }, [showSubtitleSettings, videoRatio]);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].recapMaster;
  const vt = translations[lang].voiceover;
  const styles = getRecapStyles(lang);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 300 * 1024 * 1024) {
        setError(lang === "EN" ? "File size must be under 300MB for this demo." : "File size must be under 300MB for this demo.");
        return;
      }
      setFile(selectedFile);
      
      // Extract duration
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        setDuration(video.duration);
        window.URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(selectedFile);

      setError(null);
      setResult(null);
      setVoiceoverAudioUrl(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const requiredCost = file ? Math.max(1, Math.ceil((duration || 0) / 10)) : 10;

  const handleGenerate = async () => {
    if (!file) return;

    if (diamonds < requiredCost) {
      setShowDiamondModal(true);
      return;
    }
    
    setIsGenerating(true);
    setGenerationPhase("recap");
    setError(null);
    setResult(null);
    setVoiceoverAudioUrl(null);
    setMergedVideoUrl(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
    let deducted = false;
    let activeHistoryId: string | null = null;

    try {
      const success = await deductDiamonds(requiredCost);
      if (!success) {
        setShowDiamondModal(true);
        setIsGenerating(false);
        setGenerationPhase(null);
        return;
      }
      deducted = true;

      const newHistoryId = Date.now().toString();
      activeHistoryId = newHistoryId;
      const genEngTimestamp = () => {
        const d = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const year = d.getFullYear();
        const month = months[d.getMonth()];
        const day = d.getDate();
        let hours = d.getHours();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutes = d.getMinutes().toString().padStart(2, "0");
        return `${month} ${day}, ${year}, ${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
      };
      const timestampStr = genEngTimestamp();
      const newHistoryItem: HistoryItem = {
        id: newHistoryId,
        timestamp: timestampStr,
        fileName: file.name,
        style: selectedStyle,
        recapResult: "",
        status: "recap"
      };
      setCurrentHistoryId(newHistoryId);
      
      setHistory(prev => {
        const updated = [newHistoryItem, ...prev];
        localStorage.setItem(`recap_history_${user?.uid || 'guest'}`, JSON.stringify(updated));
        return updated;
      });

      const base64 = await fileToBase64(file);
      const jobId = await api.recap(base64, file.type, selectedStyle, lang, duration || undefined, apiKey, freezeFrameZoomEnabled, isNarrationRecap);
      const jobResult = await pollForCompletion(jobId);
      const recapValue = jobResult.text;
      
      await incrementUsage();
      setResult(recapValue || "");
      updateHistoryItem(newHistoryId, { 
        recapResult: recapValue || "",
        status: "voiceover"
      });

      // Auto-trigger voiceover generation
      if (recapValue) {
        setIsVoiceoverGenerating(true);
        setGenerationPhase("voiceover");
        try {
          const cleanText = recapValue.replace(/[#*`_~]/g, '');
          const vJobId = await api.voiceover(cleanText, selectedVoice, apiKey);
          const vResult = await pollForCompletion(vJobId);
          const voice64 = vResult.audioData;
          
          if (voice64) {
            const binaryString = atob(voice64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);
            setVoiceoverAudioUrl(url);
            updateHistoryItem(newHistoryId, { 
              voiceoverAudioUrl: url,
              status: "merge"
            });

            setIsVoiceoverGenerating(false);
            // Auto trigger merge and await its completion so any errors are caught here
            await performMerge(file, url, recapValue, newHistoryId);
          } else {
            throw new Error("No voiceover audio data returned from api");
          }
        } catch (vErr) {
          console.error("Auto voiceover / merge failed:", vErr);
          throw vErr;
        } finally {
          setIsVoiceoverGenerating(false);
        }
      } else {
        throw new Error("No recap script returned from api");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || (lang === "EN" ? "Failed to generate recap. Please try again." : "Failed to generate recap. Please try again.");
      setError(errMsg);
      
      if (activeHistoryId) {
        updateHistoryItem(activeHistoryId, { status: "failed" });
      }

      // Auto-refund immediately if we managed to deduct but failed to produce final video
      if (deducted) {
        console.log(`Error occurred. Auto-refunding ${requiredCost} diamonds.`);
        await refundDiamonds(requiredCost);
      }
    } finally {
      setIsGenerating(false);
      setGenerationPhase(null);
    }
  };

  const handleGenerateVoiceover = async () => {
    if (!result || !file) return;
    setIsVoiceoverGenerating(true);
    setGenerationPhase("voiceover");
    setVoiceoverAudioUrl(null);

    try {
      // Clean markdown for better TTS
      const cleanText = result.replace(/[#*`_~]/g, '');
      const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
      const jobId = await api.voiceover(cleanText, selectedVoice, apiKey);
      const jobResult = await pollForCompletion(jobId);
      const base64 = jobResult.audioData;
      
      if (base64) {
        await incrementUsage();
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setVoiceoverAudioUrl(url);

        if (currentHistoryId) {
          updateHistoryItem(currentHistoryId, { voiceoverAudioUrl: url });
        }

        // Auto trigger merge on manual regeneration too
        performMerge(file, url, result || undefined, currentHistoryId || undefined);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVoiceoverGenerating(false);
      setGenerationPhase(null);
    }
  };

  const playVoiceover = () => {
    if (voiceoverAudioUrl) {
      new Audio(voiceoverAudioUrl).play();
    }
  };

  const performMerge = async (videoFile: File, audioUrl: string, subtitleTextOverride?: string, historyIdToUpdate?: string) => {
    setIsMerging(true);
    setGenerationPhase("merge");
    setMergedVideoUrl(null);

    const targetId = historyIdToUpdate || currentHistoryId;
    if (targetId) {
      updateHistoryItem(targetId, { status: "merge" });
    }

    try {
      const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = error => reject(error);
        });
      };

      const videoBase64 = await fileToBase64(videoFile);
      
      let logoBase64 = undefined;
      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile);
      }
      
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      const audioBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(audioBlob);
      });

      const jobId = await api.merge(
        videoBase64, 
        audioBase64, 
        logoBase64, 
        logoSize, 
        logoPosition, 
        videoRatio, 
        videoScale,
        cropTop,
        cropBottom,
        cropLeft,
        cropRight,
        bgColor,
        bgBlurEnabled,
        blurEnabled,
        blurWidth,
        blurHeight,
        blurY,
        blurIntensity,
        subtitleEnabled,
        (subtitleTextOverride || result)?.replace(/[#*`_~]/g, ''),
        subtitleColor,
        subtitleFontSize,
        subtitleFont,
        subtitleBoxColor,
        subtitleY,
        glowingSweepEnabled,
        freezeFrameZoomEnabled,
        apiKey
      );
      
      if (jobId) {
        // Use generic helper
        const job = await pollForCompletion(jobId);
        if (!job.downloadUrl) {
          throw new Error("No download url was returned for the merged video");
        }
        setMergedVideoUrl(job.downloadUrl);
        if (targetId) {
          updateHistoryItem(targetId, { 
            mergedVideoUrl: job.downloadUrl,
            status: "completed"
          });
        }
      } else {
        throw new Error("No Merge job ID returned");
      }
    } catch (err) {
      console.error(err);
      if (targetId) {
        updateHistoryItem(targetId, { status: "failed" });
      }
      alert(err instanceof Error ? err.message : "Something went wrong during merging");
      throw err;
    } finally {
      setIsMerging(false);
      setGenerationPhase(null);
    }
  };

  const handleMerge = () => {
    if (file && voiceoverAudioUrl) {
      performMerge(file, voiceoverAudioUrl, result || undefined, currentHistoryId || undefined);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <OutOfDiamondsModal isOpen={showDiamondModal} onClose={() => setShowDiamondModal(false)} lang={lang} requiredCost={requiredCost} />
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-page-bg/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90 border border-transparent hover:border-border">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-black text-text-primary dark:text-white tracking-tighter">{t.headline}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <UserHeader onAdminClick={onAdminClick} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 space-y-10">
        {/* Upload Section */}
        <section className="space-y-4">
          {/* Segmented Mode Selector Switch */}
          <div id="recap-mode-selector" className="max-w-sm mx-auto bg-slate-100/80 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-border dark:border-white/5 flex gap-1 shadow-inner backdrop-blur-xl">
            <button
              id="mode-ai-recap"
              type="button"
              onClick={() => setIsNarrationRecap(false)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-center text-xs font-black tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
                !isNarrationRecap 
                  ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30 transform active:scale-[0.98]"
                  : "text-text-secondary/85 dark:text-slate-400 hover:text-text-primary dark:hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {lang === "EN" ? "Ai Mode" : "Ai Mode"}
            </button>
            <button
              id="mode-narration"
              type="button"
              onClick={() => setIsNarrationRecap(true)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-center text-xs font-black tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
                isNarrationRecap 
                  ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30 transform active:scale-[0.98]"
                  : "text-text-secondary/85 dark:text-slate-400 hover:text-text-primary dark:hover:text-slate-200"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              {lang === "EN" ? "Narration Mode" : "Narration Mode"}
            </button>
          </div>

          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-2.5 border border-border dark:border-white/5 shadow-2xl max-w-sm mx-auto group hover:border-blue-500/20 transition-all">
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept="video/mp4,video/quicktime"
              onChange={handleFileChange}
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group ${
                file ? "border-blue-500/50 bg-blue-500/5" : "border-border dark:border-white/10 hover:border-blue-500/30 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                file ? "bg-blue-600 shadow-xl shadow-blue-500/20" : "bg-slate-100 dark:bg-white/5 group-hover:bg-blue-500/10"
              }`}>
                {file ? <Check className="w-4 h-4 text-white" /> : <CloudUpload className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />}
              </div>
              <div className="space-y-0.5">
                <h3 className={`text-xs font-black tracking-wider uppercase transition-colors ${file ? "text-text-primary dark:text-white" : "text-text-secondary dark:text-slate-400 group-hover:text-text-primary dark:group-hover:text-slate-300"}`}>
                  {file ? file.name : "CLICK TO BROWSE FILES"}
                </h3>
                <p className="text-[9px] text-text-secondary/60 dark:text-slate-600 font-bold uppercase tracking-widest leading-none">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "MP4, MOV (MAX 300MB)"}
                </p>
              </div>
            </div>
            {error && (
              <p className="mt-2 text-[9px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>
            )}
          </div>
        </section>

        {/* Style Selection */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-text-primary dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">{t.selectStyle}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`group flex items-start gap-4 p-4 rounded-2xl border text-left transition-all relative ${
                  selectedStyle === style.id 
                    ? "bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-500/10 -translate-y-1" 
                    : "bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-sm border border-border dark:border-white/[0.05] text-text-secondary hover:border-slate-300 dark:hover:border-white/10 hover:text-text-primary dark:hover:text-slate-300"
                }`}
              >
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  selectedStyle === style.id ? "bg-white/20" : "bg-slate-100 dark:bg-white/5 group-hover:bg-slate-200 dark:group-hover:bg-white/10"
                }`}>
                  <style.icon className={`w-4 h-4 ${
                    selectedStyle === style.id ? "text-white" : "text-slate-400 transition-colors group-hover:text-slate-300"
                  }`} />
                </div>
                <div className="space-y-1 pr-6">
                  <h4 className="text-[13px] font-black tracking-tight">
                    {style.title}
                  </h4>
                  <p className={`text-[10px] leading-relaxed font-bold uppercase tracking-widest line-clamp-2 ${
                    selectedStyle === style.id ? "text-blue-100" : "text-slate-600"
                  }`}>
                    {style.description}
                  </p>
                </div>
                {selectedStyle === style.id && (
                  <div className="absolute top-4 right-4">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Voiceover Settings */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-text-primary dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Music className="w-4 h-4 text-purple-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">{vt.headline}</h2>
          </div>

          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl flex flex-wrap gap-8">
            <div className="flex-1 space-y-3 min-w-[200px]">
              <label className="text-[10px] font-black text-text-primary dark:text-slate-500 uppercase tracking-[0.2em]">{vt.selectVoice}</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(vt.voices).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedVoice(key)}
                    className={`px-4 py-2 rounded-lg border text-[10px] font-black transition-all ${
                      selectedVoice === key 
                        ? "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20" 
                        : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                  >
                    {(label as string).split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Ratio Selection Section */}
        <section className="space-y-4">
          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Ratio Setting" : "Ratio Setting"}
                </label>
                <button 
                  onClick={() => setShowRatioSettings(true)}
                  className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-black"
                >
                  <Maximize className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-widest">{videoRatio} Setting</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Logo Customization Section */}
        <section className="space-y-4">
          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Upload Button */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Upload Logo" : "Upload Logo"}
                </label>
                <input 
                  type="file" 
                  ref={logoInputRef}
                  className="hidden" 
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                <button 
                  onClick={() => logoInputRef.current?.click()}
                  className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all ${
                    logoFile ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-500 dark:text-emerald-400" : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  <CloudUpload className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {logoFile ? "Logo Ready" : (lang === "EN" ? "Select Logo" : "Select Logo")}
                  </span>
                </button>
              </div>

              {/* Settings Toggle Button */}
              {logoFile && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                    {lang === "EN" ? "Overlay Adjust" : "Overlay Adjust"}
                  </label>
                  <button 
                    onClick={() => setShowLogoSettings(true)}
                    className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <Star className="w-4 h-4" />
                    {lang === "EN" ? "Logo Settings" : "Logo Settings"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Blur Subtitle Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-text-primary dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Sparkles className="w-4 h-4 text-red-400" />
            </div>
            <h2 className="text-lg font-black tracking-tight">{lang === "EN" ? "Blur" : "Blur"}</h2>
          </div>

          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Blur Overlay" : "Blur Overlay"}
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setBlurEnabled(!blurEnabled)}
                    className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all ${
                      blurEnabled ? "bg-red-600/20 border-red-500/30 text-red-500 dark:text-red-400" : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {blurEnabled ? (lang === "EN" ? "Blur Enabled" : "Blur Enabled") : (lang === "EN" ? "Enable Blur" : "Enable Blur")}
                    </span>
                  </button>

                  {blurEnabled && (
                    <button 
                      onClick={() => setShowBlurSettings(true)}
                      className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <Star className="w-4 h-4" />
                      {lang === "EN" ? "Blur Settings" : "Blur Settings"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Subtitle Customization Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-text-primary dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Subtitles className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="text-lg font-black tracking-tight">{lang === "EN" ? "Subtitle" : "Subtitle"}</h2>
          </div>

          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Subtitle" : "Subtitle"}
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSubtitleEnabled(!subtitleEnabled)}
                    className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all ${
                      subtitleEnabled ? "bg-cyan-600/20 border-cyan-500/30 text-cyan-500 dark:text-cyan-400" : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <Subtitles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {subtitleEnabled ? (lang === "EN" ? "Subtitle Enabled" : "Subtitle Enabled") : (lang === "EN" ? "Enable Subtitle" : "Enable Subtitle")}
                    </span>
                  </button>

                  {subtitleEnabled && (
                    <button 
                      onClick={() => setShowSubtitleSettings(true)}
                      className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <Star className="w-4 h-4" />
                      {lang === "EN" ? "Settings" : "Settings"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Freeze Frame Zoom Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-text-primary dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Maximize className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">
              {translations[lang].recapMaster.freezeFrameZoom}
            </h2>
          </div>

          <div className="bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-border dark:border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setFreezeFrameZoomEnabled(!freezeFrameZoomEnabled)}
                    className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all ${
                      freezeFrameZoomEnabled ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-500 dark:text-emerald-400" : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <Maximize className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {freezeFrameZoomEnabled ? (lang === "EN" ? "Freeze Zoom Enabled" : "Freeze Zoom Enabled") : (lang === "EN" ? "Enable Freeze Zoom" : "Enable Freeze Zoom")}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>



            {/* Video Ratio Modal */}
            <AnimatePresence>
              {showRatioSettings && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowRatioSettings(false)} />
                  
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="relative w-full max-w-5xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] md:max-h-[90vh]"
                  >
                    {/* Visual Preview Side */}
                    <div className="relative flex-none h-[220px] md:h-auto md:flex-1 bg-black flex items-center justify-center overflow-hidden p-4 md:p-12">
                      <motion.div 
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative shadow-2xl overflow-hidden flex items-center justify-center bg-slate-900 border border-white/10"
                        style={{
                          aspectRatio: videoRatio.replace(':', '/'),
                          maxHeight: '100%',
                          maxWidth: '100%',
                        }}
                      >
                        <div 
                          className="relative w-full h-full flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: bgColor }}
                        >
                          {file ? (
                            <>
                              {bgBlurEnabled && (
                                <video 
                                  src={URL.createObjectURL(file)} 
                                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-60 scale-110"
                                  autoPlay 
                                  muted 
                                  loop 
                                  playsInline
                                />
                              )}
                              <video 
                                src={URL.createObjectURL(file)} 
                                className="relative w-full h-full object-contain transition-transform duration-200"
                                style={{ 
                                  transform: `scale(${(videoScale || 100) / 100})`,
                                  clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`,
                                  filter: "contrast(115%) brightness(115%) saturate(125%)"
                                }}
                                autoPlay 
                                muted 
                                loop 
                                playsInline
                              />
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                               <Play className="w-12 h-12 text-white/5" />
                            </div>
                          )}
                        </div>
                        
                        {/* Overlay Grid for context */}
                        <div className="absolute inset-0 border border-emerald-500/20 pointer-events-none" />
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ background: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '10% 10%' }} />
                      </motion.div>

                      <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Active Frame: {videoRatio}</span>
                      </div>
                    </div>

                    {/* Controls Side */}
                    <div className="w-full md:w-80 p-4 md:p-5 flex flex-col gap-4 border-l border-white/5 bg-[#0f172a] flex-1 min-h-0">
                      
                      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">
                            {lang === "EN" ? "Aspect Ratio" : "Aspect Ratio"}
                          </label>
                          <div className="grid grid-cols-1 gap-1.5">
                            {[
                              { id: "16:9", label: "16:9 Landscape" },
                              { id: "9:16", label: "9:16 Portrait" },
                              { id: "1:1", label: "1:1 Square" },
                            ].map((ratio) => (
                              <button
                                key={ratio.id}
                                onClick={() => setVideoRatio(ratio.id)}
                                className={`px-4 py-2 rounded-lg border text-left transition-all ${
                                  videoRatio === ratio.id 
                                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                                    : "bg-white/5 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"
                                }`}
                              >
                                <div className="text-[10px] font-black uppercase tracking-wider">{ratio.label}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Content Scale" : "Content Scale"}
                            </label>
                            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{videoScale}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="100" 
                            max="200" 
                            value={videoScale} 
                            onChange={(e) => setVideoScale(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Crop Top" : "Crop Top"}
                            </label>
                            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{cropTop}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="50" 
                            value={cropTop} 
                            onChange={(e) => setCropTop(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Crop Bottom" : "Crop Bottom"}
                            </label>
                            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{cropBottom}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="50" 
                            value={cropBottom} 
                            onChange={(e) => setCropBottom(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Crop Left" : "Crop Left"}
                            </label>
                            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{cropLeft}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="50" 
                            value={cropLeft} 
                            onChange={(e) => setCropLeft(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Crop Right" : "Crop Right"}
                            </label>
                            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{cropRight}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="50" 
                            value={cropRight} 
                            onChange={(e) => setCropRight(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Background Color" : "Background Color"}
                            </label>
                            <input 
                              type="color" 
                              value={bgColor} 
                              onChange={(e) => setBgColor(e.target.value)}
                              className="w-8 h-5 bg-transparent border-none cursor-pointer rounded overflow-hidden"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Background Blur" : "Background Blur"}
                            </label>
                            <button 
                              onClick={() => setBgBlurEnabled(!bgBlurEnabled)}
                              className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-300 ${bgBlurEnabled ? 'bg-blue-500' : 'bg-white/10'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${bgBlurEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowRatioSettings(false)}
                        className="w-full h-14 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
                      >
                        {lang === "EN" ? "Apply Changes" : "Apply Changes"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logo Settings Modal */}
            <AnimatePresence>
              {logoFile && showLogoSettings && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowLogoSettings(false)} />
                  
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="relative w-full max-w-5xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] md:max-h-[90vh]"
                  >
                    {/* Visual Preview Side */}
                    <div className="relative flex-none h-[220px] md:h-auto md:flex-1 bg-black flex items-center justify-center overflow-hidden p-4 md:p-12">
                      <motion.div 
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative shadow-2xl overflow-hidden flex items-center justify-center bg-slate-900 border border-white/10"
                        style={{
                          aspectRatio: videoRatio.replace(':', '/'),
                          maxHeight: '100%',
                          maxWidth: '100%',
                        }}
                      >
                        <div 
                          className="relative w-full h-full flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: bgColor }}
                        >
                          {file ? (
                            <>
                              {bgBlurEnabled && (
                                <video 
                                  src={URL.createObjectURL(file)} 
                                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                                  autoPlay 
                                  muted 
                                  loop 
                                  playsInline
                                />
                              )}
                              <video 
                                src={URL.createObjectURL(file)} 
                                className="relative w-full h-full object-contain transition-transform duration-200"
                                style={{ 
                                  transform: `scale(${(videoScale || 100) / 100})`,
                                  clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`,
                                  filter: "contrast(115%) brightness(115%) saturate(125%)"
                                }}
                                autoPlay 
                                muted 
                                loop 
                                playsInline
                              />
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                               <Play className="w-12 h-12 text-white/5" />
                            </div>
                          )}
                        </div>

                        {/* The Actual Logo Preview Overlay */}
                        <div 
                          className="absolute transition-all duration-300 ease-out pointer-events-none"
                          style={{
                            width: `${logoSize}px`,
                            padding: '10px',
                            ...(logoPosition === 'top-left' && { top: 0, left: 0 }),
                            ...(logoPosition === 'top-right' && { top: 0, right: 0 }),
                            ...(logoPosition === 'bottom-left' && { bottom: 0, left: 0 }),
                            ...(logoPosition === 'bottom-right' && { bottom: 0, right: 0 }),
                          }}
                        >
                          <div className="w-full h-full border-2 border-emerald-500/50 rounded-lg shadow-2xl overflow-hidden flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm">
                            <img src={URL.createObjectURL(logoFile)} alt="Logo Preview" className="w-full h-full object-contain" />
                          </div>
                        </div>
                      </motion.div>

                      <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Logo Overlay (Ratio: {videoRatio})</span>
                      </div>
                    </div>

                    {/* Controls Side */}
                    <div className="w-full md:w-80 p-4 md:p-5 flex flex-col gap-4 border-l border-white/5 bg-[#0f172a] flex-1 min-h-0">
                      
                      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">
                            {lang === "EN" ? "Position" : "Position"}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "top-left", label: lang === "EN" ? "Top Left" : "Top Left" },
                              { id: "top-right", label: lang === "EN" ? "Top Right" : "Top Right" },
                              { id: "bottom-left", label: lang === "EN" ? "Bottom Left" : "Bottom Left" },
                              { id: "bottom-right", label: lang === "EN" ? "Bottom Right" : "Bottom Right" },
                            ].map((pos) => (
                              <button
                                key={pos.id}
                                onClick={() => setLogoPosition(pos.id)}
                                className={`px-4 py-2 rounded-lg border text-[10px] font-black transition-all ${
                                  logoPosition === pos.id 
                                    ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                                    : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300"
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Logo Scale" : "Logo Scale"}
                            </label>
                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{logoSize}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="30" 
                            max="300" 
                            value={logoSize} 
                            onChange={(e) => setLogoSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowLogoSettings(false)}
                        className="w-full h-14 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
                      >
                        {lang === "EN" ? "Save & Close" : "Save & Close"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Blur Settings Modal */}
            <AnimatePresence>
              {showBlurSettings && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowBlurSettings(false)} />
                  
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="relative w-full max-w-5xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] md:max-h-[90vh]"
                  >
                    {/* Visual Preview Side */}
                    <div className="relative flex-none h-[220px] md:h-auto md:flex-1 bg-black flex items-center justify-center overflow-hidden p-4 md:p-12">
                      <motion.div 
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative shadow-2xl overflow-hidden flex items-center justify-center bg-slate-900 border border-white/10"
                        style={{
                          aspectRatio: videoRatio.replace(':', '/'),
                          maxHeight: '100%',
                          maxWidth: '100%',
                        }}
                      >
                        <div 
                          className="relative w-full h-full flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: bgColor }}
                        >
                          {file ? (
                            <>
                              {bgBlurEnabled && (
                                <video 
                                  src={URL.createObjectURL(file)} 
                                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                                  autoPlay 
                                  muted 
                                  loop 
                                  playsInline
                                />
                              )}
                              <video 
                                src={URL.createObjectURL(file)} 
                                className="relative w-full h-full object-contain transition-transform duration-200"
                                style={{ 
                                  transform: `scale(${(videoScale || 100) / 100})`,
                                  clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`,
                                  filter: "contrast(115%) brightness(115%) saturate(125%)"
                                }}
                                autoPlay 
                                muted 
                                loop 
                                playsInline
                              />
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                               <Play className="w-12 h-12 text-white/5" />
                            </div>
                          )}
                        </div>

                        {/* Blur Overlay Preview */}
                        <div 
                          className="absolute bg-slate-900/40 backdrop-blur-3xl border-2 border-red-500/50 rounded-lg shadow-2xl overflow-hidden transition-all duration-150"
                          style={{
                            width: `${(blurWidth / 1000) * 100}%`,
                            height: `${(blurHeight / 1000) * 100}%`,
                            top: `${(blurY / 1000) * 100}%`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                          }}
                        >
                          <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-red-400 opacity-50" />
                          </div>
                        </div>
                      </motion.div>


                    </div>

                    {/* Controls Side */}
                    <div className="w-full md:w-80 p-4 md:p-5 flex flex-col gap-4 border-l border-white/5 bg-[#0f172a] flex-1 min-h-0">
                      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Blur Width" : "Blur Width"}
                            </label>
                            <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{blurWidth}</span>
                          </div>
                          <input 
                            type="range" 
                            min="100" 
                            max="1000" 
                            value={blurWidth} 
                            onChange={(e) => setBlurWidth(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Blur Height" : "Blur Height"}
                            </label>
                            <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{blurHeight}</span>
                          </div>
                          <input 
                            type="range" 
                            min="20" 
                            max="500" 
                            value={blurHeight} 
                            onChange={(e) => setBlurHeight(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Vertical Position" : "Vertical Position"}
                            </label>
                            <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{blurY}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="1000" 
                            value={blurY} 
                            onChange={(e) => setBlurY(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Blur Intensity" : "Blur Intensity"}
                            </label>
                             <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{blurIntensity}</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="50" 
                            value={blurIntensity} 
                            onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowBlurSettings(false)}
                        className="w-full h-14 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
                      >
                        {lang === "EN" ? "Apply Blur" : "Apply Blur"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtitle Settings Modal */}
            <AnimatePresence>
              {showSubtitleSettings && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                >
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowSubtitleSettings(false)} />
                  
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="relative w-full max-w-5xl bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] md:max-h-[90vh]"
                  >
                    {/* Visual Preview Side */}
                    <div className="relative flex-none h-[220px] md:h-auto md:flex-1 bg-black flex items-center justify-center overflow-hidden p-4 md:p-12">
                      <motion.div 
                        ref={previewRef}
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative shadow-2xl overflow-hidden flex items-center justify-center bg-slate-900 border border-white/10"
                        style={{
                          aspectRatio: videoRatio.replace(':', '/'),
                          maxHeight: '100%',
                          maxWidth: '100%'
                        }}
                      >
                        <div 
                          className="relative w-full h-full flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: bgColor }}
                        >
                          {file ? (
                            <>
                              {bgBlurEnabled && (
                                <video 
                                  src={URL.createObjectURL(file)} 
                                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                                  autoPlay 
                                  muted 
                                  loop 
                                  playsInline
                                />
                              )}
                              <video 
                                src={URL.createObjectURL(file)} 
                                className="relative w-full h-full object-contain transition-transform duration-200"
                                style={{ 
                                  transform: `scale(${(videoScale || 100) / 100})`,
                                  clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`,
                                  filter: "contrast(115%) brightness(115%) saturate(125%)"
                                }}
                                autoPlay 
                                muted 
                                loop 
                                playsInline
                              />
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                               <Play className="w-12 h-12 text-white/5" />
                            </div>
                          )}
                        </div>
                        
                        {/* Subtitle Preview Overlay */}
                        <div 
                          className="absolute px-2 pointer-events-none"
                          style={{
                            top: `${subtitleY}%`,
                            left: '50%',
                            transform: `translate(-50%, -${subtitleY}%)`,
                            width: '90%',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                          }}
                        >
                          <div 
                            className="backdrop-blur-md px-6 py-2 rounded-xl border border-white/10 text-center max-w-full"
                            style={{
                              backgroundColor: `${subtitleBoxColor}99`, // Approx 0.6 opacity
                              color: subtitleColor,
                              fontSize: `${Math.max(1, subtitleFontSize * 0.4) * Math.max(previewSize.w / 400, previewSize.h / 225)}px`,
                              fontFamily: subtitleFont,
                              lineHeight: '1.5'
                            }}
                          >
                             Better Centered Subtitles<br/>
                             Stable Alignment
                          </div>
                        </div>
                      </motion.div>

                      <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Subtitle Preview (Ratio: {videoRatio})</span>
                      </div>
                    </div>

                    {/* Controls Side */}
                    <div className="w-full md:w-80 p-4 md:p-5 flex flex-col gap-4 border-l border-white/5 bg-[#0f172a] flex-1 min-h-0">
                      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">
                            {lang === "EN" ? "Subtitle Color" : "Subtitle Color"}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {["#ffffff", "#FFEB3B", "#4CAF50", "#2196F3", "#F44336", "#E91E63"].map((color) => (
                              <button 
                                key={color}
                                onClick={() => setSubtitleColor(color)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${subtitleColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input 
                              type="color" 
                              value={subtitleColor}
                              onChange={(e) => setSubtitleColor(e.target.value)}
                              className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer p-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">
                            {lang === "EN" ? "Box Color" : "Box Color"}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {["#000000", "#1a1a1a", "#2c3e50", "#c0392b", "#27ae60", "#2980b9"].map((color) => (
                              <button 
                                key={color}
                                onClick={() => setSubtitleBoxColor(color)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${subtitleBoxColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            <input 
                              type="color" 
                              value={subtitleBoxColor}
                              onChange={(e) => setSubtitleBoxColor(e.target.value)}
                              className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer p-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Font Size" : "Font Size"}
                            </label>
                            <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">{subtitleFontSize}px</span>
                          </div>
                          <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={subtitleFontSize} 
                            onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Vertical Position" : "Vertical Position"}
                            </label>
                            <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">{subtitleY}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="5" 
                            max="95" 
                            value={subtitleY} 
                            onChange={(e) => setSubtitleY(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">
                            {lang === "EN" ? "Font Family" : "Font Family"}
                          </label>
                          <div className="relative">
                            <select
                              value={subtitleFont}
                              onChange={(e) => setSubtitleFont(e.target.value)}
                              className="w-full px-4 py-4 rounded-xl border bg-white/5 border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer transition-all font-medium text-sm"
                              style={{ fontFamily: subtitleFont }}
                            >
                              {["Padauk", "Myanmar Sagar", "YoeYar-One Bold", "Tharlon", "Myanmar Gant Gaw", "Myanmar Khway", "Myanmar Pauklay", "Yunghkio", "Inter", "Arial", "Roboto", "Georgia", "Courier New"].map((f) => (
                                <option key={f} value={f} style={{ fontFamily: f }} className="bg-slate-900 text-white">
                                  {f}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowSubtitleSettings(false)}
                        className="w-full h-14 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
                      >
                        {lang === "EN" ? "Apply Subtitles" : "Apply Subtitles"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>


        {/* Action Button */}
        {!showLogoSettings && !showRatioSettings && !showBlurSettings && (() => {
          const isAnyGenerating = isGenerating || isVoiceoverGenerating || isMerging;
          const getButtonText = () => {
            if (generationPhase === "merge" || isMerging) {
              return lang === "EN" ? "Generating Final Video..." : "Final Videoထုတ်နေသည်...";
            }
            if (generationPhase === "recap") {
              return lang === "EN" ? "Generating Recap Script..." : "Recap စာသားထုတ်နေသည်...";
            }
            if (generationPhase === "voiceover" || isVoiceoverGenerating) {
              return lang === "EN" ? "Generating Neural Voice..." : "အသံထုတ်နေသည်...";
            }
            if (isGenerating) {
              return lang === "EN" ? "SYNCING..." : "ထုတ်လုပ်နေသည်...";
            }
            return `${t.generate} (${requiredCost} Dia)`;
          };
          
          return (
            <div className="flex justify-center pt-4">
              <button 
                onClick={handleGenerate}
                disabled={!file || isAnyGenerating}
                className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-4 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
                  !file 
                    ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                    : isAnyGenerating
                      ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30 cursor-not-allowed animate-pulse"
                      : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white cursor-pointer"
                }`}
              >
                 <div className="flex items-center gap-3">
                  {isAnyGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <DiamondIcon className="w-6 h-6 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
                  )}
                  {getButtonText()}
                 </div>
              </button>
            </div>
          );
        })()}

        {/* Result Section */}
        <AnimatePresence>
          {result && (
            <motion.section 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-8"
            >
              {/* Audio and merged video result if ready */}
              {mergedVideoUrl && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center pt-4"
                >
                  <a 
                    href={mergedVideoUrl} 
                    download="recap_master_final.mp4"
                    className="w-full sm:w-auto h-14 px-10 bg-green-600 hover:bg-green-700 text-white rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-green-500/30 active:scale-95 cursor-pointer"
                  >
                    <CloudUpload className="w-5 h-5" />
                    {t.downloadMerged}
                  </a>
                </motion.div>
              )}




            </motion.section>
          )}
        </AnimatePresence>

        {/* History Section */}
        <div className="pt-12 border-t border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-blue-500" />
              <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                {lang === "EN" ? "Recap History" : "Recap History"}
              </h2>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(lang === "EN" ? "Are you sure you want to clear all history?" : "Are you sure you want to clear all history?")) {
                    const userKey = user?.uid || "guest";
                    setHistory([]);
                    localStorage.removeItem(`recap_history_${userKey}`);
                    setCurrentHistoryId(null);
                  }
                }}
                className="text-[10px] text-red-500 hover:text-red-400 font-black tracking-widest uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === "EN" ? "CLEAR ALL" : "CLEAR ALL"}
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center p-8 bg-white/5 border border-dashed border-white/10 rounded-2xl">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {lang === "EN" 
                  ? "No creations logged yet. Begin syncing to save logs!" 
                  : "No creations logged yet. Begin syncing to save logs!"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {(() => {
                  const handleRestoreHistory = (histItem: HistoryItem) => {
                    setResult(histItem.recapResult);
                    setVoiceoverAudioUrl(histItem.voiceoverAudioUrl || null);
                    setMergedVideoUrl(histItem.mergedVideoUrl || null);
                    setCurrentHistoryId(histItem.id);
                    setSelectedStyle(histItem.style);
                    
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  };

                  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
                    e.stopPropagation();
                    const userKey = user?.uid || "guest";
                    setHistory(prev => {
                      const updated = prev.filter(item => item.id !== id);
                      localStorage.setItem(`recap_history_${userKey}`, JSON.stringify(updated));
                      return updated;
                    });
                    if (id === currentHistoryId) {
                      setCurrentHistoryId(null);
                    }
                  };

                  const displayedHistory = showAllHistory ? history : history.slice(0, 5);

                  return displayedHistory.map((item) => {
                    const styleObj = styles.find(s => s.id === item.style);
                    const styleLabel = styleObj?.title || item.style;
                    return (
                      <HistoryCard 
                        key={item.id} 
                        item={item} 
                        styleLabel={styleLabel} 
                        lang={lang} 
                        onRestore={() => handleRestoreHistory(item)}
                        onDelete={(e) => deleteHistoryItem(item.id, e)}
                      />
                    );
                  });
                })()}
              </div>

              {history.length > 5 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="px-6 h-11 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-blue-400 hover:text-blue-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {showAllHistory ? "See Less" : "See More"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginView({ lang, onCancel }: { lang: Language; onCancel?: () => void }) {
  const t = translations[lang].nav;
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error("Login failed:", error);
      setError(error.message || "Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[340px] bg-[#0E1524] border border-white/[0.08] rounded-3xl p-8 text-center shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      >
        <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Clapperboard className="w-7 h-7" />
        </div>
        
        <h1 className="text-2xl font-black tracking-tight text-white mb-2">MM RECAP</h1>
        <p className="text-[10px] font-semibold tracking-[0.15em] text-purple-400 uppercase mb-6">
          Access Denied - Login Required
        </p>
        
        <div className="space-y-2.5">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-[#6D3DF3] hover:from-purple-700 hover:to-indigo-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] border border-purple-500/20"
          >
            {isLoggingIn ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isLoggingIn ? "Authenticating..." : "CONTINUE WITH GOOGLE"}
          </button>

          {error && (
            <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full h-10 text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
          )}
        </div>
        
        <p className="mt-5 text-[9px] text-slate-400 font-medium uppercase tracking-wide leading-relaxed max-w-[280px] mx-auto">
          Please sign in with a Google Account to use MM Recap.
        </p>
      </motion.div>
    </div>
  );
}

function PremiumModal({ lang, onClose }: { lang: Language; onClose: () => void }) {
  const isMM = lang === "MY";
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[#0a0a0a] border border-amber-500/40 rounded-[2.5rem] p-8 md:p-10 max-w-sm w-full shadow-[0_0_60px_rgba(245,158,11,0.2)] relative overflow-hidden group font-sans"
      >
        {/* Animated Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/20 blur-[80px] rounded-full animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-600/10 blur-[80px] rounded-full animate-pulse delay-700" />
        
        <div className="relative z-10 text-center space-y-6">
          <div className="inline-flex p-4 rounded-[1.5rem] bg-linear-to-br from-amber-400 to-amber-600 text-black shadow-2xl shadow-amber-500/40 mb-1 rotate-12 group-hover:rotate-0 transition-transform duration-500">
            <Lock size={32} strokeWidth={2.5} />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic leading-tight">
              {isMM ? "PREMIUM များအတွက်သာ" : "PREMIUM ONLY"}
            </h2>
            <p className="text-zinc-400 font-medium text-sm leading-relaxed px-2">
              {isMM 
                ? "ဤကိရိယာသည် Premium များအတွက်သာ သီးသန့်ဖြစ်ပါသည်။ ကျေးဇူးပြု၍ Premium အဖြစ်မြှင့်တင်ရန် " 
                : "This tool is exclusive to Premium members. To unlock this feature, please contact "}
              <span className="text-amber-400 font-black">Telegram @akhptn</span>
              {isMM ? " ကိုဆက်သွယ်ပါ။" : " via Telegram."}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <motion.a 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="https://t.me/akhptn" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-amber-500/30 flex items-center justify-center gap-2 transition-all"
            >
              Contact @akhptn
              <ArrowRight size={16} />
            </motion.a>
            <button 
              onClick={onClose}
              className="w-full py-4 rounded-xl bg-white/5 text-zinc-500 font-black text-[10px] uppercase tracking-[0.25em] hover:bg-white/10 hover:text-white transition-all border border-transparent hover:border-white/10"
            >
              {isMM ? "ပြန်ထွက်မည်" : "Go Back"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const faqData = {
  EN: [
    {
      q: "Are there any video file size limits?",
      a: "Yes, currently we support MP4 and MOV video files of up to 300MB."
    },
    {
      q: "How can I download subtitle (.SRT) files?",
      a: "After processing your video in the Video Transcribe section, a download button will appear allowing you to export the time-synced .SRT file directly."
    },
    {
      q: "Can I receive the AI Recap in different styles?",
      a: "Yes! You can choose from 9 custom styles including Step-by-Step, Funny Commentary, and Epic Exaggerated to match your video's niche."
    },
    {
      q: "Can I use my own API Key?",
      a: "Absolutely. Under API Settings, select 'Own API Key' and enter your own Gemini API Key to continue processing."
    }
  ],
  MY: [
    {
      q: "Are there any video file size limits?",
      a: "Yes, currently we support MP4 and MOV video files of up to 300MB."
    },
    {
      q: "How can I download subtitle (.SRT) files?",
      a: "After processing your video in the Video Transcribe section, a download button will appear allowing you to export the time-synced .SRT file directly."
    },
    {
      q: "Can I receive the AI Recap in different styles?",
      a: "Yes! You can choose from 9 custom styles including Step-by-Step, Funny Commentary, and Epic Exaggerated to match your video's niche."
    },
    {
      q: "Can I use my own API Key?",
      a: "Absolutely. Under API Settings, select 'Own API Key' and enter your own Gemini API Key to continue processing."
    }
  ]
};

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      className="py-4.5 border-b border-slate-200 dark:border-white/[0.08] cursor-pointer transition-colors duration-75 select-none group bg-transparent text-left"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {faq.q}
        </h3>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.05 }}
          className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-75"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 10 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.05 }}
            className="overflow-hidden"
          >
            <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-sans mt-0.5">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppContent() {
  const { user, loading, role, diamonds } = useFirebase();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [intendedToolId, setIntendedToolId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("MY");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (!saved) {
        return true;
      }
      return saved !== 'light';
    }
    return true;
  });
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handler = () => {
      const currentDark = document.documentElement.classList.contains('dark');
      if (currentDark !== darkMode) {
        setDarkMode(currentDark);
      }
    };
    window.addEventListener('theme-changed', handler);
    return () => window.removeEventListener('theme-changed', handler);
  }, [darkMode]);

  const TOOL_PATHS: Record<string, string> = {
    "recap-master": "recapmaster",
    "video-recapper": "videorecapper",
    "ai-voiceover": "voiceover",
    "video-transcribe": "transcribe",
    "videotosrt": "videotosrt",
    "aivideovoiceactor": "aivideovoiceactor",
  };

  useEffect(() => {
    if (user && intendedToolId && !loading) {
      if (intendedToolId === 'admin') {
        navigate('/admin');
      } else {
        const path = TOOL_PATHS[intendedToolId] || intendedToolId;
        navigate(`/${path}`);
      }
      setIntendedToolId(null);
      setShowLoginPrompt(false);
    }
  }, [user, intendedToolId, loading, role, navigate]);

  const tNav = translations[lang].nav;
  const tools = getTools(lang);

  const handleToolClick = (toolId: string) => {
    if (toolId === "subtitle-editor") {
      const isAdmin = user && (role === 'admin' || user.email?.toLowerCase() === 'uploadadd.com@gmail.com');
      if (!isAdmin) {
        alert("Update လုပ်နေသောကြောင့် သုံးလို့မရသေးပါ");
        return;
      }
    }

    if (!user) {
      setIntendedToolId(toolId);
      setShowLoginPrompt(true);
      return;
    }
    
    const path = TOOL_PATHS[toolId] || toolId;
    navigate(`/${path}`);
  };

  const handleAdminClick = () => {
    if (!user) {
      setIntendedToolId('admin');
      setShowLoginPrompt(true);
      return;
    }
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user && (role === 'admin' || user.email?.toLowerCase() === 'uploadadd.com@gmail.com');

  return (
    <div className="min-h-screen bg-page-bg selection:bg-cyan-500/30">
      <AnimatePresence>
        {showLoginPrompt && !user && (
          <LoginView lang={lang} onCancel={() => setShowLoginPrompt(false)} />
        )}
      </AnimatePresence>

      <div style={{ display: location.pathname === '/recapmaster' ? 'block' : 'none' }}>
        <RecapMasterView 
          onBack={() => navigate('/')} 
          lang={lang}
          setLang={setLang}
          onAdminClick={handleAdminClick}
        />
      </div>

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/admin" element={
            isAdmin ? (
              !isAdminVerified ? (
                <AdminSecondaryLoginView 
                  onSuccess={() => setIsAdminVerified(true)} 
                  onBack={() => navigate('/')} 
                  lang={lang} 
                />
              ) : (
                <motion.div
                  key="admin-dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.05 }}
                >
                  <AdminDashboard onBack={() => navigate('/')} />
                </motion.div>
              )
            ) : (
              <AccessDeniedView onBack={() => navigate('/')} lang={lang} />
            )
          } />
          
          <Route path="/recapmaster" element={
            <div className="min-h-screen" />
          } />

          <Route path="/videorecapper" element={
            <motion.div
              key="video-recapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
            >
              <VideoRecapperView 
                onBack={() => navigate('/')} 
                lang={lang}
                setLang={setLang}
                onAdminClick={handleAdminClick}
              />
            </motion.div>
          } />

          <Route path="/aivoiceover" element={
            <motion.div
              key="ai-voiceover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
            >
              <VoiceoverView 
                onBack={() => navigate('/')} 
                lang={lang}
                setLang={setLang}
                onAdminClick={handleAdminClick}
              />
            </motion.div>
          } />

          <Route path="/videotranscribe" element={
            <motion.div
              key="video-transcribe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
            >
              <TranscribeView 
                onBack={() => navigate('/')} 
                lang={lang}
                setLang={setLang}
                onAdminClick={handleAdminClick}
              />
            </motion.div>
          } />

          <Route path="/videotosrt" element={
            <motion.div
              key="video-to-srt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
            >
              <VideoToSrtView 
                onBack={() => navigate('/')} 
                lang={lang}
                setLang={setLang}
                onAdminClick={handleAdminClick}
              />
            </motion.div>
          } />

          <Route path="/aivideovoiceactor" element={
            <motion.div
              key="ai-video-voice-actor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
            >
              <AIVideoVoiceActorView 
                onBack={() => navigate('/')} 
                lang={lang}
                setLang={setLang}
                onAdminClick={handleAdminClick}
              />
            </motion.div>
          } />

          <Route path="/" element={
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05 }}
              id="lumina-portal"
              className="text-text-secondary relative overflow-hidden"
            >
              <div className="hero-glow animate-pulse" />
              <div className="absolute inset-0 noise-overlay" />
              
              {/* Header */}
              <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-page-bg/40 backdrop-blur-3xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                  <div className="flex items-center gap-12">
                    <div className="flex items-center gap-3 group cursor-pointer transition-all hover:opacity-80" onClick={() => navigate('/')}>
                      <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] via-[#6D3DF3] to-[#4F46E5] rounded-xl flex items-center justify-center shadow-2xl shadow-purple-500/30 group-hover:scale-105 group-hover:rotate-6 transition-all duration-500">
                        <Clapperboard className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex flex-col -gap-1">
                        <span className="text-2xl font-black tracking-tighter text-text-primary dark:text-white leading-none">MM RECAP</span>
                        <span className="text-[7.5px] font-tech font-black tracking-[0.25em] text-purple-400 uppercase ml-1 block mt-0.5">One Click Ai Tool</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <button 
                      onClick={() => {
                        if (location.pathname === '/') {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                          navigate('/');
                        }
                      }}
                      className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer hidden sm:block"
                    >
                      Home
                    </button>
                    <button 
                      onClick={() => {
                        if (location.pathname === '/') {
                          document.getElementById('workspace-tools')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          navigate('/');
                          setTimeout(() => {
                            document.getElementById('workspace-tools')?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }
                      }}
                      className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer hidden sm:block"
                    >
                      Tool
                    </button>
                    <button 
                      onClick={() => {
                        if (location.pathname === '/') {
                          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          navigate('/');
                          setTimeout(() => {
                            document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                          }, 150);
                        }
                      }}
                      className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer hidden sm:block"
                    >
                      Pricing
                    </button>
                    <UserHeader onAdminClick={handleAdminClick} />
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="pt-32 pb-32 px-6 max-w-7xl mx-auto relative z-10 flex flex-col items-center">
                {/* Hero section resembling the first mockup */}
                <div className="w-full max-w-4xl mx-auto text-center mt-8 mb-20">
                  {/* Glowing Badge resembling 'NEW Latest integration' */}
                   <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#120D1E]/90 border border-[#6D3DF3]/30 mb-8 shadow-[0_0_20px_rgba(109,61,243,0.15)]"
                  >
                    <span className="text-[9px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full font-tech tracking-wider uppercase">NEW</span>
                    <span className="text-[10px] text-purple-300 font-medium tracking-wide">Latest Integration</span>
                  </motion.div>

                  {/* High impact display typography headline */}
                  <motion.h1 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-4xl sm:text-5.5xl md:text-6.5xl lg:text-7xl font-sans font-black text-center text-white tracking-tight leading-[1.08] mb-8"
                  >
                    Boost your <br />
                    <span className="bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">content with AI.</span>
                  </motion.h1>

                  {/* Elegant professional subtitle */}
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm sm:text-base md:text-lg text-slate-400 text-center max-w-2xl mx-auto mb-10 leading-relaxed font-sans px-4"
                  >
                    Elevate your video's reach effortlessly with AI, where smart technology meets user-friendly translation & transcription tools.
                  </motion.p>

                  {/* Call to action start button */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="flex justify-center mb-16"
                  >
                    <button 
                      onClick={() => document.getElementById('workspace-tools')?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-8 py-3.5 bg-white hover:bg-slate-100 text-slate-950 text-sm font-black rounded-lg transition-all shadow-[0_4px_30px_rgba(255,255,255,0.2)] hover:scale-[1.03] active:scale-[0.98] duration-200"
                    >
                      Start For Free
                    </button>
                  </motion.div>

                  {/* Realistic screen/workspace mockup card with backdrop glow */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="relative max-w-3.5xl mx-auto group"
                  >
                    {/* Glowing Purple lens flare background behind the window */}
                    <div className="absolute -inset-10 bg-purple-600/10 rounded-[3rem] blur-3xl pointer-events-none group-hover:bg-purple-600/15 transition-all duration-700" />
                    
                    <div className="relative border border-white/[0.08] bg-[#0A0713]/90 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-3xl">
                      {/* Window header */}
                      <div className="flex items-center justify-between px-5 h-11 border-b border-white/[0.05] bg-white/[0.01]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                          <span className="text-[9px] text-slate-500 font-mono ml-3">workspace.io/mmrecap</span>
                        </div>
                        <div className="w-32 h-4.5 rounded bg-white/[0.02] border border-white/[0.05]" />
                      </div>
                      
                      {/* Window contents */}
                      <div className="grid grid-cols-4 text-left">
                        {/* Sidebar Mock */}
                        <div className="col-span-1 border-r border-white/[0.05] bg-white/[0.01] p-4 hidden sm:block space-y-4">
                          <div className="h-3 w-4/5 rounded bg-white/[0.06]" />
                          <div className="space-y-2 pt-3 border-t border-white/[0.03]">
                            <div className="h-2.5 w-11/12 rounded bg-purple-500/20 border border-purple-500/20" />
                            <div className="h-2.5 w-4/5 rounded bg-white/[0.02]" />
                            <div className="h-2.5 w-5/6 rounded bg-white/[0.02]" />
                            <div className="h-2.5 w-3/4 rounded bg-white/[0.02]" />
                          </div>
                        </div>
                        
                        {/* Work Area Mock */}
                        <div className="col-span-4 sm:col-span-3 p-5 space-y-5">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="h-3.5 w-24 rounded bg-white/[0.08]" />
                              <div className="h-2.5 w-14 rounded bg-white/[0.03]" />
                            </div>
                            <div className="h-5.5 w-16 rounded bg-white/[0.04] border border-white/[0.04]" />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl space-y-1.5">
                              <div className="h-2.5 w-12 rounded bg-slate-500/30" />
                              <div className="h-5 w-16 rounded bg-white/[0.08]" />
                              <div className="h-2 w-10 rounded bg-green-500/20" />
                            </div>
                            <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl space-y-1.5">
                              <div className="h-2.5 w-16 rounded bg-slate-500/30" />
                              <div className="h-5 w-20 rounded bg-white/[0.08]" />
                              <div className="h-2 w-12 rounded bg-red-500/20" />
                            </div>
                          </div>
                          
                          {/* Sparkline simulation graph */}
                          <div className="h-20 bg-white/[0.005] border border-white/[0.04] rounded-xl flex items-end px-3 py-1.5 relative overflow-hidden">
                            <div className="absolute top-3 left-3"><div className="h-2.5 w-14 rounded bg-white/[0.03]" /></div>
                            <svg className="w-full h-12 text-purple-500/35" viewBox="0 0 100 20" preserveAspectRatio="none">
                              <path d="M0,15 Q15,4 30,12 T60,5 T90,14 T100,10" fill="none" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M0,15 Q15,4 30,12 T60,5 T90,14 T100,10 L100,20 L0,20 Z" fill="rgba(147, 51, 234, 0.03)" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Second Section: Workspace Tools */}
                <div id="workspace-tools" className="w-full max-w-4xl pt-12 scroll-mt-24">
                  {/* Title of tools resembling second mockup */}
                  <div className="text-center mb-10">
                    <h2 className="text-sm font-black tracking-[0.2em] font-tech text-slate-500 uppercase">
                      Select an AI Tool to Begin
                    </h2>
                  </div>

                  {/* Grid of Tools, designed exactly like the second mockup */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tools.map((tool, index) => {
                      return (
                        <motion.div
                          key={tool.id}
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.15, delay: index * 0.015 }}
                          className="group bg-white hover:bg-slate-50/80 dark:bg-[#0A0713]/60 dark:hover:bg-[#120E1F]/90 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 rounded-2xl p-6.5 flex items-center justify-between gap-4 transition-all duration-300 cursor-pointer shadow-lg active:scale-98 select-none"
                          onClick={() => handleToolClick(tool.id)}
                        >
                          <div className="flex items-center gap-4.5">
                            {/* Simple dynamic icon styling */}
                            <div className={`w-11 h-11 rounded-xl ${tool.color} flex items-center justify-center border border-white/10 shadow-md group-hover:scale-105 transition-all text-white`}>
                              <tool.icon className={`w-5 h-5 ${tool.iconColor || 'text-white'}`} />
                            </div>
                            <div className="space-y-0.5">
                              <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-all uppercase tracking-wide">
                                {tool.title}
                              </h3>
                              {tool.badge && (
                                <span className={`inline-block text-[8px] font-black ${
                                  tool.badge === 'PRO' 
                                    ? 'text-amber-400 border border-amber-500/30 bg-amber-500/10' 
                                    : tool.badge === 'FREE'
                                      ? 'text-emerald-400 border border-emerald-500/30 bg-emerald-500/10'
                                      : 'text-blue-400 border border-blue-500/30 bg-blue-500/10'
                                } px-1.5 py-0.5 rounded font-tech tracking-wider uppercase`}>
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="w-7 h-7 bg-slate-100 group-hover:bg-purple-100 dark:bg-white/[0.03] dark:group-hover:bg-[#6D3DF3]/20 border border-slate-200 dark:border-white/[0.05] rounded-lg flex items-center justify-center text-slate-400 group-hover:text-purple-600 dark:group-hover:text-white transition-all">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Our Goal & FAQ Sections */}
                <div className="mt-20 pt-16 border-t border-slate-200 dark:border-white/[0.05] w-full max-w-4xl px-4 md:px-0 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-start text-left">
                  {/* Our Goal Section */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.15 }}
                    className="relative flex flex-col justify-between group h-full space-y-6"
                  >
                    <div className="space-y-5 relative z-10">
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Our Goal
                      </h2>
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-sans font-medium">
                        To solve video editing, translation, and subtitling workflows for Myanmar Content Creators in seconds using AI technology, providing the easiest and most time-saving solution.
                      </p>
                    </div>
                    
                    <div className="mt-6 relative z-10 inline-flex px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black font-tech text-[10px] uppercase tracking-widest leading-none text-center shadow-[0_4px_15px_rgba(109,61,243,0.25)] transition-all duration-300 border border-white/10 self-start">
                      INNOVATE
                    </div>
                  </motion.div>

                  {/* FAQs Section */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.15 }}
                    className="space-y-6 lg:pl-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                           Frequently Asked Questions (FAQs)
                        </h2>
                      </div>

                      <div className="space-y-4">
                        {faqData[lang].map((faq, index) => (
                          <FAQItem key={index} faq={faq} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Pricing Section */}
                <div id="pricing" className="mt-24 pt-16 border-t border-slate-200 dark:border-white/[0.05] w-full max-w-4xl scroll-mt-24 text-left">
                  <div className="space-y-2 mb-12 text-center">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                      Premium Diamond Packages
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-sans mx-auto">
                      Get more diamonds to unlock advanced features, generate epic voiceovers, and transcribe videos instantly.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Tier 1 */}
                    <motion.div 
                      whileHover={{ y: -5 }}
                      className="relative overflow-hidden bg-white dark:bg-[#0A0713]/40 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-md"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 font-tech">Starter</span>
                          <span className="text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 rounded-full text-slate-600 dark:text-slate-400 font-tech uppercase">Popular</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-900 dark:text-white">30,000</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">MMK</span>
                        </div>
                        <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span><strong>200</strong> Diamonds</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            <span>Full Tool Suite Access</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            <span>Lifetime Support</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            <span>1-min Recap Video = 6 Diamonds (Includes all AI tools)</span>
                          </div>
                        </div>
                      </div>
                      <a 
                        href="https://t.me/akhptn" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-8 py-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-white/[0.03] dark:hover:bg-[#6D3DF3]/20 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-black text-[10px] uppercase tracking-widest text-center transition-all shadow-xs"
                      >
                        Purchase Now
                      </a>
                    </motion.div>

                    {/* Tier 2 */}
                    <motion.div 
                      whileHover={{ y: -5 }}
                      className="relative overflow-hidden bg-slate-50/80 dark:bg-[#0A0713]/80 border border-purple-500/50 dark:border-[#6D3DF3]/40 hover:border-purple-600 dark:hover:border-[#6D3DF3] rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg shadow-purple-500/5 dark:shadow-[0_0_30px_rgba(109,61,243,0.1)]"
                    >
                      <div className="absolute top-0 right-0">
                        <span className="text-[8px] bg-[#6D3DF3] text-white font-black uppercase px-3 py-1 rounded-bl-xl tracking-widest">Best Value</span>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 font-tech">Premium</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-900 dark:text-white">50,000</span>
                          <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">MMK</span>
                        </div>
                        <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-white/[0.05]">
                          <div className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse" />
                            <span><strong>400</strong> Diamonds</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span>Priority Server Access</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span>Full Tool Suite Access</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span>1-min Recap Video = 6 Diamonds (Includes all AI tools)</span>
                          </div>
                        </div>
                      </div>
                      <a 
                        href="https://t.me/akhptn" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-8 py-3 rounded-xl bg-[#6D3DF3] hover:bg-[#5B30D6] text-white font-black text-[10px] uppercase tracking-widest text-center transition-all shadow-lg shadow-[#6D3DF3]/25 border border-white/10"
                      >
                        Purchase Now
                      </a>
                    </motion.div>

                    {/* Tier 3 */}
                    <motion.div 
                      whileHover={{ y: -5 }}
                      className="relative overflow-hidden bg-white dark:bg-[#0A0713]/40 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-md"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 font-tech">Elite</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-900 dark:text-white">70,000</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">MMK</span>
                        </div>
                        <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span><strong>600</strong> Diamonds</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            <span>VIP Support line</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            <span>Full Tool Suite Access</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                            <span>1-min Recap Video = 6 Diamonds (Includes all AI tools)</span>
                          </div>
                        </div>
                      </div>
                      <a 
                        href="https://t.me/akhptn" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-8 py-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-white/[0.03] dark:hover:bg-[#6D3DF3]/20 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-black text-[10px] uppercase tracking-widest text-center transition-all shadow-xs"
                      >
                        Purchase Now
                      </a>
                    </motion.div>
                  </div>
                </div>

                {/* Why Choose MM Recap? Section */}
                <div className="mt-24 pt-16 border-t border-slate-200 dark:border-white/[0.05] w-full max-w-4xl text-left">
                  <div className="space-y-2 mb-12 text-center">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                      Why Choose MM Recap?
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1 */}
                    <div className="p-6 bg-white dark:bg-[#0A0713]/40 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 rounded-2xl flex flex-col justify-between transition-all duration-300 group shadow-md hover:shadow-lg">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-650 dark:text-purple-400 font-tech">Myanmar-Optimized AI</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans font-medium">
                          A localized AI system that deeply understands Myanmar spoken pronunciation, dialects, and cultural nuances.
                        </p>
                      </div>
                    </div>

                    {/* Card 2 */}
                    <div className="p-6 bg-white dark:bg-[#0A0713]/40 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 rounded-2xl flex flex-col justify-between transition-all duration-300 group shadow-md hover:shadow-lg">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-650 dark:text-purple-400 font-tech">Lightning-Fast Speed</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans font-medium">
                          Generate high-quality video summaries, voiceovers, and subtitles in seconds instead of waiting for hours.
                        </p>
                      </div>
                    </div>

                    {/* Card 3 */}
                    <div className="p-6 bg-white dark:bg-[#0A0713]/40 border border-slate-200 dark:border-white/[0.05] hover:border-purple-500/30 dark:hover:border-[#6D3DF3]/30 rounded-2xl flex flex-col justify-between transition-all duration-300 group shadow-md hover:shadow-lg">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase tracking-wider text-purple-650 dark:text-purple-400 font-tech">All-in-One Workflow</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans font-medium">
                          Seamlessly handle your video summarizing, transcribing, and localized voiceover processes in a single unified workspace.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </main>

              {/* Subtle floating elements */}
              <div className="fixed top-1/4 -left-20 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
              <div className="fixed bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

              {/* Footer / Meta Data */}
              <footer className="fixed bottom-0 left-0 right-0 h-16 border-t border-white/[0.03] bg-page-bg/40 backdrop-blur-xl z-50 flex items-center justify-center pointer-events-none md:pointer-events-auto">
                <span className="text-[10px] font-tech font-black text-text-primary dark:text-slate-600 tracking-[0.3em] uppercase">© 2026 MM RECAP</span>
              </footer>
            </motion.div>
          } />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppContent />
  );
}
