import React, { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Search,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Check,
  X,
  Tag,
  ChevronLeft,
  Sparkles,
  Loader2,
  Settings,
  Key,
  Download,
  Upload,
  Cpu,
} from "lucide-react";
import { Prompt } from "./types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GoogleGenAI } from "@google/genai";
import { translations, Language } from "./i18n";

// Storage utility for Chrome Extension compatibility
const storage = {
  get: async (key: string): Promise<string | null> => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(key);
        return (result[key] as string) || null;
      }
    } catch (e) {
      console.warn("Chrome storage not available, falling back to localStorage");
    }
    return localStorage.getItem(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [key]: value });
        return;
      }
    } catch (e) {
      console.warn("Chrome storage not available, falling back to localStorage");
    }
    localStorage.setItem(key, value);
  },
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"list" | "form" | "settings">("list");
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [deepSeekApiKey, setDeepSeekApiKey] = useState("");
  const [preferredProvider, setPreferredProvider] = useState<
    "gemini" | "deepseek"
  >("gemini");
  const [language, setLanguage] = useState<Language>("en");

  const t = translations[language];

  // Load prompts and API key from storage on mount
  useEffect(() => {
    const loadData = async () => {
      const savedPrompts = await storage.get("prompts");
      const savedApiKey = await storage.get("gemini_api_key");
      const savedDeepSeekKey = await storage.get("deepseek_api_key");
      const savedProvider = await storage.get("preferred_provider");
      const savedLanguage = (await storage.get("language")) as Language;

      if (savedApiKey) {
        setApiKey(savedApiKey);
      }
      if (savedDeepSeekKey) {
        setDeepSeekApiKey(savedDeepSeekKey);
      }
      if (savedProvider === "gemini" || savedProvider === "deepseek") {
        setPreferredProvider(savedProvider);
      }
      if (savedLanguage === "en" || savedLanguage === "zh") {
        setLanguage(savedLanguage);
      }

      if (savedPrompts) {
        try {
          setPrompts(JSON.parse(savedPrompts));
        } catch (e) {
          console.error("Failed to parse prompts from storage");
        }
      } else {
        // Add some default prompts if empty
        const defaultPrompts: Prompt[] = [
          {
            id: uuidv4(),
            title: "Explain like I am 5",
            content:
              "Explain the following concept simply, as if I were a 5-year-old child. Use analogies and avoid jargon:\n\n[Concept]",
            tags: ["learning", "explain"],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: uuidv4(),
            title: "Code Reviewer",
            content:
              "Act as a senior software engineer. Review the following code for best practices, performance, security, and readability. Suggest improvements:\n\n[Code]",
            tags: ["coding", "review"],
            createdAt: Date.now() - 10000,
            updatedAt: Date.now() - 10000,
          },
        ];
        setPrompts(defaultPrompts);
        storage.set("prompts", JSON.stringify(defaultPrompts));
      }
    };

    loadData();
  }, []);

  // Save prompts and API key to storage whenever they change
  useEffect(() => {
    storage.set("prompts", JSON.stringify(prompts));
  }, [prompts]);

  useEffect(() => {
    storage.set("gemini_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    storage.set("deepseek_api_key", deepSeekApiKey);
  }, [deepSeekApiKey]);

  useEffect(() => {
    storage.set("preferred_provider", preferredProvider);
  }, [preferredProvider]);

  useEffect(() => {
    storage.set("language", language);
  }, [language]);

  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return prompts;
    const query = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }, [prompts, searchQuery]);

  const handleSavePrompt = (
    prompt: Omit<Prompt, "id" | "createdAt" | "updatedAt">,
  ) => {
    if (editingPrompt) {
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === editingPrompt.id
            ? { ...p, ...prompt, updatedAt: Date.now() }
            : p,
        ),
      );
    } else {
      const newPrompt: Prompt = {
        ...prompt,
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setPrompts((prev) => [newPrompt, ...prev]);
    }
    setView("list");
    setEditingPrompt(null);
  };

  const handleDeletePrompt = (id: string) => {
    if (confirm(t.confirmDelete)) {
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setView("form");
  };

  const handleAddNew = () => {
    setEditingPrompt(null);
    setView("form");
  };

  const renderContent = () => {
    switch (view) {
      case "list":
        return (
          <ListView
            prompts={filteredPrompts}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onEdit={handleEditPrompt}
            onDelete={handleDeletePrompt}
            t={t}
          />
        );
      case "form":
        return (
          <FormView
            initialData={editingPrompt}
            apiKey={apiKey}
            deepSeekApiKey={deepSeekApiKey}
            preferredProvider={preferredProvider}
            onSave={handleSavePrompt}
            onCancel={() => {
              setView("list");
              setEditingPrompt(null);
            }}
            t={t}
          />
        );
      case "settings":
        return (
          <SettingsView
            apiKey={apiKey}
            setApiKey={setApiKey}
            deepSeekApiKey={deepSeekApiKey}
            setDeepSeekApiKey={setDeepSeekApiKey}
            preferredProvider={preferredProvider}
            setPreferredProvider={setPreferredProvider}
            language={language}
            setLanguage={setLanguage}
            prompts={prompts}
            setPrompts={setPrompts}
            onBack={() => setView("list")}
            t={t}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full bg-white overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
            P
          </div>
          <h1 className="font-semibold text-slate-800 text-lg tracking-tight">
            {t.appName}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors border border-indigo-200 shadow-sm"
            title={language === "en" ? "Switch to Chinese" : "切换为英文"}
          >
            {language === "en" ? "中文" : "EN"}
          </button>
          {view === "list" && (
            <>
              <button
                onClick={() => setView("settings")}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title={t.settings}
              >
                <Settings size={18} />
              </button>
              <button
                onClick={handleAddNew}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                title={t.addNew}
              >
                <Plus size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
        {renderContent()}
      </main>
    </div>
  );
}

// --- List View Component ---

function ListView({
  prompts,
  searchQuery,
  setSearchQuery,
  onEdit,
  onDelete,
  t,
}: {
  prompts: Prompt[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onEdit: (p: Prompt) => void;
  onDelete: (id: string) => void;
  t: any;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 shrink-0">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Prompts List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
        {prompts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <Search size={24} className="text-slate-300" />
            </div>
            <p className="text-sm">{t.noPrompts}</p>
          </div>
        ) : (
          prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={() => onEdit(prompt)}
              onDelete={() => onDelete(prompt.id)}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}

// --- Prompt Card Component ---

function PromptCard({
  prompt,
  onEdit,
  onDelete,
  t,
}: {
  prompt: Prompt;
  onEdit: () => void;
  onDelete: () => void;
  t: any;
  key?: React.Key;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-slate-800 text-sm leading-tight pr-2">
          {prompt.title}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title={t.editPrompt}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title={t.deletePrompt || "Delete"}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 line-clamp-2 mb-3 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
        {prompt.content}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex flex-wrap gap-1">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
            >
              <Tag size={8} className="mr-1" />
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
              +{prompt.tags.length - 3}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
            copied
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
          )}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t.copied : t.copy}
        </button>
      </div>
    </div>
  );
}

// --- Form View Component ---

function FormView({
  initialData,
  apiKey,
  deepSeekApiKey,
  preferredProvider,
  onSave,
  onCancel,
  t,
}: {
  initialData: Prompt | null;
  apiKey: string;
  deepSeekApiKey: string;
  preferredProvider: "gemini" | "deepseek";
  onSave: (data: Omit<Prompt, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  t: any;
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [tagsInput, setTagsInput] = useState(
    initialData?.tags.join(", ") || "",
  );
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    if (!content.trim()) return;

    const systemPrompt = `You are an expert prompt engineer. Please optimize the following prompt to be highly effective for LLMs. Make it clear, structured, and specific. Return ONLY the optimized prompt text. Do not include any explanations, conversational filler, or markdown formatting around it.`;

    setIsOptimizing(true);
    try {
      if (preferredProvider === "gemini") {
        const effectiveApiKey = apiKey;
        if (!effectiveApiKey) {
          alert(t.setApiKeyFirst.replace("{provider}", "Gemini"));
          setIsOptimizing(false);
          return;
        }
        const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `${systemPrompt}\n\nOriginal Prompt:\n${content}`,
        });
        if (response.text) {
          setContent(response.text.trim());
        }
      } else {
        if (!deepSeekApiKey) {
          alert(t.setApiKeyFirst.replace("{provider}", "DeepSeek"));
          setIsOptimizing(false);
          return;
        }
        const response = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${deepSeekApiKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: content },
              ],
              temperature: 0.7,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "DeepSeek API error");
        }

        const data = await response.json();
        const optimizedText = data.choices[0].message.content;
        if (optimizedText) {
          setContent(optimizedText.trim());
        }
      }
    } catch (error: any) {
      console.error("Failed to optimize prompt:", error);
      alert(t.apiError.replace("{error}", error.message || "Unknown error"));
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSave({ title, content, tags });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center px-4 py-3 border-b border-slate-100 shrink-0">
        <button
          onClick={onCancel}
          className="mr-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-medium text-slate-800 text-sm">
          {initialData ? t.editPrompt : t.newPrompt}
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar"
      >
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-xs font-medium text-slate-700">
            {t.title}
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <label
              htmlFor="content"
              className="text-xs font-medium text-slate-700"
            >
              {t.content}
            </label>
            <button
              type="button"
              onClick={handleOptimize}
              disabled={isOptimizing || !content.trim()}
              className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOptimizing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {isOptimizing ? t.optimizing : t.optimize}
            </button>
          </div>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.contentPlaceholder}
            className="w-full flex-1 min-h-[150px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
            required
          />
        </div>

        <div className="space-y-1.5 shrink-0">
          <label htmlFor="tags" className="text-xs font-medium text-slate-700">
            {t.tags}
          </label>
          <div className="relative">
            <Tag
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t.tagsPlaceholder}
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="pt-4 mt-auto shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !content.trim()}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20"
          >
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Settings View Component ---

function SettingsView({
  apiKey,
  setApiKey,
  deepSeekApiKey,
  setDeepSeekApiKey,
  preferredProvider,
  setPreferredProvider,
  language,
  setLanguage,
  prompts,
  setPrompts,
  onBack,
  t,
}: {
  apiKey: string;
  setApiKey: (key: string) => void;
  deepSeekApiKey: string;
  setDeepSeekApiKey: (key: string) => void;
  preferredProvider: "gemini" | "deepseek";
  setPreferredProvider: (provider: "gemini" | "deepseek") => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  onBack: () => void;
  t: any;
}) {
  const [localGeminiKey, setLocalGeminiKey] = useState(apiKey);
  const [localDeepSeekKey, setLocalDeepSeekKey] = useState(deepSeekApiKey);
  const [localProvider, setLocalProvider] = useState(preferredProvider);
  const [localLanguage, setLocalLanguage] = useState(language);

  useEffect(() => {
    setLocalLanguage(language);
  }, [language]);

  const handleSave = () => {
    setApiKey(localGeminiKey);
    setDeepSeekApiKey(localDeepSeekKey);
    setPreferredProvider(localProvider);
    setLanguage(localLanguage);
    onBack();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(prompts, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `prompts_export_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedPrompts = JSON.parse(content);

        if (Array.isArray(importedPrompts)) {
          if (confirm(t.importConfirm.replace("{count}", importedPrompts.length.toString()))) {
            // Simple merge by ID or just append
            setPrompts((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newPrompts = importedPrompts.filter(
                (p) => !existingIds.has(p.id),
              );
              return [...prev, ...newPrompts];
            });
            alert(t.importSuccess);
          }
        } else {
          alert(t.importError);
        }
      } catch (err) {
        console.error("Import failed:", err);
        alert(t.importParseError);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center px-4 py-3 border-b border-slate-100 shrink-0">
        <button
          onClick={onBack}
          className="mr-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-medium text-slate-800 text-sm">{t.settings}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Language Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles size={18} />
            <h3 className="text-sm font-semibold">{t.language}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLocalLanguage("en")}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                localLanguage === "en"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300",
              )}
            >
              English
            </button>
            <button
              onClick={() => setLocalLanguage("zh")}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                localLanguage === "zh"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300",
              )}
            >
              中文
            </button>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-600">
            <Cpu size={18} />
            <h3 className="text-sm font-semibold">{t.aiProvider}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLocalProvider("gemini")}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                localProvider === "gemini"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300",
              )}
            >
              Google Gemini
            </button>
            <button
              onClick={() => setLocalProvider("deepseek")}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                localProvider === "deepseek"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300",
              )}
            >
              DeepSeek
            </button>
          </div>
        </div>

        {/* Gemini Config */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-600">
            <Key size={18} />
            <h3 className="text-sm font-semibold">{t.geminiApi}</h3>
          </div>
          <div className="bg-blue-50 p-2 rounded text-[10px] text-blue-700 border border-blue-100">
            {t.geminiNote}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="gemini-key"
              className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >
              {t.apiKeyLabel}
            </label>
            <input
              id="gemini-key"
              type="password"
              value={localGeminiKey}
              onChange={(e) => setLocalGeminiKey(e.target.value)}
              placeholder={t.apiKeyPlaceholder}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* DeepSeek Config */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-indigo-600">
            <Key size={18} />
            <h3 className="text-sm font-semibold">{t.deepSeekApi}</h3>
          </div>
          <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-600 border border-slate-100">
            {t.deepSeekNote}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="deepseek-key"
              className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >
              {t.apiKeyLabel}
            </label>
            <input
              id="deepseek-key"
              type="password"
              value={localDeepSeekKey}
              onChange={(e) => setLocalDeepSeekKey(e.target.value)}
              placeholder={t.apiKeyPlaceholder}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Data Management */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-600">
            <Download size={18} />
            <h3 className="text-sm font-semibold">{t.dataManagement}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              <Download size={14} />
              {t.export}
            </button>
            <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer">
              <Upload size={14} />
              {t.import}
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20"
          >
            {t.saveSettings}
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {t.privacyNote}
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {t.privacyText}
          </p>
        </div>
      </div>
    </div>
  );
}
