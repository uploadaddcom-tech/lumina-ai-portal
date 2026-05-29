
export type Language = "EN" | "MY";

export const translations = {
  EN: {
    nav: {
      dashboard: "Dashboard",
      aiRecap: "Ai Recap",
      library: "Library",
      apiDocs: "Api Docs",
      loginWithGoogle: "Login with Google",
      authenticating: "Authenticating...",
      authRequired: "Access Denied: Auth Required",
      authPrompt: "Please authenticate to access the MM Recap tools and OS features."
    },
    api: {
      title: "API Settings",
      optionApp: "App API Key",
      optionOwn: "Own API Key",
      inputPlaceholder: "Enter your Gemini API key...",
      saveKey: "Save API Key",
      saved: "API Key Saved",
    },
    hero: {
      title: "",
      dashboard: "",
      description: "",
    },
    recapMaster: {
      headline: "Recap Master",
      uploadTitle: "Upload Video",
      browseFiles: "Click to browse files",
      fileLimit: "MP4, MOV up to 300MB",
      selectStyle: "Select Recap Style",
      generate: "Generate Recap",
      voiceoverTitle: "Generate AI Voiceover",
      mergeWithVideo: "Merge with Original Video",
      merging: "Merging Video & Audio...",
      mergeSuccess: "Successfully merged!",
      downloadMerged: "Download Merged Video",
      freezeFrameZoom: "Freeze Frame Zoom",
      freezeFrameZoomDesc: "Perform a 2s Zoom Pan at every 6s interval before merging",
      actionsTitle: "ဆောင်ਰွက်ပေးခဲ့သည့် အချက်များ:",
      usageTitle: "အသုံးပြုပုံ",
      actions: [
        "ဗီဒီယိုပါ အကြောင်းအရာကို AI မှ လေ့လာခြင်း",
        "အဓိက အချက်အလက်များကို မြန်မာလို အကျဉ်းချုပ်ပေးခြင်း",
        "စိတ်ကြိုက် ပုံစံများဖြင့် Recap ထုတ်ပေးခြင်း"
      ],
      usage: "ဗီဒီယိုဖိုင်ကို တင်ပါ။ Recap ပုံစံကို ရွေးချယ်ပြီး Generate Recap ကို နှိပ်ပါ။ AI က သင့်အတွက် အကောင်းဆုံး ပြန်လည်သုံးသပ်ချက်ကို ထုတ်ပေးပါလိမ့်မည်။"
    },
    voiceover: {
      headline: "AI Voiceover",
      inputPlaceholder: "Enter text to convert to voice...",
      selectVoice: "Select AI Voice",
      selectMood: "Select Mood",
      generate: "Generate Voiceover",
      preview: "Listen to Preview",
      download: "Download",
      voices: {
        Puck: "Puck (Deep & Masculine)",
        Charon: "Charon (Technical & Clear)",
        Kore: "Kore (Bright & Friendly)",
        Fenrir: "Fenrir (Rugged & Warm)",
        Zephyr: "Zephyr (Soft & Calm)"
      },
      moods: {
        story: "Storytelling",
        recap: "Video Recap",
        news: "News Report",
        promo: "Promotional"
      }
    },
    transcribe: {
      headline: "Video Transcribe",
      uploadTitle: "Upload Video",
      generate: "Start Transcribing",
      actionsTitle: "ဆောင်ရွက်ပေးခဲ့သည့် အချက်များ:",
      usageTitle: "အသုံးပြုပုံ",
      actions: [
        "ဗီဒီယိုထဲက အသံကို နားထောင်ခြင်း",
        "မြန်မာဘာသာသို့ တိကျစွာ ပြန်ဆိုခြင်း",
        "စာသားများကို အချိန်နှင့်တပြေးညီ ထုတ်ယူခြင်း"
      ],
      usage: "ဗီဒီယိုဖိုင်ကို တင်လိုက်ရုံဖြင့် AI က အလိုအလျောက် နားထောင်ပြီး မြန်မာလို ဘာသာပြန်ပေးမည် ဖြစ်ပါသည်။"
    },
    styles: {
      stepByStep: {
        title: "Step-by-Step Guide",
        desc: "A structured, numbered list of instructions with clear phases.",
      },
      materialList: {
        title: "Material List",
        desc: "Focus solely on the tools and supplies needed for the project.",
      },
      funnyCommentary: {
        title: "Funny Commentary",
        desc: "A hilarious, slightly sarcastic recap that pokes fun at the process.",
      },
      epicExaggerated: {
        title: "Epic/Exaggerated",
        desc: "Treats the project like a world-changing masterpiece with intense praise.",
      },
      projectStory: {
        title: "Project Story",
        desc: "A narrative recap focusing on the creative journey and the \"why\".",
      },
      proTips: {
        title: "Pro Tips & Tricks",
        desc: "Focuses on the expert techniques and potential pitfalls shown.",
      },
      quickSummary: {
        title: "Quick Summary",
        desc: "A high-level 30-second read for someone in a hurry.",
      },
      realTimeNarration: {
        title: "Real-Time Narration",
        desc: "A chronological narrative following the exact timeline and actions of the video.",
      },
      fairytaleHumor: {
        title: "Humorous Fairytale",
        desc: "A fairytale-style story with lots of jokes and humor.",
      },
    },
    tools: {
      videoRecapper: {
        title: "Ai Video Recapper",
        desc: "စကားပြောပါတဲ့ Video တွေကို ကြည့်ပြီး မြန်မာလို Recap ပြောပေးမယ့် Tool",
      },
      videoRecap: {
        title: "Video Recap",
        desc: "ဗီဒီယိုနဲ့ အောက်ဒီယိုဖိုင်တွေကို ပေါင်းပေးမယ့် tool ပါ။ အကယ်၍ အောက်ဒီယိုက ပိုရှည်နေရင် ဗီဒီယိုနဲ့ ကွက်တိဖြစ်အောင်...",
      },
      subtitleEditor: {
        title: "Subtitle Editor",
        desc: " Video များကို  One Click ဖြင့် မြန်မာဘာသာပြန် စာတန်းထိုးပေးနိုင်သည် ",
      },
      autoRecap: {
        title: "Auto Recap",
        desc: "Neural Engine အသစ်ဖြင့် ဗီဒီယိုများကို အလိုအလျောက် Recap လုပ်ပေးမည့် tool ပါ။ Highlight များကို...",
      },
      videoTranscribe: {
        title: "Video Transcribe",
        desc: "Videoများကို စက္ကန့်ပိုင်းအတွင်းမြန်မာစာသားထုတ်ပေးမည်",
      },
      aiVoiceover: {
        title: "Ai Voiceover",
        desc: "စာရိုက်ထည့်လိုက်ရုံနဲ့ AI အသံအဖြစ် ပြောင်းလဲပေးမယ့် tool ဖြစ်ပါတယ်။",
      },
      recapMaster: {
        title: "Recap Master",
        desc: "Enterprise-grade media processing engine for master-level recap generation and distribution.",
      }
    }
  },
  MY: {
    nav: {
      dashboard: "ဒက်ရှ်ဘုတ်",
      aiRecap: "AI ပြန်လည်သုံးသပ်ချက်",
      library: "စာကြည့်တိုက်",
      apiDocs: "API စာရွက်စာတမ်းများ",
      loginWithGoogle: "Google ဖြင့် ဝင်ရောက်ပါ",
      authenticating: "စစ်ဆေးနေသည်...",
      authRequired: "ဝင်ရောက်ခွင့်မရှိပါ- Login လိုအပ်ပါသည်",
      authPrompt: "MM Recap များအား အသုံးပြုနိုင်ရန် Google Account ဖြင့် ဝင်ရောက်ပေးပါ။"
    },
    api: {
      title: "API ဆက်တင်များ",
      optionApp: "App API Key",
      optionOwn: "ကိုယ်ပိုင် API Key",
      inputPlaceholder: "Gemini API key ကို ရိုက်ထည့်ပါ...",
      saveKey: "API Key သိမ်းဆည်းရန်",
      saved: "API Key သိမ်းဆည်းပြီးပါပြီ",
    },
    hero: {
      title: "",
      dashboard: "",
      description: "",
    },
    recapMaster: {
      headline: "Recap Master",
      uploadTitle: "ဗီဒီယိုတင်ပါ",
      browseFiles: "Click to browse files",
      fileLimit: "MP4, MOV (Max 300MB)",
      selectStyle: "Select Recap Style",
      generate: "Recap ထုတ်လုပ်ပါ",
      voiceoverTitle: "AI Voiceover ထုတ်လုပ်မည်",
      mergeWithVideo: "မူရင်းဗီဒီယိုနှင့်ပေါင်းမည်",
      merging: "ဗီဒီယိုနှင့်အသံ ပေါင်းနေသည်...",
      mergeSuccess: "ပေါင်းစပ်မှု အောင်မြင်သည်!",
      downloadMerged: "Final Video ဒေါင်းလုဒ်လုပ်မည်",
      freezeFrameZoom: "Freeze Frame Zoom",
      freezeFrameZoomDesc: "ဗီဒီယိုတွင် ၆ စက္ကန့်လျှင်တစ်ကြိမ်၊ ၂ စက္ကန့်ကြာ Freeze Frame Zoom ប្រုလုပ်ရန်",
      actionsTitle: "ဆောင်ရွက်ပေးခဲ့သည့် အချက်များ:",
      usageTitle: "အသုံးပြုပုံ",
      actions: [
        "ဗီဒီယိုပါ အကြောင်းအရာကို AI မှ လေ့လာခြင်း",
        "အဓိက အချက်အလက်များကို မြန်မာလို အကျဉ်းချုပ်ပေးခြင်း",
        "စိတ်ကြိုက် ပုံစံများဖြင့် Recap ထုတ်ပေးခြင်း"
      ],
      usage: "ဗီဒီယိုဖိုင်ကို တင်ပါ။ Recap ပုံစံကို ရွေးချယ်ပြီး Generate Recap ကို နှိပ်ပါ။ AI က သင့်အတွက် အကောင်းဆုံး ပြန်လည်သုံးသပ်ချက်ကို ထုတ်ပေးပါလိမ့်မည်။"
    },
    voiceover: {
      headline: "AI Voiceover",
      inputPlaceholder: "အသံပြောင်းလိုသော စာသားကို ရိုက်ထည့်ပါ...",
      selectVoice: "AI အသံ ရွေးချယ်ပါ",
      selectMood: "ဟန်ပန် ရွေးချယ်ပါ",
      generate: "အသံထုတ်လုပ်ပါ",
      preview: "နားထောင်မည်",
      download: "ဒေါင်းလုဒ်လုပ်မည်",
      voices: {
        Puck: "Puck (ခန့်ညားသောအသံ)",
        Charon: "Charon (ကြည်လင်သောအသံ)",
        Kore: "Kore (ဖော်ရွေသောအသံ)",
        Fenrir: "Fenrir (နွေးထွေးသောအသံ)",
        Zephyr: "Zephyr (အေးချမ်းသောအသံ)"
      },
      moods: {
        story: "ပုံပြင်ပြောဟန်",
        recap: "Video Recap ဟန်",
        news: "သတင်းကြေညာဟန်",
        promo: "ကြော်ငြာဟန်"
      }
    },
    transcribe: {
      headline: "Video Transcribe",
      uploadTitle: "ဗီဒီယိုတင်ပါ",
      generate: "ဘာသာပြန်ခြင်း စတင်ပါ",
      actionsTitle: "ဆောင်ရွက်ပေးခဲ့သည့် အချက်များ:",
      usageTitle: "အသုံးပြုပုံ",
      actions: [
        "ဗီဒီယိုထဲက အသံကို နားထောင်ခြင်း",
        "မြန်မာဘာသာသို့ တိကျစွာ ပြန်ဆိုခြင်း",
        "စာသားများကို အချိန်နှင့်တပြေးညီ ထုတ်ယူခြင်း"
      ],
      usage: "ဗီဒီယိုဖိုင်ကို တင်လိုက်ရုံဖြင့် AI က အလိုအလျောက် နားထောင်ပြီး မြန်မာလို ဘာသာပြန်ပေးမည် ဖြစ်ပါသည်။"
    },
    styles: {
      stepByStep: {
        title: "Step-by-Step Guide",
        desc: "A structured, numbered list of instructions with clear phases.",
      },
      materialList: {
        title: "Material List",
        desc: "Focus solely on the tools and supplies needed for the project.",
      },
      funnyCommentary: {
        title: "Funny Commentary",
        desc: "A hilarious, slightly sarcastic recap that pokes fun at the process.",
      },
      epicExaggerated: {
        title: "Epic/Exaggerated Recap",
        desc: "Treats the project like a world-changing masterpiece with intense praise.",
      },
      projectStory: {
        title: "Project Story",
        desc: "A narrative recap focusing on the creative journey and the \"why\".",
      },
      proTips: {
        title: "Pro Tips & Tricks",
        desc: "Focuses on the expert techniques and potential pitfalls shown.",
      },
      quickSummary: {
        title: "Quick Summary",
        desc: "A high-level 30-second read for someone in a hurry.",
      },
      realTimeNarration: {
        title: "Real-Time Narration",
        desc: "A chronological narrative following the exact timeline and actions of the video.",
      },
      fairytaleHumor: {
        title: "Humorous Fairytale",
        desc: "A fairytale-style story with lots of jokes and humor.",
      },
    },
    tools: {
      videoRecapper: {
        title: "Ai Video Recapper",
        desc: "စကားပြောပါတဲ့ Video တွေကို ကြည့်ပြီး မြန်မာလို Recap ပြောပေးမယ့် Tool",
      },
      videoRecap: {
        title: "Video Recap",
        desc: "ဗီဒီယိုနဲ့ အောက်ဒီယိုဖိုင်တွေကို ပေါင်းပေးမယ့် tool ပါ။ အကယ်၍ အောက်ဒီယိုက ပိုရှည်နေရင် ဗီဒီယိုနဲ့ ကွက်တိဖြစ်အောင်...",
      },
      subtitleEditor: {
        title: "Subtitle Editor",
        desc: " Video များကို  One Click ဖြင့် မြန်မာဘာသာပြန် စာတန်းထိုးပေးနိုင်သည် ",
      },
      autoRecap: {
        title: "Auto Recap",
        desc: "Neural Engine အသစ်ဖြင့် ဗီဒီယိုများကို အလိုအလျောက် Recap လုပ်ပေးမည့် tool ပါ။ Highlight များကို...",
      },
      videoTranscribe: {
        title: "Video Transcribe",
        desc: "Videoများကို စက္ကန့်ပိုင်းအတွင်းမြန်မာစာသားထုတ်ပေးမည်",
      },
      aiVoiceover: {
        title: "Ai Voiceover",
        desc: "စာရိုက်ထည့်လိုက်ရုံနဲ့ AI အသံအဖြစ် ပြောင်းလဲပေးမယ့် tool ဖြစ်ပါတယ်။",
      },
      recapMaster: {
        title: "Recap Master",
        desc: " မည်သည့် Video အမျိုးအစားကိုမဆို One Click Recap ထုတ်လုပ်နိုင်သည်",
      }
    }
  },
};
