
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
      authPrompt: "Please authenticate to access the Lumina Neural tools and OS features."
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
        desc: "ဗီဒီယိုဖိုင်များတွင် မြန်မာစာတန်းထိုးများကို စက္ကန့်ပိုင်းအတွင်း အလိုအလျောက်ထည့်သွင်းပေးပြီး စိတ်ကြိုက်ပြင်ဆင်နိုင်မည်...",
      },
      autoRecap: {
        title: "Auto Recap",
        desc: "Neural Engine အသစ်ဖြင့် ဗီဒီယိုများကို အလိုအလျောက် Recap လုပ်ပေးမည့် tool ပါ။ Highlight များကို...",
      },
      videoTranscribe: {
        title: "Video Transcribe",
        desc: "Neural abstraction engine that surgically extracts text and translates it into Myanmar script with...",
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
      authPrompt: "Lumina Neural tools များအား အသုံးပြုနိုင်ရန် Google Account ဖြင့် ဝင်ရောက်ပေးပါ။"
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
      browseFiles: "ဖိုင်ရွေးရန် နှိပ်ပါ",
      fileLimit: "MP4, MOV (အများဆုံး 300MB)",
      selectStyle: "Recap ပုံစံရွေးချယ်ပါ",
      generate: "Recap ထုတ်လုပ်ပါ",
      voiceoverTitle: "AI Voiceover ထုတ်လုပ်မည်",
      mergeWithVideo: "မူရင်းဗီဒီယိုနှင့်ပေါင်းမည်",
      merging: "ဗီဒီယိုနှင့်အသံ ပေါင်းနေသည်...",
      mergeSuccess: "ပေါင်းစပ်မှု အောင်မြင်သည်!",
      downloadMerged: "ပေါင်းပြီးသားဗီဒီယိုကို ဒေါင်းလုဒ်လုပ်မည်",
      freezeFrameZoom: "Freeze Frame Zoom function",
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
        title: "အဆင့်ဆင့်လမ်းညွှန်",
        desc: "ရှင်းလင်းသော အဆင့်များဖြင့် နံပါတ်စဉ်တပ်၍ ဖော်ပြပေးမည်။",
      },
      materialList: {
        title: "လိုအပ်သောပစ္စည်းများ",
        desc: "ဗီဒီယိုထဲတွင် အသုံးပြုထားသော ကိရိယာများနှင့် ပစ္စည်းများကိုသာ ဖော်ပြမည်။",
      },
      funnyCommentary: {
        title: "ဟာသဆန်ဆန်နောက်ကလိုက်ပြောခြင်း",
        desc: "ရယ်စရာကောင်းပြီး ခပ်နောက်နောက် အသံနေအထားဖြင့် ပြန်လည်ပြောပြပေးမည်။",
      },
      epicExaggerated: {
        title: "အမွမ်းတင် အက်ပတ် Recap",
        desc: "ဗီဒီယိုထဲက လုပ်ဆောင်ချက်လေးတွေကို ကမ္ဘာကျော်အောင်မြင်မှုကြီးတစ်ခုလို အမွမ်းတင်ပြီး စိတ်လှုပ်ရှားစရာကောင်းအောင် ပြန်ပြောပြပေးမှာပါ။",
      },
      projectStory: {
        title: "ပုံပြင်ကဲ့သို့ပြောပြချက်",
        desc: "ဖန်တီးမှုခရီးစဉ်တစ်ခုကဲ့သို့ စိတ်ဝင်စားဖွယ် ဖော်ပြပေးမည်။",
      },
      proTips: {
        title: "ကျွမ်းကျင်အကြံပြုချက်များ",
        desc: "သတိထားရမည့်အချက်များနှင့် အသုံးဝင်သော နည်းလမ်းများကို အဓိကဖော်ပြမည်။",
      },
      quickSummary: {
        title: "အကျဉ်းချုပ်",
        desc: "အမြန်ဖတ်ရှုနိုင်ရန်အတွက် အကျဉ်းချုပ် ဖော်ပြပေးမည်။",
      },
      realTimeNarration: {
        title: "ဗီဒီယိုအတိုင်းလိုက်ပြောပြချက်",
        desc: "ဗီဒီယိုထဲက အချိန်အပိုင်းအခြားနဲ့ လုပ်ဆောင်ချက်တွေအတိုင်း တဆင့်ချင်းစီ လိုက်လံပြောပြပေးမည်။",
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
        desc: "ဗီဒီယိုဖိုင်များတွင် မြန်မာစာတန်းထိုးများကို စက္ကန့်ပိုင်းအတွင်း အလိုအလျောက်ထည့်သွင်းပေးပြီး စိတ်ကြိုက်ပြင်ဆင်နိုင်မည်...",
      },
      autoRecap: {
        title: "Auto Recap",
        desc: "Neural Engine အသစ်ဖြင့် ဗီဒီယိုများကို အလိုအလျောက် Recap လုပ်ပေးမည့် tool ပါ။ Highlight များကို...",
      },
      videoTranscribe: {
        title: "Video Transcribe",
        desc: "Neural abstraction engine that surgically extracts text and translates it into Myanmar script with...",
      },
      aiVoiceover: {
        title: "Ai Voiceover",
        desc: "စာရိုက်ထည့်လိုက်ရုံနဲ့ AI အသံအဖြစ် ပြောင်းလဲပေးမယ့် tool ဖြစ်ပါတယ်။",
      },
      recapMaster: {
        title: "Recap Master",
        desc: "လုပ်ငန်းသုံးအဆင့် မီဒီယာလုပ်ဆောင်ချက် အင်ဂျင်ဖြစ်ပြီး Recap များ ထုတ်လုပ်ရန်အတွက် ဖြစ်သည်။",
      }
    }
  },
};
