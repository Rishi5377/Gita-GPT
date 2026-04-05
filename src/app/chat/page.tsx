"use client";

import { useState } from "react";
import { MessageBubble } from "@/features/chat/components/MessageBubble";
import { ChatInput } from "@/features/chat/components/ChatInput";
import { Sidebar } from "@/features/chat/components/Sidebar";
import { CrisisDisclaimer } from "@/components/ui/CrisisDisclaimer";
import { useChat } from "@/features/chat/hooks/useChat";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/core/utils/cn";
import { PanelLeftOpen } from "lucide-react";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, handleNewChat, bottomRef } = useChat();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans antialiased text-foreground">
      {/* Animated Sidebar Wrapper */}
      <motion.div 
        animate={{ 
          width: isSidebarOpen ? 260 : 0,
          opacity: isSidebarOpen ? 1 : 0
        }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 1 }}
        className="overflow-hidden border-r border-border h-screen sticky top-0 shrink-0 z-50 bg-sidebar"
      >
        <div className="w-[260px] h-full">
          <Sidebar 
            onNewChat={handleNewChat} 
            onClose={() => setIsSidebarOpen(false)} 
          />
        </div>
      </motion.div>
      
      <motion.main 
        layout
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 1 }}
        className="flex-1 flex flex-col relative overflow-hidden h-full"
      >
        {/* Top bar with Toggle (when sidebar is closed) */}
        {!isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 left-4 z-50"
          >
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
            >
              <PanelLeftOpen size={20} />
            </button>
          </motion.div>
        )}

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hidden">
          <div className={cn(
            "mx-auto transition-all duration-700 w-full",
            messages.length === 0 ? "max-w-5xl h-full flex flex-col items-center justify-center pt-20" : "max-w-5xl pt-12 pb-32"
          )}>
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center text-center space-y-8"
                >
                  <div className="space-y-4">
                    <h1 className="text-6xl md:text-7xl font-serif font-medium tracking-tight text-foreground/90 leading-tight">
                      Gita-GPT
                    </h1>
                    <p className="text-xl text-muted font-serif italic max-w-lg mx-auto">
                      &quot;Path to identify Yourself&quot;
                    </p>
                  </div>
                  
                  <div className="w-full h-full px-4 text-center">
                    <ChatInput onSend={sendMessage} isLoading={isLoading} />
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col px-4 md:px-0">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={bottomRef} className="h-4" />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Persistent Floating Input (when chatting) */}
        {messages.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/80 to-transparent pt-12">
            <ChatInput onSend={sendMessage} isLoading={isLoading} />
          </div>
        )}
        
        <CrisisDisclaimer />
      </motion.main>
    </div>
  );
}
