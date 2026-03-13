import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Bot, User, Maximize2, List, Plus, Trash2, Hash, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAiStore } from "../store/aiStore";
import { aiApi } from "../api";

export const AskVerifineWidget: React.FC = () => {
  const {
    isOpen,
    toggleChat,
    isFabVisible,
    messages,
    addMessage,
    currentThreadId,
    setCurrentThread,
    threads,
    setThreads,
    setMessages
  } = useAiStore();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    if (!showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadThreads();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentThreadId && isOpen) {
      loadThreadDetails(currentThreadId);
    } else if (!currentThreadId) {
      setMessages([]);
    }
  }, [currentThreadId, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, showHistory]);

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

    // Add optimistic user message
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
        loadThreads();
      }

      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        created_at: response.created_at,
      });
    } catch (error) {
      console.error("AI Chat Error:", error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again later.",
        created_at: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessageContent = (content: string) => {
    // Process line by line for bullet points
    const lines = content.split('\n');
    const formattedLines = lines.map(line => {
      // Replace "* " at the start of a line with a bullet point dot
      let processedLine = line.trimStart();
      if (processedLine.startsWith('* ')) {
        processedLine = '• ' + processedLine.substring(2);
      }
      return processedLine;
    });

    // Handle bold formatting across the entire string now
    let fullContent = formattedLines.join('\n');
    
    // Bold regex: finds **...** and replaces with strong tags
    fullContent = fullContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return fullContent;
  };

  if (!isFabVisible) return null;

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleChat}
            className="fixed bottom-17 right-6 z-9999 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <MessageCircle size={28} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-9999 flex h-[600px] max-h-[85vh] w-[400px] max-w-[90vw] flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-gray-200 dark:ring-slate-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
              <div className="flex items-center space-x-2">
                {showHistory ? (
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 -ml-1 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="p-1 -ml-1 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    <List size={20} />
                  </button>
                )}
                <div className="flex items-center space-x-2">
                  {!showHistory && <Bot size={20} />}
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">{showHistory ? 'History' : 'Ask Verifine'}</h3>
                    {!showHistory && <p className="text-xs text-blue-100 font-medium">Financial AI Agent</p>}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {showHistory && (
                  <button
                    onClick={() => {
                      setCurrentThread(null);
                      setShowHistory(false);
                    }}
                    className="rounded-full p-2 hover:bg-blue-700 transition-colors"
                    title="New Chat"
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  onClick={() => {
                    toggleChat();
                    navigate("/ai");
                  }}
                  className="rounded-full p-2 hover:bg-blue-700 transition-colors"
                  title="Open Full Screen"
                >
                  <Maximize2 size={18} />
                </button>
                <button
                  onClick={toggleChat}
                  className="rounded-full p-2 hover:bg-blue-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-white dark:bg-slate-900">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`w-full group px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${currentThreadId === thread.id
                      ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                      : "hover:bg-gray-100 dark:hover:bg-slate-800/80 text-gray-700 dark:text-gray-300"
                      }`}
                    onClick={() => {
                      setCurrentThread(thread.id);
                      setShowHistory(false);
                    }}
                  >
                    <button
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
            ) : (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-800/50">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
                      <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                        <Bot size={32} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">Hello there!</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[250px]">
                          I'm your AI financial assistant. Ask me about your expenses, revenue, and cashflow.
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                          }`}
                      >
                        <div
                          className={`flex max-w-[85%] items-end space-x-2 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"
                            }`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === "user" ? "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300" : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                            }`}>
                            {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                          </div>
                          <div
                            className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === "user"
                              ? "bg-blue-600 dark:bg-blue-600 text-white rounded-br-none"
                              : "bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
                              }`}
                          >
                            <div 
                              className="whitespace-pre-wrap prose-sm dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex max-w-[85%] items-end space-x-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                          <Bot size={16} />
                        </div>
                        <div className="rounded-2xl rounded-bl-none bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-4 py-3 shadow-sm flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                            <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                            <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a financial question..."
                      className="w-full rounded-full border border-transparent dark:border-slate-700 bg-gray-100 dark:bg-slate-800 py-3 pl-5 pr-12 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white disabled:bg-gray-400 dark:disabled:bg-slate-700 hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
                    >
                      <Send size={16} className="ml-0.5" />
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
