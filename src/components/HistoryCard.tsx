import { useState } from "react";
import { FileVideo, Trash2, Eye, Volume2, CloudUpload } from "lucide-react";
import Markdown from "react-markdown";

interface HistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  style: string;
  recapResult: string;
  voiceoverAudioUrl?: string | null;
  mergedVideoUrl?: string | null;
}

interface HistoryCardProps {
  item: HistoryItem;
  styleLabel: string;
  lang: "EN" | "MY";
  onRestore: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function HistoryCard({ item, styleLabel, lang, onRestore, onDelete }: HistoryCardProps) {
  const [showScript, setShowScript] = useState(false);

  return (
    <div className="bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-xl border border-border dark:border-white/5 rounded-2xl p-5 hover:border-blue-500/20 transition-all space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-400">
            <FileVideo className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-text-primary dark:text-white line-clamp-1">{item.fileName}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {styleLabel}
              </span>
              <span className="text-[10px] text-text-secondary/60 font-bold">
                {item.timestamp}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-95 cursor-pointer ml-auto"
          title={lang === "EN" ? "Delete from history" : "မှတ်တမ်းမှ ဖျက်မည်"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 items-center justify-between border-t border-white/5">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowScript(!showScript)}
            className="h-9 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            {showScript 
              ? (lang === "EN" ? "Hide Script" : "စာသားဝှက်မည်") 
              : (lang === "EN" ? "View Script" : "စာသားကြည့်မည်")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {item.voiceoverAudioUrl && (
            <div className="flex items-center gap-2 bg-slate-100/5 px-3 py-1.5 rounded-xl border border-white/5 max-w-full">
              <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <audio src={item.voiceoverAudioUrl} controls className="h-6 w-32 md:w-40 sm:w-36 text-xs bg-transparent dark:text-white" />
            </div>
          )}

          {item.mergedVideoUrl && (
            <a
              href={item.mergedVideoUrl}
              download="recap_master_final.mp4"
              className="h-9 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              {lang === "EN" ? "Final Video Download" : "Final Video ဒေါင်းလုဒ်လုပ်မည်"}
            </a>
          )}
        </div>
      </div>

      {showScript && (
        <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto font-sans">
          <Markdown>{item.recapResult}</Markdown>
        </div>
      )}
    </div>
  );
}
