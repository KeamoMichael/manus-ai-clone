import React, { useState, useRef, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { CreditSheet } from './components/CreditSheet';
import { PlannerWidget } from './components/PlannerWidget';
import { InlinePlanWidget } from './components/InlinePlanWidget';
import { LoginModal } from './components/LoginModal';
import { MessageRenderer } from './components/MessageRenderer';
import { Message, AgentState, Plan, Model, MODELS } from './types';
import { Plus, ArrowUp, FileText, Download, Check, Square, Mic } from 'lucide-react';
import { generatePlan, executeStep, generateFinalReport, analyzeIntent, generateChatResponse, generateStepLogs } from './services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import manusLogo from './assets/manus logo.png';
import { Thinking } from './components/Thinking';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [currentModel, setCurrentModel] = useState<Model>(MODELS[0]);
  const [isCreditSheetOpen, setIsCreditSheetOpen] = useState(false);
  const [credits, setCredits] = useState(1067);

  // Auth & Session State
  const [isLoggedIn, setIsLoggedIn] = useState(false); // Start as guest
  const [isLoginRequired, setIsLoginRequired] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStoppedRef = useRef(false);

  // Auto-scroll for message container
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, messages.length, currentPlan?.steps]);

  // Handle textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to calculate scrollHeight correctly
      textareaRef.current.style.height = 'auto';
      // Set to scrollHeight but cap it at max height
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [inputValue]);

  // Sync currentPlan updates
  useEffect(() => {
    if (currentPlan) {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.type === 'plan' && msg.id === currentPlan.id
            ? { ...msg, plan: currentPlan }
            : msg
        )
      );
    }
  }, [currentPlan]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setIsLoginRequired(false);
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return "Working late?";
    if (hour < 12) return "Good morning.";
    if (hour < 17) return "Good afternoon.";
    if (hour < 21) return "Good evening.";
    return "Hello.";
  };

  const getWelcomeMessage = () => {
    if (isLoggedIn) {
      return `${getTimeBasedGreeting()} What's on your mind?`;
    }
    return "What can I do for you?";
  };

  const handleStop = () => {
    isStoppedRef.current = true;
  };

  const handleTermination = () => {
    const stopMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "I have terminated the task as requested.",
      type: 'text'
    };
    setMessages(prev => [...prev, stopMsg]);
    setAgentState(AgentState.IDLE);
    setCurrentPlan(prev => prev ? { ...prev, isComplete: true } : null);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || agentState !== AgentState.IDLE || isLoginRequired) return;

    const userText = inputValue;

    // Check Guest Limits & Permissions
    if (!isLoggedIn) {
      // Check for private data access intents
      const privateKeywords = ['gmail', 'email', 'calendar', 'drive', 'my file', 'my doc', 'spreadsheet', 'login', 'account'];
      const requiresAuth = privateKeywords.some(kw => userText.toLowerCase().includes(kw));

      // Trigger if auth required or limit reached (3 interactions)
      if (requiresAuth || interactionCount >= 3) {
        setIsLoginRequired(true);
        return;
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAgentState(AgentState.PLANNING);
    setCredits(prev => prev - 10);
    setInteractionCount(prev => prev + 1);

    isStoppedRef.current = false;

    // --- STEP 1: Determine Intent ---
    if (isStoppedRef.current) { handleTermination(); return; }
    const intent = await analyzeIntent(userText);

    // --- CASE A: Simple Chat ---
    if (intent === 'chat') {
      if (isStoppedRef.current) { handleTermination(); return; }
      const responseText = await generateChatResponse(userText);

      if (isStoppedRef.current) { handleTermination(); return; }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        type: 'text',
        modelTag: currentModel.tag
      };

      setMessages(prev => [...prev, assistantMsg]);
      setAgentState(AgentState.IDLE);
      return;
    }

    // --- CASE B: Complex Task (Agentic Mode) ---

    // Generate initial response (skip for file operations - we'll respond at the end with deliverable)
    // Catch: create/modify/edit/change/update/save X.py OR mentions of existing files like hello.py
    const initialFileMatch = userText.match(/(?:create|modify|edit|change|update|deliverable|named|file|save|package|the file|to).*?([a-zA-Z0-9_-]+\.(py|js|html|css|json|txt|md|tsx|ts|jsx|zip))/i);
    const isFileRequest = initialFileMatch !== null;

    let initialResponseContent = '';
    if (!isFileRequest) {
      // Only generate detailed response for non-file requests
      initialResponseContent = await generateChatResponse(`Acknowledge the user's request: "${userText}". Be brief and natural, 1-2 sentences max.`);
    } else {
      // For file requests, just acknowledge and proceed to execution
      initialResponseContent = `I'll create ${initialFileMatch[1]} for you.`;
    }

    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: initialResponseContent,
      type: 'text',
      modelTag: currentModel.tag
    }]);

    // 2. Generate Plan
    if (isStoppedRef.current) { handleTermination(); return; }
    const rawSteps = await generatePlan(userText);

    if (isStoppedRef.current) { handleTermination(); return; }

    const planId = (Date.now() + 2).toString();
    const newPlan: Plan = {
      id: planId,
      title: userText,
      isComplete: false,
      steps: rawSteps.map((desc, i) => ({
        id: i,
        description: desc,
        status: 'pending',
        logs: []
      }))
    };

    const planMsg: Message = {
      id: planId,
      role: 'assistant',
      content: '',
      type: 'plan',
      plan: newPlan,
      modelTag: currentModel.tag
    };
    setMessages(prev => [...prev, planMsg]);
    setCurrentPlan(newPlan);
    setAgentState(AgentState.EXECUTING);

    // 3. Execute Steps Loop
    let executionContext = "";
    const updatedSteps = [...newPlan.steps];

    for (let i = 0; i < updatedSteps.length; i++) {
      if (isStoppedRef.current) { handleTermination(); return; }

      updatedSteps[i].status = 'active';
      setCurrentPlan({ ...newPlan, steps: [...updatedSteps] });

      // Execute the step FIRST (actual work happens here)
      if (isStoppedRef.current) { handleTermination(); return; }
      const result = await executeStep(updatedSteps[i].description, executionContext);
      executionContext += `\nStep ${i + 1}: ${result}`;

      // THEN show logs after execution (so they match what actually happened)
      const dynamicLogs = await generateStepLogs(updatedSteps[i].description, executionContext);

      for (const log of dynamicLogs) {
        if (isStoppedRef.current) { handleTermination(); return; }
        updatedSteps[i].logs.push(log);
        setCurrentPlan({ ...newPlan, steps: [...updatedSteps] });
        await new Promise(r => setTimeout(r, 300)); // Short delay for visual feedback
      }

      updatedSteps[i].status = 'completed';
      setCurrentPlan({ ...newPlan, steps: [...updatedSteps] });
      await new Promise(r => setTimeout(r, 500)); // Brief pause before next step
    }

    // 4. Finalize - Detect if user requested a specific file
    if (isStoppedRef.current) { handleTermination(); return; }

    // Check if user requested a specific file creation
    // Enhanced regex to catch: "create X.zip", "deliverable > X.zip", "named X.zip", etc.
    const fileMatch = userText.match(/(?:create|modify|edit|change|update|deliverable|named|file|save|package|the file|to).*?([a-zA-Z0-9_-]+\.(py|js|html|css|json|txt|md|tsx|ts|jsx|zip))/i);
    const requestedFile = fileMatch ? fileMatch[1] : null;

    console.log('[File Detection] User text:', userText);
    console.log('[File Detection] Regex match:', fileMatch);
    console.log('[File Detection] Requested file:', requestedFile);

    let finalContent = '';
    let fileName = '';
    let fileType = '';

    if (requestedFile) {
      // User requested a specific file - generate it!
      const extension = requestedFile.split('.').pop()!;
      finalContent = await generateFinalReport(userText, updatedSteps.map(s => s.description));
      fileName = requestedFile;

      // Map extension to file type
      const typeMap: Record<string, string> = {
        'py': 'Python',
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'tsx': 'TypeScript React',
        'jsx': 'JavaScript React',
        'html': 'HTML',
        'css': 'CSS',
        'json': 'JSON',
        'txt': 'Text',
        'md': 'Markdown',
        'zip': 'ZIP Archive'
      };
      fileType = typeMap[extension] || 'Code';
    } else {
      // General task - create summary report
      finalContent = await generateFinalReport(userText, updatedSteps.map(s => s.description));
      fileName = `Result_${userText.substring(0, 10).replace(/\s/g, '_')}.md`;
      fileType = 'Markdown';
    }

    if (isStoppedRef.current) { handleTermination(); return; }

    setCurrentPlan(prev => prev ? { ...prev, isComplete: true } : null);

    const fileMsg: Message = {
      id: (Date.now() + 3).toString(),
      role: 'assistant',
      content: finalContent,
      type: 'file',
      modelTag: currentModel.tag,
      isZip: requestedFile?.endsWith('.zip') || false,
      fileData: {
        name: fileName,
        type: fileType,
        size: `${Math.ceil(finalContent.length / 1024)}KB`
      }
    };

    setMessages(prev => [...prev, fileMsg]);
    setAgentState(AgentState.IDLE);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] text-gray-900 font-sans relative overflow-hidden">
      <TopBar
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        credits={credits}
        openCredits={() => setIsCreditSheetOpen(true)}
      />

      <CreditSheet isOpen={isCreditSheetOpen} onClose={() => setIsCreditSheetOpen(false)} credits={credits} />
      <LoginModal isOpen={isLoginRequired} onLogin={handleLogin} />

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-20 pb-40 px-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center -mt-20">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-sans font-semibold text-center text-gray-800 leading-tight tracking-tight"
            >
              {getWelcomeMessage()}
            </motion.h1>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="bg-gray-100 px-5 py-3 rounded-2xl rounded-tr-sm text-gray-800 max-w-[85%] text-[15px] leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center gap-1 mb-2">
                      <img src={manusLogo} alt="Manus" className="h-6 w-auto object-contain" />
                      <span className="text-[11px] bg-gray-200 px-2 py-0.5 rounded-md text-gray-500 font-medium">
                        {msg.modelTag || currentModel.tag}
                      </span>
                    </div>

                    {msg.type === 'text' && (
                      <div className="mb-4">
                        <MessageRenderer content={msg.content} />
                      </div>
                    )}

                    {msg.type === 'plan' && msg.plan && (
                      <InlinePlanWidget plan={msg.plan} />
                    )}

                    {msg.type === 'file' && msg.fileData && (
                      <div className="mt-4">
                        <p className="text-gray-800 text-[15px] leading-relaxed mb-3">
                          {msg.isZip
                            ? `I've created ${msg.fileData.name} with all the necessary project files compressed and ready for download.`
                            : `I've created the file ${msg.fileData.name} for you.`
                          }
                        </p>

                        <div
                          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group shadow-sm"
                          onClick={() => {
                            if (msg.isZip) {
                              // Handle binary ZIP - convert base64 to blob
                              try {
                                console.log('[ZIP Download] Starting...');
                                console.log('[ZIP Download] Content length:', msg.content.length);
                                console.log('[ZIP Download] First 100 chars:', msg.content.substring(0, 100));

                                const binary = atob(msg.content);
                                console.log('[ZIP Download] Base64 decoded, binary length:', binary.length);

                                const bytes = new Uint8Array(binary.length);
                                for (let i = 0; i < binary.length; i++) {
                                  bytes[i] = binary.charCodeAt(i);
                                }
                                console.log('[ZIP Download] Byte array created');

                                const blob = new Blob([bytes], { type: 'application/zip' });
                                console.log('[ZIP Download] Blob created, size:', blob.size);

                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = msg.fileData!.name;
                                a.click();
                                URL.revokeObjectURL(url);
                                console.log('[ZIP Download] Success!');
                              } catch (e) {
                                console.error('[ZIP Download] ERROR:', e);
                                console.error('[ZIP Download] Error details:', e instanceof Error ? e.message : String(e));
                                alert(`Error downloading ZIP file: ${e instanceof Error ? e.message : 'Unknown error'}`);
                              }
                            } else {
                              // Handle regular text file
                              const blob = new Blob([msg.content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = msg.fileData!.name;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                          }}
                        >                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                              <FileText className="text-white" size={20} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{msg.fileData.name}</h4>
                              <p className="text-xs text-gray-500">{msg.fileData.type} • {msg.fileData.size}</p>
                            </div>
                          </div>
                          <div className="p-2 text-gray-400 group-hover:text-blue-600 transition-colors">
                            <Download size={20} />
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <Check size={14} className="text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Task completed</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {agentState === AgentState.PLANNING && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Thinking modelTag={currentModel.tag} />
              </motion.div>
            )}

            <div className="h-12" />
          </div>
        )}
      </div>

      <PlannerWidget plan={currentPlan} />

      {/* Bottom Input Bar - Minimal Multi-line Redesign with Ultra Tightened Spacing */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#F9F9F9] via-[#F9F9F9] to-transparent pt-10 z-40">
        <div className="max-w-2xl mx-auto">
          <div className={`flex flex-col bg-white p-1 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 transition-all ${isLoginRequired ? 'opacity-50 grayscale pointer-events-none' : ''}`}>

            {/* Upper Text Area - Dynamically scales up to max-height, minimal vertical gaps */}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={messages.length > 0 ? "Message Manus..." : "What's on your mind?"}
              disabled={agentState !== AgentState.IDLE || isLoginRequired}
              className="w-full min-h-[24px] max-h-[300px] bg-transparent border-none outline-none text-[15px] px-3 pt-2 pb-0 text-gray-900 placeholder-gray-300 resize-none scrollbar-hide overflow-y-auto leading-relaxed"
            />

            {/* Lower Icon Row - Zero margin-top for absolute minimum gap */}
            <div className="flex items-center justify-between mt-0 px-1 pb-0.5 pt-0.5">
              {/* Left side: Upload */}
              <button
                disabled={isLoginRequired}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
              >
                <Plus size={18} />
              </button>

              {/* Right side: Mic and Send/Stop */}
              <div className="flex items-center gap-1">
                <button
                  disabled={isLoginRequired}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  <Mic size={16} />
                </button>

                {agentState !== AgentState.IDLE ? (
                  <button
                    onClick={handleStop}
                    className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoginRequired}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${inputValue.trim()
                      ? 'bg-black text-white hover:opacity-90 shadow-sm'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                  >
                    <ArrowUp size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
