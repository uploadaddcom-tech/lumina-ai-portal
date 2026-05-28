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

dotenv.config();

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const unlinkPromise = promisify(fs.unlink);
const readFilePromise = promisify(fs.readFile);

let currentKeyIdx = 0;

function getAiClient(customKey?: string): GoogleGenAI {
  if (customKey) {
    return new GoogleGenAI({ apiKey: customKey });
  }
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  const keyToUse = apiKeys.length > 0 ? apiKeys[currentKeyIdx % apiKeys.length] : (process.env.GEMINI_API_KEY || "");
  return new GoogleGenAI({ apiKey: keyToUse });
}

function rotateApiKey() {
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  if (apiKeys.length > 1) {
    currentKeyIdx = (currentKeyIdx + 1) % apiKeys.length;
    console.log(`[API KEY ROTATION] Rotated to key index ${currentKeyIdx}. Active Key preview: ...${apiKeys[currentKeyIdx].substring(apiKeys[currentKeyIdx].length - 6, apiKeys[currentKeyIdx].length)}`);
  }
}

async function retryWithBackoff<T>(
  fn: (client: GoogleGenAI) => Promise<T>,
  customKey?: string,
  maxRetries = 6,
  initialDelay = 1500
): Promise<T> {
  let delay = initialDelay;
  const apiKeysCount = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean).length;

  for (let i = 0; i <= maxRetries; i++) {
    const aiClient = getAiClient(customKey);
    try {
      return await fn(aiClient);
    } catch (error: any) {
      const is503 = error.message?.includes("503") || error.status === 503 || error.message?.includes("high demand");
      const is429 = error.message?.includes("429") || error.status === 429;
      const is500 = error.message?.includes("500") || error.status === 500 || error.message?.includes("Internal error");
      const isTimeout = error.message?.includes("timeout") || error.message?.includes("fetch failed") || error.code === 'UND_ERR_HEADERS_TIMEOUT';

      if (!customKey && apiKeysCount > 1 && (is503 || is429 || is500 || isTimeout || error.message)) {
        console.warn(`[API KEY FAILURE] Error on key index ${currentKeyIdx}: ${error.message || error}. Rotating to next key...`);
        rotateApiKey();
      }

      if (i === maxRetries) {
        throw error;
      }

      console.warn(`Gemini API Error (Retryable): ${error.message || error}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 1.5;
    }
  }
  throw new Error("Retry failed");
}

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
        const { videoBase64, mimeType, style, lang, duration, apiKey: customKey, freezeFrameZoomEnabled, isNarrationRecap } = req.body;
        const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
        const model = "gemini-3.5-flash";
        
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
            : `ဗီဒီယိုထဲမှာ ဖြစ်ပျက်နေတဲ့ အရာတွေကို အခြေခံပြီး အချိန်နဲ့တပြေးညီ အသေးစိတ်ကျပြီး စိတ်ဝင်စားစရာကောင်းတဲ့ နောက်ခံစကားပြော (Narration) script တစ်ခု ရေးသားပေးပါ။ အချိန်မှတ်တမ်းများ (timestamps) မထည့်ရ။

အောက်ပါ script စာသားသည် ၆၀ စက္ကန့်စာဗီဒီယိုအတွက် ရေးသားထားသော စံပြနမူနာဖြစ်ပြီး၊ ၎င်း၏ အရေးအသားပုံစံ၊ စာလုံးအရှည်နှင့် အဆင့်ဆင့်အသေးစိတ်ပြောပြချက်တို့ကို အတိအကျအတုယူရေးသားပေးပါ -
[၆၀ စက္ကန့်စာအတွက် စံပြနမူနာ Script]
"ကောင်လေးတစ်ယောက်ဟာ ညတိုင်း ညတိုင်း သံခြေချင်းတွေ ခတ်ထားခံရပါတယ်။ သူ့မိခင်က သူ့ကို အခန်းထဲမှာ သော့ခတ်ပိတ်ထားလေ့ရှိပါတယ်။ နောက်တစ်နေ့ မိုးလင်းတဲ့အခါမှာတော့ ကောင်လေးရဲ့ တစ်ကိုယ်လုံးမှာ အမွှေးအမျှင်တွေ ပေါက်လာပြီး စူးရှတဲ့ သွားစွယ်ကြီးတွေ ထွက်လာပါတယ်။ သူ့မိခင်ကတော့ နေ့တိုင်း နေ့တိုင်း သူ့ရဲ့ အမွှေးတွေကို ရိပ်ပေးရသလို၊ ထက်မြက်တဲ့ လက်သည်းတွေကိုလည်း ညှပ်ပေးရပါတယ်။

ကောင်လေးရဲ့ မွေးနေ့ရောက်တဲ့အခါမှာ သူဟာ အသားဟင်းလေးပဲ စားချင်တယ်လို့ တောင်းဆိုခဲ့ပါတယ်။ ဒါပေမဲ့ သူ့မိခင်ကတော့ \"အသားစားတာ ကျန်းမာရေးနဲ့မညီညွတ်ဘူး\" လို့ ပြောပြီး ပေါင်မုန့်ကိုပဲ ကျွေးခဲ့ပါတယ်။ ကျောင်းမှာဆိုရင်လည်း ကောင်လေးဟာ နေ့တိုင်း ဟင်းသီးဟင်းရွက်တွေကိုပဲ စားရပါတယ်။ အတန်းဖော်တစ်ယောက်က သူ့ကို အသားကျွေးပေမဲ့ သူဟာ မစားရဲပါဘူး။ သူက သူ့ရဲ့ ဟင်းသီးဟင်းရွက်တွေကို အတန်းဖော်တွေကို ဝေမျှပေးတဲ့အခါမှာလည်း အတန်းဖော်တွေက ရွံရှာသလိုမျိုး လုပ်ပြကြပါတယ်။ အဲ့ဒီအချိန်ကစပြီး ကောင်လေးဟာ သံသယတွေ စတင်ဝင်လာပါတော့တယ်။

တစ်နေ့မှာတော့ ကောင်လေးရဲ့မိခင် အပြင်သွားစရာရှိတာကြောင့် အိမ်နီးနားချင်းကို ကောင်လေးကို ကြည့်ပေးဖို့ အကူအညီတောင်းခဲ့ပါတယ်။ အိမ်နီးနားချင်းက ကောင်လေးဟာ အရမ်းအားနည်းနေတာကို မြင်တော့ သူ့အတွက် အမဲသားစတိတ် ချက်ကျွေးပါတယ်။ ကောင်လေးဟာ သူ့ဘဝမှာ ပထမဆုံးအကြိမ်အဖြစ် အသားကို စားဖူးသွားပြီး အငမ်းမရ ဝါးမျိုစားသောက်ပါတော့တယ်။ အိမ်နီးနားချင်းကလည်း ကောင်လေးအတွက် အသားတွေကို ထပ်ခါထပ်ခါ ချက်ကျွေးခဲ့ပါတယ်။

ဒါကို မိခင်ဖြစ်သူ သိသွားတဲ့အခါမှာတော့ အရမ်းကို ကြောက်လန့်သွားပါတယ်။ ကောင်လေးကတော့ သူ့မိခင်က သူ့ကို လိမ်ညာထားတယ်လို့ ထင်မြင်သွားပါတယ်။ မိခင်ဖြစ်သူက ကောင်လေးကို အခန်းထဲမှာ ချက်ချင်း ပြန်ပိတ်ထားလိုက်ပါတယ်။ နောက်တစ်နေ့မှာတော့ အခန်းတံခါးမှာ လက်သည်းရာတွေ အများကြီး ထင်ကျန်နေပြီး ကောင်လေးရဲ့ အဝတ်အစားတွေလည်း စုတ်ပြတ်သတ်နေတာကို တွေ့လိုက်ရပါတယ်။

ကောင်လေးဟာ အတန်းဖော်တွေနဲ့ ဆော့ဖို့အတွက် အိမ်ကနေ တိတ်တဆိတ် ခိုးထွက်ခဲ့ပါတယ်။ သူဟာ ကောင်းကင်ကို မော့ကြည့်လိုက်တဲ့အခါ ထိန်ထိန်သာနေတဲ့ လပြည့်ဝန်းကြီး ကို မြင်လိုက်ရပါတယ်။ သူ့ရဲ့ မျက်နှာပေါ်မှာ အမွှေးအမျှင်တွေ စတင်ပေါက်လာပြီး... နောက်တစ်စက္ကန့်မှာတော့ ကောင်လေးဟာ ဝံပုလွေလူသားအဖြစ် လုံးဝပြောင်းလဲသွားပါတော့တယ်။"`,
          "fairytale-humor": lang === "EN"
            ? "Tell a highly dramatic, fairytale-like narrative story of this video, but pack it with tons of clever jokes, funny observations, and lots of humor to make it extremely funny."
            : `ဒီဗီဒီယိုပါ အကြောင်းအရာကို ပုံပြင်ဆန်ဆန် ဇာတ်လမ်းဆန်းတစ်ပုဒ်လို ပြန်ပြောပြပေးပါ၊ ဒါပေမယ့် ရယ်စရာကောင်းတဲ့ ဟာသတွေ၊ ဟာသဥာဏ်ရွှင်တဲ့ သရော်ချက်တွေနဲ့ ဟာသများများပေါင်းစပ်ပြီး အလွန်ရယ်ရမယ့် ပုံစံမျိုးဖြင့် ရေးပေးပါ။

အောက်ပါ script စာသားသည် ၆၀ စက္ကန့်စာဗီဒီယိုအတွက် ရေးသားထားသော စံပြနမူနာဖြစ်ပြီး၊ ၎င်း၏ အရေးအသားပုံစံ၊ စာလုံးအရှည်နှင့် အဆင့်ဆင့်ပုံပြောဟန်တို့ကို အတိအကျအတုယူရေးသားပေးပါ -
[၆၀ စက္ကန့်စာအတွက် စံပြနမူနာ Script]
"ကောင်လေးတစ်ယောက်ဟာ ညတိုင်း ညတိုင်း သံခြေချင်းတွေ ခတ်ထားခံရပါတယ်။ သူ့မိခင်က သူ့ကို အခန်းထဲမှာ သော့ခတ်ပိတ်ထားလေ့ရှိပါတယ်။ နောက်တစ်နေ့ မိုးလင်းတဲ့အခါမှာတော့ ကောင်လေးရဲ့ တစ်ကိုယ်လုံးမှာ အမွှေးအမျှင်တွေ ပေါက်လာပြီး စူးရှတဲ့ သွားစွယ်ကြီးတွေ ထွက်လာပါတယ်။ သူ့မိခင်ကတော့ နေ့တိုင်း နေ့တိုင်း သူ့ရဲ့ အမွှေးတွေကို ရိပ်ပေးရသလို၊ ထက်မြက်တဲ့ လက်သည်းတွေကိုလည်း ညှပ်ပေးရပါတယ်။

ကောင်လေးရဲ့ မွေးနေ့ရောက်တဲ့အခါမှာ သူဟာ အသားဟင်းလေးပဲ စားချင်တယ်လို့ တောင်းဆိုခဲ့ပါတယ်။ ဒါပေမဲ့ သူ့မိခင်ကတော့ \"အသားစားတာ ကျန်းမာရေးနဲ့မညီညွတ်ဘူး\" လို့ ပြောပြီး ပေါင်မုန့်ကိုပဲ ကျွေးခဲ့ပါတယ်။ ကျောင်းမှာဆိုရင်လည်း ကောင်လေးဟာ နေ့တိုင်း ဟင်းသီးဟင်းရွက်တွေကိုပဲ စားရပါတယ်။ အတန်းဖော်တစ်ယောက်က သူ့ကို အသားကျွေးပေမဲ့ သူဟာ မစားရဲပါဘူး။ သူက သူ့ရဲ့ ဟင်းသီးဟင်းရွက်တွေကို အတန်းဖော်တွေကို ဝေမျှပေးတဲ့အခါမှာလည်း အတန်းဖော်တွေက ရွံရှာသလိုမျိုး လုပ်ပြကြပါတယ်။ အဲ့ဒီအချိန်ကစပြီး ကောင်လေးဟာ သံသယတွေ စတင်ဝင်လာပါတော့တယ်။

တစ်နေ့မှာတော့ ကောင်လေးရဲ့မိခင် အပြင်သွားစရာရှိတာကြောင့် အိမ်နီးနားချင်းကို ကောင်လေးကို ကြည့်ပေးဖို့ အကူအညီတောင်းခဲ့ပါတယ်။ အိမ်နီးနားချင်းက ကောင်လေးဟာ အရမ်းအားနည်းနေတာကို မြင်တော့ သူ့အတွက် အမဲသားစတိတ် ချက်ကျွေးပါတယ်။ ကောင်လေးဟာ သူ့ဘဝမှာ ပထမဆုံးအကြိမ်အဖြစ် အသားကို စားဖူးသွားပြီး အငမ်းမရ ဝါးမျိုစားသောက်ပါတော့တယ်။ အိမ်နီးနားချင်းကလည်း ကောင်လေးအတွက် အသားတွေကို ထပ်ခါထပ်ခါ ချက်ကျွေးခဲ့ပါတယ်။

ဒါကို မိခင်ဖြစ်သူ သိသွားတဲ့အခါမှာတော့ အရမ်းကို ကြောက်လန့်သွားပါတယ်။ ကောင်လေးကတော့ သူ့မိခင်က သူ့ကို လိမ်ညာထားတယ်လို့ ထင်မြင်သွားပါတယ်။ မိခင်ဖြစ်သူက ကောင်လေးကို အခန်းထဲမှာ ချက်ချင်း ပြန်ပိတ်ထားလိုက်ပါတယ်။ နောက်တစ်နေ့မှာတော့ အခန်းတံခါးမှာ လက်သည်းရာတွေ အများကြီး ထင်ကျန်နေပြီး ကောင်လေးရဲ့ အဝတ်အစားတွေလည်း စုတ်ပြတ်သတ်နေတာကို တွေ့လိုက်ရပါတယ်။

ကောင်လေးဟာ အတန်းဖော်တွေနဲ့ ဆော့ဖို့အတွက် အိမ်ကနေ တိတ်တဆိတ် ခိုးထွက်ခဲ့ပါတယ်။ သူဟာ ကောင်းကင်ကို မော့ကြည့်လိုက်တဲ့အခါ ထိန်ထိန်သာနေတဲ့ လပြည့်ဝန်းကြီး ကို မြင်လိုက်ရပါတယ်။ သူ့ရဲ့ မျက်နှာပေါ်မှာ အမွှေးအမျှင်တွေ စတင်ပေါက်လာပြီး... နောက်တစ်စက္ကန့်မှာတော့ ကောင်လေးဟာ ဝံပုလွေလူသားအဖြစ် လုံးဝပြောင်းလဲသွားပါတော့တယ်။"`,
        };

        const isFreezeEnabled = freezeFrameZoomEnabled === true || freezeFrameZoomEnabled === "true";
        const wpm = isFreezeEnabled ? 230 : 190;
        const wordCount = duration ? Math.floor((duration / 60) * wpm) : wpm;
        
        const constraintPrompt = lang === "EN"
          ? `Constraints:
             - Script length: Approximately ${wordCount} words (Strictly target ${wpm} words per 60 seconds. DO NOT exceed this word count).
             - Output: Final polished narrative script ONLY.
             - DO NOT include ANY introductions like "Let's start", "Hello", "In this video", "စလိုက်ရအောင်", "ပြောပြမယ်နော်".
             - DO NOT use numbering, bullet points, or list formatting.
             - DO NOT include timestamps.
             - Provide the text exactly as it should be read for a voiceover.`
          : `ကန့်သတ်ချက်များ -
             - Script အရှည် - စကားလုံးရေ ${wordCount} တိတိ (ဗီဒီယို ၁ မိနစ်လျှင် စကားလုံး ${wpm} နှုန်းဖြင့် စာလုံးရေ မပိုစေဘဲ တိကျစွာ တွက်ချက်ထားသည်)။
             - ရလဒ် - အချောသတ်ထားသော ဇာတ်ညွှန်း (Script) သာ ဖြစ်ရမည်။
             - "စလိုက်ရအောင်"၊ "ပြောပြမယ်နော်"၊ "မင်္ဂလာပါ" "ဒီဗီဒီယိုလေးမှာ" ကဲ့သို့သော အစဦး စကားလုံးများ လုံးဝ မထည့်ရ။
             - အမှတ်စဉ်များ၊ Bullet point များ သို့မဟုတ် စာရင်းပုံစံများ လုံးဝ မသုံးရ။
             - အချိန်မှတ်တမ်း (Timestamps) များ မထည့်ရ။
             - Voiceover စကားပြောစတိုင်ဖြင့် ရေးသားပါ။ "သည်" ဟု အဆုံးသတ်ခြင်းကို လုံးဝ မသုံးရ၊ "တယ်" (သို့မဟုတ်) "နေတယ်" စသည့် စကားပြောအသုံးအနှုန်းများကိုသာ သုံးရမည်။
             - Voiceover အနေဖြင့် တိုက်ရိုက်ဖတ်ရမယ့် စာသားအတိုင်းသာ ဖော်ပြပေးပါ။`;

        const promptSnippet = stylePrompts[style] || stylePrompts["step-by-step"];
        const finalPrompt = `${promptSnippet}\n\n${constraintPrompt}\n\nRespond in ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language. Provide direct output only.`;

        let text = "";

        if (isNarrationRecap === true || isNarrationRecap === "true") {
          const tempDir = path.join(process.cwd(), "temp");
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          const tempId = crypto.randomBytes(8).toString("hex");
          const inputVideoPath = path.join(tempDir, `narration_input_${tempId}.mp4`);
          const outputAudioPath = path.join(tempDir, `narration_output_${tempId}.wav`);

          try {
            await writeFilePromise(inputVideoPath, Buffer.from(videoBase64, 'base64'));

            // Extract audio track using FFmpeg
            await execPromise(`ffmpeg -i "${inputVideoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${outputAudioPath}" -y`);

            // Read extracted WAV audio content as base64
            const audioBuffer = await readFilePromise(outputAudioPath);
            const audioBase64 = audioBuffer.toString("base64");

            // Build beautiful translation instruction
            const systemPrompt = lang === "EN"
              ? "Listen to the audio in this file carefully and transcribe it, then translate the transcription into English so that it flows naturally. Only provide the translated text. No introductions, no greetings, no description."
              : `ဒီဗီဒီယိုရဲ့ နောက်ခံစကားပြော (Narration) ကို သေချာနားထောင်ပြီး transcribeလုပ်ပြီး၊ မြန်မာဘာသာစကားနဲ့ နားထောင်လို့ အဆင်ပြေပြေနဲ့ အရမ်းချောမွေ့ဆွဲဆောင်မှုရှိတဲ့ ဇာတ်လမ်းပြောစတိုင် (recap voiceover script) စာသားအဖြစ် ဘာသာပြန်ပေးပါ။

ကန့်သတ်ချက်များ -
- ရလဒ် - အချောသတ်ထားသော ဇာတ်ညွှန်း (Script) သာ ဖြစ်ရမည်။
- "စလိုက်ရအောင်"၊ "ပြောပြမယ်နော်"၊ "မင်္ဂလာပါ" "ဒီဗီဒီယိုလေးမှာ" ကဲ့သို့သော အစဦး စကားလုံးများ လုံးဝ မထည့်ရ။
- အမှတ်စဉ်များ၊ Bullet point များ သို့မဟုတ် စာရင်းပုံစံများ လုံးဝ မသုံးရ။
- အချိန်မှတ်တမ်း (Timestamps) များ မထည့်ရ။
- Voiceover စကားပြောစတိုင်ဖြင့် ရေးသားပါ။ "သည်" ဟု အဆုံးသတ်ခြင်းကို လုံးဝ မသုံးရ၊ "တယ်" (သို့မဟုတ်) "နေတယ်" စသည့် စကားပြောအသုံးအနှုန်းများကိုသာ သုံးရမည်။
- Voiceover အနေဖြင့် တိုက်ရိုက်ဖတ်ရမယ့် စာသားအတိုင်းသာ ဖော်ပြပေးပါ။`;

            const response = await retryWithBackoff((client) => client.models.generateContent({
              model: model,
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    { inlineData: { data: audioBase64, mimeType: "audio/wav" } }
                  ]
                }
              ]
            }), customKey);

            text = response.text || "";

          } finally {
            if (fs.existsSync(inputVideoPath)) {
              await unlinkPromise(inputVideoPath).catch(err => console.error("Clean input fail:", err));
            }
            if (fs.existsSync(outputAudioPath)) {
              await unlinkPromise(outputAudioPath).catch(err => console.error("Clean audio fail:", err));
            }
          }
        } else {
          const response = await retryWithBackoff((client) => client.models.generateContent({
            model: model,
            contents: [
              {
                parts: [
                  { text: finalPrompt },
                  { inlineData: { data: videoBase64, mimeType } }
                ]
              }
            ]
          }), customKey);
          
          text = response.text || "";
        }
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
        const model = "gemini-3.5-flash";
        const prompt = `Listen to the audio in this video carefully and transcribe it, then translate the transcription into ${lang === "EN" ? "English" : "Myanmar (Burmese)"} language so that it flows naturally. Only provide the translated text.`;

        const response = await retryWithBackoff((client) => client.models.generateContent({
          model: model,
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { data: videoBase64, mimeType } }
              ]
            }
          ]
        }), customKey);
        
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
          
          let audioBase64: string | undefined = undefined;
          let lastErr: any = null;
          
          const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
          
          for (const currentModel of ttsModels) {
            try {
              const response = await retryWithBackoff((client) => client.models.generateContent({
                model: currentModel,
                contents: [{ parts: [{ text: chunk }] }],
                config: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceName || "Kore" }
                    }
                  }
                } as any
              }), customKey, 2, 800);
              
              const chunkData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (chunkData) {
                audioBase64 = chunkData;
                console.log(`[TTS SUCCESS] Voiceover chunk generated successfully with model ${currentModel}`);
                break;
              }
            } catch (err: any) {
              console.warn(`[TTS FALLBACK] Model ${currentModel} failed: ${err.message || err}. Trying next fallback...`);
              lastErr = err;
            }
          }
          
          if (audioBase64) {
            audioBuffers.push(Buffer.from(audioBase64, 'base64'));
          } else {
            throw lastErr || new Error("All TTS fallback models failed to generate audio.");
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

      let vDurRaw = await getDuration(videoPath);
      // Speed up video by 5% (1.05x speed). Therefore, the effective video duration becomes:
      let vDur = vDurRaw / 1.05;
      const aDur = await getDuration(audioPath);
      
      console.log(`Duration check -> Raw Video Duration (vDurRaw): ${vDurRaw}s, Effective Video Duration (vDur) under 1.05x: ${vDur}s, Audio Duration (aDur): ${aDur}s`);

      const initialSpeed = vDur > 0 ? (aDur / vDur) : 1;
      console.log(`[MM RECAP LOGIC] Initial alignment speed factor: ${initialSpeed}`);

      if (initialSpeed > 2.4 || initialSpeed < 0.8) {
        throw new Error("အဆင်မပြေပါ");
      }

      if (initialSpeed < 1.2) {
        // Target speed of atempo is 1.3
        const targetRawDuration = (aDur / 1.3) * 1.05;
        console.log(`[MM RECAP LOGIC] Current speed ${initialSpeed} < 1.2. Requiring atempo=1.3. Cutting video from raw duration ${vDurRaw}s to target raw duration ${targetRawDuration}s...`);

        if (targetRawDuration < vDurRaw) {
          const prompt = `
            Task: Analyze this video and identify the most important parts to KEEP, so that the total duration of the kept parts is approximately ${targetRawDuration.toFixed(2)} seconds.
            We need to cut out the least important, static, repetitive, silent, or transitional frames.
            
            Requirements:
            1. The total duration of the video to keep is ${targetRawDuration.toFixed(2)} seconds.
            2. Break the kept segments into a list of start and end times in seconds (e.g. [{"start": 0, "end": 12.5}, ...]).
            3. The sum of (end_time - start_time) for all kept segments MUST be as close as possible to ${targetRawDuration.toFixed(2)} seconds.
            4. Ensure the segments are in chronological order and do not overlap.
            5. Return ONLY a JSON array of objects: [{"start": 0.0, "end": 12.5}, ...]
          `;

          let keptSegments: any[] = [];
          try {
            const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
            const response = await retryWithBackoff(async (client) => {
              const res = await client.models.generateContent({
                model: "gemini-3.5-flash",
                contents: [
                  {
                    parts: [
                      { text: prompt },
                      { inlineData: { data: videoBase64, mimeType: req.body.mimeType || "video/mp4" } }
                    ]
                  }
                ],
                config: {
                  responseMimeType: "application/json"
                }
              });
              return res.text || "[]";
            }, customKey);

            keptSegments = JSON.parse(response);
            console.log("[MM RECAP LOGIC] Received segments from Gemini:", keptSegments);
          } catch (err) {
            console.error("[MM RECAP LOGIC] Gemini scene cut analysis failed:", err);
          }

          let validatedSegments: { start: number; end: number }[] = [];
          if (Array.isArray(keptSegments) && keptSegments.length > 0) {
            for (let seg of keptSegments) {
              let start = parseFloat(seg.start);
              let end = parseFloat(seg.end);
              if (!isNaN(start) && !isNaN(end) && start >= 0 && end > start && start < vDurRaw) {
                if (end > vDurRaw) end = vDurRaw;
                validatedSegments.push({ start, end });
              }
            }
          }

          if (validatedSegments.length === 0) {
            validatedSegments = [{ start: 0, end: Math.min(vDurRaw, targetRawDuration) }];
          }

          let currentTotal = validatedSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
          console.log(`[MM RECAP LOGIC] Raw sum of kept segments: ${currentTotal}s (Target: ${targetRawDuration}s)`);

          if (Math.abs(currentTotal - targetRawDuration) > 0.05) {
            if (validatedSegments.length > 0) {
              const diff = targetRawDuration - currentTotal;
              const lastIdx = validatedSegments.length - 1;
              validatedSegments[lastIdx].end += diff;
              if (validatedSegments[lastIdx].end <= validatedSegments[lastIdx].start) {
                validatedSegments[lastIdx].end = validatedSegments[lastIdx].start + 1.0;
              }
            }
          }

          const segmentFiles = [];
          for (let i = 0; i < validatedSegments.length; i++) {
            const seg = validatedSegments[i];
            const segPath = path.join(tempDir, `cut_seg_${tempId}_${i}.mp4`);
            await execPromise(`ffmpeg -ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(3)} -i "${videoPath}" -c:v libx264 -preset ultrafast -an -y "${segPath}"`);
            segmentFiles.push(segPath);
          }

          const concatTxtPath = path.join(tempDir, `concat_cut_${tempId}.txt`);
          const concatContent = segmentFiles.map(f => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join('\n');
          await writeFilePromise(concatTxtPath, concatContent);

          const cutVideoPath = path.join(tempDir, `video_cut_${tempId}.mp4`);
          await execPromise(`ffmpeg -f concat -safe 0 -i "${concatTxtPath}" -c copy -y "${cutVideoPath}"`);

          fs.copyFileSync(cutVideoPath, videoPath);

          for (const f of segmentFiles) {
            if (fs.existsSync(f)) await unlinkPromise(f);
          }
          if (fs.existsSync(concatTxtPath)) await unlinkPromise(concatTxtPath);
          if (fs.existsSync(cutVideoPath)) await unlinkPromise(cutVideoPath);

          // Update durations
          vDurRaw = await getDuration(videoPath);
          vDur = vDurRaw / 1.05;
        }
      } else if (initialSpeed > 1.4) {
        // Target speed of atempo is 1.4 or 1.6 under user requirements if speed > 1.4
        let targetAtempo = 1.4;
        if (initialSpeed >= 1.9 && initialSpeed <= 2.4) {
          targetAtempo = 1.6;
        }
        console.log(`[MM RECAP LOGIC] Current speed ${initialSpeed} > 1.4. Requiring atempo=${targetAtempo}. Slowing down entire video...`);
        
        let S_slow = targetAtempo / initialSpeed;
        if (isNaN(S_slow) || S_slow <= 0.1) S_slow = 0.3;
        if (S_slow > 0.95) S_slow = 0.95;

        console.log(`[MM RECAP LOGIC] Slow down entire video by S_slow: ${S_slow.toFixed(4)}`);

        const slowVideoPath = path.join(tempDir, `video_slow_${tempId}.mp4`);
        await execPromise(`ffmpeg -i "${videoPath}" -vf "setpts=PTS/${S_slow.toFixed(4)}" -c:v libx264 -preset ultrafast -an -y "${slowVideoPath}"`);

        fs.copyFileSync(slowVideoPath, videoPath);

        if (fs.existsSync(slowVideoPath)) await unlinkPromise(slowVideoPath);

        // Update durations
        vDurRaw = await getDuration(videoPath);
        vDur = vDurRaw / 1.05;
      }
      
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
        const color = (subtitleColor || "#ffffff").replace('#', '0x');
        const previewFontSizeInPx = Math.max(1, (subtitleFontSize || 13) * 0.4);
        const fSize = Math.floor(previewFontSizeInPx * effectiveFontScale);
        
        let targetFontFile = "Tharlon-Regular.ttf";
        if (subtitleFont === "Padauk") {
          targetFontFile = "Padauk-Bold.ttf";
        } else if (subtitleFont === "Myanmar Sagar") {
          targetFontFile = "MyanmarSagar.ttf";
        } else if (subtitleFont === "YoeYar-One Bold") {
          targetFontFile = "YoeYar-One Bold.ttf";
        } else if (subtitleFont === "Myanmar Gant Gaw") {
          targetFontFile = "MyanmarGantGaw.ttf";
        } else if (subtitleFont === "Myanmar Khway") {
          targetFontFile = "MyanmarKhway.ttf";
        } else if (subtitleFont === "Myanmar Pauklay") {
          targetFontFile = "MyanmarPauklay.ttf";
        } else if (subtitleFont === "Yunghkio") {
          targetFontFile = "Yunghkio.ttf";
        } else if (subtitleFont === "Tharlon") {
          targetFontFile = "Tharlon-Regular.ttf";
        }

        const fontPaths = [
          path.join(process.cwd(), targetFontFile),
          path.join(__dirname, targetFontFile),
          path.join(process.cwd(), "Padauk-Bold.ttf"),
          path.join(__dirname, "Padauk-Bold.ttf"),
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

        let svChunks: { text: string; start_time: number; end_time: number }[] = [];

        console.log("Requesting AI Timestamps for Subtitles...");
        const aiClient = customKey ? new GoogleGenAI({ apiKey: customKey }) : ai;
        
        // Send the PRISTINE, UNALTERED original audio directly to AI for flawless, natural timeline alignment.
        // This avoids rate distortion, pitch artifacts, and temporal shifts introduced by ffmpeg atempo filters.
        const aiAudioBase64 = audioBuffer.toString('base64');
        
        const timestampPrompt = `
          Task: Provide an extremely precise JSON array of subtitle timestamps (start and end times in seconds with 3 decimal places for millisecond accuracy) for this audio based on the script.
          
          Script: "${subtitleText}"
          
          Requirements:
          1. Analyze the audio with extreme precision down to milliseconds to match the exact start and end of spoken words in the script.
          2. TIMING PRECISION: Start times must align precisely with the exact millisecond the speech actually begins. Subtitles must appear exactly when the first phonetic sound/syllable of the chunk is heard.
          3. CRITICAL ENDING: Do not extend past the end of speech. Subtitles must disappear as soon as that spoken chunk finishes, ensuring perfect synchronization.
          4. CRITICAL FOR SPACELESS LANGUAGES (LIKE MYANMAR/BURMESE): Since the Myanmar language does not contain word spaces, you MUST segment the script by grammatical phrases, clauses, or natural pauses rather than 'word counts'. Splitting at natural comma-like boundaries or semantic breath boundaries (စကားစု ရပ်နားမှု) is highly recommended. Each chunk must be a short phrase that a human can read easily, lasting around 1.0 to 3.0 seconds in speech. Never let a single subtitle chunk extend too long.
          5. For normal spaced languages, each segment text MUST be strictly 4 to 8 words, or a very short phrase (စကားစုအတိုလေးများ). It must never contain more than 1 short sentence/phrase, resulting in at most 1 short line on screen, and absolutely never 3-4 lines or paragraphs.
          6. Detect silences, breaths, and pauses accurately, ensuring subtitles do not overlap during silent gaps.
          7. Return ONLY a JSON array of objects: [{"text": "...", "start_time": 1.234, "end_time": 4.567}, ...]
          8. Timestamps MUST be numbers in seconds with exactly 3 decimal places (e.g., 2.345) to ensure perfect synchronization.
          9. Ensure the chunks cover the FULL script in precise sequential order without missing any text, chunk by chunk.
        `;

        svChunks = await retryWithBackoff(async (client) => {
          const tsResponse = await client.models.generateContent({
            model: "gemini-3.5-flash",
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
        }, customKey);

        console.log(`Successfully received and parsed ${svChunks.length} AI subtitle segments.`);

        // Helper to safely parse strings / numbers / formats like "1:23", "01:23.456", "1.23s", and millisecond integers
        const parseTimestamp = (val: any): number => {
          if (val === undefined || val === null) return NaN;
          
          let str = String(val).trim();
          if (!str) return NaN;

          // Replace trailing 's', 'sec', etc.
          str = str.replace(/[sS](ec(ond)?)?$/, '').trim();

          // Check if it is in MM:SS or HH:MM:SS format (e.g., "1:23" or "01:23" or "00:01:23")
          if (str.includes(':')) {
            const parts = str.split(':');
            let secs = 0;
            let multiplier = 1;
            // Go from right to left (seconds, minutes, hours)
            for (let i = parts.length - 1; i >= 0; i--) {
              const p = parseFloat(parts[i]);
              if (isNaN(p)) return NaN;
              secs += p * multiplier;
              multiplier *= 60;
            }
            return secs;
          }

          const parsed = parseFloat(str);
          if (isNaN(parsed)) return NaN;

          // Heuristic: If parsed number is extremely large (e.g. > 1000) and we can see it
          // could be millisecond integers (like 12300 instead of 12.3), convert it to seconds.
          // Note that a standard video in this app is usually under 5-10 minutes.
          // If the raw timestamp is > 1000, it is 100% in milliseconds.
          if (parsed > 1000) {
            return parsed / 1000;
          }

          return parsed;
        };

        // 1. Compute cumulative character weights of all subtitle scripts for exact fallback mapping
        const totalChars = svChunks.reduce((sum, chunk) => sum + (chunk?.text?.length || 0), 0) || 1;
        let pAccumChars = 0;
        
        const preparedChunks = svChunks.map((chunk, idx) => {
          const text = (chunk?.text || "").trim();
          const len = text.length;
          const pStart = pAccumChars / totalChars;
          pAccumChars += len;
          const pEnd = pAccumChars / totalChars;

          const cAny = chunk as any;
          let rawStartVal = cAny.start_time !== undefined ? cAny.start_time : cAny.start;
          if (rawStartVal === undefined) rawStartVal = cAny.startTime;
          if (rawStartVal === undefined) rawStartVal = cAny.time_start;

          let rawEndVal = cAny.end_time !== undefined ? cAny.end_time : cAny.end;
          if (rawEndVal === undefined) rawEndVal = cAny.endTime;
          if (rawEndVal === undefined) rawEndVal = cAny.time_end;

          let rawStart = parseTimestamp(rawStartVal);
          let rawEnd = parseTimestamp(rawEndVal);

          return {
            text,
            rawStart,
            rawEnd,
            pStart,
            pEnd,
          };
        });

        // 2. Linear text-weight interpolation for any NaN timestamps to guarantee full-timeline alignment
        const interpolatedChunks = preparedChunks.map((item, idx) => {
          let rawStart = item.rawStart;
          let rawEnd = item.rawEnd;

          if (isNaN(rawStart)) {
            // Find left bound
            let L_time = 0;
            let L_p = 0;
            for (let i = idx - 1; i >= 0; i--) {
              if (!isNaN(preparedChunks[i].rawStart)) {
                L_time = preparedChunks[i].rawStart;
                L_p = preparedChunks[i].pStart;
                break;
              }
            }
            // Find right bound
            let R_time = aDur;
            let R_p = 1.0;
            for (let i = idx + 1; i < preparedChunks.length; i++) {
              if (!isNaN(preparedChunks[i].rawStart)) {
                R_time = preparedChunks[i].rawStart;
                R_p = preparedChunks[i].pStart;
                break;
              }
            }
            const denom = R_p - L_p;
            rawStart = L_time + (R_time - L_time) * (denom > 0 ? (item.pStart - L_p) / denom : 0);
          }

          if (isNaN(rawEnd)) {
            // Find left bound
            let L_time = rawStart + 0.5;
            let L_p = item.pStart;
            for (let i = idx - 1; i >= 0; i--) {
              if (!isNaN(preparedChunks[i].rawEnd)) {
                L_time = preparedChunks[i].rawEnd;
                L_p = preparedChunks[i].pEnd;
                break;
              }
            }
            // Find right bound
            let R_time = aDur;
            let R_p = 1.0;
            for (let i = idx + 1; i < preparedChunks.length; i++) {
              if (!isNaN(preparedChunks[i].rawEnd)) {
                R_time = preparedChunks[i].rawEnd;
                R_p = preparedChunks[i].pEnd;
                break;
              }
            }
            const denom = R_p - L_p;
            rawEnd = L_time + (R_time - L_time) * (denom > 0 ? (item.pEnd - L_p) / denom : 0);
          }

          // Bounds safety
          if (rawStart < 0) rawStart = 0;
          if (rawEnd < rawStart + 0.1) rawEnd = rawStart + 1.2;
          if (rawEnd > aDur) rawEnd = aDur;
          if (rawStart >= aDur) rawStart = Math.max(0, aDur - 1.0);

          return {
            text: item.text,
            rawStart,
            rawEnd
          };
        });

        // 3. Scale timeframes mathematically by speed factor and push to sanitized array
        const sanitizedChunks: { text: string; start: number; end: number }[] = [];
        const audioSpeedFactor = (typeof speed === 'number' && speed > 0) ? speed : 1.0;
        console.log(`Applying mathematical alignment scale factor for subtitles: ${audioSpeedFactor}`);

        for (const item of interpolatedChunks) {
          // Apply a professional 150ms calibration offset to account for model acoustic onset latency
          const calibratedStart = Math.max(0, item.rawStart - 0.150);
          const calibratedEnd = Math.max(calibratedStart + 0.5, item.rawEnd - 0.150);

          const scaledStart = calibratedStart / audioSpeedFactor;
          const scaledEnd = calibratedEnd / audioSpeedFactor;

          sanitizedChunks.push({
            text: item.text,
            start: scaledStart,
            end: scaledEnd
          });
        }

        // Always sort sanitized chunks chronologically to guarantee correct order and prevent overlaps
        sanitizedChunks.sort((a, b) => a.start - b.start);

        // 2. Resolve overlaps, enforce logical progression
        for (let i = 0; i < sanitizedChunks.length; i++) {
          const current = sanitizedChunks[i];
          const textLen = current.text.length;

          // Upper duration limit (default max 3.5s per chunk to prevent sticking forever)
          const maxDur = Math.min(3.5, Math.max(1.2, textLen * 0.15));
          if (current.end - current.start > maxDur) {
            current.end = current.start + maxDur;
          }

          // Lower duration limit (at least 0.5s for readability)
          if (current.end - current.start < 0.5) {
            current.end = current.start + 0.5;
          }

          // Sequential check: if next starts before current ends, truncate current's end-time.
          // Crucially: NEVER modify next's start-time to prevent lagging cascade delays!
          if (i < sanitizedChunks.length - 1) {
            const next = sanitizedChunks[i + 1];
            if (next.start < current.end) {
              current.end = Math.max(current.start + 0.3, next.start - 0.02);
            }
          }
        }

        // 3. Final validation of safety limits
        for (const current of sanitizedChunks) {
          if (current.start < 0) current.start = 0;
          if (current.end <= current.start) current.end = current.start + 0.8;
        }

        let svIndex = 0;
        for (const chunk of sanitizedChunks) {
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

          const lines = wrapText(chunk.text, 40);
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
          
          const enableArg = `:enable='between(t,${chunk.start.toFixed(3)},${chunk.end.toFixed(3)})'`;
          const boxCol = (subtitleBoxColor || "#000000").replace('#', '0x');
          const subYPercent = typeof subtitleY === "number" ? subtitleY : 75;
          const subYFact = (subYPercent / 100).toFixed(3);
          // Use the provided box color with 0.6 opacity
          vFilters.push(`${lastV}drawtext=textfile='${chunkPath}':x=(w-text_w)/2:y=(h-text_h)*${subYFact}:fontsize=${fSize}:fontcolor=${color}:box=1:boxcolor=${boxCol}@0.6:boxborderw=10:line_spacing=5:text_shaping=1:fix_bounds=true${fontArg}${enableArg}[sv${svIndex}]`);
          
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
