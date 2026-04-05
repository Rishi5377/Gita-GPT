import {
  Plus,
  Search,
  MessageSquare,
  ExternalLink,
  PanelLeftClose
} from "lucide-react";
import { cn } from "@/core/utils/cn";

interface SidebarProps {
  onNewChat: () => void;
  onClose: () => void;
}

export function Sidebar({ onNewChat, onClose }: SidebarProps) {
  const navItems = [
    { icon: MessageSquare, label: "Chats", active: true },
  ];

  const recentChats = [
    "Bhagavad Gita-based mental health...",
    "Path to identify Yourself",
    "Arjuna's Dilemma Analysis",
    "Finding Peace in Chaos",
  ];

  return (
    <div className="w-[260px] bg-sidebar flex flex-col h-screen shrink-0 backdrop-blur-xl">
      {/* Top Actions */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Menu</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full border border-border">
              <Plus size={14} />
            </div>
            New chat
          </button>

          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-muted">
            <Search size={16} />
            Search
          </button>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="px-2 py-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              item.active
                ? "bg-white/5 text-foreground font-medium"
                : "text-muted hover:bg-white/5 hover:text-foreground"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Recent Chats Section */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hidden">
        <h3 className="text-[10px] uppercase tracking-widest text-muted font-bold mb-4 opacity-50">Recents</h3>
        <ul className="space-y-1">
          {recentChats.map((chat) => (
            <li key={chat}>
              <button className="w-full text-left px-2 py-1.5 rounded-md text-[13px] text-muted hover:text-foreground hover:bg-white/5 transition-all truncate">
                {chat}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer / Profile */}
      <div className="p-4 border-t border-border mt-auto">
        <button className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all group">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs group-hover:scale-105 transition-transform">
            G
          </div>
          <div className="flex flex-col items-start overflow-hidden text-left">
            <span className="text-sm font-medium truncate w-full">Gita Explorer</span>
            <span className="text-[10px] text-muted">Wisdom Plan</span>
          </div>
          <ExternalLink size={12} className="ml-auto text-muted/50" />
        </button>
      </div>
    </div>
  );
}
