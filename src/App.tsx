import { useState, type FormEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  SlidersHorizontal,
  Image as ImageIcon,
  RotateCcw,
  Upload,
  MoveHorizontal,
  HelpCircle,
  Eye,
  Check,
  Zap,
} from "lucide-react";
import LiquidHover, { DEFAULT_IMAGE } from "./components/LiquidHover";

const PRESET_IMAGES = [
  {
    name: "Original Requested",
    url: DEFAULT_IMAGE,
    author: "Unsplash",
  },
  {
    name: "Liquid Glass Art",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
    author: "Milad Fakurian",
  },
  {
    name: "Fluid Iridescent Wave",
    url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=800&auto=format&fit=crop",
    author: "Steve Johnson",
  },
  {
    name: "Abstract Neon Gradient",
    url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop",
    author: "Alexander Ant",
  },
  {
    name: "Dark Marble Waves",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=800&auto=format&fit=crop",
    author: "Pawel Czerwinski",
  },
];

const ASPECT_RATIOS = [
  { id: "portrait", label: "3 : 4", widthClass: "w-[340px] sm:w-[420px] md:w-[480px] h-[450px] sm:h-[560px] md:h-[640px]" },
  { id: "square", label: "1 : 1", widthClass: "w-[340px] sm:w-[440px] md:w-[500px] h-[340px] sm:h-[440px] md:h-[500px]" },
  { id: "landscape", label: "16 : 9", widthClass: "w-[360px] sm:w-[540px] md:w-[680px] h-[202px] sm:h-[303px] md:h-[382px]" },
];

