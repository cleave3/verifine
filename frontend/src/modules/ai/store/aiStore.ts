import { create } from "zustand";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Thread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AiState {
  isOpen: boolean;
  currentThreadId: string | null;
  messages: Message[];
  threads: Thread[];
  isFabVisible: boolean;
  toggleChat: () => void;
  setFabVisible: (visible: boolean) => void;
  setCurrentThread: (threadId: string | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setThreads: (threads: Thread[]) => void;
}

export const useAiStore = create<AiState>((set) => ({
  isOpen: false,
  currentThreadId: null,
  messages: [],
  threads: [],
  isFabVisible: true,
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  setFabVisible: (visible) => set({ isFabVisible: visible }),
  setCurrentThread: (threadId) => set({ currentThreadId: threadId, messages: [] }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setThreads: (threads) => set({ threads }),
}));
