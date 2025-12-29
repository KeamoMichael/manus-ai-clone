import { GoogleGenAI, Type } from '@google/genai';
import { PlanStep } from "../types"; // Keep existing import
import { io, Socket } from 'socket.io-client'; // Re-add Socket type
import JSZip from 'jszip';

// Initialize Gemini API
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('Missing VITE_GEMINI_API_KEY');
}
const ai = new GoogleGenAI({ apiKey });

export interface Model {
  id: string;
  name: string;
  displayName: string;
  tag: string;
  description?: string;
  badge?: string;
}

export const AVAILABLE_MODELS: Model[] = [
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Nexa 1.0 Flash',
    displayName: 'Nexa 1.0 Flash',
    tag: 'Flash',
    description: 'Versatile agent capable of most tasks.',
    badge: 'Flash'
  },
  {
    id: 'gemini-exp-1206',
    name: 'Nexa 1.5 Pro',
    displayName: 'Nexa 1.5 Pro',
    tag: 'Pro',
    description: 'High-performance agent designed for complex tasks such as coding, long docs and Deep Research.',
    badge: 'Pro'
  }
];

// Socket.IO connection for E2B browser control
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;
let browserSocket: Socket | null = null;
let browserReady = false;

// Initialize browser connection
const initBrowser = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (browserSocket && browserReady) {
      resolve();
      return;
    }

    browserSocket = io(SOCKET_URL);

    browserSocket.on('connect', () => {
      console.log('[Agent] Browser socket connected');
      browserSocket!.emit('start-browser');
    });

    browserSocket.on('browser-ready', () => {
      console.log('[Agent] Browser ready for use');
      browserReady = true;
      resolve();
    });

    browserSocket.on('browser-error', (error: { message: string }) => {
      console.error('[Agent] Browser error:', error);
      reject(new Error(error.message));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!browserReady) {
        reject(new Error('Browser initialization timeout'));
      }
    }, 30000);
  });
};

// Tavily Search via REST API (browser-compatible)
const searchTavily = async (query: string) => {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('Tavily API key not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.statusText}`);
  }

  return await response.json();
};

// 1. Determine Intent: Chat vs Task
export const analyzeIntent = async (prompt: string): Promise<'chat' | 'task'> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // Updated to latest flash model
      contents: `Classify the following user prompt.
      "chat": Simple greetings, questions about the AI's identity, casual conversation, or simple one-shot questions that don't require research or multiple steps.
      "task": Requests requiring research, planning, creating documents, coding, analyzing data, or executing multiple steps.
      
      User Prompt: "${prompt}"
      
      Return ONLY the string "chat" or "task".`,
    });
    const text = response.text?.toLowerCase().trim();
    return text?.includes('task') ? 'task' : 'chat';
  } catch (e) {
    return 'chat'; // Default to chat on error
  }
};

// 2. Simple Chat Response
export const generateChatResponse = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "I'm here to help.";
  } catch (e) {
    return "I'm having trouble connecting right now.";
  }
};

// 3. Helper to create a plan based on user prompt
export const generatePlan = async (prompt: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert autonomous agent planner. 
      Break down the following user request into exactly 4 distinct, actionable steps that an AI agent would take to complete the task.
      Return ONLY a JSON array of strings. Do not include markdown formatting.
      User Request: "${prompt}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return ["Analyze request", "Gather information", "Process data", "Generate report"];

    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Plan generation error:", error);
    return ["Analyze request", "Search web", "Synthesize findings", "Finalize output"];
  }
};

// 4. Generate Step Logs (for visual progress) - Now tool-aware
export const generateStepLogs = async (step: string, context: string): Promise<string[]> => {
  // Classify the tool type to generate appropriate logs
  const toolType = await classifyStepTool(step);

  const lowerStep = step.toLowerCase();

  // Return logs with keywords that trigger correct icons
  if (toolType === 'browser') {
    // Browsing → Globe icon
    const urlMatch = step.match(/(https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]+)/i);
    const site = urlMatch ? urlMatch[0] : 'website';
    return [
      'Browsing ' + site,
      'Reading page content...'
    ];
  }

  else if (toolType === 'search') {
    // Searching → Search icon
    const query = step.replace(/search|find|look up|research|google|for|the|web|internet/gi, '').trim();
    return [
      'Searching for ' + (query || step),
      'Analyzing search results...'
    ];
  }

  else {
    // General knowledge - check if it's code/file related
    if (lowerStep.includes('create') && (lowerStep.includes('file') || lowerStep.includes('.py') || lowerStep.includes('.js') || lowerStep.includes('.md'))) {
      // Writing file → FileText icon
      return [
        'Writing file...',
        'Saving changes...'
      ];
    }

    if (lowerStep.includes('execute') || lowerStep.includes('command') || lowerStep.includes('run')) {
      // Terminal command → Terminal icon
      return [
        'Executing command...',
        'Processing output...'
      ];
    }

    // Default processing logs
    return [
      'Processing request...',
      'Generating response...'
    ];
  }
};

