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
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Analyzing video content with AI",
        "Summarizing key points accurately in English",
        "Generating professional custom Recaps"
      ],
      usage: "Upload your video file, select a recap style, and click 'Generate Recap'. AI will analyze the video and generate the best summary for you."
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
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Analyzing speech from video",
        "Transcribing speech accurately",
        "Exporting timed synchronized text"
      ],
      usage: "Simply upload your video file, and AI will automatically listen and transcribe the spoken words."
    },
    videoToSrt: {
      headline: "SRT Generator",
      uploadTitle: "Upload Video",
      generate: "Generate SRT",
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Extracting audio from video",
        "Listening and analyzing speech",
        "Translating and generating Myanmar SRT file"
      ],
      usage: "Upload your video file, and AI will automatically split audio, translate the dialogue and generate precise Myanmar .srt subtitles."
    },
    aiVideoVoiceActor: {
      headline: "AI Video Voice Actor",
      uploadTitle: "Upload Video",
      selectVoice: "Select AI Voice Actor",
      generate: "Generate Burmese Voice Actor Overlay",
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Extracting audio from video",
        "Converting dialog to precise Burmese translations",
        "Generating timestamp-aligned professional Burmese vocals",
        "Compositing voiceover layer into final movie output"
      ],
      usage: "Upload your video, pick a starting voice, and hit generate. The AI will translate, voice-act dialogues with dramatic pauses, and yield a combined Burmese video download."
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
        desc: "Watch any video with speech and generate clean text/audio recaps effortlessly.",
      },
      videoRecap: {
        title: "Video Recap",
        desc: "Combine video and audio files into a single masterfully synchronized video recap.",
      },
      subtitleEditor: {
        title: "Subtitle Editor",
        desc: "Create and translate high-quality subtitles for any video file with a single click.",
      },
      autoRecap: {
        title: "Auto Recap",
        desc: "Automatically summarize video highlights using a powerful state-of-the-art Neural Engine.",
      },
      videoTranscribe: {
        title: "Video Transcribe",
        desc: "Transcribe any spoken video file into precise, cleanly formatted text in seconds.",
      },
      aiVoiceover: {
        title: "Ai Voiceover",
        desc: "Convert written text into highly articulate, natural life-like AI speech and voices.",
      },
      recapMaster: {
        title: "Recap Master",
        desc: "Generate master-level, fully customized audio and text video recaps with a single click.",
      },
      videoToSrt: {
        title: "SRT Generator",
        desc: "Convert any spoken video into a cleanly translated Myanmar (.srt) subtitle file.",
      },
      aiVideoVoiceActor: {
        title: "AI Video Voice Actor",
        desc: "Translate, record, and align precise high-quality Burmese dubbing voice actor overlay over your video.",
      }
    }
  },
  MY: {
    nav: {
      dashboard: "Dashboard",
      aiRecap: "Ai Recap",
      library: "Library",
      apiDocs: "Api Docs",
      loginWithGoogle: "Login with Google",
      authenticating: "Authenticating...",
      authRequired: "Access Denied: Auth Required",
      authPrompt: "Please sign in with a Google Account to use MM Recap."
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
      browseFiles: "ဖိုင်များကို ရွေးချယ်ရန် နှိပ်ပါ",
      fileLimit: "MP4၊ MOV (အများဆုံး 300MB)",
      selectStyle: "Select Recap Style",
      generate: "Generate Recap",
      voiceoverTitle: "Generate AI Voiceover",
      mergeWithVideo: "Merge with Original Video",
      merging: "Merging Video & Audio...",
      mergeSuccess: "Successfully merged!",
      downloadMerged: "Download Final Video",
      freezeFrameZoom: "Freeze Frame Zoom",
      freezeFrameZoomDesc: "Perform a 2s Zoom Pan at every 6s interval before merging",
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Analyzing video content with AI",
        "Summarizing key points accurately in English",
        "Generating professional custom Recaps"
      ],
      usage: "Upload your video file, select a recap style, and click 'Generate Recap'. AI will analyze the video and generate the best summary for you."
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
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Analyzing speech from video",
        "Transcribing speech accurately",
        "Exporting timed synchronized text"
      ],
      usage: "Simply upload your video file, and AI will automatically listen and transcribe the spoken words."
    },
    videoToSrt: {
      headline: "SRT Generator",
      uploadTitle: "Upload Video",
      generate: "Generate SRT",
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Extracting audio from video",
        "Listening and analyzing speech",
        "Translating and generating Myanmar SRT file"
      ],
      usage: "Upload your video file, and AI will automatically split audio, translate the dialogue and generate precise Myanmar .srt subtitles."
    },
    aiVideoVoiceActor: {
      headline: "AI Video Voice Actor",
      uploadTitle: "Upload Video",
      selectVoice: "Select AI Voice Actor",
      generate: "Generate Burmese Voice Actor Overlay",
      actionsTitle: "Actions Performed:",
      usageTitle: "How to Use",
      actions: [
        "Extracting audio from video",
        "Converting dialog to precise Burmese translations",
        "Generating timestamp-aligned professional Burmese vocals",
        "Compositing voiceover layer into final movie output"
      ],
      usage: "Upload your video, pick a starting voice, and hit generate. The AI will translate, voice-act dialogues with dramatic pauses, and yield a combined Burmese video download."
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
        desc: "Watch any video with speech and generate clean text/audio recaps effortlessly.",
      },
      videoRecap: {
        title: "Video Recap",
        desc: "Combine video and audio files into a single masterfully synchronized video recap.",
      },
      subtitleEditor: {
        title: "Subtitle Editor",
        desc: "Create and translate high-quality subtitles for any video file with a single click.",
      },
      autoRecap: {
        title: "Auto Recap",
        desc: "Automatically summarize video highlights using a powerful state-of-the-art Neural Engine.",
      },
      videoTranscribe: {
        title: "Video Transcribe",
        desc: "Transcribe any spoken video file into precise, cleanly formatted text in seconds.",
      },
      aiVoiceover: {
        title: "Ai Voiceover",
        desc: "Convert written text into highly articulate, natural life-like AI speech and voices.",
      },
      recapMaster: {
        title: "Recap Master",
        desc: "Generate master-level, fully customized audio and text video recaps with a single click.",
      },
      videoToSrt: {
        title: "SRT Generator",
        desc: "ဗီဒီယိုမှ အသံကိုခွဲထုတ်ပြီး မြန်မာဘာသာပြန် .srt စာတန်းထိုးဖိုင် အလိုအလျောက် ထုတ်ယူပေးသည်။",
      },
      aiVideoVoiceActor: {
        title: "AI Video Voice Actor",
        desc: "ဗီဒီယိုထဲမှ အသံကိုနားထောင်ပြီး မြန်မာလို အသံနားစနစ်ဖြင့် သရုပ်ဆောင်ကာ ဗီဒီယိုအဖြစ် ပေါင်းစပ်ဒေါင်းလုဒ်လုပ်ပေးသည်။",
      }
    }
  },
};
