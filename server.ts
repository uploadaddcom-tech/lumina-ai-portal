import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to handle JSON payloads - set a large limit for videos
  app.use(express.json({ limit: "50mb" }));

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
      // ... prompts as defined before ...
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

  // API Route for Gemini Proxy (Legacy/General)

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
