/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ArrowRight,
  ArrowLeft,
  Bell, 
  Camera, 
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
  Lock
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { translations, Language } from "./translations";
import Markdown from "react-markdown";
import { useFirebase } from "./components/FirebaseProvider";
import { loginWithGoogle, logout } from "./lib/firebase";
import { DiamondIcon } from "./components/DiamondIcon";
import { AdminDashboard } from "./components/AdminDashboard";

// Internal API Helpers to replace GeminiService.ts
const api = {
  async recap(videoBase64: string, mimeType: string, style: string, lang: Language, duration?: number, apiKey?: string) {
    const res = await fetch("/api/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64, mimeType, style, lang, duration, apiKey }),
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
    color: "bg-red-500",
    iconColor: "text-white",
    borderColor: "border-red-500/20 hover:border-red-500/50",
    shadowColor: "shadow-red-500/20",
  },
  {
    id: "videorecapper",
    title: translations[lang].tools.videoRecapper.title,
    description: translations[lang].tools.videoRecapper.desc,
    icon: Play,
    color: "bg-blue-500",
    iconColor: "text-white",
    borderColor: "border-blue-500/20 hover:border-blue-500/50",
    shadowColor: "shadow-blue-500/20",
    badge: "NEW"
  },
  {
    id: "video-recap",
    title: translations[lang].tools.videoRecap.title,
    description: translations[lang].tools.videoRecap.desc,
    icon: Camera,
    color: "bg-purple-500",
    iconColor: "text-white",
    borderColor: "border-purple-500/20 hover:border-purple-500/50",
    shadowColor: "shadow-purple-500/20"
  },
  {
    id: "subtitle-editor",
    title: translations[lang].tools.subtitleEditor.title,
    description: translations[lang].tools.subtitleEditor.desc,
    icon: Subtitles,
    color: "bg-cyan-500",
    iconColor: "text-white",
    borderColor: "border-cyan-500/20 hover:border-cyan-500/50",
    shadowColor: "shadow-cyan-500/20",
  },
  {
    id: "auto-recap",
    title: translations[lang].tools.autoRecap.title,
    description: translations[lang].tools.autoRecap.desc,
    icon: Star,
    color: "bg-indigo-500",
    iconColor: "text-white",
    borderColor: "border-indigo-500/20 hover:border-indigo-500/50",
    shadowColor: "shadow-indigo-500/20",
    badge: "NEW"
  },
  {
    id: "videotranscribe",
    title: translations[lang].tools.videoTranscribe.title,
    description: translations[lang].tools.videoTranscribe.desc,
    icon: Type,
    color: "bg-teal-500",
    iconColor: "text-white",
    borderColor: "border-teal-500/20 hover:border-teal-500/50",
    shadowColor: "shadow-teal-500/20",
    badge: "NEW"
  },
  {
    id: "aivoiceover",
    title: translations[lang].tools.aiVoiceover.title,
    description: translations[lang].tools.aiVoiceover.desc,
    icon: Music,
    color: "bg-amber-500",
    iconColor: "text-white",
    borderColor: "border-amber-500/20 hover:border-amber-500/50",
    shadowColor: "shadow-amber-500/20"
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

  if (!user) {
    return (
      <button 
        onClick={handleLogin}
        disabled={isLoggingIn}
        className="flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20"
      >
        {isLoggingIn ? (
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <LogIn className="w-3.5 h-3.5" />
        )}
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end text-right">
        <span className="hidden md:block text-[10px] font-black text-text-primary dark:text-white tracking-widest uppercase mb-0.5">{user.displayName || 'Neural User'}</span>
        <div className="flex items-center gap-2">
          {(role === 'admin' || user.email?.toLowerCase() === 'uploadadd.com@gmail.com') && (
            <button 
              onClick={onAdminClick}
              className="px-2 py-0.5 rounded-md bg-emerald-500 text-[9px] font-tech font-black text-white uppercase tracking-tighter hover:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all active:scale-95"
            >
              ADMIN-PNL
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-blue-500/10 px-2 md:px-3 py-1 rounded-lg border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <DiamondIcon className="w-4 h-4 md:w-5 md:h-5 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)] animate-pulse" />
            <span className="text-[10px] md:text-[13px] font-tech font-black text-blue-500 tracking-tighter">{diamonds} Diamond</span>
          </div>
        </div>
      </div>
      <button onClick={() => logout()} className="p-2 rounded-xl hover:bg-red-500/10 transition-all group border border-transparent hover:border-red-500/20 active:scale-95" title="Logout">
        <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
      </button>
      <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-cyan-400 to-blue-600 p-0.5 shadow-lg">
        <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center overflow-hidden">
          <img src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="avatar" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}

function VoiceoverView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage } = useFirebase();
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedMood, setSelectedMood] = useState("story");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });

  const t = translations[lang].voiceover;

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;

    try {
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

            <div className="flex-1 space-y-3 min-w-[200px]">
              <label className="text-[10px] font-black text-text-primary dark:text-slate-500 uppercase tracking-[0.3em]">{t.selectMood}</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(t.moods).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedMood(key)}
                    className={`px-4 py-2 rounded-lg border text-[10px] font-black transition-all ${
                      selectedMood === key 
                        ? "bg-purple-600 border-purple-500 text-white shadow-xl shadow-purple-500/20" 
                        : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-text-secondary dark:text-slate-500 hover:border-slate-300 dark:hover:border-white/10 hover:text-text-primary dark:hover:text-slate-300"
                    }`}
                  >
                    {label as string}
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
              {isGenerating ? (lang === "EN" ? "SYNCING..." : "ထုတ်လုပ်နေသည်...") : t.generate}
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
  const { user, incrementUsage } = useFirebase();
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({ source: "app", value: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].transcribe;

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
          setError(lang === "EN" ? `Transcription failed: ${err.message}` : `ဘာသာပြန်ရန် အဆင်မပြေပါ။ ${err.message}`);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (err) {
      console.error(err);
      setError(lang === "EN" ? "Failed to transcribe. Please try again." : "ဘာသာပြန်ရန် အဆင်မပြေပါ။ ပြန်လည်ကြိုးစားပေးပါ။");
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
                : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white shadow-blue-500/30"
            }`}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isGenerating ? (lang === "EN" ? "SYNCING..." : "ဘာသာပြန်နေသည်...") : t.generate}
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

function OutOfDiamondsModal({ isOpen, onClose, lang }: { isOpen: boolean, onClose: () => void, lang: Language }) {
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
                ? "You need at least 10 diamonds to generate a recap. Please contact us to buy more." 
                : "Recap ထုတ်လုပ်ရန် Diamond ၁၀ ခု လိုအပ်ပါသည်။ Diamond ထပ်ဝယ်ရန် ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ။"}
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
          {lang === "EN" ? "Access Denied" : "ဝင်ရောက်ခွင့်မရှိပါ"}
        </h2>
        <p className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase max-w-xs mx-auto">
          {lang === "EN" 
            ? "You do not have administrative privileges to access this neural sector."
            : "ဤနေရာသို့ ဝင်ရောက်ရန် သင့်တွင် လုပ်ပိုင်ခွင့် (Admin Role) မရှိပါ။"}
        </p>
      </div>
      <button 
        onClick={onBack}
        className="flex items-center gap-3 px-8 h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border border-white/10"
      >
        <ArrowLeft className="w-4 h-4" /> {lang === "EN" ? "Return to Portal" : "ပင်မစာမျက်နှာသို့ ပြန်သွားမည်"}
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
            {lang === "EN" ? "Neural Verification" : "Admin အတည်ပြုခြင်း"}
          </h2>
          <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-2">
            {lang === "EN" ? "Secondary authentication required" : "ဒုတိယအဆင့် အတည်ပြုရန် လိုအပ်သည်"}
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
            {lang === "EN" ? "Authorize Access" : "အတည်ပြုမည်"}
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

function RecapMasterView({ onBack, lang, setLang, onAdminClick }: ViewProps) {
  const { user, incrementUsage, deductDiamonds, diamonds } = useFirebase();
  const [selectedStyle, setSelectedStyle] = useState("step-by-step");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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
  const [videoRatio, setVideoRatio] = useState("16:9");
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
  
    // Subtitle Settings
    const [subtitleEnabled, setSubtitleEnabled] = useState(false);
    const [subtitleColor, setSubtitleColor] = useState("#ffffff");
    const [subtitleFontSize, setSubtitleFontSize] = useState(24);
    const [subtitleFont, setSubtitleFont] = useState("Padauk");
    const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang].recapMaster;
  const vt = translations[lang].voiceover;
  const styles = getRecapStyles(lang);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 300 * 1024 * 1024) {
        setError(lang === "EN" ? "File size must be under 300MB for this demo." : "ဖိုင်အရွယ်အစားသည် 300MB အောက်သာ ဖြစ်ရပါမည်။");
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

  const handleGenerate = async () => {
    if (!file) return;

    if (diamonds < 10) {
      setShowDiamondModal(true);
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setVoiceoverAudioUrl(null);

    const apiKey = apiKeyConfig.source === "own" ? apiKeyConfig.value : undefined;

    try {
      const success = await deductDiamonds(10);
      if (!success) {
        setShowDiamondModal(true);
        setIsGenerating(false);
        return;
      }

      const base64 = await fileToBase64(file);
      const jobId = await api.recap(base64, file.type, selectedStyle, lang, duration || undefined, apiKey);
      const jobResult = await pollForCompletion(jobId);
      const recapValue = jobResult.text;
      
      await incrementUsage();
      setResult(recapValue || "");

      // Auto-trigger voiceover generation
      if (recapValue) {
        setIsVoiceoverGenerating(true);
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

            // Auto play audio
            const audio = new Audio(url);
            audio.play();

            // Auto trigger merge
            performMerge(file, url, recapValue);
          }
        } catch (vErr) {
          console.error("Auto voiceover failed:", vErr);
        } finally {
          setIsVoiceoverGenerating(false);
        }
      }
    } catch (err) {
      console.error(err);
      setError(lang === "EN" ? "Failed to generate recap. Please try again." : "Recap ထုတ်လုပ်ရန် အဆင်မပြေပါ။ ပြန်လည်ကြိုးစားပေးပါ။");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVoiceover = async () => {
    if (!result || !file) return;
    setIsVoiceoverGenerating(true);
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

        // Auto trigger merge on manual regeneration too
        performMerge(file, url, result || undefined);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVoiceoverGenerating(false);
    }
  };

  const playVoiceover = () => {
    if (voiceoverAudioUrl) {
      new Audio(voiceoverAudioUrl).play();
    }
  };

  const performMerge = async (videoFile: File, audioUrl: string, subtitleTextOverride?: string) => {
    setIsMerging(true);
    setMergedVideoUrl(null);

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
        apiKey
      );
      
      if (jobId) {
        // Use generic helper
        const job = await pollForCompletion(jobId);
        setMergedVideoUrl(job.downloadUrl);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Something went wrong during merging");
    } finally {
      setIsMerging(false);
    }
  };

  const handleMerge = () => {
    if (file && voiceoverAudioUrl) {
      performMerge(file, voiceoverAudioUrl, result || undefined);
    }
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-secondary pb-20 selection:bg-blue-500/20 transition-colors duration-300">
      <OutOfDiamondsModal isOpen={showDiamondModal} onClose={() => setShowDiamondModal(false)} lang={lang} />
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
        <ApiKeySelector config={apiKeyConfig} setConfig={setApiKeyConfig} lang={lang} />
        
        {/* Upload Section */}
        <section className="space-y-4">
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
                file ? "border-blue-500/50 bg-blue-500/5" : "border-white/10 hover:border-blue-500/30 hover:bg-white/5"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                file ? "bg-blue-600 shadow-xl shadow-blue-500/20" : "bg-white/5 group-hover:bg-blue-500/10"
              }`}>
                {file ? <Check className="w-4 h-4 text-white" /> : <CloudUpload className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />}
              </div>
              <div className="space-y-0.5">
                <h3 className={`text-xs font-black tracking-wider uppercase transition-colors ${file ? "text-text-primary dark:text-white" : "text-text-secondary dark:text-slate-400 group-hover:text-text-primary dark:group-hover:text-slate-300"}`}>
                  {file ? file.name : t.browseFiles}
                </h3>
                <p className="text-[9px] text-text-secondary/60 dark:text-slate-600 font-bold uppercase tracking-widest leading-none">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : t.fileLimit}
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
          <div className="flex items-center gap-3 text-white">
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
                    : "bg-card-bg/60 dark:bg-[#0f172a]/60 backdrop-blur-sm border-border dark:border-white/[0.05] text-text-secondary hover:border-slate-300 dark:hover:border-white/10 hover:text-text-primary dark:hover:text-slate-300"
                }`}
              >
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  selectedStyle === style.id ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
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
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Music className="w-4 h-4 text-purple-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">{vt.headline}</h2>
          </div>

          <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl flex flex-wrap gap-8">
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
                        : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300"
                    }`}
                  >
                    {(label as string).split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3 min-w-[200px]">
              <label className="text-[10px] font-black text-text-primary dark:text-slate-500 uppercase tracking-[0.2em]">{vt.selectMood}</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(vt.moods).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedMood(key)}
                    className={`px-4 py-2 rounded-lg border text-[10px] font-black transition-all ${
                      selectedMood === key 
                        ? "bg-purple-600 border-purple-500 text-white shadow-xl shadow-purple-500/20" 
                        : "bg-white/5 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300"
                    }`}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Ratio Selection Section */}
        <section className="space-y-4">
          <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Ratio Setting" : "Frame ချိန်ညှိမှုများ"}
                </label>
                <button 
                  onClick={() => setShowRatioSettings(true)}
                  className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 transition-all font-black"
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
          <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Upload Button */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Upload Logo" : "Logo တင်ရန်"}
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
                    logoFile ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  <CloudUpload className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {logoFile ? "Logo Ready" : (lang === "EN" ? "Select Logo" : "Logo ရွေးချယ်ပါ")}
                  </span>
                </button>
              </div>

              {/* Settings Toggle Button */}
              {logoFile && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                    {lang === "EN" ? "Overlay Adjust" : "Logo ချိန်ညှိမှုများ"}
                  </label>
                  <button 
                    onClick={() => setShowLogoSettings(true)}
                    className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <Star className="w-4 h-4" />
                    {lang === "EN" ? "Logo Settings" : "Logo Setting"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Blur Subtitle Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Sparkles className="w-4 h-4 text-red-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">{lang === "EN" ? "Subtitle Blur" : "စာတန်းထိုး Blur အုပ်ရန်"}</h2>
          </div>

          <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Blur Overlay" : "Blur အုပ်မည်"}
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setBlurEnabled(!blurEnabled)}
                    className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all ${
                      blurEnabled ? "bg-red-600/20 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {blurEnabled ? (lang === "EN" ? "Blur Enabled" : "Blur ဖွင့်ထားသည်") : (lang === "EN" ? "Enable Blur" : "Blur ဖွင့်ရန်")}
                    </span>
                  </button>

                  {blurEnabled && (
                    <button 
                      onClick={() => setShowBlurSettings(true)}
                      className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <Star className="w-4 h-4" />
                      {lang === "EN" ? "Blur Settings" : "နေရာညှိရန်"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Subtitle Customization Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Subtitles className="w-4 h-4 text-cyan-400" />
            </div>
            <h2 className="text-xl font-black tracking-tight">{lang === "EN" ? "Subtitle Customization" : "စာတန်းထိုး စိတ်ကြိုက်ပြင်ဆင်ခြင်း"}</h2>
          </div>

          <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">
                  {lang === "EN" ? "Subtitle" : "စာတန်းထိုး"}
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSubtitleEnabled(!subtitleEnabled)}
                    className={`flex items-center gap-3 px-6 h-12 rounded-xl border transition-all ${
                      subtitleEnabled ? "bg-cyan-600/20 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <Subtitles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {subtitleEnabled ? (lang === "EN" ? "Subtitle Enabled" : "စာတန်းထိုး ဖွင့်ထားသည်") : (lang === "EN" ? "Enable Subtitle" : "စာတန်းထိုး ဖွင့်ရန်")}
                    </span>
                  </button>

                  {subtitleEnabled && (
                    <button 
                      onClick={() => setShowSubtitleSettings(true)}
                      className="flex items-center gap-3 px-6 h-12 rounded-xl border bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <Star className="w-4 h-4" />
                      {lang === "EN" ? "Settings" : "Setting ချိန်ရန်"}
                    </button>
                  )}
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
                                  filter: "contrast(115%) brightness(95%) saturate(125%)"
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
                            {lang === "EN" ? "Aspect Ratio" : "Ratio ရွေးချယ်ပါ"}
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
                              {lang === "EN" ? "Content Scale" : "ဗီဒီယို Zoom"}
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
                              {lang === "EN" ? "Crop Top" : "အပေါ်မှ ဖြတ်ရန်"}
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
                              {lang === "EN" ? "Crop Bottom" : "အောက်မှ ဖြတ်ရန်"}
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
                              {lang === "EN" ? "Crop Left" : "ဘယ်ဘက်မှ ဖြတ်ရန်"}
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
                              {lang === "EN" ? "Crop Right" : "ညာဘက်မှ ဖြတ်ရန်"}
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
                              {lang === "EN" ? "Background Color" : "နောက်ခံအရောင်"}
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
                              {lang === "EN" ? "Background Blur" : "နောက်ခံ ဝါးရန်"}
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
                        {lang === "EN" ? "Apply Changes" : "သိမ်းဆည်းမည်"}
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
                                  filter: "contrast(115%) brightness(95%) saturate(125%)"
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
                            {lang === "EN" ? "Position" : "တည်နေရာ"}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "top-left", label: lang === "EN" ? "Top Left" : "အပေါ် ဘယ်" },
                              { id: "top-right", label: lang === "EN" ? "Top Right" : "အပေါ် ညာ" },
                              { id: "bottom-left", label: lang === "EN" ? "Bottom Left" : "အောက် ဘယ်" },
                              { id: "bottom-right", label: lang === "EN" ? "Bottom Right" : "အောက် ညာ" },
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
                              {lang === "EN" ? "Logo Scale" : "အရွယ်အစား"}
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
                        {lang === "EN" ? "Save & Close" : "သိမ်းဆည်းမည်"}
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
                                  filter: "contrast(115%) brightness(95%) saturate(125%)"
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
                              {lang === "EN" ? "Blur Width" : "အကျယ်"}
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
                              {lang === "EN" ? "Blur Height" : "အမြင့်"}
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
                              {lang === "EN" ? "Vertical Position" : "အပေါ်အောက် ရွှေ့ရန်"}
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
                              {lang === "EN" ? "Blur Intensity" : "ဝါးနှုန်း (Blur Strength)"}
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
                        {lang === "EN" ? "Apply Blur" : "သိမ်းဆည်းမည်"}
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
                                  filter: "contrast(115%) brightness(95%) saturate(125%)"
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
                        <div className="absolute bottom-6 md:bottom-12 left-0 right-0 px-2 md:px-8 flex flex-col items-center gap-2 pointer-events-none">
                          <div 
                            className="bg-black/60 backdrop-blur-md px-24 py-6 rounded-[2.5rem] border border-white/10 text-center max-w-[95%]"
                            style={{
                              color: subtitleColor,
                              fontSize: `${Math.max(8, subtitleFontSize * 0.4)}px`,
                              fontFamily: subtitleFont,
                              lineHeight: '1.6'
                            }}
                          >
                             This is a sample subtitle line for preview.<br/>
                             ချိန်ညှိမှုများကို သိမ်းဆည်းရန် "သိမ်းဆည်းမည်" ကိုနှိပ်ပါ။
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
                            {lang === "EN" ? "Subtitle Color" : "အရောင်"}
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

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                              {lang === "EN" ? "Font Size" : "အရွယ်အစား"}
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

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block">
                            {lang === "EN" ? "Font Family" : "Font အမျိုးအစား"}
                          </label>
                          <div className="relative">
                            <select
                              value={subtitleFont}
                              onChange={(e) => setSubtitleFont(e.target.value)}
                              className="w-full px-4 py-4 rounded-xl border bg-white/5 border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer transition-all font-medium text-sm"
                              style={{ fontFamily: subtitleFont }}
                            >
                              {["Padauk", "Inter", "Arial", "Roboto", "Georgia", "Courier New"].map((f) => (
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
                        {lang === "EN" ? "Apply Subtitles" : "သိမ်းဆည်းမည်"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>


        {/* Action Button */}
        {!showLogoSettings && !showRatioSettings && !showBlurSettings && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={handleGenerate}
              disabled={!file || isGenerating}
              className={`h-14 px-12 rounded-full font-black text-[13px] flex items-center justify-center gap-4 transition-all relative overflow-hidden active:scale-95 shadow-2xl ${
                !file || isGenerating 
                  ? "bg-white/5 cursor-not-allowed text-slate-600 border border-white/10" 
                  : "bg-linear-to-r from-blue-600 to-indigo-700 hover:scale-105 text-white"
              }`}
            >
               <div className="flex items-center gap-3">
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <DiamondIcon className="w-6 h-6 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
                )}
                {isGenerating ? (lang === "EN" ? "SYNCING..." : "ထုတ်လုပ်နေသည်...") : `${t.generate} (10 Dia)`}
               </div>
            </button>
          </div>
        )}

        {/* Result Section */}
        <AnimatePresence>
          {result && (
            <motion.section 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-8"
            >
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-black tracking-tight">{lang === "EN" ? "Generated Recap" : "ထုတ်လုပ်ထားသော Recap"}</h2>
              </div>
              
              <div className="bg-[#0f172a]/40 backdrop-blur-lg rounded-[2.5rem] p-10 border border-white/5 shadow-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                    <Sparkles className="w-6 h-6 text-blue-400/50" />
                  </div>
                </div>
                
                <div className="prose prose-invert prose-slate max-w-none prose-lg md:prose-xl prose-p:leading-relaxed prose-headings:text-white prose-headings:font-black prose-headings:tracking-tighter prose-li:text-slate-300 font-medium selection:bg-blue-500/30">
                  <Markdown>{result}</Markdown>
                </div>
              </div>

              {/* Audio result if ready */}
              {voiceoverAudioUrl && (
                <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-3xl p-8 border border-white/5 shadow-2xl space-y-8">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                        <Music className="w-7 h-7 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white uppercase tracking-widest">{t.voiceoverTitle}</h3>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded inline-block mt-1">Audio Ready for Deployment</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={playVoiceover}
                        className="w-14 h-14 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 flex items-center justify-center transition-all active:scale-90"
                      >
                        <Play className="w-6 h-6 text-white fill-white/20" />
                      </button>
                      <a 
                        href={voiceoverAudioUrl} 
                        download="recap_voiceover.wav"
                        className="w-14 h-14 bg-blue-600/20 hover:bg-blue-600/30 rounded-2xl border border-blue-500/20 flex items-center justify-center transition-all active:scale-90"
                      >
                        <CloudUpload className="w-6 h-6 text-blue-400" />
                      </a>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button 
                        onClick={handleMerge}
                        disabled={isMerging}
                        className={`w-full sm:w-auto h-14 px-10 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-4 transition-all active:scale-95 ${
                          isMerging ? "bg-white/5 cursor-not-allowed text-slate-600" : "bg-purple-600 hover:bg-purple-700 text-white shadow-2xl shadow-purple-500/30"
                        }`}
                      >
                        {isMerging ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isMerging ? t.merging : t.mergeWithVideo}
                      </button>

                      {mergedVideoUrl && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-xl"
                        >
                          <Check className="w-5 h-5 text-green-500" />
                          <span className="text-[11px] font-black text-green-500 uppercase tracking-widest">{t.mergeSuccess}</span>
                        </motion.div>
                      )}
                    </div>

                    {mergedVideoUrl && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-6 bg-white/[0.03] rounded-2xl border border-white/10 flex flex-col sm:flex-row gap-6 items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                            <Play className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-white uppercase tracking-[0.2em] block">RECAP_FINAL.MP4</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">System Bound Master Output</span>
                          </div>
                        </div>
                        <a 
                          href={mergedVideoUrl} 
                          download="recap_master_final.mp4"
                          className="w-full sm:w-auto h-12 px-10 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-green-500/30 active:scale-95"
                        >
                          <CloudUpload className="w-4 h-4" />
                          {t.downloadMerged}
                        </a>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}



              {/* Regeneration Section */}
              <div className="pt-8 border-t border-white/5 flex flex-col gap-4">
                <button 
                  onClick={handleGenerateVoiceover}
                  disabled={isVoiceoverGenerating || !result}
                  className={`h-12 px-10 self-start rounded-full font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all active:scale-95 ${
                    isVoiceoverGenerating || !result ? "bg-white/5 cursor-not-allowed text-slate-600" : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                >
                  {isVoiceoverGenerating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4 text-blue-500" />}
                  {isVoiceoverGenerating ? (lang === "EN" ? "Regenerating..." : "ပြန်လည်ထုတ်လုပ်နေသည်...") : (lang === "EN" ? "Regenerate Neural Voice" : "အသံပြန်ထုတ်မည်")}
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
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
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
      <div className="hero-glow" />
      <div className="absolute inset-0 noise-overlay" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-12 text-center shadow-3xl"
      >
        <div className="w-20 h-20 bg-linear-to-br from-blue-600 via-indigo-600 to-indigo-800 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/30 mx-auto mb-8 animate-pulse">
          <Cpu className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl font-black tracking-tighter text-text-primary dark:text-white mb-4">LUMINA</h1>
        <p className="text-[10px] font-tech font-black tracking-[0.4em] text-blue-500 uppercase mb-8">{t.authRequired}</p>
        
        <div className="space-y-3">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full h-16 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/15 text-slate-950 dark:text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] border border-white/10"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {isLoggingIn ? t.authenticating : t.loginWithGoogle}
          </button>

          {error && (
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full h-12 text-slate-500 hover:text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
          )}
        </div>
        
        <p className="mt-8 text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
          {t.authPrompt}
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

function AppContent() {
  const { user, loading, role, diamonds } = useFirebase();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [intendedToolId, setIntendedToolId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("MY");
  const [darkMode, setDarkMode] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const TOOL_PATHS: Record<string, string> = {
    "recap-master": "recapmaster",
    "video-recapper": "videorecapper",
    "ai-voiceover": "voiceover",
    "video-transcribe": "transcribe",
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
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                >
                  <AdminDashboard onBack={() => navigate('/')} />
                </motion.div>
              )
            ) : (
              <AccessDeniedView onBack={() => navigate('/')} lang={lang} />
            )
          } />
          
          <Route path="/recapmaster" element={
            <motion.div
              key="recap-master"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <RecapMasterView 
                onBack={() => navigate('/')} 
                lang={lang}
                setLang={setLang}
                onAdminClick={handleAdminClick}
              />
            </motion.div>
          } />

          <Route path="/videorecapper" element={
            <motion.div
              key="video-recapper"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TranscribeView 
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
              transition={{ duration: 0.5 }}
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
                      <div className="w-10 h-10 bg-linear-to-br from-blue-600 via-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center shadow-2xl shadow-blue-500/30 group-hover:scale-105 group-hover:rotate-6 transition-all duration-500">
                        <Cpu className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex flex-col -gap-1">
                        <span className="text-2xl font-black tracking-tighter text-text-primary dark:text-white leading-none">LUMINA</span>
                        <span className="text-[9px] font-tech font-black tracking-[0.4em] text-blue-500/80 uppercase ml-1">NEURAL OS</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <UserHeader onAdminClick={handleAdminClick} />
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="pt-36 pb-32 px-6 max-w-7xl mx-auto relative z-10">
                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {tools.map((tool, index) => {
                    const glowClass = 
                      tool.id === 'recap-master' ? 'card-glow-red' :
                      tool.id === 'video-recapper' ? 'card-glow-blue' :
                      tool.id === 'video-recap' ? 'card-glow-purple' :
                      tool.id === 'subtitle-editor' ? 'card-glow-blue' :
                      tool.id === 'auto-recap' ? 'card-glow-indigo' :
                      tool.id === 'video-transcribe' ? 'card-glow-teal' :
                      tool.id === 'ai-voiceover' ? 'card-glow-orange' : 'card-glow-blue';

                    return (
                      <motion.div
                        key={tool.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        className={`group relative bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-md border ${tool.borderColor || 'border-border'} rounded-[2rem] p-7 flex flex-col h-full cursor-pointer transition-all duration-500 hover:bg-card-bg/60 dark:hover:bg-white/[0.02] hover:-translate-y-3 ${tool.shadowColor || ''} hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden`}
                        onClick={() => handleToolClick(tool.id)}
                      >
                        {/* Background Glow */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ${glowClass}`} />
                        <div className="scanline group-hover:block hidden" />
                        
                        {tool.badge && (
                          <div className="absolute top-0 right-0 p-4 z-20">
                            <div className={`flex items-center gap-2 text-[9px] ${tool.badge === 'PRO' ? 'bg-linear-to-br from-amber-400 to-amber-600' : 'bg-linear-to-br from-blue-400 to-indigo-600'} text-white px-3 py-1 rounded-bl-2xl rounded-tr-xl font-tech font-black tracking-widest uppercase shadow-2xl`}>
                              {tool.badge}
                            </div>
                          </div>
                        )}

                        <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-50 transition-all translate-x-4 group-hover:translate-x-0 hidden md:block">
                          <ArrowRight className="w-5 h-5 text-white" />
                        </div>
                        
                        <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center mb-8 shadow-xl shadow-black/10 dark:shadow-black/40 ring-1 ring-white/20 relative z-10 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700`}>
                          <tool.icon className={`w-6 h-6 ${tool.iconColor} drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]`} />
                        </div>

                        <div className="relative z-10">
                          <h3 className="text-xl font-black text-text-primary dark:text-white mb-3 tracking-tighter group-hover:brand-gradient transition-all leading-none">
                            {tool.title}
                          </h3>
                          <p className="text-[10px] text-text-secondary dark:text-slate-500 line-clamp-3 mb-10 leading-relaxed font-tech font-bold uppercase tracking-widest group-hover:text-text-primary dark:group-hover:text-slate-400 transition-colors">
                            {tool.description}
                          </p>
                        </div>

                        <div className="mt-auto relative z-10">
                          <div className="relative w-full h-12 rounded-xl overflow-hidden group/btn transition-all active:scale-[0.98] border border-white/5">
                            <div className="absolute inset-0 bg-white/5 group-hover/btn:bg-white/10 transition-all duration-300" />
                            <div className="relative flex items-center justify-between px-4 h-full">
                              <span className="text-[10px] font-tech font-black uppercase tracking-[0.2em] text-slate-400 group-hover/btn:text-white transition-colors">Initialize Tool</span>
                              <div className="w-6 h-6 bg-white/5 rounded-lg flex items-center justify-center group-hover/btn:bg-blue-600 group-hover/btn:shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all">
                                 <ArrowRight className="w-3 h-3 text-slate-500 group-hover/btn:text-white transition-all" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Side decoration */}
                        <div className="absolute top-1/2 left-0 h-8 w-1 bg-blue-600 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all rounded-r-full" />
                      </motion.div>
                    );
                  })}
                </div>
              </main>

              {/* Subtle floating elements */}
              <div className="fixed top-1/4 -left-20 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
              <div className="fixed bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

              {/* Footer / Meta Data */}
              <footer className="fixed bottom-0 left-0 right-0 h-16 border-t border-white/[0.03] bg-page-bg/40 backdrop-blur-xl z-50 flex items-center justify-between px-8 pointer-events-none md:pointer-events-auto">
                 <div className="flex items-center gap-6">
                 </div>
                 
                 <div className="flex items-center gap-6">
                   <span className="text-[10px] font-tech font-black text-text-primary dark:text-slate-600 tracking-[0.3em] uppercase">© 2026 Lumina Neural Systems</span>
                 </div>
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
