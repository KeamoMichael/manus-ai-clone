import React, { useState, useRef, useEffect } from 'react';
import { TopBar } from './components/TopBar';

import { PlannerWidget } from './components/PlannerWidget';
import { InlinePlanWidget } from './components/InlinePlanWidget';
import { LoginModal } from './components/LoginModal';
import { MessageRenderer } from './components/MessageRenderer';
import { Message, AgentState, Plan, Model } from './types';
import { Plus, ArrowUp, FileText, Download, Check, Square, Mic, X, File, FileArchive, Image as ImageIcon } from 'lucide-react';
import { detectFileOperation, getFileOperationAck } from './utils/fileOperationDetector';
import { generatePlan, executeStep, generateFinalReport, analyzeIntent, generateChatResponse, generateChatResponseStream, generateStepLogs } from './services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { RenameChatModal } from './components/RenameChatModal';
import { ChatHistory } from './types';
import nexaLogo from './assets/Nexa AI agent logo PNG.png';
import { Thinking } from './components/Thinking';

import { AVAILABLE_MODELS } from './services/geminiService';

// File attachment interface
interface AttachedFile {
  id: string;
  file: File;
  preview?: string; // For images
  type: 'image' | 'pdf' | 'archive' | 'document' | 'code' | 'other';
}

