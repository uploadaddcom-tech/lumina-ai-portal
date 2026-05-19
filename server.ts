import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { exec } from "child_process";
import crypto from "crypto";
import { promisify } from "util";

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const readFilePromise = promisify(fs.readFile);

interface SubtitlePhrase {
  text: string;
  start_time: number;
  end_time: number;
}

const SubtitleSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      start_time: { type: Type.NUMBER },
      end_time: { type: Type.NUMBER },
    },
    required: ["text", "start_time", "end_time"],
  },
};

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const is503 = error.message?.includes("503") || error.status === 503 || error.message?.includes("high demand");
      const is429 = error.message?.includes("429") || error.status === 429;
      
      if (i === maxRetries || (!is503 && !is429)) {
        throw error;
      }
      
      console.warn(`Gemini API Error (Retryable): ${error.message}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error("Retry failed");
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJobs = new Map<string, { 
  status: string; 
  downloadUrl?: string; 
  text?: string; 
  subtitleTimeline?: SubtitlePhrase[]; 
  audioData?: string; 
  error?: string 
}>();

// Periodic cleanup of temp files and job history (every 30 minutes)
setInterval(() => {
  const tempDir = path.join(process.cwd(), "temp");
  if (fs.existsSync(tempDir)) {
    const now = Date.now();
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      try {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        // Delete files older than 1 hour
        if (now - stats.mtimeMs > 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.error("Cleanup Error for file", file, e);
      }
    }
  }
  // Also cleanup stale jobs
  if (appJobs.size > 200) {
    const keys = Array.from(appJobs.keys());
    for (let i = 0; i < 100; i++) {
        appJobs.delete(keys[i]);
    }
  }
}, 30 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to handle JSON payloads - set a large limit for videos
  app.use(express.json({ limit: "300mb" }));

  // Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey || "" });

  // Specialized Gemini Endpoints for Video Portal
  app.post("/api/recap", async (req, res) => {
    const jobId = crypto.randomBytes(12).toString("hex");
    appJobs.set(jobId, { status: "processing" });
    res.json({ jobId });

    (async () => {
      try {
        const { videoBase64, mimeType, style, lang, duration, apiKey: customKey } = req.body;
        const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
        const model = "gemini-3-flash-preview";
        
        const stylePrompts: Record<string, string> = {
          "step-by-step": lang === "EN" 
            ? "Create a very detailed, comprehensive, step-by-step guide based on this video. Break it down into logical phases and include every minor detail and technique shown."
            : "ဒီဗီဒီယိုကို အခြေခံပြီး အလွန်အသေးစိတ်ကျပြီး ပြည့်စုံတဲ့ အဆင့်ဆင့်လမ်းညွှန်ချက်တစ်ခုကို ပြုလုပ်ပေးပါ။ အဆင့်တွေကို အပိုင်းလိုက် ခွဲခြားဖော်ပြပေးပြီး ဗီဒီယိုထဲမှာပါတဲ့ နည်းစနစ်နဲ့ အသေးစိတ်အချက်အလက်အားလုံးကို ထည့်သွင်းပေးပါ။",
          "material-list": lang === "EN"
            ? "Identify and list all the materials, tools, and supplies shown or used in this video in great detail."
            : "ဒီဗီဒီယိုထဲမှာ အသုံးပြုထားတဲ့ ကိရိယာတွေ၊ ပစ္စည်းတွေကို အသေးစိတ် ရှာဖွေပြီး စာရင်းပြုစုပေးပါ။",
          "funny-commentary": lang === "EN"
            ? "Provide an entertaining, hilarious, and detailed recap of this video."
            : "ဒီဗီဒီယိုအကြောင်းကို ဖျော်ဖြေမှုပေးနိုင်ပြီး ရယ်စရာကောင်းတဲ့ အသေးစိတ် ပြန်ပြောပြချက်တစ်ခု ပြုလုပ်ပေးပါ။",
          "epic-exaggerated": lang === "EN"
            ? "Treat this project like a world-changing masterpiece. Provide a long, epic recap."
            : "ဒီပရောဂျက်ကို ကမ္ဘာကြီးကို ပြောင်းလဲစေမယ့် လက်ရာမွန်တစ်ခုလို သဘောထားပြီး အရမ်းကြီးကျယ်ခမ်းနားတဲ့ပုံစံနဲ့ ပြန်ပြောပြပေးပါ။",
          "project-story": lang === "EN"
            ? "Tell the complete story of this project as a narrative journey."
            : "ဒီပရောဂျက်ရဲ့ ဇာတ်လမ်းအပြည့်အစုံကို ခရီးစဉ်တစ်ခုလို ပုံပြောသလိုမျိုး ပြန်ပြောပြပေးပါ။",
          "pro-tips": lang === "EN"
            ? "Exhaustively extract every expert technique, pro tip, and potential pitfall shown."
            : "ဒီဗီဒီယိုတစ်ခုလုံးမှာပါတဲ့ ကျွမ်းကျင်သူတွေရဲ့ နည်းလမ်းတွေ၊ အကြံပြုချက်တွေကို အသေးစိတ် ထုတ်နုတ်ဖော်ပြပေးပါ။",
          "quick-summary": lang === "EN"
            ? "Provide a comprehensive overall summary that captures the essence of the entire video."
            : "ဗီဒီယိုတစ်ခုလုံးရဲ့ အနှစ်သာရကို ခြုံငုံမိစေမယ့် ပြည့်စုံတဲ့ အကျဉ်းချုပ်တစ်ခုကို ဖော်ပြပေးပါ။",
          "real-time-narration": lang === "EN"
            ? "Provide a chronological, real-time narration script for this video. DO NOT include timestamps."
            : "ဗီဒီယိုထဲမှာ ဖြစ်ပျက်နေတဲ့ အရာတွေကို အခြေခံပြီး အချိန်နဲ့တပြေးညီ နောက်ခံစကားပြော script တစ်ခု ရေးသားပေးပါ။ အချိန်မှတ်တမ်းတွေ မထည့်ပါနဲ့။",
        };

        const wordCount = duration ? Math.floor((duration / 60) * 150) : 150;
        
        const constraintPrompt = lang === "EN"
          ? `Constraints:
             - OUTPUT FORMAT: JSON Array of Objects.
             - STRUCTURE: Each object must have "text" (string), "start_time" (number), "end_time" (number).
             - FRAGMENTATION: Break the script into very short, TikTok-style phrases (4-6 words each).
             - TIMING: Sync "start_time" and "end_time" accurately to the video content events.
             - SCRIPT CONTENT: High-quality polished narrative ONLY. No intros, no timestamps in text, no bullet points.
             - Total duration: Approximately ${duration || 60} seconds.`
          : `ကန့်သတ်ချက်များ -
             - ရလဒ်ပုံစံ - JSON Array of Objects သာဖြစ်ရမည်။
             - တည်ဆောက်ပုံ - Object တစ်ခုစီတွင် "text" (စာသား)၊ "start_time" (စက္ကန့်) နှင့် "end_time" (စက္ကန့်) ပါဝင်ရမည်။
             - ပမာဏ - စာတန်းများကို TikTok/Reel စတိုင်အတိုင်း ၄ လုံးမှ ၆ လုံးခန့် တိုတိုလေးများသာ ဖြတ်ပေးပါ။
             - အချိန်ညှိနှိုင်းမှု - "start_time" နှင့် "end_time" ကို ဗီဒီယိုပါ အဖြစ်အပျက်များနှင့် အတိအကျညှိပေးပါ။
             - ပါဝင်သည့်အချက်အလက် - အချောသတ်ထားသော ဇာတ်ညွှန်းသာ ဖြစ်ရမည်။ နိဒါန်းများ၊ စာရင်းများ လုံးဝမပါရ။ "သည်" အစား "တယ်" သုံးပါ။`;

        const promptSnippet = stylePrompts[style] || stylePrompts["step-by-step"];
        const finalPrompt = `${promptSnippet}\n\n${constraintPrompt}\n\nRespond in ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language. Provide JSON array only.`;

        const response = await retryWithBackoff(() => aiClient.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                { text: finalPrompt },
                { inlineData: { data: videoBase64, mimeType } }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: SubtitleSchema,
          } as any
        }));
        
        const rawJson = response.text || "[]";
        let timeline: SubtitlePhrase[] = [];
        try {
          timeline = JSON.parse(rawJson);
          if (lang === "MY") {
            timeline = timeline.map(p => ({
              ...p,
              text: p.text.replace(/သည်([။၊\s\n]|$)/g, 'တယ်$1')
                         .replace(/သနည်း([။၊\s\n]|$)/g, 'သလဲ$1')
                         .replace(/ခဲ့သည်([။၊\s\n]|$)/g, 'ခဲ့တယ်$1')
            }));
          }
        } catch (e) {
          console.error("JSON Parse Error in Recap:", e);
        }

        const fullText = timeline.map(p => p.text).join(" ");
        appJobs.set(jobId, { status: "completed", text: fullText, subtitleTimeline: timeline });
      } catch (error: any) {
        console.error("Recap Error Background:", error);
        appJobs.set(jobId, { status: "error", error: error.message });
      }
    })();
  });

  app.post("/api/transcribe", async (req, res) => {
    const jobId = crypto.randomBytes(12).toString("hex");
    appJobs.set(jobId, { status: "processing" });
    res.json({ jobId });

    (async () => {
      try {
        const { videoBase64, mimeType, lang, apiKey: customKey } = req.body;
        const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
        const model = "gemini-3-flash-preview";
        const prompt = lang === "EN"
          ? `Listen to the video audio. Transcribe and translate into English. 
             OUTPUT: JSON array of objects with "text" (short phrase 4-6 words), "start_time" (seconds), "end_time" (seconds).`
          : `ဗီဒီယိုထဲက အသံကို နားထောင်ပြီး Transcription ပြုလုပ်ပါ။ ပြီးလျှင် မြန်မာဘာသာ (စကားပြောစတိုင်) သို့ ပြန်ဆိုပေးပါ။
             OUTPUT: JSON array of objects သာဖြစ်ရမည်။ တစ်ခုချင်းစီတွင် "text" (စာတန်းတို ၄-၆ လုံး)၊ "start_time" နှင့် "end_time" ပါဝင်ရမည်။`;

        const response = await retryWithBackoff(() => aiClient.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { data: videoBase64, mimeType } }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: SubtitleSchema,
          } as any
        }));
        
        const rawJson = response.text || "[]";
        let timeline: SubtitlePhrase[] = [];
        try {
          timeline = JSON.parse(rawJson);
          if (lang === "MY") {
            timeline = timeline.map(p => ({
              ...p,
              text: p.text.replace(/သည်([။၊\s\n]|$)/g, 'တယ်$1')
                         .replace(/သနည်း([။၊\s\n]|$)/g, 'သလဲ$1')
                         .replace(/ခဲ့သည်([။၊\s\n]|$)/g, 'ခဲ့တယ်$1')
            }));
          }
        } catch (e) {
          console.error("JSON Parse Error in Transcribe:", e);
        }

        const fullText = timeline.map(p => p.text).join(" ");
        appJobs.set(jobId, { status: "completed", text: fullText, subtitleTimeline: timeline });
      } catch (error: any) {
        console.error("Transcribe Error Background:", error);
        appJobs.set(jobId, { status: "error", error: error.message });
      }
    })();
  });

  app.post("/api/voiceover", async (req, res) => {
    const jobId = crypto.randomBytes(12).toString("hex");
    appJobs.set(jobId, { status: "processing" });
    res.json({ jobId });

    (async () => {
      try {
        const { text, voiceName, apiKey: customKey } = req.body;
        const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
        const model = "gemini-3.1-flash-tts-preview";

        const getChunks = (input: string, maxLen = 600) => {
          const sentences = input.split(/(?<=[။၊.!?])\s+/);
          const chunks = [];
          let current = "";
          for (const s of sentences) {
            if ((current + s).length > maxLen && current) {
              chunks.push(current.trim());
              current = s;
            } else {
              current = current ? current + " " + s : s;
            }
          }
          if (current) chunks.push(current.trim());
          return chunks;
        };

        const textChunks = getChunks(text);
        const audioBuffers: Buffer[] = [];

        for (const chunk of textChunks) {
          if (!chunk.trim()) continue;
          const response = await retryWithBackoff(() => aiClient.models.generateContent({
            model: model,
            contents: [{ parts: [{ text: chunk }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || "Kore" }
                }
              }
            } as any
          }));
          
          const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audioBase64) {
            audioBuffers.push(Buffer.from(audioBase64, 'base64'));
          }
        }

        const pcmData = Buffer.concat(audioBuffers);
        const sampleRate = 24000;
        const numChannels = 1;
        const byteRate = sampleRate * numChannels * 2; // 16-bit
        const blockAlign = numChannels * 2;
        
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + pcmData.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20); // PCM
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(16, 34); // 16-bit
        header.write('data', 36);
        header.writeUInt32LE(pcmData.length, 40);

        const finalAudio = Buffer.concat([header, pcmData]);
        appJobs.set(jobId, { status: "completed", audioData: finalAudio.toString("base64") });
      } catch (error: any) {
        console.error("Voiceover Error Background:", error);
        appJobs.set(jobId, { status: "error", error: error.message });
      }
    })();
  });

  // Server-side Merging Endpoint
  app.post("/api/merge", async (req, res) => {
    const jobId = crypto.randomBytes(12).toString("hex");
    const tempId = jobId; 
    const tempDir = path.join(process.cwd(), "temp");
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Initialize job status
    appJobs.set(jobId, { status: "processing" });

    // Return jobId immediately
    res.json({ jobId });

    // Proceed in background
    (async () => {
      const videoPath = path.join(tempDir, `video_${tempId}.mp4`);
      const audioPath = path.join(tempDir, `audio_${tempId}.wav`);
      const logoPath = path.join(tempDir, `logo_${tempId}.png`);
      const outputPath = path.join(tempDir, `output_${tempId}.mp4`);

      try {
        const { 
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
        subtitleTimeline,
        subtitleColor,
        subtitleFontSize,
        subtitleFont,
        apiKey
      } = req.body;
      
      const videoBuffer = Buffer.from(videoBase64, 'base64');
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      await writeFilePromise(videoPath, videoBuffer);
      await writeFilePromise(audioPath, audioBuffer);

      let hasLogo = false;
      if (logoBase64) {
        const logoBuffer = Buffer.from(logoBase64, 'base64');
        await writeFilePromise(logoPath, logoBuffer);
        hasLogo = true;
      }

      // Get Durations to handle speed adjustment
      const getDuration = async (filePath: string) => {
        try {
          const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
          const duration = parseFloat(stdout.trim());
          if (!isNaN(duration)) return duration;
        } catch (e) {
          // Fallback to ffmpeg if ffprobe fails for some reason
          try {
            const { stderr } = await execPromise(`ffmpeg -i "${filePath}" 2>&1`);
            const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
            if (match) {
              const h = parseInt(match[1]);
              const m = parseInt(match[2]);
              const s = parseInt(match[3]);
              const ms = parseFloat("0." + match[4]);
              return h * 3600 + m * 60 + s + ms;
            }
          } catch (innerE) {
            console.error("Duration Parsing Error:", innerE);
          }
        }
        return 0;
      };

      const vDur = await getDuration(videoPath);
      const aDur = await getDuration(audioPath);
      
      // Get video resolution for scaling
      const getResolution = async (filePath: string) => {
        try {
          const { stdout } = await execPromise(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`);
          const parts = stdout.trim().split('x');
          if (parts.length === 2) return { w: parseInt(parts[0]), h: parseInt(parts[1]) };
        } catch (e) {
          console.error("Resolution Error:", e);
        }
        return { w: 1280, h: 720 };
      };
      
      const vRes = await getResolution(videoPath);
      // Reference width for logo scaling (UI preview container is approx 400px wide)
      const logoScale = vRes.w / 400;
      // Reference width for font scaling (UI preview container is approx 400px wide)
      const fontScale = vRes.w / 400;
      const padding = 20 * logoScale;
      const zoom = (videoScale || 100) / 100;
      const cTop = (cropTop || 0) / 100;
      const cBottom = (cropBottom || 0) / 100;
      const cLeft = (cropLeft || 0) / 100;
      const cRight = (cropRight || 0) / 100;
      const bgColorVal = bgColor || "black";

      // Ratio Filter with Zoom support (Fit & Pad - Avoid Cropping)
      let ratioFilter = "";
      if (videoRatio) {
        const [rw, rh] = videoRatio.split(':').map(Number);
        const targetAR = rw / rh;
        
        // 1. Initial manual crop if user specified
        const manualCrop = `crop=iw*(1-${cLeft+cRight}):ih*(1-${cTop+cBottom}):iw*${cLeft}:ih*${cTop}`;
        
        // 2. Final dimensions based on output ratio
        const outW = vRes.w;
        const outH = Math.round(vRes.w / targetAR);
        const safeW = Math.max(2, Math.floor(outW / 2) * 2);
        const safeH = Math.max(2, Math.floor(outH / 2) * 2);

        if (bgBlurEnabled) {
          // Background blur path: scale background to fill, blur it, map foreground on top
          ratioFilter = `split[main][bg]; [bg]${manualCrop},scale=w=${safeW}:h=${safeH}:force_original_aspect_ratio=increase,boxblur=40:20,crop=${safeW}:${safeH}[bg_applied]; [main]${manualCrop},scale=w=${safeW}:h=${safeH}:force_original_aspect_ratio=decrease[fg]; [bg_applied][fg]overlay=(W-w)/2:(H-h)/2,scale=iw*${zoom}:ih*${zoom},crop=${safeW}:${safeH},format=yuv420p`;
        } else {
          // Solid color path: standard pad
          ratioFilter = `${manualCrop},setsar=1,scale=w=${safeW}:h=${safeH}:force_original_aspect_ratio=decrease,pad=${safeW}:${safeH}:(ow-iw)/2:(oh-ih)/2:color=${bgColorVal.replace('#', '0x')},scale=iw*${zoom}:ih*${zoom},crop=${safeW}:${safeH},format=yuv420p`;
        }
      }
      
      let posFilter = "";
      switch (logoPosition) {
        case 'top-left': posFilter = `${padding}:${padding}`; break;
        case 'top-right': posFilter = `W-w-${padding}:${padding}`; break;
        case 'bottom-left': posFilter = `${padding}:H-h-${padding}`; break;
        case 'bottom-right': posFilter = `W-w-${padding}:H-h-${padding}`; break;
        default: posFilter = `W-w-${padding}:${padding}`; // top-right default
      }

      // If audio is longer than video, speed it up to match video duration exactly
      const speed = (vDur > 0 && aDur > (vDur + 0.1)) ? (aDur / vDur) : 1;
      
      // Build filter complex
      let vFilters: string[] = [];
      let lastV = "[0:v]";
      
      // Stage 1: Ratio & Zoom & Auto Flip & Color Correction (User requested)
      let baseFilters = [ratioFilter, "hflip", "eq=contrast=1.15:brightness=-0.05:saturation=1.25"].filter(Boolean).join(",");
      if (baseFilters) {
        vFilters.push(`${lastV}${baseFilters}[rv]`);
        lastV = "[rv]";
      }

      // Re-calculate effective resolution after ratio/scale
      const effectiveRes = { w: vRes.w, h: vRes.h };
      if (videoRatio) {
        const [rw, rh] = videoRatio.split(':').map(Number);
        if (effectiveRes.w / rw > effectiveRes.h / rh) {
           effectiveRes.w = Math.floor(effectiveRes.h * rw / rh);
        } else {
           effectiveRes.h = Math.floor(effectiveRes.w * rh / rw);
        }
      }
      const effectiveLogoScale = effectiveRes.w / 400;
      const effectiveFontScale = effectiveRes.w / 400;

      // Stage 2: Blur
      if (blurEnabled) {
        const bw = `(iw*${blurWidth || 400}/1000)`;
        const bh = `(ih*${blurHeight || 100}/1000)`;
        const byValue = blurY !== undefined ? blurY : 800;
        const radius = blurIntensity || 10;
        
        // Define coordinate tokens for different filters
        const cropY = `(ih*${byValue}/1000)`;
        const overlayY = `(H*${byValue}/1000)`;
        
        vFilters.push(`${lastV}split[v_main][v_blur]`);
        vFilters.push(`[v_blur]crop=w='trunc(min(iw,${bw})/2)*2':h='trunc(min(ih,${bh})/2)*2':x='(iw-out_w)/2':y='clip(${cropY},0,ih-out_h)',boxblur=${radius}:2[blurred]`);
        vFilters.push(`[v_main][blurred]overlay=x=(W-w)/2:y='clip(${overlayY},0,H-h)'[bv]`);
        lastV = "[bv]";
      }

      // Stage 3: Sync Subtitles
      if (subtitleEnabled && subtitleTimeline && Array.isArray(subtitleTimeline)) {
        const color = (subtitleColor || "#ffffff").replace('#', '0x');
        
        // Exact Preview Match: Preview uses 0.4 multiplier on a 400px wide container
        const previewFontSizeInPx = Math.max(8, (subtitleFontSize || 24) * 0.4);
        const fSize = Math.floor(previewFontSizeInPx * effectiveFontScale);
        
        const fontPaths = [
          path.join(__dirname, "Padauk-Bold.ttf"),
          path.join(process.cwd(), "Padauk-Bold.ttf"),
          "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf",
          "/usr/share/fonts/truetype/padauk/Padauk-Regular.ttf"
        ];

        let fontArg = "";
        for (const fp of fontPaths) {
          if (fs.existsSync(fp)) {
            fontArg = `:fontfile='${fp}'`;
            break;
          }
        }

        const wrapText = (text: string, maxLen: number) => {
          if (!text.includes(' ') && text.length > maxLen) {
            let res = [];
            for (let i = 0; i < text.length; i += maxLen) {
              res.push(text.substring(i, i + maxLen));
            }
            return res;
          }
          const words = text.split(/\s+/);
          let lines = [];
          let currentLine = "";
          words.forEach(word => {
            if ((currentLine + word).length > maxLen) {
              lines.push(currentLine.trim());
              currentLine = word + " ";
            } else {
              currentLine += word + " ";
            }
          });
          if (currentLine) lines.push(currentLine.trim());
          return lines;
        };

        let svIndex = 0;
        // If speed > 1, it means audio was sped up to fit video. 
        // Timeline was generated against original audio, so we must adjust it.
        const timelineScale = 1 / speed;

        for (const phrase of subtitleTimeline) {
          if (!phrase.text || !phrase.text.trim()) continue;
          
          // Center each line and moderately pad
          const lines = wrapText(phrase.text.trim(), 50);
          const maxLineLen = Math.max(...lines.map(l => l.length));
          const centeredLines = lines.map(l => {
            const padSize = Math.max(0, Math.floor((maxLineLen - l.length) / 2));
            const pad = " ".repeat(padSize);
            return `${pad}${l}${pad}`;
          });
          const wrapped = centeredLines.map(l => `  ${l}  `).join('\n');
          
          const startTime = phrase.start_time * timelineScale;
          const endTime = phrase.end_time * timelineScale;
          
          const chunkPath = path.join(tempDir, `chunk_${tempId}_${svIndex}.txt`);
          await writeFilePromise(chunkPath, wrapped);
          
          const enableArg = `:enable='between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})'`;
          // Position: center horizontally, 90% from top (Bottom Center)
          vFilters.push(`${lastV}drawtext=textfile='${chunkPath}':x=(w-text_w)/2:y=(h-text_h)*0.9:fontsize=${fSize}:fontcolor=${color}:box=1:boxcolor=black@0.6:boxborderw=15:line_spacing=5:fix_bounds=true${fontArg}${enableArg}[sv${svIndex}]`);
          
          lastV = `[sv${svIndex}]`;
          svIndex++;
        }
      }

      // Stage 4: Logo
      if (hasLogo) {
        const logoSizeVal = Math.floor((logoSize || 100) * effectiveLogoScale);
        vFilters.push(`[2:v]scale=${logoSizeVal}:-2[l]`);
        vFilters.push(`${lastV}[l]overlay=${posFilter}[vout]`);
        lastV = "[vout]";
      }

      let audioComplexFilters: string[] = [];
      if (speed > 1) {
        let atempo = `atempo=${speed}`;
        if (speed > 2.0) atempo = `atempo=2.0,atempo=${speed/2.0}`;
        audioComplexFilters.push(`[1:a]${atempo}[aout]`);
      }

      // Combine all filters
      const allFilters = [...vFilters, ...audioComplexFilters].join(';');
      const filterPath = path.join(tempDir, `filter_${tempId}.txt`);
      
      let ffmpegCmd = "";
      if (allFilters) {
        await writeFilePromise(filterPath, allFilters);
        // If lastV is still [0:v], it means no video filters were applied to it as labels
        const mapV = (lastV === "[0:v]") ? " -map 0:v:0" : ` -map "${lastV}"`;
        const mapA = (speed > 1) ? ' -map "[aout]"' : ' -map 1:a:0';
        
        ffmpegCmd = `ffmpeg -i "${videoPath}" -i "${audioPath}"${hasLogo ? ` -i "${logoPath}"` : ""} -filter_complex_script "${filterPath}"${mapV}${mapA} -c:v libx264 -preset ultrafast -c:a aac -b:a 192k -movflags +faststart -shortest -y "${outputPath}"`;
      } else {
        // No filters at all
        if (speed > 1) {
          ffmpegCmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "[1:a]atempo=${speed}[aout]" -map 0:v:0 -map "[aout]" -c:v libx264 -preset ultrafast -y "${outputPath}"`;
        } else {
          ffmpegCmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -shortest -y "${outputPath}"`;
        }
      }

      console.log("Executing CMD:", ffmpegCmd);
      await execPromise(ffmpegCmd);

      // Success
      const downloadFilename = `output_${tempId}.mp4`;
      appJobs.set(jobId, { 
        status: "completed", 
        downloadUrl: `/api/download/${downloadFilename}` 
      });

    } catch (error: any) {
      console.error("FFmpeg Error Output:", error.stderr || error);
      const errorMessage = error.stderr ? `FFmpeg Failed: ${error.stderr.split('\n').pop()}` : error.message;
      appJobs.set(jobId, { status: "error", error: errorMessage });
    } finally {
      // Cleanup source files only, KEEP the output file for download
      try {
        if (fs.existsSync(videoPath)) await unlinkPromise(videoPath);
        if (fs.existsSync(audioPath)) await unlinkPromise(audioPath);
        if (fs.existsSync(logoPath)) await unlinkPromise(logoPath);
        // Note: outputPath is kept for the download endpoint
        
        const fPath = path.join(tempDir, `filter_${tempId}.txt`);
        if (fs.existsSync(fPath)) await unlinkPromise(fPath);
        const subPath = path.join(tempDir, `subtitle_text_${tempId}.txt`);
        if (fs.existsSync(subPath)) await unlinkPromise(subPath);
        
        // Cleanup chunks
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          if (file.startsWith(`chunk_${tempId}_`)) {
            await unlinkPromise(path.join(tempDir, file));
          }
        }
      } catch (cleanError) {
        console.error("Cleanup Error:", cleanError);
      }
    }
  })();
});

  // Status endpoint for polling
  app.get("/api/status/:jobId", (req, res) => {
    const job = appJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  });

  // Download endpoint
  app.get("/api/download/:filename", (req, res) => {
    const filename = req.params.filename;
    // Basic security: only allow files from temp dir that start with output_
    if (!filename.startsWith("output_") || filename.includes("..")) {
      return res.status(403).send("Unauthorized");
    }
    const filePath = path.join(process.cwd(), "temp", filename);
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).send("File not found");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: "0.0.0.0",
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is missing. API calls will fail.");
    }
  });

  server.timeout = 300000; // 5 minutes
  server.headersTimeout = 305000;
  server.keepAliveTimeout = 305000;
}

startServer();
