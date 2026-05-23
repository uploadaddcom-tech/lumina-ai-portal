import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { exec } from "child_process";
import crypto from "crypto";
import { promisify } from "util";

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const readFilePromise = promisify(fs.readFile);

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const is503 = error.message?.includes("503") || error.status === 503 || error.message?.includes("high demand");
      const is429 = error.message?.includes("429") || error.status === 429;
      const is500 = error.message?.includes("500") || error.status === 500 || error.message?.includes("Internal error");
      
      if (i === maxRetries || (!is503 && !is429 && !is500)) {
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

const appJobs = new Map<string, { status: string; downloadUrl?: string; text?: string; audioData?: string; error?: string }>();

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

async function registerFonts() {
  console.log("Registering custom Myanmar fonts in system Fontconfig...");
  const fontsToRegister = [
    "Padauk-Bold.ttf",
    "TU01_PannYeat-Regular.ttf",
    "SM04_Moon-Bold.ttf",
    "Aka07-Bold.ttf",
    "M01_PuPu-Regular.ttf"
  ];

  const targetDirs = [
    "/usr/share/fonts/truetype/lumina",
    path.join(process.env.HOME || "/root", ".local/share/fonts"),
    path.join(process.env.HOME || "/root", ".fonts")
  ];

  let selectedDir = "";
  for (const dir of targetDirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // test write permission
      const testFile = path.join(dir, ".test_write");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      selectedDir = dir;
      console.log(`Using writable font directory: ${selectedDir}`);
      break;
    } catch (e) {
      console.warn(`Directory ${dir} not writable, trying next...`);
    }
  }

  if (!selectedDir) {
    console.warn("No writable standard font directories found! Fonts might not register correctly.");
    return;
  }

  for (const font of fontsToRegister) {
    const srcPath = path.join(process.cwd(), font);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(selectedDir, font);
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${font} to ${destPath}`);
      } catch (err) {
        console.error(`Failed to copy font ${font}:`, err);
      }
    } else {
      console.warn(`Font file not found in build directory: ${srcPath}`);
    }
  }

  try {
    console.log("Executing fc-cache to rebuild font cache...");
    const { stdout, stderr } = await execPromise("fc-cache -fv");
    console.log("fc-cache command execution output:", stdout || stderr);
  } catch (err: any) {
    console.warn("fc-cache failed (might be headless system or fc-cache is missing):", err.message);
  }
}

async function startServer() {
  // Register Myanmar fonts on startup to enable correct Harfbuzz Unicode text shaping
  await registerFonts();

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
        const model = "gemini-2.5-flash";
        
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
          "fairytale-humor": lang === "EN"
            ? "Tell a highly dramatic, fairytale-like narrative story of this video, but pack it with tons of clever jokes, funny observations, and lots of humor to make it extremely funny."
            : "ဒီဗီဒီယိုကို ပုံပြင်ဆန်ဆန် ဇာတ်လမ်းတစ်ပုဒ်လို ပြန်ပြောပြပေးပါ၊ ဒါပေမယ့် ရယ်စရာကောင်းတဲ့ ဟာသတွေ၊ ဟာသဥာဏ်ရွှင်တဲ့ သရော်ချက်တွေနဲ့ ဟာသများများ ပေါင်းစပ်ပြီး အလွန်ရယ်ရမယ့် ပုံစံမျိုးဖြင့် ရေးပေးပါ။",
        };

        const wordCount = duration ? Math.floor((duration / 60) * 150) : 150;
        
        const constraintPrompt = lang === "EN"
          ? `Constraints:
             - Script length: Approximately ${wordCount} words (Strictly target 150 words per 60 seconds).
             - Output: Final polished narrative script ONLY.
             - DO NOT include ANY introductions like "Let's start", "Hello", "In this video", "စလိုက်ရအောင်", "ပြောပြမယ်နော်".
             - DO NOT use numbering, bullet points, or list formatting.
             - DO NOT include timestamps.
             - Provide the text exactly as it should be read for a voiceover.`
          : `ကန့်သတ်ချက်များ -
             - Script အရှည် - စကားလုံးရေ ${wordCount} ခန့် (ဗီဒီယို ၁ မိနစ်လျှင် စကားလုံး ၁၅၀ နှုန်းဖြင့် တိကျစွာ တွက်ချက်ထားသည်)။
             - ရလဒ် - အချောသတ်ထားသော ဇာတ်ညွှန်း (Script) သာ ဖြစ်ရမည်။
             - "စလိုက်ရအောင်"၊ "ပြောပြမယ်နော်"၊ "မင်္ဂလာပါ" "ဒီဗီဒီယိုလေးမှာ" ကဲ့သို့သော အစဦး စကားလုံးများ လုံးဝ မထည့်ရ။
             - အမှတ်စဉ်များ၊ Bullet point များ သို့မဟုတ် စာရင်းပုံစံများ လုံးဝ မသုံးရ။
             - အချိန်မှတ်တမ်း (Timestamps) များ မထည့်ရ။
             - Voiceover စကားပြောစတိုင်ဖြင့် ရေးသားပါ။ "သည်" ဟု အဆုံးသတ်ခြင်းကို လုံးဝ မသုံးရ၊ "တယ်" (သို့မဟုတ်) "နေတယ်" စသည့် စကားပြောအသုံးအနှုန်းများကိုသာ သုံးရမည်။
             - Voiceover အနေဖြင့် တိုက်ရိုက်ဖတ်ရမယ့် စာသားအတိုင်းသာ ဖော်ပြပေးပါ။`;

        const promptSnippet = stylePrompts[style] || stylePrompts["step-by-step"];
        const finalPrompt = `${promptSnippet}\n\n${constraintPrompt}\n\nRespond in ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language. Provide direct output only.`;

        const response = await retryWithBackoff(() => aiClient.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                { text: finalPrompt },
                { inlineData: { data: videoBase64, mimeType } }
              ]
            }
          ]
        }));
        
        let text = response.text || "";
        if (lang === "MY") {
          text = text.replace(/သည်([။၊\s\n]|$)/g, 'တယ်$1');
          text = text.replace(/သနည်း([။၊\s\n]|$)/g, 'သလဲ$1');
          text = text.replace(/ခဲ့သည်([။၊\s\n]|$)/g, 'ခဲ့တယ်$1');
        }

        appJobs.set(jobId, { status: "completed", text });
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
        const model = "gemini-2.5-flash";
        const prompt = `Listen to the audio in this video carefully and transcribe it, then translate the transcription into ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language so that it flows naturally. Only provide the translated text.`;

        const response = await retryWithBackoff(() => aiClient.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { data: videoBase64, mimeType } }
              ]
            }
          ]
        }));
        
        appJobs.set(jobId, { status: "completed", text: response.text });
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
        subtitleColor,
        subtitleFontSize,
        subtitleFont,
        subtitleBoxColor,
        subtitleY,
        glowingSweepEnabled,
        freezeFrameZoomEnabled,
        apiKey: customKey
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

      // Get audio track details
      const getAudioDetails = async (filePath: string) => {
        try {
          const { stdout } = await execPromise(`ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate,channels -of csv=p=0 "${filePath}"`);
          const parts = stdout.trim().split(',');
          if (parts.length === 2) {
            return { hasAudio: true, sample_rate: parseInt(parts[0]) || 44100, channels: parseInt(parts[1]) || 2 };
          }
        } catch (e) {
          // Fall through
        }
        return { hasAudio: false, sample_rate: 44100, channels: 2 };
      };

      // Get Durations to handle speed adjustment
      const getDuration = async (filePath: string) => {
        try {
          // 1. Try format duration
          const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
          let duration = parseFloat(stdout.trim());
          if (!isNaN(duration) && duration > 0) return duration;
        } catch (e) {
          console.warn(`ffprobe format duration check failed for ${filePath}, trying streams...`);
        }

        try {
          // 2. Try select first stream duration
          const { stdout: streamStream } = await execPromise(`ffprobe -v error -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 -select_streams 0 "${filePath}"`);
          let duration = parseFloat(streamStream.trim());
          if (!isNaN(duration) && duration > 0) return duration;
        } catch (e) {
          // Silent fallback
        }

        try {
          // 3. Try select specific video stream
          const { stdout: streamV } = await execPromise(`ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
          let duration = parseFloat(streamV.trim());
          if (!isNaN(duration) && duration > 0) return duration;
        } catch (e) {
          // Silent fallback
        }

        try {
          // 4. Try select specific audio stream
          const { stdout: streamA } = await execPromise(`ffprobe -v error -select_streams a:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
          let duration = parseFloat(streamA.trim());
          if (!isNaN(duration) && duration > 0) return duration;
        } catch (e) {
          // Silent fallback
        }

        // Final fallback parsing standard ffmpeg -i stderr output
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
          console.error("Duration Parsing Error in fallback:", innerE);
        }
        return 0;
      };

      // Apply Freeze Frame Zoom if enabled
      const zoomIntervals: { start: number; end: number }[] = [];
      if (freezeFrameZoomEnabled === true || freezeFrameZoomEnabled === 'true') {
        const rawVideoPath = path.join(tempDir, `video_raw_${tempId}.mp4`);
        fs.renameSync(videoPath, rawVideoPath);
        
        try {
          const originalResRaw = await getResolution(rawVideoPath);
          const originalRes = {
            w: Math.max(2, Math.floor(originalResRaw.w / 2) * 2),
            h: Math.max(2, Math.floor(originalResRaw.h / 2) * 2)
          };
          const durationRaw = await getDuration(rawVideoPath);
          const { hasAudio, sample_rate, channels } = await getAudioDetails(rawVideoPath);
          
          // Fixed freeze interval of 6 seconds, as explicitly requested by the user
          const freezeInterval = 6;
          console.log(`Applying Freeze Frame Zoom 2s every ${freezeInterval}s on video of duration ${durationRaw}s...`);
          
          const freezeTimes: number[] = [];
          for (let t = freezeInterval; t < durationRaw - 2; t += freezeInterval) {
            freezeTimes.push(t);
          }
          
          if (freezeTimes.length === 0) {
            // Just normalize and output
            await execPromise(`ffmpeg -i "${rawVideoPath}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -g 30 -keyint_min 30 -sc_threshold 0 -s ${originalRes.w}x${originalRes.h} ${hasAudio ? "-c:a aac" : "-f lavfi -i anullsrc=r=" + sample_rate + ":cl=" + (channels === 1 ? "mono" : "stereo") + " -c:a aac -shortest"} -y "${videoPath}"`);
          } else {
            // Define concurrency pool helper to limit parallel executions safely
            const runWithConcurrencyLimit = async <T>(
              tasks: (() => Promise<T>)[],
              limit: number
            ): Promise<T[]> => {
              const results: T[] = new Array(tasks.length);
              let currentIndex = 0;

              const worker = async () => {
                while (currentIndex < tasks.length) {
                  const index = currentIndex++;
                  results[index] = await tasks[index]();
                }
              };

              const workers = Array.from(
                { length: Math.min(limit, tasks.length) },
                () => worker()
              );
              await Promise.all(workers);
              return results;
            };

            interface SegmentTask {
              type: 'normal' | 'zoom';
              index: number;
              filePath: string;
              prevTime?: number;
              segDuration?: number;
              fTime?: number;
            }

            const segmentTasks: SegmentTask[] = [];
            let prevTime = 0;
            let currentConcatTime = 0;

            for (let i = 0; i < freezeTimes.length; i++) {
              const fTime = freezeTimes[i];
              const segDuration = fTime - prevTime;
              
              const segPath = path.join(tempDir, `part_norm_${tempId}_${i}.mp4`);
              segmentTasks.push({
                type: 'normal',
                index: i,
                filePath: segPath,
                prevTime,
                segDuration
              });
              currentConcatTime += segDuration;

              const zoomPath = path.join(tempDir, `part_zoom_${tempId}_${i}.mp4`);
              segmentTasks.push({
                type: 'zoom',
                index: i,
                filePath: zoomPath,
                fTime
              });
              zoomIntervals.push({ start: currentConcatTime, end: currentConcatTime + 2.0 });
              currentConcatTime += 2.0;

              prevTime = fTime;
            }

            const lastSegPath = path.join(tempDir, `part_norm_${tempId}_last.mp4`);
            const lastSegDuration = durationRaw - prevTime;
            segmentTasks.push({
              type: 'normal',
              index: -1,
              filePath: lastSegPath,
              prevTime,
              segDuration: lastSegDuration
            });

            // Define safeNum helper specifically for number parsing robustly
            const safeNum = (val: any, fallback: number): number => {
              if (val === undefined || val === null || val === "") return fallback;
              const parsed = Number(val);
              return isNaN(parsed) ? fallback : parsed;
            };

            // Translate into parallel tasks
            const tasks = segmentTasks.map(task => {
              return async () => {
                if (task.type === 'normal') {
                  const segPath = task.filePath;
                  const prevTimeVal = task.prevTime!;
                  const segDurationVal = task.segDuration!;
                  if (hasAudio) {
                    await execPromise(`ffmpeg -ss ${prevTimeVal} -t ${segDurationVal.toFixed(3)} -i "${rawVideoPath}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -g 30 -keyint_min 30 -sc_threshold 0 -s ${originalRes.w}x${originalRes.h} -c:a aac -ar ${sample_rate} -ac ${channels} -y "${segPath}"`);
                  } else {
                    await execPromise(`ffmpeg -ss ${prevTimeVal} -t ${segDurationVal.toFixed(3)} -i "${rawVideoPath}" -f lavfi -i anullsrc=r=${sample_rate}:cl=${channels === 1 ? 'mono' : 'stereo'} -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -g 30 -keyint_min 30 -sc_threshold 0 -s ${originalRes.w}x${originalRes.h} -c:a aac -ar ${sample_rate} -ac ${channels} -shortest -y "${segPath}"`);
                  }
                } else {
                  const i = task.index;
                  const fTimeVal = task.fTime!;
                  const zoomPath = task.filePath;
                  
                  const framePath = path.join(tempDir, `frame_${tempId}_${i}.png`);
                  
                  if (blurEnabled === true || blurEnabled === 'true') {
                    try {
                      const cTop = Math.min(45, safeNum(cropTop, 0)) / 100;
                      const cBottom = Math.min(45, safeNum(cropBottom, 0)) / 100;
                      const cLeft = Math.min(45, safeNum(cropLeft, 0)) / 100;
                      const cRight = Math.min(45, safeNum(cropRight, 0)) / 100;

                      const croppedW = originalRes.w * (1 - cLeft - cRight);
                      const croppedH = originalRes.h * (1 - cTop - cBottom);
                      const cropYOffset = originalRes.h * cTop;

                      const bWidthVal = safeNum(blurWidth, 400);
                      const bHeightVal = safeNum(blurHeight, 100);
                      const bYPercent = safeNum(blurY, 800);

                      const bw = croppedW * bWidthVal / 1000;
                      const bh = croppedH * bHeightVal / 1000;
                      const cropY = cropYOffset + (croppedH * bYPercent / 1000);

                      const bw_trunc = Math.max(2, Math.min(originalRes.w - 4, Math.floor(bw / 2) * 2));
                      const bh_trunc = Math.max(2, Math.min(originalRes.h - 4, Math.floor(bh / 2) * 2));
                      const cy_clip = Math.max(0, Math.min(originalRes.h - bh_trunc - 4, Math.floor(cropY)));
                      const radius = blurIntensity || 10;

                      // Combined extract + scale + blur in a single high-performance ffmpeg command
                      await execPromise(`ffmpeg -ss ${fTimeVal} -i "${rawVideoPath}" -vframes 1 -q:v 2 -vf "scale=${originalRes.w}:${originalRes.h},split[v_main][v_blur]; [v_blur]crop=w=${bw_trunc}:h=${bh_trunc}:x=(iw-${bw_trunc})/2:y=${cy_clip},boxblur=${radius}:2[blurred]; [v_main][blurred]overlay=x=(W-${bw_trunc})/2:y=${cy_clip}" -y "${framePath}"`);
                    } catch (blurFrameError) {
                      console.error(`Failed to apply subtitle blur to frame ${i}:`, blurFrameError);
                      // Fallback: extract and scale without blur if combined execution failed
                      await execPromise(`ffmpeg -ss ${fTimeVal} -i "${rawVideoPath}" -vframes 1 -q:v 2 -vf "scale=${originalRes.w}:${originalRes.h}" -y "${framePath}"`);
                    }
                  } else {
                    // Extract and scale without blur
                    await execPromise(`ffmpeg -ss ${fTimeVal} -i "${rawVideoPath}" -vframes 1 -q:v 2 -vf "scale=${originalRes.w}:${originalRes.h}" -y "${framePath}"`);
                  }
                  
                  // Zoom pan to generate 2s segment video
                  await execPromise(`ffmpeg -loop 1 -i "${framePath}" -f lavfi -i anullsrc=r=${sample_rate}:cl=${channels === 1 ? 'mono' : 'stereo'} -vf "zoompan=z='1.00+0.15*on/60':x='(iw-iw/max(1,zoom))/2':y='(ih-ih/max(1,zoom))/2':d=60:fps=30:s=${originalRes.w}x${originalRes.h},format=yuv420p" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30 -g 30 -keyint_min 30 -sc_threshold 0 -c:a aac -ar ${sample_rate} -ac ${channels} -t 2 -y "${zoomPath}"`);
                  
                  if (fs.existsSync(framePath)) {
                    await unlinkPromise(framePath);
                  }
                }
              };
            });

            // Limit processing concurrency to 3 to optimize CPU utilization without throttling
            await runWithConcurrencyLimit(tasks, 3);

            const segmentFiles = segmentTasks.map(t => t.filePath);

            // Concat segments
            const concatTxtPath = path.join(tempDir, `concat_${tempId}.txt`);
            const concatContent = segmentFiles.map(f => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join('\n');
            await writeFilePromise(concatTxtPath, concatContent);
            
            await execPromise(`ffmpeg -f concat -safe 0 -i "${concatTxtPath}" -c copy -y "${videoPath}"`);
            
            // Clean up files immediately
            for (const file of segmentFiles) {
              if (fs.existsSync(file)) await unlinkPromise(file);
            }
            if (fs.existsSync(concatTxtPath)) await unlinkPromise(concatTxtPath);
          }
        } catch (error) {
          console.error("Freeze zoom processing failed, falling back to original video:", error);
          fs.copyFileSync(rawVideoPath, videoPath);
          zoomIntervals.length = 0; // Reset zoom intervals so static blur works normally on the original fallback video
        } finally {
          if (fs.existsSync(rawVideoPath)) await unlinkPromise(rawVideoPath);
          // Complete cleanup of any stray segment files to prevent disk usage overflow and memory pressure
          try {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
              if (file.includes(`_${tempId}_`) || file.includes(`_${tempId}.txt`)) {
                const fullP = path.join(tempDir, file);
                if (fs.existsSync(fullP)) {
                  fs.unlinkSync(fullP);
                }
              }
            }
          } catch (cleanE) {
            console.error("Stray files cleanup failed:", cleanE);
          }
        }
      }

      const vDurRaw = await getDuration(videoPath);
      // Speed up video by 5% (1.05x speed). Therefore, the effective video duration becomes:
      const vDur = vDurRaw / 1.05;
      const aDur = await getDuration(audioPath);
      
      console.log(`Duration check -> Raw Video Duration (vDurRaw): ${vDurRaw}s, Effective Video Duration (vDur) under 1.05x: ${vDur}s, Audio Duration (aDur): ${aDur}s`);
      
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

      // Speed up or slow down the audio to match the effective video duration exactly (they must finish at the same time)
      const speed = vDur > 0 ? (aDur / vDur) : 1;
      console.log(`Speed calculation results -> Target video duration: ${vDur}s, Original audio duration: ${aDur}s. Alignment speed factor: ${speed}`);

      // Generate the optimal atempo filter chain to achieve the target speed
      let atempoChain = "";
      if (Math.abs(speed - 1.0) > 0.005) {
        let tempSpeed = speed;
        const speedFactors: number[] = [];
        while (tempSpeed > 2.0) {
          speedFactors.push(2.0);
          tempSpeed /= 2.0;
        }
        while (tempSpeed < 0.5) {
          speedFactors.push(0.5);
          tempSpeed /= 0.5;
        }
        if (Math.abs(tempSpeed - 1.0) > 0.005) {
          speedFactors.push(tempSpeed);
        }
        atempoChain = speedFactors.map(s => `atempo=${s.toFixed(4)}`).join(',');
      }
      
      // Build filter complex
      let vFilters: string[] = [];
      let lastV = "[0:v]";
      
      // Stage 1: Ratio & Zoom & Auto Flip & Color Correction (User requested) + 5% frame play-rate speed-up (setpts=PTS/1.05)
      let baseFilters = [ratioFilter, "hflip", "eq=contrast=1.15:brightness=-0.05:saturation=1.25", "setpts=PTS/1.05"].filter(Boolean).join(",");
      if (baseFilters) {
        vFilters.push(`${lastV}${baseFilters}[rv]`);
        lastV = "[rv]";
      }

      // Stage 1.5: Professional Glowing Light Sweep (geq filter)
      // The user wants a glowing light sweep at equal intervals, avoiding the first 3 seconds and the last 3 seconds.
      // - 1 min and below: exactly 3 times proportionally
      // - Above 1 min & below 2 mins: exactly 6 times proportionally
      // - Above 2 mins & below 3 mins: exactly 9 times proportionally
      if (glowingSweepEnabled === true || glowingSweepEnabled === 'true') {
        const safeVDur = (vDur && vDur > 0 && !isNaN(vDur)) ? vDur : 10;
        const sBoundary = safeVDur > 8 ? 3.0 : safeVDur * 0.15;
        const eBoundary = safeVDur > 8 ? safeVDur - 3.0 : safeVDur * 0.85;
        const activeRange = Math.max(0.1, eBoundary - sBoundary);

        let numSweeps = 3;
        if (safeVDur <= 60) {
          numSweeps = 3;
        } else if (safeVDur <= 120) {
          numSweeps = 6;
        } else {
          numSweeps = 9;
        }

        const sweepDur = 1.2;
        const sweepExpressions: { s: string; e: string }[] = [];

        for (let i = 1; i <= numSweeps; i++) {
          const fraction = i / (numSweeps + 1);
          const targetTime = sBoundary + activeRange * fraction;
          const s = (targetTime - sweepDur / 2).toFixed(3);
          const e = (targetTime + sweepDur / 2).toFixed(3);
          sweepExpressions.push({ s, e });
        }

        // Build the nested FFMPEG expression for sweep position
        let S_expr = "-9999";
        for (let i = numSweeps - 1; i >= 0; i--) {
          const { s, e } = sweepExpressions[i];
          S_expr = `if(between(T,${s},${e}),(W+H+300)*(T-${s})/${sweepDur}-150,${S_expr})`;
        }
        
        // We will perform geq on RGB format and then convert back to standard format for optimal performance and color accuracy
        // This adds a peak brightness of 160 with a soft-blurred roll-off width of 150px
        const geqFilter = `format=gbrp,geq=r='min(255,r(X,Y)+max(0,160*(1-abs(X+Y-(${S_expr}))/150)))':g='min(255,g(X,Y)+max(0,160*(1-abs(X+Y-(${S_expr}))/150)))':b='min(255,b(X,Y)+max(0,160*(1-abs(X+Y-(${S_expr}))/150)))',format=yuv420p`;
        
        vFilters.push(`${lastV}${geqFilter}[gsv]`);
        lastV = "[gsv]";
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
      const effectiveFontScale = Math.max(effectiveRes.w / 400, effectiveRes.h / 225);

      // Stage 2: Blur
      if (blurEnabled) {
        const bw = `(iw*${blurWidth || 400}/1000)`;
        const bh = `(ih*${blurHeight || 100}/1000)`;
        const byValue = blurY !== undefined ? blurY : 800;
        const radius = blurIntensity || 10;
        
        // Define coordinate tokens for different filters
        const cropY = `(ih*${byValue}/1000)`;
        const overlayY = `(H*${byValue}/1000)`;
        
        // Disable the global static blur overlay during freeze-frame zooms since those are already blurred dynamically.
        // Account for 1.05x speed-up timeline compression in Stage 1.
        let enableExpr = "";
        if (zoomIntervals && zoomIntervals.length > 0) {
          const parts = zoomIntervals.map(interval => {
            const startScaled = interval.start / 1.05;
            const endScaled = interval.end / 1.05;
            return `not(between(t,${startScaled.toFixed(3)},${endScaled.toFixed(3)}))`;
          });
          enableExpr = `:enable='${parts.join("*")}'`;
        }
        
        vFilters.push(`${lastV}split[v_main][v_blur]`);
        vFilters.push(`[v_blur]crop=w='trunc(min(iw,${bw})/2)*2':h='trunc(min(ih,${bh})/2)*2':x='(iw-out_w)/2':y='clip(${cropY},0,ih-out_h)',boxblur=${radius}:2[blurred]`);
        vFilters.push(`[v_main][blurred]overlay=x=(W-w)/2:y='clip(${overlayY},0,H-h)'${enableExpr}[bv]`);
        lastV = "[bv]";
      }

      // Stage 3: Sync Subtitles with AI Timestamps
      if (subtitleEnabled && subtitleText) {
        let fontFamily = "Padauk";
        if (subtitleFont === "TU01 PannYeat") {
          fontFamily = "TU01 PannYeat";
        } else if (subtitleFont === "SM04 Moon") {
          fontFamily = "SM04 Moon";
        } else if (subtitleFont === "Aka07") {
          fontFamily = "Aka07";
        } else if (subtitleFont === "M01 PuPu") {
          fontFamily = "M01 PuPu";
        }

        const color = (subtitleColor || "#ffffff").replace('#', '0x');
        const previewFontSizeInPx = Math.max(1, (subtitleFontSize || 24) * 0.4);
        const fSize = Math.floor(previewFontSizeInPx * effectiveFontScale);

        let svChunks: { text: string; start_time: number; end_time: number }[] = [];

        console.log("Requesting AI Timestamps for Subtitles...");
        const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
        
        let aiAudioBase64 = audioBuffer.toString('base64');
        
        // CRITICAL SYNC FIX: If audio is speed-adjusted, AI must hear the ADJUSTED audio 
        // to provide accurate timestamps for the final video timeline.
        if (atempoChain) {
          console.log(`Pre-adjusting audio for AI sync with filter: ${atempoChain}...`);
          const aiAudioPath = path.join(tempDir, `ai_audio_${tempId}.wav`);
          
          try {
            await execPromise(`ffmpeg -i "${audioPath}" -filter:a "${atempoChain}" -y "${aiAudioPath}"`);
            const scaledBuffer = fs.readFileSync(aiAudioPath);
            aiAudioBase64 = scaledBuffer.toString('base64');
            if (fs.existsSync(aiAudioPath)) await unlinkPromise(aiAudioPath);
          } catch (ffmpegErr) {
            console.warn("Pre-adjustment failed, using original audio:", ffmpegErr);
          }
        }
        
        const timestampPrompt = `
          Task: Provide an extremely precise JSON array of subtitle timestamps (start and end times in seconds with 3 decimal places for millisecond accuracy) for this audio based on the script.
          
          Script: "${subtitleText}"
          
          Requirements:
          1. Analyze the audio with extreme precision down to milliseconds to match the exact start and end of spoken words in the script.
          2. Break the script into small, highly readable chunks (usually around 4-8 words or a short phrase).
          3. Detect silences, breaths, and pauses accurately, ensuring subtitles do not overlap during silent gaps.
          4. Return ONLY a JSON array of objects: [{"text": "...", "start_time": 1.234, "end_time": 4.567}, ...]
          5. Timestamps MUST be numbers in seconds with exactly 3 decimal places (e.g., 2.345) to ensure perfect synchronization.
          6. Ensure the chunks cover the FULL script in precise sequential order without missing any text.
        `;

        svChunks = await retryWithBackoff(async () => {
          const tsResponse = await aiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                parts: [
                  { text: timestampPrompt },
                  { inlineData: { data: aiAudioBase64, mimeType: 'audio/wav' } }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });

          const tsRaw = tsResponse.text || "[]";
          return JSON.parse(tsRaw);
        });

        console.log(`Successfully received and parsed ${svChunks.length} AI subtitle segments.`);

        let svIndex = 0;
        for (const chunk of svChunks) {
          if (!chunk.text.trim()) continue;
          
          const wrapText = (text: string, maxLen: number) => {
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

          const getVisualLength = (str: string) => {
            // Myanmar combining marks heuristic: ignore non-spacing marks for visual width estimation
            return str.replace(/[\u102B-\u103E\u105A-\u105D\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D]/g, '').length;
          };

          const lines = wrapText(chunk.text.trim(), 40);
          const visualLengths = lines.map(getVisualLength);
          const maxWidth = Math.max(...visualLengths);
          
          const centeredLines = lines.map((l, idx) => {
            const padSize = Math.max(0, Math.floor((maxWidth - visualLengths[idx]) / 2));
            const pad = " ".repeat(padSize);
            return `${pad}${l}${pad}`;
          });
          // Add tighter horizontal padding to the lines
          const wrapped = centeredLines.map(l => ` ${l} `).join('\n');
          
          const chunkPath = path.join(tempDir, `chunk_${tempId}_${svIndex}.txt`);
          await writeFilePromise(chunkPath, wrapped);
          
          const enableArg = `:enable='between(t,${chunk.start_time.toFixed(3)},${chunk.end_time.toFixed(3)})'`;
          const boxCol = (subtitleBoxColor || "#000000").replace('#', '0x');
          const subYPercent = typeof subtitleY === "number" ? subtitleY : 90;
          const subYFact = (subYPercent / 100).toFixed(3);
          
          // Use Fontconfig registered name for correct Harfbuzz Unicode text shaping
          const fontArg = `:font='${fontFamily}':text_shaping=1`;

          vFilters.push(`${lastV}drawtext=textfile='${chunkPath}':x=(w-text_w)/2:y=(h-text_h)*${subYFact}:fontsize=${fSize}:fontcolor=${color}:box=1:boxcolor=${boxCol}@0.6:boxborderw=10:line_spacing=5:fix_bounds=true${fontArg}${enableArg}[sv${svIndex}]`);
          
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
      if (atempoChain) {
        audioComplexFilters.push(`[1:a]${atempoChain}[aout]`);
      }

      // Combine all filters
      const allFilters = [...vFilters, ...audioComplexFilters].join(';');
      const filterPath = path.join(tempDir, `filter_${tempId}.txt`);
      
      let ffmpegCmd = "";
      if (allFilters) {
        await writeFilePromise(filterPath, allFilters);
        // If lastV is still [0:v], it means no video filters were applied to it as labels
        const mapV = (lastV === "[0:v]") ? " -map 0:v:0" : ` -map "${lastV}"`;
        const mapA = atempoChain ? ' -map "[aout]"' : ' -map 1:a:0';
        
        ffmpegCmd = `ffmpeg -i "${videoPath}" -i "${audioPath}"${hasLogo ? ` -i "${logoPath}"` : ""} -filter_complex_script "${filterPath}"${mapV}${mapA} -c:v libx264 -preset ultrafast -c:a aac -b:a 192k -movflags +faststart -shortest -y "${outputPath}"`;
      } else {
        // No filters at all
        if (atempoChain) {
          ffmpegCmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "[1:a]${atempoChain}[aout]" -map 0:v:0 -map "[aout]" -c:v libx264 -preset ultrafast -y "${outputPath}"`;
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
        const assPath = path.join(tempDir, `subtitles_${tempId}.ass`);
        if (fs.existsSync(assPath)) await unlinkPromise(assPath);
        
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