// 5. Execute Step with Intelligent Tool Selection
export const executeStep = async (step: string, context: string): Promise<string> => {
  const lowerStep = step.toLowerCase();

  // First, classify what tool this step needs
  const toolDecision = await classifyStepTool(step);
  console.log(`[Agent] Step: "${step}" → Tool: ${toolDecision}`);

  // --- BROWSER: Explicit browsing tasks ---
  if (toolDecision === 'browser') {
    const urlMatch = step.match(/(https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]+)/i);
    const url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : 'https://google.com';

    try {
      console.log(`[Agent] Initializing E2B browser for: ${url}`);
      await initBrowser();

      browserSocket!.emit('navigate', url);

      await new Promise<void>((resolve) => {
        browserSocket!.once('navigation-complete', () => resolve());
        setTimeout(() => resolve(), 5000);
      });

      console.log(`[Agent] Successfully browsed to ${url}`);
      return `Navigated to ${url} using E2B cloud desktop browser. Page is now visible in the preview.`;
    } catch (e) {
      console.error('[Agent] Browser failed:', e);
      return `Browser unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }

  // --- SEARCH: Current events, facts, recent info ---
  else if (toolDecision === 'search') {
    const query = step
      .replace(/search|find|look up|research|google|for|the|web|internet/gi, '')
      .trim();

    if (query && import.meta.env.VITE_TAVILY_API_KEY) {
      try {
        console.log(`[Agent] Using Tavily to search: "${query}"`);
        const response = await searchTavily(query);

        if (response.results && response.results.length > 0) {
          let results = response.results
            .map((r: any, i: number) =>
              `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`
            )
            .join('\n\n');

          if (response.answer) {
            results = `Summary: ${response.answer}\n\n--- Sources ---\n${results}`;
          }

          console.log(`[Tavily] Found ${response.results.length} results`);
          return results;
        }
      } catch (e) {
        console.error('[Tavily] Search failed:', e);
      }
    }
    // Fallback to Gemini if Tavily unavailable
    console.log('[Agent] Tavily unavailable, using Gemini knowledge');
  }

  // --- GEMINI: General knowledge, coding, explanations ---
  // This is also the fallback for failed searches
  console.log(`[Agent] Using Gemini internal knowledge`);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Given the following context and step, provide a detailed response to complete the step.
      
Context: ${context}

Step to complete: ${step}

Provide a comprehensive response:`,
    });

    return response.text || "Processing...";
  } catch (e) {
    return `Step processed: ${step}`;
  }
};

// Helper: Classify which tool a step needs
const classifyStepTool = async (step: string): Promise<'browser' | 'search' | 'knowledge'> => {
  const lowerStep = step.toLowerCase();

  // Simple keyword matching for speed
  // BROWSER: Explicit navigation
  if (lowerStep.includes('browse') || lowerStep.includes('visit') ||
    lowerStep.includes('navigate to') || lowerStep.includes('open') && (lowerStep.includes('http') || lowerStep.includes('.com') || lowerStep.includes('.org'))) {
    return 'browser';
  }

  // SEARCH: Current events, facts, "what's happening", recent info
  if ((lowerStep.includes('search') || lowerStep.includes('find') ||
    lowerStep.includes('look up') || lowerStep.includes('research')) &&
    (lowerStep.includes('latest') || lowerStep.includes('recent') ||
      lowerStep.includes('current') || lowerStep.includes('news') ||
      lowerStep.includes('today') || lowerStep.includes('this week') ||
      lowerStep.includes('what is happening') || lowerStep.includes("what's new"))) {
    return 'search';
  }

  // KNOWLEDGE: Everything else (explanations, coding, general questions)
  // This includes: "explain X", "what is X", "how does X work", "write code for X"
  return 'knowledge';
};

