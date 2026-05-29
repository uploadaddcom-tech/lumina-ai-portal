import { FileVideo, Trash2, CloudUpload } from "lucide-react";

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

interface HistoryCardProps {
  item: HistoryItem;
  styleLabel: string;
  lang: "EN" | "MY";
  onRestore: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function HistoryCard({ item, styleLabel, lang, onRestore, onDelete }: HistoryCardProps) {
  const activeStatus = item.status || (item.mergedVideoUrl ? "completed" : "completed");

  return (
    <div 
      onClick={onRestore}
      className="bg-card-bg/40 dark:bg-[#0f172a]/40 backdrop-blur-xl border border-border dark:border-white/5 rounded-2xl p-5 hover:border-blue-500/20 hover:bg-white/[0.02] dark:hover:bg-[#0f172a]/60 transition-all space-y-4 cursor-pointer"
    >
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
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-95 cursor-pointer ml-auto"
          title={lang === "EN" ? "Delete from history" : "Delete from history"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 items-center justify-between border-t border-white/5">
        <div className="flex flex-wrap gap-2 items-center">
          {activeStatus === "recap" && (
            <span className="text-[11px] font-black uppercase text-yellow-500 animate-pulse bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">
              Generating Recap...
            </span>
          )}
          {activeStatus === "voiceover" && (
            <span className="text-[11px] font-black uppercase text-orange-500 animate-pulse bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/20">
              Generating Neural Voice...
            </span>
          )}
          {activeStatus === "merge" && (
            <span className="text-[11px] font-black uppercase text-blue-500 animate-pulse bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
              Generating Final Video...
            </span>
          )}
          {activeStatus === "failed" && (
            <span className="text-[11px] font-black uppercase text-red-500 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20">
              {lang === "EN" ? "Failed" : "Failed"}
            </span>
          )}
          {activeStatus === "completed" && (
            <span className="text-[11px] font-black uppercase text-green-500 bg-green-500/10 px-3 py-1.5 rounded-xl border border-green-500/20">
              Completed
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {item.mergedVideoUrl && (
            <a
              href={item.mergedVideoUrl}
              download="recap_master_final.mp4"
              onClick={(e) => e.stopPropagation()}
              className="h-9 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-all text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              {lang === "EN" ? "Final Video Download" : "Download Final Video"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
