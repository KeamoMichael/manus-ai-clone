export interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'archive' | 'document' | 'code' | 'other';
  size: number;
  mimeType: string;
  preview?: string; // For images - data URL
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'plan' | 'file';
  plan?: Plan; // Added this to store plan state within the message history
  planId?: string;
  fileData?: FileArtifact;
  modelTag?: string;
  isZip?: boolean; // Flag for binary ZIP files
  attachments?: MessageAttachment[]; // User uploaded files
}

export interface FileArtifact {
  name: string;
  type: string;
  size: string;
  url?: string;
}

export interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'active' | 'completed';
  logs: string[]; // e.g. "Searching...", "Browsing..."
}

export interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  isComplete: boolean;
}

export enum AgentState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
}

export interface Model {
  id: string;
  name: string;
  description: string;
  tag?: string;
}

export const MODELS: Model[] = [
  { id: 'lite', name: 'Nexa 1.6 Fast', description: 'A lightweight agent for everyday tasks.', tag: 'Fast' },
  { id: 'max', name: 'Nexa 1.6 Pro', description: 'High-performance agent designed for complex tasks.', tag: 'Pro' },
];

export interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}