// 7. Final Report Generation
export const generateFinalReport = async (originalPrompt: string, stepSummaries: string[]): Promise<string> => {
  try {
    // Check if user requested a specific file (must match App.tsx regex!)
    const fileMatch = originalPrompt.match(/(?:create|modify|edit|change|update|deliverable|named|file|save|package|the file|to).*?([a-zA-Z0-9_-]+\.(py|js|html|css|json|txt|md|tsx|ts|jsx|zip))/i);
    const requestedFile = fileMatch ? fileMatch[1] : null;

    console.log('[Final Report] Prompt:', originalPrompt);
    console.log('[Final Report] Detected file:', requestedFile);

    if (requestedFile && requestedFile.endsWith('.zip')) {
      // Generate ZIP archive with multiple files!
      console.log('[ZIP Gen] Generating ZIP for:', requestedFile);

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `User requested: "${originalPrompt}"

Generate a complete project with multiple files for ${requestedFile}.
Return as a JSON object with this EXACT format:
{
  "files": [
    {"name": "main_script.py", "content": "actual Python code here"},
    {"name": "requirements.txt", "content": "dependencies list"},
    {"name": "README.md", "content": "setup instructions and usage"}
  ]
}

Create ALL necessary files for a complete, working project.
Include proper code, dependencies, and documentation.
Return ONLY the JSON, no markdown formatting.`
      });

      console.log('[ZIP Gen] Got response, text length:', response.text.length);
      console.log('[ZIP Gen] Response preview:', response.text.substring(0, 200));

      try {
        // Strip markdown code fences if Gemini added them
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        console.log('[ZIP Gen] Cleaned JSON, length:', jsonText.length);

        const filesData = JSON.parse(jsonText);
        console.log('[ZIP Gen] Parsed JSON successfully');
        console.log('[ZIP Gen] Files count:', filesData?.files?.length);

        const zip = new JSZip();

        // Add all files to ZIP
        if (filesData.files && Array.isArray(filesData.files)) {
          filesData.files.forEach((file: { name: string, content: string }) => {
            console.log('[ZIP Gen] Adding file:', file.name, 'size:', file.content.length);
            zip.file(file.name, file.content);
          });

          console.log('[ZIP Gen] Generating compressed ZIP...');
          // Generate compressed ZIP as base64
          const zipBlob = await zip.generateAsync({ type: 'base64' });
          console.log('[ZIP Gen] ZIP generated! Base64 length:', zipBlob.length);
          return zipBlob; // Return base64 ZIP data
        } else {
          console.error('[ZIP Gen] Invalid file structure:', filesData);
          return '# Error: Invalid file structure';
        }
      } catch (parseError) {
        console.error('[ZIP Gen] Parse/generation error:', parseError);
        console.error('[ZIP Gen] Raw response:', response.text);
        return '# Error creating ZIP archive';
      }
    } else if (requestedFile) {
      // Generate ONLY the file code content - NO MARKDOWN!
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `User requested: "${originalPrompt}"

Generate ONLY the code content for ${requestedFile}. 
Do NOT include any markdown formatting, explanations, or comments.
Do NOT use code fences (backticks).
Return ONLY the raw code that should be in the file.

Example: if they asked for hello.py saying "Hello World!", return exactly:
print("Hello World!")

Just the code, nothing else.`
      });

      return response.text || '# Code generation failed';
    } else {
      // Generate a task summary (can use markdown here)
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Summarize this completed task in 2-3 sentences.
        
User asked: ${originalPrompt}
Steps completed: ${stepSummaries.join(', ')}

Be concise.`
      });

      return response.text || 'Task completed successfully.';
    }
  } catch (error) {
    console.error('Final report generation error:', error);
    const fileMatch = originalPrompt.match(/create.*?([a-zA-Z0-9_-]+\.(py|js|html|css|json|txt|md|tsx|ts|jsx|zip))/i);
    const requestedFile = fileMatch ? fileMatch[1] : null;
    return requestedFile ? '# Error generating file' : 'Task completed with errors.';
  }
};