export default function App() {
  const [imageSrc, setImageSrc] = useState(DEFAULT_IMAGE);
  const [customUrl, setCustomUrl] = useState("");
  const [resolution, setResolution] = useState(10);
  const [cursorSize, setCursorSize] = useState(50);
  const [intensity, setIntensity] = useState(50);
  const [aspectRatio, setAspectRatio] = useState("portrait");
  const [showControls, setShowControls] = useState(true);
  const [activeTab, setActiveTab] = useState<"presets" | "settings">("settings");
  const [copied, setCopied] = useState(false);

  const currentAspect = ASPECT_RATIOS.find((a) => a.id === aspectRatio) || ASPECT_RATIOS[0];

  const handleCustomUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      setImageSrc(customUrl.trim());
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setImageSrc(DEFAULT_IMAGE);
    setResolution(10);
    setCursorSize(50);
    setIntensity(50);
    setAspectRatio("portrait");
    setCustomUrl("");
  };

  const copyCodeSnippet = () => {
    const code = `<LiquidHover
  imageSrc="${imageSrc}"
  resolution={${resolution}}
  cursorSize={${cursorSize}}
  intensity={${intensity}}
/>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f8f5f0] text-stone-800 flex flex-col justify-between overflow-hidden font-sans antialiased selection:bg-amber-500/20">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-200/30 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-100/40 rounded-full blur-[140px]" />

      {/* Header Bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-stone-200/80 bg-white/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-stone-900 flex items-center gap-2">
              Liquid Distortion
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-stone-100 text-stone-600 rounded-full border border-stone-200">
                Originkit
              </span>
            </h1>
            <p className="text-xs text-stone-500">Interactive WebGL Hydrodynamic Distortion</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControls(!showControls)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              showControls
                ? "bg-stone-900 text-stone-50 border-stone-800 shadow-sm"
                : "bg-white/80 text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showControls ? "Hide Controls" : "Show Controls"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Center Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full max-w-7xl mx-auto">
          
          {/* Centered Liquid Distortion Stage */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className={`relative rounded-2xl overflow-hidden border border-stone-200/90 shadow-xl shadow-stone-900/5 bg-white/80 backdrop-blur-sm group transition-all duration-300 ${currentAspect.widthClass}`}
            >
              {/* The WebGL Canvas */}
              <LiquidHover
                imageSrc={imageSrc}
                resolution={resolution}
                cursorSize={cursorSize}
                intensity={intensity}
                className="rounded-2xl"
              />

              {/* Subtle hover overlay badge */}
              <div className="absolute top-4 left-4 pointer-events-none z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-stone-200 text-stone-700 text-xs shadow-md opacity-90 group-hover:opacity-100 transition-opacity">
                <MoveHorizontal className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span className="text-[11px] font-medium tracking-wide">Hover or touch to distort</span>
              </div>
            </motion.div>
          </div>

          {/* Right Control Drawer / Floating Panel */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="w-full lg:w-96 bg-white/90 border border-stone-200/90 rounded-2xl p-5 backdrop-blur-xl shadow-xl shadow-stone-900/5 flex flex-col gap-5 shrink-0"
              >
                {/* Control Header & Tabs */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("settings")}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        activeTab === "settings"
                          ? "bg-stone-900 text-stone-50"
                          : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Parameters
                    </button>
                    <button
                      onClick={() => setActiveTab("presets")}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        activeTab === "presets"
                          ? "bg-stone-900 text-stone-50"
                          : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Images
                    </button>
                  </div>

                  <button
                    onClick={handleReset}
                    title="Reset to default settings"
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tab 1: Settings & Sliders */}
                {activeTab === "settings" && (
                  <div className="flex flex-col gap-4 text-xs">
                    {/* Intensity Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <label className="text-stone-700 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          Distortion Intensity
                        </label>
                        <span className="text-stone-500 font-mono">{intensity}%</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={intensity}
                        onChange={(e) => setIntensity(Number(e.target.value))}
                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      />
                      <p className="text-[10px] text-stone-400">Controls fluid displacement strength.</p>
                    </div>

                    {/* Cursor Size Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <label className="text-stone-700 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          Cursor Impact Size
                        </label>
                        <span className="text-stone-500 font-mono">{cursorSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={120}
                        value={cursorSize}
                        onChange={(e) => setCursorSize(Number(e.target.value))}
                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      />
                      <p className="text-[10px] text-stone-400">Radius of the interaction ripple.</p>
                    </div>

                    {/* Resolution Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <label className="text-stone-700 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                          Simulation Resolution
                        </label>
                        <span className="text-stone-500 font-mono">{resolution}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={resolution}
                        onChange={(e) => setResolution(Number(e.target.value))}
                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      />
                      <p className="text-[10px] text-stone-400">Grid density for fluid solver accuracy.</p>
                    </div>

                    {/* Code Snippet Button */}
                    <div className="pt-2 border-t border-stone-100">
                      <button
                        onClick={copyCodeSnippet}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-stone-800 rounded-xl font-medium transition-all"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied Props!</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Copy Props Snippet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Images & Presets */}
                {activeTab === "presets" && (
                  <div className="flex flex-col gap-4 text-xs">
                    {/* Preset Image Cards */}
                    <div className="space-y-2">
                      <label className="text-stone-700 font-medium block">Presets</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PRESET_IMAGES.map((preset, idx) => (
                          <button
                            key={idx}
                            onClick={() => setImageSrc(preset.url)}
                            className={`group relative rounded-xl overflow-hidden border text-left p-1.5 transition-all ${
                              imageSrc === preset.url
                                ? "border-amber-600 bg-amber-50 ring-1 ring-amber-600"
                                : "border-stone-200 bg-stone-50 hover:border-stone-300"
                            }`}
                          >
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-200 mb-1.5">
                              <img
                                src={preset.url}
                                alt={preset.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                            <p className="font-medium text-stone-800 text-[11px] truncate">{preset.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Image URL Form */}
                    <form onSubmit={handleCustomUrlSubmit} className="space-y-1.5">
                      <label className="text-stone-700 font-medium block">Custom Image Link</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://..."
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 focus:outline-none focus:border-amber-600 transition-colors text-xs"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                        >
                          Load
                        </button>
                      </div>
                    </form>

                    {/* Upload File Input */}
                    <div className="space-y-1.5 pt-2 border-t border-stone-100">
                      <label className="text-stone-700 font-medium block">Upload Local Image</label>
                      <label className="flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-stone-300 hover:border-stone-400 bg-stone-50 hover:bg-stone-100 rounded-xl cursor-pointer transition-all">
                        <Upload className="w-4 h-4 text-stone-500" />
                        <span className="text-stone-700 font-medium">Choose file...</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-20 flex items-center justify-between px-6 py-3 border-t border-stone-200/80 text-[11px] text-stone-500 bg-white/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-700">Originkit Liquid Hover</span>
          <span>•</span>
          <span className="text-stone-500 font-mono">WebGL Fluid Simulation</span>
        </div>
        <div className="flex items-center gap-1 text-stone-500">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Move mouse or touch to create liquid ripples</span>
        </div>
      </footer>
    </div>
  );
}
