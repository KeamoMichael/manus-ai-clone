import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronUp, Monitor, Globe, Code, Terminal as TerminalIcon,
    Image as ImageIcon, X, Maximize2, Check,
    SkipBack, SkipForward
} from 'lucide-react';
import { io } from 'socket.io-client';
import { Plan } from '../types';

interface PlannerWidgetProps {
    plan: Plan | null;
}

interface ToolViewProps {
    className?: string;
    isActive?: boolean;
}

// --- Mock Tool Components (Responsive & Animated) ---

const BrowserView = ({ className = "", isActive = true }: ToolViewProps) => {
    const [liveViewUrl, setLiveViewUrl] = useState<string>('');
    const [status, setStatus] = useState<string>('Initializing...');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (!isActive) return;

        const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;
        const socket = io(SOCKET_URL);

        socket.on('connect', () => {
            console.log('[E2B] Socket connected');
            setStatus('Launching cloud desktop...');
            socket.emit('start-browser');
        });

        socket.on('browser-ready', (data: { liveViewUrl: string; sessionId: string }) => {
            console.log('[E2B] Desktop ready:', data);
            setLiveViewUrl(data.liveViewUrl);
            setStatus('Connected');
            setError('');
        });

        socket.on('browser-error', (errorData: { message: string }) => {
            console.error('[E2B] Error:', errorData);
            setStatus('Error');
            setError(errorData.message);
        });

        socket.on('disconnect', () => {
            console.log('[E2B] Socket disconnected');
            setStatus('Disconnected');
        });

        return () => {
            console.log('[E2B] Cleaning up socket connection');
            socket.emit('stop-browser');
            socket.disconnect();
        };
    }, [isActive]);

    return (
        <div className={`bg-white flex flex-col font-sans w-full h-full overflow-hidden ${className}`}>
            {/* Chrome Header */}
            <div className="bg-gray-100 border-b border-gray-200 flex items-center px-2 py-1 gap-2 shrink-0 h-6 sm:h-8 relative z-10">
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded flex items-center px-2 h-4 sm:h-5 shadow-sm ml-2 border border-gray-200">
                    <div className="text-[8px] sm:text-[10px] text-gray-400 truncate flex-1 text-center">
                        {liveViewUrl ? 'e2b.dev' : 'cloud desktop'}
                    </div>
                </div>
            </div>

            {/* Live Browser View */}
            <div className="flex-1 relative overflow-hidden bg-gray-50">
                {liveViewUrl ? (
                    <iframe
                        src={liveViewUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        style={{
                            objectFit: 'cover',
                            transform: 'scale(1.1)',
                            transformOrigin: 'center center'
                        }}
                        title="Live Browser Preview"
                        allow="clipboard-read; clipboard-write"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                        <Globe size={32} className="text-red-400" />
                        <span className="text-xs text-red-600 font-medium">Desktop Unavailable</span>
                        <span className="text-[10px] text-gray-500 text-center">{error}</span>
                        <span className="text-[9px] text-gray-400 text-center">Configure E2B_API_KEY</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-600 font-medium">{status}</span>
                        <span className="text-[10px] text-gray-400">E2B Cloud Desktop</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const EditorView = ({ className = "", isActive = true }: ToolViewProps) => (
    <div className={`bg-[#1e1e1e] flex flex-col font-mono text-xs w-full h-full overflow-hidden ${className}`}>
        <div className="bg-[#252526] px-3 py-1 text-white/50 flex items-center gap-4 shrink-0 h-6 sm:h-8 border-b border-black/20">
            <span className="text-white/90 bg-[#1e1e1e] px-2 py-0.5 rounded-t text-[10px] border-t border-blue-500">script.py</span>
            <span className="text-[10px]">utils.ts</span>
        </div>
        <div className="p-3 text-gray-400 flex-1 overflow-hidden relative">
            <div className="flex gap-3 h-full">
                {/* Line Numbers */}
                <div className="flex flex-col text-right select-none opacity-30 text-[10px] border-r border-white/10 pr-2 mr-1">
                    {Array.from({ length: 20 }).map((_, i) => <div key={i}>{i + 1}</div>)}
                </div>

                {/* Code Content */}
                <div className="flex-1 text-[10px] leading-relaxed font-mono">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="text-pink-400">import</span> <span className="text-white">pandas</span> <span className="text-pink-400">as</span> <span className="text-white">pd</span><br />
                        <span className="text-pink-400">import</span> <span className="text-white">numpy</span> <span className="text-pink-400">as</span> <span className="text-white">np</span><br />
                        <br />
                        <span className="text-blue-400">def</span> <span className="text-yellow-200">analyze_data</span>(df):
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                        className="pl-2"
                    >
                        <span className="text-green-600"># TODO: Implement robust error handling</span>
                    </motion.div>

                    {/* Simulated Typing - Only loops if active */}
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={isActive ? { height: 'auto', opacity: 1 } : { height: 'auto', opacity: 1 }}
                        transition={isActive ? { duration: 3, repeat: Infinity, repeatDelay: 2 } : { duration: 0.5 }}
                        className="overflow-hidden whitespace-nowrap pl-2"
                    >
                        <span className="text-white">clean_df = df.dropna()</span><br />
                        <span className="text-white">results = clean_df.mean()</span><br />
                        <span className="text-pink-400">return</span> <span className="text-white">results</span>
                    </motion.div>

                    {/* Blinking Cursor - Hidden if inactive */}
                    <motion.div
                        animate={isActive ? { opacity: [1, 0, 1] } : { opacity: 0 }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="inline-block w-1.5 h-3 bg-blue-400 ml-1 align-middle"
                    />
                </div>
            </div>
        </div>
    </div>
);

const TerminalView = ({ className = "", isActive = true }: ToolViewProps) => (
    <div className={`bg-black flex flex-col font-mono text-xs w-full h-full p-3 overflow-hidden ${className}`}>
        <div className="flex-1 flex flex-col justify-end">
            <motion.div
                animate={isActive ? { y: [0, -120] } : { y: -120 }}
                transition={isActive ? { duration: 6, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
                className="space-y-1"
            >
                <div className="text-gray-500 text-[10px]">initiating connection...</div>
                <div className="text-gray-500 text-[10px]">verifying handshake...</div>
                <div className="text-green-500 text-[10px]">✔ Connected to remote host</div>
                <div className="text-green-500 flex gap-2 mt-2 text-[10px]">
                    <span>➜</span>
                    <span>~</span>
                    <span className="text-white">npm install analytics-tool</span>
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="text-gray-600 text-[9px]">
                        [..................] \ fetchMetadata: pkg_{Math.random().toString(36).substring(7)}...
                    </div>
                ))}
                <div className="text-green-500 flex gap-2 mt-2 text-[10px]">
                    <span>➜</span>
                    <span>~</span>
                    <span className="text-white">python main.py --verbose</span>
                </div>
                <div className="text-white text-[10px]">Starting process...</div>

                {/* Conditional Footer */}
                {isActive ? (
                    <div className="text-white text-[10px] flex items-center gap-1">
                        Processing
                        <span className="w-1.5 h-3 bg-white animate-pulse" />
                    </div>
                ) : (
                    <div className="text-green-500 text-[10px] flex items-center gap-1 mt-2 font-bold">
                        Process completed successfully.
                    </div>
                )}
            </motion.div>
        </div>
    </div>
);

const MediaView = ({ className = "", isActive = true }: ToolViewProps) => (
    <div className={`bg-gray-900 flex items-center justify-center w-full h-full relative overflow-hidden ${className}`}>
        <div className="absolute top-2 left-2 text-white/40 text-[10px] font-mono z-10">preview_01.png</div>
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '10px 10px' }}
        />

        <motion.div
            animate={isActive ? { scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] } : { scale: 1, rotate: 0 }}
            transition={isActive ? { duration: 10, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
            className="w-3/4 aspect-square bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg shadow-2xl relative"
        >
            <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] rounded-lg" />
            {/* Fake content inside image */}
            <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-white/20 rounded-full blur-xl" />
        </motion.div>
    </div>
);

// --- Sub-Components ---

const Thumbnail = ({ tool, onClick, isActive }: { tool: string, onClick: (e: React.MouseEvent) => void, isActive: boolean }) => {
    let Component = BrowserView;
    if (tool === 'editor') Component = EditorView;
    if (tool === 'terminal') Component = TerminalView;
    if (tool === 'media') Component = MediaView;

    return (
        <div
            onClick={onClick}
            className="relative w-full h-full bg-gray-100 rounded-lg border border-gray-200 overflow-hidden cursor-pointer shadow-sm group transition-all hover:ring-2 hover:ring-blue-500/20"
        >
            {/* Live Preview Content - Responsive Fill */}
            <div className="absolute inset-0 pointer-events-none w-full h-full bg-white">
                <Component isActive={isActive} />
            </div>

            {/* Persistent Expand Icon at Bottom Corner */}
            <div className="absolute bottom-1 right-1 bg-black/40 backdrop-blur-[2px] p-[3px] rounded-md flex items-center justify-center transition-colors group-hover:bg-black/60 z-20">
                <Maximize2 size={12} className="text-white" />
            </div>
        </div>
    );
};

// --- Main Widget ---

export const PlannerWidget: React.FC<PlannerWidgetProps> = ({ plan }) => {
    const [viewMode, setViewMode] = useState<'collapsed' | 'expanded' | 'desktop'>('collapsed');
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isDesktopPlannerOpen, setIsDesktopPlannerOpen] = useState(false);

    useEffect(() => {
        if (plan && !plan.isComplete) {
            setViewMode('collapsed');
            setElapsedSeconds(0);
            setIsDesktopPlannerOpen(false);
        }
    }, [plan?.id]);

    useEffect(() => {
        let interval: any;
        if (plan && !plan.isComplete) {
            interval = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [plan?.isComplete, plan]);

    if (!plan) return null;

    const activeStepIndex = plan.steps.findIndex(s => s.status === 'active');
    const activeStep = plan.steps[activeStepIndex] || plan.steps[plan.steps.length - 1];
    const activeStepNum = activeStepIndex === -1 ? plan.steps.length : activeStepIndex + 1;
    const isPlanComplete = plan.isComplete;

    // Determine tool based on description
    const desc = activeStep.description.toLowerCase();
    let currentTool: 'browser' | 'editor' | 'terminal' | 'media' = 'browser';
    let toolName = "the browser";
    let toolIcon = <Globe size={20} className="text-gray-600" />;

    if (desc.includes('code') || desc.includes('script') || desc.includes('write') || desc.includes('function')) {
        currentTool = 'editor';
        toolName = "the text editor";
        toolIcon = <Code size={20} className="text-gray-600" />;
    } else if (desc.includes('run') || desc.includes('execute') || desc.includes('install') || desc.includes('terminal') || desc.includes('command')) {
        currentTool = 'terminal';
        toolName = "the terminal";
        toolIcon = <TerminalIcon size={20} className="text-gray-600" />;
    } else if (desc.includes('image') || desc.includes('view') || desc.includes('media') || desc.includes('design')) {
        currentTool = 'media';
        toolName = "Media viewer";
        toolIcon = <ImageIcon size={20} className="text-gray-600" />;
    }

    const ToolComponent = currentTool === 'editor' ? EditorView : currentTool === 'media' ? MediaView : currentTool === 'terminal' ? TerminalView : BrowserView;

    // Render Full Desktop Overlay
    const renderDesktopOverlay = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-gray-50 flex flex-col"
        >
            {/* Top Bar */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
                <button onClick={() => setViewMode('expanded')} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} className="text-gray-600" />
                </button>
                <div className="flex flex-col items-center">
                    <h2 className="font-semibold text-gray-900">Manus's computer</h2>
                </div>
                <div className="w-10 flex justify-end">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <Monitor size={18} className="text-gray-600" />
                    </div>
                </div>
            </div>

            {/* Main Screen Area */}
            <div className="flex-1 p-4 md:p-8 flex items-center justify-center overflow-hidden bg-[#F9F9F9]">
                <div className="w-full h-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 relative">
                    {/* Fake Path Bar for Desktop View */}
                    <div className="absolute top-4 left-0 right-0 z-10 flex justify-center pointer-events-none">
                        <div className="bg-white/90 backdrop-blur shadow-sm border border-gray-200 px-4 py-1.5 rounded-full text-xs text-gray-500 font-mono">
                            /home/ubuntu/{currentTool === 'browser' ? 'chrome' : currentTool === 'editor' ? 'vscode' : currentTool === 'terminal' ? 'term' : 'viewer'}
                        </div>
                    </div>
                    <ToolComponent className="w-full h-full" isActive={!isPlanComplete} />
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="bg-white border-t border-gray-200 pb-8 pt-4 px-6 z-50">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Info Pill (resembling collapsed planner without thumbnail) */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
                            {toolIcon}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                                {isPlanComplete ? "Task completed" : `Manus is using ${toolName}`}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed break-words">
                                {activeStep.description}
                            </p>
                        </div>
                    </div>

                    {/* Slider - Simple progress bar with dot */}
                    <div className="relative h-1.5 w-full bg-gray-200 rounded-full cursor-pointer group">
                        {/* Filled part */}
                        <div className="absolute left-0 top-0 bottom-0 bg-gray-400 rounded-full w-[65%]" />
                        {/* Dot handle */}
                        <div className="absolute left-[65%] top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-gray-600 rounded-full shadow-md transform -translate-x-1/2 group-hover:scale-110 transition-transform" />
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center justify-center gap-10">
                        <SkipBack size={24} className="text-gray-400 cursor-not-allowed" />
                        {isPlanComplete ? (
                            <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                <span className="font-semibold text-sm">Done</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="font-semibold text-sm">Live</span>
                            </div>
                        )}
                        <SkipForward size={24} className="text-gray-400 cursor-not-allowed" />
                    </div>

                    {/* Active Task Bottom Sheet - Expandable */}
                    <motion.div
                        layout
                        initial={{ borderRadius: 12 }}
                        className="bg-gray-50 border border-gray-100 overflow-hidden shadow-sm"
                        style={{ borderRadius: 12 }}
                    >
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setIsDesktopPlannerOpen(!isDesktopPlannerOpen)}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                {!isDesktopPlannerOpen ? (
                                    <>
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${activeStep.status === 'active' ? 'bg-blue-500 animate-pulse' : isPlanComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <span className="font-medium text-gray-800 text-sm truncate">{activeStep.description}</span>
                                    </>
                                ) : (
                                    <span className="font-bold text-gray-900 text-sm">Planner</span>
                                )}
                            </div>
                            {isDesktopPlannerOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
                        </div>

                        <AnimatePresence>
                            {isDesktopPlannerOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                >
                                    <div className="px-4 pb-4 pt-0 space-y-3 max-h-[30vh] overflow-y-auto">
                                        {/* Progress Text */}
                                        <div className="flex justify-between text-xs text-gray-400 font-medium mb-2">
                                            <span>Progress</span>
                                            <span>{activeStepNum} / {plan.steps.length}</span>
                                        </div>
                                        {/* Step List */}
                                        {plan.steps.map((step) => (
                                            <div key={step.id} className="flex gap-3 items-start">
                                                <div className="mt-0.5 shrink-0">
                                                    {step.status === 'completed' ? (
                                                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                                                            <Check size={10} className="text-green-600 stroke-[3]" />
                                                        </div>
                                                    ) : step.status === 'active' ? (
                                                        <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex items-center justify-center">
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                                                    )}
                                                </div>
                                                <p className={`text-sm leading-snug ${step.status === 'completed' ? 'text-gray-900' : step.status === 'active' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {step.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );

    return (
        <>
            <AnimatePresence>
                {viewMode === 'desktop' && renderDesktopOverlay()}
            </AnimatePresence>

            <div className={`fixed bottom-28 sm:bottom-32 left-0 right-0 flex justify-center z-40 pointer-events-none px-4 transition-all duration-300 ${viewMode === 'desktop' ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
                <div className="pointer-events-auto w-full max-w-2xl origin-bottom perspective-1000">
                    <AnimatePresence>
                        {viewMode === 'expanded' ? (
                            // --- EXPANDED PLANNER VIEW ---
                            <motion.div
                                key="expanded"
                                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-200 overflow-hidden flex flex-col"
                            >
                                {/* Header */}
                                <div className="p-3 flex items-start gap-4 border-b border-gray-100 bg-white">
                                    <div className="w-40 h-24 shrink-0">
                                        <Thumbnail
                                            tool={currentTool}
                                            isActive={!isPlanComplete}
                                            onClick={(e) => { e.stopPropagation(); setViewMode('desktop'); }}
                                        />
                                    </div>
                                    <div
                                        className="flex-1 min-w-0 cursor-pointer pt-1"
                                        onClick={() => setViewMode('collapsed')}
                                    >
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm text-gray-900 leading-tight">Manus's computer</h3>
                                            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{activeStepNum} / {plan.steps.length}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {activeStep.description}
                                        </p>
                                    </div>
                                    <button onClick={() => setViewMode('collapsed')} className="text-gray-400 hover:text-gray-600 p-1">
                                        <ChevronDown size={20} />
                                    </button>
                                </div>

                                {/* Body: Planner List */}
                                <div className="p-4 bg-white">
                                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                                        {plan.steps.map((step) => (
                                            <div key={step.id} className="flex gap-3 items-start">
                                                <div className="mt-0.5 shrink-0">
                                                    {step.status === 'completed' ? (
                                                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                                            <Check size={12} className="text-green-600 stroke-[3]" />
                                                        </div>
                                                    ) : step.status === 'active' ? (
                                                        <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center">
                                                            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                                                    )}
                                                </div>
                                                <p className={`text-[15px] leading-snug ${step.status === 'completed' ? 'text-gray-900' : step.status === 'active' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {step.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            // --- COLLAPSED VIEW ---
                            <motion.div
                                key="collapsed"
                                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-200 p-2 flex items-center gap-3 pr-4 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => setViewMode('expanded')}
                            >
                                <div className="w-20 h-14 shrink-0">
                                    <Thumbnail
                                        tool={currentTool}
                                        isActive={!isPlanComplete}
                                        onClick={(e) => { e.stopPropagation(); setViewMode('desktop'); }}
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm text-gray-900">Manus's computer</h3>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {isPlanComplete ? "Task completed" : `Manus is using ${toolName}`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                        {activeStepNum} / {plan.steps.length}
                                    </span>
                                    <ChevronUp size={20} className="text-gray-400" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
};