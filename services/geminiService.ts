import { GoogleGenAI, Type } from "@google/genai";
import { PlanStep } from "../types";
import { io } from "socket.io-client";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Use dynamic socket URL: production uses same origin, dev uses localhost:3001
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;
const socket = io(SOCKET_URL, { autoConnect: false });

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

// 4. Generate Dynamic Logs for a Step
export const generateStepLogs = async (stepDescription: string, context: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `For the agentic task step: "${stepDescription}", generate 2 or 3 short, realistic "system log" status updates that an AI would report while executing this.
            Context: ${context}
            Examples: "Searching Google for X...", "Reading documentation...", "Parsing dataset...", "Running python script..."
            Keep them under 8 words.
            Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const text = response.text;
    if (!text) return ["Processing..."];
    return JSON.parse(text) as string[];
  } catch (e) {
    return ["Processing step...", "Analyzing data..."];
  }
};

// 5. Execute Step (Simulation + Real Browser Control)
export const executeStep = async (step: string, context: string): Promise<string> => {
  let scrapedContent = "";
  const lowerStep = step.toLowerCase();

  // --- Browser Control Logic ---
  if (lowerStep.includes('search') || lowerStep.includes('browse') || lowerStep.includes('google') || lowerStep.includes('visit')) {
    if (!socket.connected) socket.connect();
    socket.emit('start-browser');

    let url = 'https://www.google.com';
    if (lowerStep.includes('search')) {
      const query = step.replace(/search/i, '').replace(/google/i, '').replace(/for/i, '').trim();
      url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    } else if (lowerStep.includes('visit')) {
      const parts = step.split('visit');
      if (parts[1]) url = `https://${parts[1].trim()}`;
    }

    // Perform Navigation and Scrape
    try {
      // Wrap socket events in promises to "await" them
      await new Promise<void>((resolve) => {
        socket.emit('navigate', url);
        const onComplete = () => {
          socket.off('navigation-complete', onComplete);
          resolve();
        };
        socket.on('navigation-complete', onComplete);
        // Fallback timeout
        setTimeout(resolve, 8000);
      });

      // Get Text Content
      scrapedContent = await new Promise<string>((resolve) => {
        socket.emit('get-content');
        const onContent = (text: string) => {
          socket.off('page-content', onContent);
          resolve(text);
        };
        socket.on('page-content', onContent);
        setTimeout(() => resolve(""), 5000);
      });
    } catch (e) {
      console.error("Browser interaction failed", e);
    }
  }
  // -----------------------------

  try {
    const promptContext = scrapedContent
      ? `I have successfully browsed the web. Here is the ACTUAL text content I found on the page:\n\n${scrapedContent.substring(0, 5000)}\n\n`
      : `I am executing this step based on my internal knowledge.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are an autonomous agent executing a step in a task. 
      Current Step: ${step}
      Context from previous steps: ${context}
      
      ${promptContext}
      
      Based on the above (especially the website content if provided), provide a concise, factual summary (1-2 sentences) of what you found or achieved. 
      If you found specific data, quote it. Do not halllucinate.`,
    });
    return response.text || "Step completed.";
  } catch (error) {
    return "Completed step.";
  }
};

// 6. Final Report
export const generateFinalReport = async (originalPrompt: string, stepSummaries: string[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a comprehensive final response for the user based on the executed steps.
      Original Request: "${originalPrompt}"
      
      Execution Log:
      ${stepSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}
      
      Format with clear headings and bullet points. Keep it professional and concise.`,
    });
    return response.text || "Task completed.";
  } catch (error) {
    return "Here is the result of your request based on the steps taken.";
  }
};