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

  const formattedTime = (() => {
    let str = item.timestamp || "";
    try {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
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
      }
    } catch (e) {}

    // Fallback: character translation map
    const myanmarToEnglishMap: { [key: string]: string } = {
      "၀": "0", "၁": "1", "၂": "2", "၃": "3", "၄": "4",
      "၅": "5", "၆": "6", "၇": "7", "၈": "8", "၉": "9",
      "မနက်": "AM", "ညနေ": "PM", "ည": "PM", "နေ့လည်": "PM",
      "၊": ",", " ": " "
    };
    Object.entries(myanmarToEnglishMap).forEach(([mm, en]) => {
      str = str.split(mm).join(en);
    });
    str = str.replace(/[နာရီ|မိနစ်|စက္ကန့်|ရက်|လ|နှစ်]/g, "");
    return str.trim();
  })();

  return (
    <div 
      onClick={onRestore}
      className="bg-slate-900/45 hover:bg-slate-900/60 backdrop-blur-xl border border-slate-800 hover:border-blue-500/30 rounded-xl p-3 md:p-3.5 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 text-left"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 text-blue-400 shrink-0">
          <FileVideo className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h4 className="text-xs font-bold text-white line-clamp-1 truncate flex-1 min-w-0">{item.fileName}</h4>
            <div className="shrink-0">
              {activeStatus === "recap" && (
                <span className="text-[9px] font-black uppercase text-yellow-500 animate-pulse bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                  Recap...
                </span>
              )}
              {activeStatus === "voiceover" && (
                <span className="text-[9px] font-black uppercase text-orange-500 animate-pulse bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                  Voice...
                </span>
              )}
              {activeStatus === "merge" && (
                <span className="text-[9px] font-black uppercase text-blue-500 animate-pulse bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  Merging...
                </span>
              )}
              {activeStatus === "failed" && (
                <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                  Failed
                </span>
              )}
              {activeStatus === "completed" && (
                <span className="text-[9px] font-black uppercase text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                  Completed
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="text-[9px] text-slate-400 font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/5 leading-none">
              {styleLabel}
            </span>
            <span className="text-slate-500 font-medium tracking-tight">
              {formattedTime}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:self-center self-end pl-12 md:pl-0 shrink-0">
        {item.mergedVideoUrl && (
          <a
            href={item.mergedVideoUrl}
            download="recap_master_final.mp4"
            onClick={(e) => e.stopPropagation()}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-lg shadow-emerald-950/20 shrink-0"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            Download Final Video
          </a>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
