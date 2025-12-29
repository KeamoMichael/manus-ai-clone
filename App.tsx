import React, { useState, useRef, useEffect } from 'react';
import { TopBar } from './components/TopBar';

import { PlannerWidget } from './components/PlannerWidget';
import { InlinePlanWidget } from './components/InlinePlanWidget';
import { LoginModal } from './components/LoginModal';
import { MessageRenderer } from './components/MessageRenderer';
import { Message, AgentState, Plan, Model } from './types';
import { Plus, ArrowUp, FileText, Download, Check, Square, Mic } from 'lucide-react';
import { detectFileOperation, getFileOperationAck } from './utils/fileOperationDetector';
import { generatePlan, executeStep, generateFinalReport, analyzeIntent, generateChatResponse, generateStepLogs } from './services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { RenameChatModal } from './components/RenameChatModal';
import { ChatHistory } from './types';
import manusLogo from './assets/manus logo.png';
import { Thinking } from './components/Thinking';

import { AVAILABLE_MODELS } from './services/geminiService';

export default function App() {
  // Chat History State
  const [chats, setChats] = useState<ChatHistory[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);

  // Current Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [currentModel, setCurrentModel] = useState<Model>(AVAILABLE_MODELS[0]);

  // Auth & Session State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginRequired, setIsLoginRequired] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  // Settings State
  const [username, setUsername] = useState(() => localStorage.getItem('manus_username') || 'Manus User');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('manus_dark_mode') === 'true');

  useEffect(() => {
    localStorage.setItem('manus_username', username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem('manus_dark_mode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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

  // Initialize chat history from localStorage
  useEffect(() => {
    const savedChats = localStorage.getItem('manus_chat_history');
    if (savedChats) {
      try {
        const parsed: ChatHistory[] = JSON.parse(savedChats);
        setChats(parsed);
        // Load most recent chat
        if (parsed.length > 0) {
          const mostRecent = parsed[0];
          setActiveChatId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else {
          createNewChat();
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
        createNewChat();
      }
    } else {
      createNewChat();
    }
  }, []);

  // Save chats to localStorage whenever they change
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('manus_chat_history', JSON.stringify(chats));
    }
  }, [chats]);

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

  // Auto-save current chat when messages change
  useEffect(() => {
    if (activeChatId && messages.length > 0) {
      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages, updatedAt: Date.now(), title: generateChatTitle(messages) }
          : chat
      ));
    }
  }, [messages, activeChatId]);

  // Chat Management Functions
  const generateChatTitle = (msgs: Message[]): string => {
    const firstUserMsg = msgs.find(m => m.role === 'user');
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 50);
      return title.length < firstUserMsg.content.length ? title + '...' : title;
    }
    return 'New Chat';
  };

  const createNewChat = () => {
    const newChat: ChatHistory = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setMessages([]);
    setCurrentPlan(null);
    setAgentState(AgentState.IDLE);
  };

  const switchChat = (id: string) => {
    const chat = chats.find(c => c.id === id);
    if (chat) {
      setActiveChatId(id);
      setMessages(chat.messages);
      setCurrentPlan(null);
      setAgentState(AgentState.IDLE);
    }
  };

  const renameChat = (id: string, newTitle: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === id ? { ...chat, title: newTitle, updatedAt: Date.now() } : chat
    ));
  };

  const deleteChat = (id: string) => {
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== id);
      // If deleting active chat, switch to another or create new
      if (id === activeChatId) {
        if (filtered.length > 0) {
          setActiveChatId(filtered[0].id);
          setMessages(filtered[0].messages);
        } else {
          createNewChat();
        }
      }
      return filtered;
    });
  };

  const shareChat = (id: string) => {
    const shareUrl = `${window.location.origin}/?chat=${id}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
  };

  const getCurrentChatTitle = (): string => {
    const chat = chats.find(c => c.id === activeChatId);
    return chat?.title || 'New Chat';
  };

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

    // Intelligent file operation detection using comprehensive keyword library
    const fileOp = detectFileOperation(userText);

    let initialResponseContent = '';
    if (!fileOp.isFileOperation) {
      // Only generate detailed response for non-file requests
      initialResponseContent = await generateChatResponse(`Acknowledge the user's request: "${userText}". Be brief and natural, 1-2 sentences max.`);
    } else {
      // For file requests, use appropriate acknowledgment
      initialResponseContent = getFileOperationAck(fileOp.fileName!, fileOp.operationType);
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

    // 4. Finalize - Detect if user requested a specific file using intelligent detector
    if (isStoppedRef.current) { handleTermination(); return; }

    const finalFileOp = detectFileOperation(userText);
    const requestedFile = finalFileOp.fileName;

    console.log('[File Detection] User text:', userText);
    console.log('[File Detection] Operation:', finalFileOp);
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
    <div className="flex h-screen bg-[#F9F9F9] dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      <HistorySidebar
        isOpen={historyOpen}
        onToggle={() => setHistoryOpen(!historyOpen)}
        onClose={() => setHistoryOpen(false)}
        chats={chats}
        activeChat={activeChatId}
        onSelectChat={switchChat}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
        onShareChat={shareChat}
        onNewChat={createNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        username={username}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        username={username}
        setUsername={setUsername}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      <RenameChatModal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        onRename={(newTitle) => renameChat(activeChatId, newTitle)}
        currentTitle={getCurrentChatTitle()}
      />

      <motion.div
        className="flex-1 flex flex-col min-w-0 relative"
      >

        <TopBar
          currentModel={currentModel}
          onModelChange={setCurrentModel}
          onToggleHistory={() => setHistoryOpen(!historyOpen)}
          historyOpen={historyOpen}
          currentChatId={activeChatId}
          currentChatTitle={getCurrentChatTitle()}
          onOpenRenameModal={() => setRenameModalOpen(true)}
          onDeleteChat={() => deleteChat(activeChatId)}
          onShareChat={shareChat}
        />
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
                className="text-3xl md:text-6xl font-sans font-semibold text-center text-gray-800 dark:text-gray-100 leading-tight tracking-tight"
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
                          {msg.modelTag}
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
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#F9F9F9] via-[#F9F9F9] to-transparent dark:from-gray-900 dark:via-gray-900 dark:to-transparent pt-10 z-40">
          <div className="max-w-2xl mx-auto">
            <div className={`flex flex-col bg-white dark:bg-gray-800 p-1 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-gray-700 transition-all ${isLoginRequired ? 'opacity-50 grayscale pointer-events-none' : ''}`}>

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
                className="w-full min-h-[24px] max-h-[300px] bg-transparent border-none outline-none text-[15px] px-3 pt-2 pb-0 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-500 resize-none scrollbar-hide overflow-y-auto leading-relaxed"
              />

              {/* Lower Icon Row - Zero margin-top for absolute minimum gap */}
              <div className="flex items-center justify-between mt-0 px-1 pb-0.5 pt-0.5">
                {/* Left side: Upload */}
                <button
                  disabled={isLoginRequired}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <Plus size={18} />
                </button>

                {/* Right side: Mic and Send/Stop */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={isLoginRequired}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
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
                        ? 'bg-black text-white hover:opacity-90 shadow-sm dark:bg-white dark:text-black'
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
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
      </motion.div>
    </div>
  );
}