// Helper to determine file type
const getFileType = (file: File): AttachedFile['type'] => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type;

  if (mimeType.startsWith('image/')) return 'image';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive';
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'md', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].includes(ext)) return 'code';
  return 'other';
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth & Session State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginRequired, setIsLoginRequired] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  // Settings State
  const [username, setUsername] = useState(() => localStorage.getItem('nexa_username') || 'Nexa User');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('nexa_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });

  useEffect(() => {
    localStorage.setItem('nexa_username', username);
  }, [username]);

  // Theme effect - handles light/dark/system modes
  useEffect(() => {
    localStorage.setItem('nexa_theme_mode', themeMode);

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (themeMode === 'system') {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      // Listen for system theme changes
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(themeMode === 'dark');
    }
  }, [themeMode]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStoppedRef = useRef(false);

  // Process files (shared between input and drag/drop)
  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: AttachedFile[] = [];
    const maxFiles = 10;
    const currentCount = attachedFiles.length;

    for (let i = 0; i < fileList.length && currentCount + newFiles.length < maxFiles; i++) {
      const file = fileList[i];
      const fileType = getFileType(file);
      const attachedFile: AttachedFile = {
        id: Date.now().toString() + i,
        file,
        type: fileType,
      };

      // Create preview for images
      if (fileType === 'image') {
        attachedFile.preview = URL.createObjectURL(file);
      }

      newFiles.push(attachedFile);
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  // Handle file selection from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = ''; // Reset input
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  // Remove attached file
  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  // Get file icon based on type
  const getFileIcon = (type: AttachedFile['type']) => {
    switch (type) {
      case 'image': return <ImageIcon size={20} />;
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      case 'archive': return <FileArchive size={20} className="text-yellow-500" />;
      case 'code': return <FileText size={20} className="text-blue-500" />;
      case 'document': return <FileText size={20} className="text-blue-400" />;
      default: return <File size={20} className="text-gray-400" />;
    }
  };

  // Convert file to base64 for API
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

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
    const savedChats = localStorage.getItem('nexa_chat_history');
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
      localStorage.setItem('nexa_chat_history', JSON.stringify(chats));
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

    // Convert attached files to MessageAttachment format for display in chat
    const messageAttachments = attachedFiles.map(f => ({
      id: f.id,
      name: f.file.name,
      type: f.type,
      size: f.file.size,
      mimeType: f.file.type,
      preview: f.preview // Will be data URL for images
    }));

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined
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

      // Create message first with empty content for streaming
      const msgId = (Date.now() + 1).toString();
      const assistantMsg: Message = {
        id: msgId,
        role: 'assistant',
        content: '',
        type: 'text',
        modelTag: currentModel.tag
      };

      setMessages(prev => [...prev, assistantMsg]);
      setAgentState(AgentState.IDLE);

      // Convert attached images to base64 for API
      const imageAttachments = await Promise.all(
        attachedFiles
          .filter(f => f.type === 'image')
          .map(async (f) => ({
            base64: await fileToBase64(f.file),
            mimeType: f.file.type,
            name: f.file.name
          }))
      );

      // Extract text content from text-based files (code, documents, etc.)
      const textContents: string[] = [];
      for (const f of attachedFiles) {
        if (f.type === 'code' || f.type === 'document' || f.file.type.startsWith('text/')) {
          try {
            const text = await f.file.text();
            textContents.push(`[File: ${f.file.name}]\n${text}\n`);
          } catch (e) {
            console.error('Error reading text file:', e);
          }
        } else if (f.type === 'pdf') {
          textContents.push(`[PDF: ${f.file.name} - ${formatFileSize(f.file.size)}]`);
        }
      }

      // Augment prompt with file contents
      let augmentedPrompt = userText;
      if (textContents.length > 0) {
        augmentedPrompt = `${userText}\n\nAttached files content:\n${textContents.join('\n')}`;
      }

      // Clear attachments after capturing for send
      setAttachedFiles([]);

      // Stream response and update message content progressively
      await generateChatResponseStream(augmentedPrompt, (streamedText) => {
        if (isStoppedRef.current) return;
        setMessages(prev => prev.map(msg =>
          msg.id === msgId ? { ...msg, content: streamedText } : msg
        ));
      }, imageAttachments.length > 0 ? imageAttachments : undefined);

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
      finalContent = await generateFinalReport(userText, updatedSteps.map(s => s.description), executionContext);
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
      // General task - show summary inline (NO file creation)
      const summary = await generateFinalReport(userText, updatedSteps.map(s => s.description), executionContext);

      if (isStoppedRef.current) { handleTermination(); return; }

      setCurrentPlan(prev => prev ? { ...prev, isComplete: true } : null);

      const summaryMsg: Message = {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: summary,
        type: 'text',
        modelTag: currentModel.tag
      };

      setMessages(prev => [...prev, summaryMsg]);
      setAgentState(AgentState.IDLE);
      return; // Exit early - no file message needed
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
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />

      <RenameChatModal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        onRename={(newTitle) => renameChat(activeChatId, newTitle)}
        currentTitle={getCurrentChatTitle()}
      />

      <motion.div
        className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop Zone Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Drop any files here</p>
              <p className="text-sm text-gray-500">Maximum 10 files</p>
            </div>
          </div>
        )}

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
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end gap-2 max-w-[85%]">
                      {/* Attachments display */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 max-w-full">
                          {msg.attachments.map((att) => (
                            <div key={att.id} className="flex-shrink-0">
                              {att.type === 'image' && att.preview ? (
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                                  <img
                                    src={att.preview}
                                    alt={att.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="h-14 px-3 rounded-lg bg-gray-200 flex items-center gap-2">
                                  <div className={`flex-shrink-0 ${att.type === 'pdf' ? 'text-red-500' :
                                    att.type === 'archive' ? 'text-yellow-500' :
                                      att.type === 'code' ? 'text-blue-500' :
                                        'text-gray-500'
                                    }`}>
                                    <FileText size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-700 truncate max-w-[100px] font-medium">{att.name}</p>
                                    <p className="text-[10px] text-gray-500">{att.type.toUpperCase()}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Message text */}
                      <div className="bg-gray-100 px-5 py-3 rounded-2xl rounded-tr-sm text-gray-800 text-[15px] leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex items-center gap-1 mb-2">
                        <img src={nexaLogo} alt="Nexa" className="h-6 w-auto object-contain" />
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
                </div>
              ))}

              {agentState === AgentState.PLANNING && (
                <div>
                  <Thinking modelTag={currentModel.tag} />
                </div>
              )}

              <div className="h-12" />
            </div>
          )}
        </div>

        <PlannerWidget plan={currentPlan} />

        {/* Bottom Input Bar - Minimal Multi-line Redesign with Ultra Tightened Spacing */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-[env(safe-area-inset-bottom,1rem)] bg-gradient-to-t from-[#F9F9F9] via-[#F9F9F9] to-transparent dark:from-gray-900 dark:via-gray-900 dark:to-transparent pt-10 z-40">
          <div className="max-w-2xl mx-auto">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.zip,.rar,.7z,.doc,.docx,.txt,.md,.py,.js,.ts,.tsx,.jsx,.html,.css,.json,.xml,.yaml,.yml"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className={`flex flex-col bg-white dark:bg-gray-800 p-1 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-gray-700 transition-all ${isLoginRequired ? 'opacity-50 grayscale pointer-events-none' : ''}`}>

              {/* Attached Files Display - Horizontal Slider */}
              {attachedFiles.length > 0 && (
                <div className="px-3 pt-2 pb-1">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {attachedFiles.map((attachedFile) => (
                      <div
                        key={attachedFile.id}
                        className="relative flex-shrink-0 group"
                      >
                        {attachedFile.type === 'image' && attachedFile.preview ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                            <img
                              src={attachedFile.preview}
                              alt={attachedFile.file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-40 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center gap-2 px-3">
                            <div className="flex-shrink-0">
                              {getFileIcon(attachedFile.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">
                                {attachedFile.file.name}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {attachedFile.type.toUpperCase()} · {formatFileSize(attachedFile.file.size)}
                              </p>
                            </div>
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          onClick={() => removeAttachment(attachedFile.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-700 dark:bg-gray-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-800 shadow-md"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{attachedFiles.length}/10 files</p>
                </div>
              )}

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
                placeholder={messages.length > 0 ? "Message Nexa..." : "What's on your mind?"}
                disabled={agentState !== AgentState.IDLE || isLoginRequired}
                className="w-full min-h-[24px] max-h-[300px] bg-transparent border-none outline-none text-[15px] px-3 pt-2 pb-0 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-500 resize-none scrollbar-hide overflow-y-auto leading-relaxed"
              />

              {/* Lower Icon Row - Zero margin-top for absolute minimum gap */}
              <div className="flex items-center justify-between mt-0 px-1 pb-0.5 pt-0.5">
                {/* Left side: Upload */}
                <button
                  disabled={isLoginRequired || attachedFiles.length >= 10}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
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
