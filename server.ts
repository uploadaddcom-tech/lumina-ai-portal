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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    try {
      const { videoBase64, mimeType, style, lang, duration } = req.body;
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

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { text: finalPrompt },
              { inlineData: { data: videoBase64, mimeType } }
            ]
          }
        ]
      });
      
      let text = response.text || "";
      if (lang === "MY") {
        // Post-process to replace formal 'သည်' with 'တယ်' for real-time natural speaking style
        // We target 'သည်' at the end of sentences/phrases
        text = text.replace(/သည်([။၊\s\n]|$)/g, 'တယ်$1');
        text = text.replace(/သနည်း([။၊\s\n]|$)/g, 'သလဲ$1');
        text = text.replace(/ခဲ့သည်([။၊\s\n]|$)/g, 'ခဲ့တယ်$1');
      }

      res.json({ text });
    } catch (error: any) {
      console.error("Recap Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/transcribe", async (req, res) => {
    try {
      const { videoBase64, mimeType, lang } = req.body;
      const model = "gemini-3-flash-preview";
      const prompt = `Listen to the audio in this video carefully and transcribe it, then translate the transcription into ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language so that it flows naturally. Only provide the translated text.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: videoBase64, mimeType } }
            ]
          }
        ]
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Transcribe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/voiceover", async (req, res) => {
    try {
      const { text, voiceName } = req.body;
      const model = "gemini-3.1-flash-tts-preview";

      const response = await ai.models.generateContent({
        model: model,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || "Kore" }
            }
          }
        } as any
      });
      
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      res.json({ audioData });
    } catch (error: any) {
      console.error("Voiceover Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Server-side Merging Endpoint
  app.post("/api/merge", async (req, res) => {
    const tempId = crypto.randomBytes(8).toString("hex");
    const tempDir = path.join(process.cwd(), "temp");
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

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
        blurEnabled,
        blurWidth,
        blurHeight,
        blurY,
        subtitleEnabled,
        subtitleText,
        subtitleColor,
        subtitleFontSize,
        subtitleFont
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
          const { stderr } = await execPromise(`ffmpeg -i "${filePath}" 2>&1`);
          const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (match) {
            const h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const s = parseInt(match[3]);
            const ms = parseInt(match[4]);
            return h * 3600 + m * 60 + s + ms / 100;
          }
        } catch (e) {
          const errStr = String(e);
          const match = errStr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (match) {
            const h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const s = parseInt(match[3]);
            const ms = parseInt(match[4]);
            return h * 3600 + m * 60 + s + ms / 100;
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

      const speed = (vDur > 0 && aDur > vDur) ? aDur / vDur : 1;
      
      // Build filter complex
      let vFilters: string[] = [];
      let lastV = "[0:v]";
      
      // Stage 1: Ratio & Zoom
      if (videoRatio) {
        const z = (videoScale || 100) / 100;
        let crop = "";
        if (videoRatio === "9:16") {
          crop = `crop=w='trunc(min(iw,ih*9/16)/${z}/2)*2':h='trunc(min(ih,iw/(9/16))/${z}/2)*2'`;
        } else if (videoRatio === "1:1") {
          crop = `crop=w='trunc(min(iw,ih)/${z}/2)*2':h='trunc(min(ih,iw)/${z}/2)*2'`;
        } else if (videoRatio === "16:9") {
          crop = `crop=w='trunc(min(iw,ih*16/9)/${z}/2)*2':h='trunc(min(ih,iw/(16/9))/${z}/2)*2'`;
        }
        
        if (crop) {
          const rat = videoRatio.replace(':', '/');
          const scale = `scale=w='trunc(min(iw,ih*${rat})/2)*2':h='trunc(min(ih,iw/(${rat}))/2)*2'`;
          vFilters.push(`${lastV}setsar=1,${crop},${scale},format=yuv420p[rv]`);
          lastV = "[rv]";
        }
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
        const by = `(ih*${byValue}/1000)`;
        const bx = `(iw-out_w)/2`;
        
        vFilters.push(`${lastV}split[v1][v2]`);
        vFilters.push(`[v2]crop=w='trunc(min(iw,${bw})/2)*2':h='trunc(min(ih,${bh})/2)*2':x='clip(${bx},0,iw-out_w)':y='clip(${by},0,ih-out_h)',boxblur=15:5[blurred]`);
        vFilters.push(`[v1][blurred]overlay=x='clip(${bx},0,W-w)':y='clip(${by},0,H-h)'[bv]`);
        lastV = "[bv]";
      }

      // Stage 3: Sync Subtitles
      if (subtitleEnabled && subtitleText) {
        const wrapText = (text: string, maxLen: number) => {
          const words = text.split(/\s+/);
          let lines = [];
          let currentLine = "";
          words.forEach(word => {
            if ((currentLine + " " + word).length > maxLen) {
              lines.push(currentLine.trim());
              currentLine = word;
            } else {
              currentLine = currentLine ? currentLine + " " + word : word;
            }
          });
          if (currentLine) lines.push(currentLine.trim());
          return lines;
        };

        const color = (subtitleColor || "#ffffff").replace('#', '0x');
        // The UI preview uses subtitleFontSize * 0.1. 
        // We need to scale this 0.1 ratio to the actual video resolution.
        const fSize = Math.floor((subtitleFontSize || 24) * effectiveFontScale / 10);
        
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

        // Split text into chunks for syncing
        // We'll split by sentence enders first
        const chunks = subtitleText.split(/(?<=[။.!?])\s+/);
        
        // Total time for subtitles is the audio duration
        const totalTime = aDur || vDur;
        const charsTotal = subtitleText.length || 1;
        
        let currentTime = 0;
        let svIndex = 0;

        for (const chunk of chunks) {
          if (!chunk.trim()) continue;
          
          const wrapped = wrapText(chunk, 40).join('\n');
          const chunkDuration = (chunk.length / charsTotal) * totalTime;
          const chunkStartTime = currentTime;
          const chunkEndTime = currentTime + chunkDuration;
          
          // Write chunk to a temp file for FFmpeg drawtext
          const chunkPath = path.join(tempDir, `chunk_${tempId}_${svIndex}.txt`);
          await writeFilePromise(chunkPath, wrapped);
          
          const enableArg = `:enable='between(t,${chunkStartTime},${chunkEndTime})'`;
          vFilters.push(`${lastV}drawtext=textfile='${chunkPath}':x=(w-text_w)/2:y=h-text_h-50:fontsize=${fSize}:fontcolor=${color}:box=1:boxcolor=black@0.5:boxborderw=10:line_spacing=5:fix_bounds=true${fontArg}${enableArg}[sv${svIndex}]`);
          
          lastV = `[sv${svIndex}]`;
          currentTime = chunkEndTime;
          svIndex++;
        }
      }

      // Stage 4: Logo
      if (hasLogo) {
        const logoSizeVal = Math.floor((logoSize || 100) * effectiveLogoScale);
        vFilters.push(`[2:v]scale=${logoSizeVal}:-2[l]`);
        
        const pad = 20 * effectiveLogoScale;
        let pFilter = "";
        switch (logoPosition) {
          case 'top-left': pFilter = `${pad}:${pad}`; break;
          case 'top-right': pFilter = `W-w-${pad}:${pad}`; break;
          case 'bottom-left': pFilter = `${pad}:H-h-${pad}`; break;
          case 'bottom-right': pFilter = `W-w-${pad}:H-h-${pad}`; break;
          default: pFilter = `W-w-${pad}:${pad}`;
        }

        vFilters.push(`${lastV}[l]overlay=${pFilter}[vout]`);
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
        const mapA = (speed > 1) ? ' -map "[aout]"' : ' -map 1:a:0 -shortest';
        ffmpegCmd = `ffmpeg -i "${videoPath}" -i "${audioPath}"${hasLogo ? ` -i "${logoPath}"` : ""} -filter_complex_script "${filterPath}"${mapV}${mapA} -c:v libx264 -preset ultrafast -y "${outputPath}"`;
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


      const outputBuffer = await readFilePromise(outputPath);
      res.json({ videoBase64: outputBuffer.toString("base64") });

    } catch (error: any) {
      console.error("FFmpeg Error Output:", error.stderr || error);
      const errorMessage = error.stderr ? `FFmpeg Failed: ${error.stderr.split('\n').pop()}` : error.message;
      res.status(500).json({ error: errorMessage });
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(videoPath)) await unlinkPromise(videoPath);
        if (fs.existsSync(audioPath)) await unlinkPromise(audioPath);
        if (fs.existsSync(logoPath)) await unlinkPromise(logoPath);
        if (fs.existsSync(outputPath)) await unlinkPromise(outputPath);
        const filterPath = path.join(tempDir, `filter_${tempId}.txt`);
        if (fs.existsSync(filterPath)) await unlinkPromise(filterPath);
        const subtitleFilePath = path.join(tempDir, `subtitle_text_${tempId}.txt`);
        if (fs.existsSync(subtitleFilePath)) await unlinkPromise(subtitleFilePath);
        
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is missing. API calls will fail.");
    }
  });
}

startServer();
