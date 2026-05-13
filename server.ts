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
      const { videoBase64, mimeType, style, lang } = req.body;
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

      const promptSnippet = stylePrompts[style] || stylePrompts["step-by-step"];
      const finalPrompt = `${promptSnippet} Respond in ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language. Provide direct output only.`;

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
      
      res.json({ text: response.text });
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
        subtitleFontSize
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

      const size = logoSize || 100; // default 100px
      const padding = 20;
      const zoom = (videoScale || 100) / 100;

      // Ratio Filter with Zoom support and even dimension safety
      let ratioFilter = "";
      if (videoRatio === "9:16") {
        ratioFilter = `setsar=1,crop=w='trunc(min(iw,ih*9/16)/${zoom}/2)*2':h='trunc(min(ih,iw/(9/16))/${zoom}/2)*2',scale=w='trunc(min(iw,ih*9/16)/2)*2':h='trunc(min(ih,iw/(9/16))/2)*2',format=yuv420p`;
      } else if (videoRatio === "1:1") {
        ratioFilter = `setsar=1,crop=w='trunc(min(iw,ih)/${zoom}/2)*2':h='trunc(min(ih,iw)/${zoom}/2)*2',scale=w='trunc(min(iw,ih)/2)*2':h='trunc(min(ih,iw)/2)*2',format=yuv420p`;
      } else if (videoRatio === "16:9") {
        ratioFilter = `setsar=1,crop=w='trunc(min(iw,ih*16/9)/${zoom}/2)*2':h='trunc(min(ih,iw/(16/9))/${zoom}/2)*2',scale=w='trunc(min(iw,ih*16/9)/2)*2':h='trunc(min(ih,iw/(16/9))/2)*2',format=yuv420p`;
      }
      
      let posFilter = "";
      switch (logoPosition) {
        case 'top-left': posFilter = `${padding}:${padding}`; break;
        case 'top-right': posFilter = `W-w-${padding}:${padding}`; break;
        case 'bottom-left': posFilter = `${padding}:H-h-${padding}`; break;
        case 'bottom-right': posFilter = `W-w-${padding}:H-h-${padding}`; break;
        default: posFilter = `W-w-${padding}:${padding}`; // top-right default
      }

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

      // Stage 2: Blur
      if (blurEnabled) {
        const bw = blurWidth || 300;
        const bh = blurHeight || 80;
        const by = blurY !== undefined ? blurY : `(ih-bh-50)`;
        const bx = `(iw-bw)/2`;
        
        vFilters.push(`${lastV}split[v1][v2]`);
        // Use clip to ensure crop is within valid bounds to avoid FFmpeg crash
        vFilters.push(`[v2]boxblur=20:10,crop=w=min(iw,${bw}):h=min(ih,${bh}):x=clip(${bx},0,iw-out_w):y=clip(${by},0,ih-out_h)[blurred]`);
        vFilters.push(`[v1][blurred]overlay=x=clip(${bx},0,W-w):y=clip(${by},0,H-h)[bv]`);
        lastV = "[bv]";
      }

      // Stage 3: Subtitles
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
          return lines.join(' ');
        };

        const wrappedText = wrapText(subtitleText, 45);
        // Escape for FFmpeg drawtext when using a file script
        const escaped = wrappedText
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "'\\''")
          .replace(/:/g, '\\:')
          .replace(/%/g, '\\%');
          
        const color = (subtitleColor || "#ffffff").replace('#', '0x');
        const fSize = subtitleFontSize || 24;
        
        // Search for Myanmar-compatible fonts in common Linux paths
        const fontPaths = [
          "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf",
          "/usr/share/fonts/truetype/padauk/Padauk-Regular.ttf",
          "/usr/share/fonts/truetype/noto/NotoSansMyanmar-VF.ttf",
          "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        ];
        let fontArg = "";
        for (const fp of fontPaths) {
          if (fs.existsSync(fp)) {
            fontArg = `:fontfile='${fp}'`;
            console.log(`Using font: ${fp}`);
            break;
          }
        }

        vFilters.push(`${lastV}drawtext=text='${escaped}':x=(w-text_w)/2:y=h-text_h-50:fontsize=${fSize}:fontcolor=${color}:box=1:boxcolor=black@0.5:boxborderw=10:line_spacing=5:fix_bounds=true${fontArg}[sv]`);
        lastV = "[sv]";
      }

      // Stage 4: Logo
      if (hasLogo) {
        const logoSizeVal = logoSize || 100;
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
