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

  // Custom font serving to prevent OTS parsing errors
  app.get("/Padauk.ttf", (req, res) => {
    const fontPath = path.join(process.cwd(), "Padauk.ttf");
    if (fs.existsSync(fontPath)) {
      res.setHeader("Content-Type", "font/ttf");
      res.sendFile(fontPath);
    } else {
      res.status(404).send("Font not found");
    }
  });

  // Alias for Padauk-Bold.ttf if requested by frontend
  app.get("/Padauk-Bold.ttf", (req, res) => {
    const fontPath = path.join(process.cwd(), "Padauk.ttf");
    if (fs.existsSync(fontPath)) {
      res.setHeader("Content-Type", "font/ttf");
      res.sendFile(fontPath);
    } else {
      res.status(404).send("Font not found");
    }
  });

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

  app.post("/api/transcribe-subtitles", async (req, res) => {
    try {
      const { videoBase64, mimeType } = req.body;
      const model = "gemini-1.5-flash"; 
      
      const srtPrompt = `Listen to the audio in this video carefully. Generate a SubRip (.srt) subtitle file in Myanmar (Burmese) language. 
      Rules:
      1. Translate the speech naturally into Myanmar language using a conversational style.
      2. Strictly follow SRT format (Index, Timing, Text).
      3. Break long sentences into readable lines (max 8 words per line).
      4. DO NOT include any preamble or code blocks. Start directly with '1'.
      5. The timestamps must be accurate to the audio narration.
      6. Output ONLY the raw SRT content.`;

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { text: srtPrompt },
              { inlineData: { data: videoBase64, mimeType } }
            ]
          }
        ]
      });

      let srtContent = "";
      if (typeof (response as any).text === 'string') {
        srtContent = (response as any).text;
      } else if (typeof (response as any).text === 'function') {
        srtContent = (response as any).text();
      } else {
        srtContent = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
      
      // Clean SRT content: find first occurrence of 1\n00:
      const srtMatch = srtContent.match(/1\r?\n00:[\s\S]*$/);
      if (srtMatch) {
        srtContent = srtMatch[0].trim();
      } else {
        // More generic match if first index isn't 1 or spacing is different
        const genericMatch = srtContent.match(/\d+\r?\n\d{2}:\d{2}:\d{2}[\s\S]*$/);
        if (genericMatch) srtContent = genericMatch[0].trim();
      }

      console.log("Generated Subtitles Length:", srtContent.length);
      res.json({ srt: srtContent });
    } catch (error: any) {
      console.error("Transcribe Subtitles Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/render-subtitle-video", async (req, res) => {
    const tempId = crypto.randomBytes(8).toString("hex");
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const videoPath = path.join(tempDir, `v_${tempId}.mp4`);
    const srtPath = path.join(tempDir, `s_${tempId}.srt`);
    const outputPath = path.join(tempDir, `out_${tempId}.mp4`);

    try {
      const { videoBase64, srt, color, fontSize, bgOpacity, marginV } = req.body;
      await writeFilePromise(videoPath, Buffer.from(videoBase64, 'base64'));
      await writeFilePromise(srtPath, srt);

      // Convert Hex to ASS Color (&H00BBGGRR)
      let assColor = "FFFFFF";
      if (color && color.startsWith("#")) {
        const r = color.substring(1, 3);
        const g = color.substring(3, 5);
        const b = color.substring(5, 7);
        assColor = `${b}${g}${r}`;
      }

      const fSize = fontSize || 24;
      const opacity = Math.floor((bgOpacity || 0.6) * 255).toString(16).padStart(2, '0');
      const mv = marginV || 30;

      const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, "\\:").replace(/'/g, "'\\\\''");
      const fontsDir = process.cwd();

      // force_style parameters:
      // Alignment=2 (Bottom Center)
      // Outline=1, Shadow=1
      // BackColour (for background box) - &H(Alpha)(BB)(GG)(RR)
      const ffmpegCmd = `ffmpeg -i "${videoPath}" -vf "subtitles=filename='${escapedSrtPath}':fontsdir='${fontsDir}':force_style='Fontname=Padauk,FontSize=${fSize},PrimaryColour=&H00${assColor},OutlineColour=&H00000000,BackColour=&H${opacity}000000,BorderStyle=4,Alignment=2,Outline=1,Shadow=0,MarginV=${mv},WrapStyle=2'" -c:v libx264 -preset ultrafast -c:a copy -y "${outputPath}"`;

      console.log("Rendering Subtitle Video:", ffmpegCmd);
      await execPromise(ffmpegCmd);

      const outputBuffer = await readFilePromise(outputPath);
      res.json({ videoBase64: outputBuffer.toString("base64") });

    } catch (error: any) {
      console.error("Render Subtitle Video Error:", error);
      res.status(500).json({ error: error.message });
    } finally {
      [videoPath, srtPath, outputPath].forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }
  });

  app.post("/api/voiceover", async (req, res) => {
    try {
      const { text, voiceName } = req.body;
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
        const response = await ai.models.generateContent({
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
        });
        
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
      res.json({ audioData: finalAudio.toString("base64") });
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
        blurIntensity,
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

      // If audio is longer than video, speed it up to match video duration exactly
      const speed = (vDur > 0 && aDur > (vDur + 0.1)) ? (aDur / vDur) : 1;
      
      // Build filter complex
      let vFilters: string[] = [];
      let lastV = "[0:v]";
      
      // Stage 1: Ratio & Zoom
      if (ratioFilter) {
        vFilters.push(`${lastV}${ratioFilter}[rv]`);
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

      // Stage 2: Audio filters (speed matching)
      let audioFilter = "";
      let processedAudioPath = audioPath;

      if (speed > 1.05) {
        if (speed <= 2.0) {
          audioFilter = `atempo=${speed.toFixed(2)}`;
        } else {
          let s = speed;
          let chains = [];
          while (s > 2.0) {
            chains.push("atempo=2.0");
            s /= 2.0;
          }
          chains.push(`atempo=${s.toFixed(2)}`);
          audioFilter = chains.join(",");
        }

        const syncAudioPath = path.join(tempDir, `sync_audio_${tempId}.wav`);
        try {
          await execPromise(`ffmpeg -i "${audioPath}" -af "${audioFilter}" -y "${syncAudioPath}"`);
          processedAudioPath = syncAudioPath;
        } catch (syncErr) {
          console.error("Sync Audio Pre-processing failed:", syncErr);
        }
      }

        // Stage 3: Sync Subtitles using AI-generated SRT from SYNCHRONIZED Audio
        if (subtitleEnabled && subtitleText) {
          const srtPath = path.join(tempDir, `subs_${tempId}.srt`);
          const fontPath = path.join(process.cwd(), 'Padauk.ttf');
          console.log("Font Path Check:", fontPath);

          try {
            const audioBuffer = await readFilePromise(processedAudioPath);
            const srtPrompt = `Generate a strictly valid SubRip (.srt) subtitle file for the following text: "${subtitleText}".
            The total duration of the audio is exactly ${vDur} seconds.
            Synchronization is the TOP priority. Match the speech timing in the audio perfectly.
            Rules:
            1. Strictly follow SRT format.
            2. Break into natural phrases (4-7 words per line).
            3. Output ONLY the raw SRT content, no markdown blocks.`;

            const response = await ai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: [
                {
                  parts: [
                    { text: srtPrompt },
                    { inlineData: { data: audioBuffer.toString("base64"), mimeType: "audio/wav" } }
                  ]
                }
              ]
            });
            
            let srtContent = "";
            if (typeof (response as any).text === 'string') {
              srtContent = (response as any).text;
            } else if (typeof (response as any).text === 'function') {
              srtContent = (response as any).text();
            } else {
               srtContent = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            }

            // Step 2: SRT Extraction Logic - Extract starting from the first "1"
            const srtMatch = srtContent.match(/1\r?\n00:[\s\S]*$/);
            if (srtMatch) {
              srtContent = srtMatch[0].trim();
            } else {
              // Fallback for different indexing or spacing
              const genericMatch = srtContent.match(/\d+\r?\n\d{2}:\d{2}:\d{2}[\s\S]*$/);
              if (genericMatch) srtContent = genericMatch[0].trim();
            }

            // Validation Check: srtContent contains -->
            if (srtContent.includes("-->")) {
              await writeFilePromise(srtPath, srtContent);
              console.log("SRT File Created at:", srtPath);

              // Dynamic Color Conversion: Convert Hex (#RRGGBB) to ASS (&H00BBGGRR)
              let assColor = "FFFFFF"; // Default White
              if (subtitleColor && subtitleColor.startsWith("#")) {
                 const r = subtitleColor.substring(1, 3);
                 const g = subtitleColor.substring(3, 5);
                 const b = subtitleColor.substring(5, 7);
                 assColor = `${b}${g}${r}`; // BBGGRR format
              }

              const fSize = subtitleFontSize || 28;
              
              // Step 3: FFmpeg Filter Fix - Linux path escape
              const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, "\\:").replace(/'/g, "'\\\\''");
              const fontsDir = process.cwd(); 
              
              // Final Styling: WrapStyle=2, Alignment=2, and FontName=Padauk
              vFilters.push(`${lastV}subtitles=filename='${escapedSrtPath}':fontsdir='${fontsDir}':force_style='Fontname=Padauk,FontSize=${fSize},PrimaryColour=&H00${assColor},WrapStyle=2,Alignment=2,Outline=1,Shadow=1,MarginV=30'[sv]`);
              lastV = "[sv]";
            } else {
              console.warn("SRT Validation failed: --> not found. Skipping subtitles.");
            }
          } catch (srtError) {
            console.error("Subtitle Stage Error Details:", srtError);
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
        const srtPath = path.join(tempDir, `subs_${tempId}.srt`);
        if (fs.existsSync(srtPath)) await unlinkPromise(srtPath);
        const syncAudioPath = path.join(tempDir, `sync_audio_${tempId}.wav`);
        if (fs.existsSync(syncAudioPath)) await unlinkPromise(syncAudioPath);
        
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
