import React, { useEffect, useState, useRef } from "react";
import { useAiStore } from "../store/aiStore";
import { aiApi } from "../api";
import { Bot, User, Send, Hash, MoreVertical, Plus, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import useWidth from "../../../hooks/useWidth";

export const AiChatPage: React.FC = () => {
  const {
    threads,
    setThreads,
    messages,
    setMessages,
    currentThreadId,
    setCurrentThread,
    addMessage,
    isFabVisible,
    setFabVisible
  } = useAiStore();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isMobile } = useWidth()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (currentThreadId) {
      loadThreadDetails(currentThreadId);
    } else {
      setMessages([]);
    }
  }, [currentThreadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadThreads = async () => {
    try {
      const data = await aiApi.getThreads();
      setThreads(data);
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  };

  const loadThreadDetails = async (id: string) => {
    try {
      const data = await aiApi.getThreadDetails(id);
      setMessages(data.messages.map(m => ({
        id: Math.random().toString(),
        role: m.role,
        content: m.message,
        created_at: m.created_at
      })));
    } catch (error) {
      console.error("Failed to load thread details:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    addMessage({
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    });

    setIsLoading(true);
    try {
      const response = await aiApi.chat({
        thread_id: currentThreadId,
        message: userMessage,
      });

      if (!currentThreadId) {
        setCurrentThread(response.thread_id);
        loadThreads(); // Refresh threads list
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        created_at: response.created_at,
      });
    } catch (error) {
      console.error("AI Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-110px)] overflow-hidden bg-white dark:bg-slate-900">
      {/* Sidebar - Threads List */}
      <div
        className={`${(isSidebarOpen || !isMobile) ? "w-full md:w-72 absolute md:relative z-20" : "w-0"
          } h-full border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex flex-col transition-all duration-300 overflow-hidden shrink-0 shadow-xl md:shadow-none`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Chat History</h2>
          <div className="flex space-x-1">
            <button
              onClick={() => {
                setCurrentThread(null);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="New Chat"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Close Menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`w-full group px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${currentThreadId === thread.id
                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium"
                : "hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
            >
              <button
                onClick={() => {
                  setCurrentThread(thread.id);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className="flex-1 text-left flex items-center space-x-3 truncate"
              >
                <Hash size={16} className={`shrink-0 ${currentThreadId === thread.id ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`} />
                <span className="truncate text-sm pr-2">{thread.title || "New Conversation"}</span>
              </button>

              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm("Are you sure you want to delete this conversation?")) {
                    try {
                      await aiApi.deleteThread(thread.id);
                      if (currentThreadId === thread.id) {
                        setCurrentThread(null);
                      }
                      loadThreads();
                    } catch (err) {
                      console.error("Failed to delete thread", err);
                    }
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 shrink-0 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-all focus:opacity-100"
                title="Delete Chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {threads.length === 0 && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-8">
              No previous conversations found.
            </div>
          )}
        </div>

        {/* Settings Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isFabVisible}
              onChange={(e) => setFabVisible(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show FAB across app</span>
          </label>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="h-16 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400"
            >
              <MoreVertical size={20} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100 leading-tight">Ask Verifine</h2>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                Online
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="h-20 w-20 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Bot size={40} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">How can I help you today?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                I'm your AI financial assistant connected directly to your organizations data.
                I can help analyze expenses, track revenue, and monitor your cash flow.
              </p>

              <div className="grid grid-cols-1 gap-3 w-full">
                {[
                  "What are my total expenses for last month?",
                  "Show me the top 5 vendors we paid",
                  "What is my current cash balance across accounts?"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-3 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-500 transition-colors flex items-center group"
                  >
                    <span className="flex-1">{suggestion}</span>
                    <Send size={14} className="text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex max-w-[75%] items-start space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-1 ${msg.role === "user" ? "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300" : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                    }`}>
                    {msg.role === "user" ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div
                    className={`rounded-2xl px-5 py-3.5 shadow-sm ${msg.role === "user"
                      ? "bg-blue-600 dark:bg-blue-600 text-white rounded-tr-none"
                      : "bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-gray-100 rounded-tl-none"
                      }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-[75%] items-start space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                  <Bot size={20} />
                </div>
                <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-tl-none px-5 py-4 shadow-sm flex items-center space-x-2">
                  <div className="flex space-x-1.5">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-500"></motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-500"></motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-500"></motion.div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto flex items-end shadow-sm border border-gray-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Message Ask Verifine..."
              className="w-full max-h-32 min-h-[56px] resize-none border-0 bg-transparent py-4 pl-5 pr-14 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 sm:text-sm"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-gray-500 hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
            >
              <Send size={16} className="ml-0.5" />
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-gray-400 dark:text-gray-500">
            Ask Verifine can make mistakes. Check important info.
          </div>
        </div>
      </div>
    </div>
  );
};
