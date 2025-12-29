import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, MoreVertical, Edit2, Trash2, Share2, Plus, Search, PanelLeft, Edit3, ChevronDown, ChevronRight, ChevronLeft, User } from 'lucide-react';
import { ChatHistory } from '../types';
import manusLogo from '../assets/manus logo.png';
import { SearchModal } from './SearchModal';

interface HistorySidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    chats: ChatHistory[];
    activeChat: string;
    onSelectChat: (id: string) => void;
    onRenameChat: (id: string, newTitle: string) => void;
    onDeleteChat: (id: string) => void;
    onShareChat: (id: string) => void;
    onNewChat: () => void;
    onOpenSettings: () => void;
    username?: string;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
    isOpen,
    onToggle,
    onClose,
    chats,
    activeChat,
    onSelectChat,
    onRenameChat,
    onDeleteChat,
    onShareChat,
    onNewChat,
    onOpenSettings,
    username
}) => {
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString();
    };

    const handleMenuAction = (chatId: string, action: 'rename' | 'delete' | 'share', e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(null);

        if (action === 'rename') {
            const chat = chats.find(c => c.id === chatId);
            if (chat) {
                setRenameValue(chat.title);
                setRenaming(chatId);
            }
        } else if (action === 'delete') {
            if (deleteConfirm === chatId) {
                onDeleteChat(chatId);
                setDeleteConfirm(null);
            } else {
                setDeleteConfirm(chatId);
                setTimeout(() => setDeleteConfirm(null), 3000);
            }
        } else if (action === 'share') {
            onShareChat(chatId);
        }
    };

    const handleRename = (chatId: string) => {
        if (renameValue.trim()) {
            onRenameChat(chatId, renameValue.trim());
        }
        setRenaming(null);
    };

    // Sidebar Content Component
    const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
        const showFull = mobile || isOpen;
        const [isSearchOpen, setIsSearchOpen] = useState(false);

        return (
            <div className="flex flex-col h-full w-full">
                {/* Search Modal */}
                <SearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    chats={chats}
                    onSelectChat={onSelectChat}
                    onNewChat={onNewChat}
                />

                {/* Header */}
                <div className={`flex items-center h-14 min-h-[56px] px-3 border-b border-gray-100/50 ${showFull ? 'justify-between' : 'justify-center'} relative`}>

                    {/* Mobile Header Layout: Logo (Center), Settings Right */}
                    {mobile ? (
                        <>
                            {/* Center: Logo */}
                            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
                                <img src={manusLogo} alt="Manus" className="h-6 w-auto object-contain max-w-[100px]" />
                            </div>

                            {/* Right: Settings User Icon */}
                            <div className="ml-auto">
                                <button
                                    onClick={onOpenSettings}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                                >
                                    <User size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        // Desktop Header Layout
                        <>
                            {showFull && (
                                <div className="flex items-center overflow-hidden">
                                    <img src={manusLogo} alt="Manus" className="h-6 w-auto object-contain max-w-[120px]" />
                                </div>
                            )}

                            <button
                                onClick={onToggle}
                                className={`p-1.5 hover:bg-gray-200 rounded-md text-gray-500 transition-colors shrink-0 ${showFull ? '' : 'mx-auto'}`}
                                title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
                            >
                                <PanelLeft size={18} />
                            </button>
                        </>
                    )}
                </div>

                {/* Primary Actions */}
                <div className="px-2 py-4 space-y-1 border-b border-transparent">
                    <button
                        onClick={() => {
                            onNewChat();
                            if (mobile) onClose();
                        }}
                        className={`flex items-center ${showFull ? 'gap-3 px-3' : 'justify-center'} py-2 rounded-lg hover:bg-gray-200 transition-colors group w-full`}
                        title="New task"
                    >
                        <Edit3 size={18} className="text-gray-700 shrink-0" />
                        {showFull && <span className="text-sm font-medium text-gray-900">New task</span>}
                    </button>

                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className={`flex items-center ${showFull ? 'gap-3 px-3' : 'justify-center'} py-2 rounded-lg hover:bg-gray-200 transition-colors group w-full`}
                        title="Search"
                    >
                        <Search size={18} className="text-gray-500 shrink-0 group-hover:text-gray-800" />
                        {showFull && <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">Search</span>}
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-2 mt-2 custom-scrollbar">
                    {showFull ? (
                        <>
                            {/* Collapsible Header */}
                            <button
                                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 w-full mb-1 transition-colors select-none"
                            >
                                {isHistoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                All tasks
                            </button>

                            {/* Collapsible Content */}
                            <AnimatePresence>
                                {isHistoryExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        {chats.length === 0 ? (
                                            <p className="px-6 text-xs text-gray-400 py-2">No tasks yet</p>
                                        ) : (
                                            chats.map((chat) => (
                                                <div key={chat.id} className="relative group/item">
                                                    {renaming === chat.id ? (
                                                        <div className="mx-2 p-1 border rounded bg-white shadow-sm">
                                                            <input
                                                                autoFocus
                                                                className="w-full text-sm outline-none bg-transparent px-1"
                                                                value={renameValue}
                                                                onChange={e => setRenameValue(e.target.value)}
                                                                onBlur={() => handleRename(chat.id)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleRename(chat.id);
                                                                    if (e.key === 'Escape') setRenaming(null);
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => {
                                                                onSelectChat(chat.id);
                                                                if (mobile) onClose();
                                                            }}
                                                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm mb-0.5 transition-colors ${activeChat === chat.id ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
                                                                }`}
                                                            title={chat.title}
                                                        >
                                                            <MessageSquare size={16} className={`shrink-0 ${activeChat === chat.id ? 'text-gray-900' : 'text-gray-400'}`} />
                                                            <span className="truncate flex-1">{chat.title}</span>
                                                            <div className="opacity-0 group-hover/item:opacity-100 flex items-center">
                                                                <button
                                                                    onClick={(e) => handleMenuAction(chat.id, 'rename', e)}
                                                                    className="p-1 hover:bg-gray-300 rounded text-gray-500 hover:text-gray-800"
                                                                >
                                                                    <MoreVertical size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    ) : (
                        // Mini Mode: Icons Only
                        <div className="space-y-1 pt-2">
                            {chats.map((chat) => (
                                <div
                                    key={chat.id}
                                    onClick={() => onSelectChat(chat.id)}
                                    className={`flex justify-center py-2.5 rounded-md cursor-pointer transition-colors ${activeChat === chat.id ? 'bg-gray-200 text-gray-900' : 'text-gray-400 hover:bg-gray-100'
                                        }`}
                                    title={chat.title}
                                >
                                    <MessageSquare size={18} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Desktop Sidebar - Mini (60px) <-> Expanded (260px) */}
            <motion.div
                initial={false}
                animate={{
                    width: isOpen ? '260px' : '60px',
                    transition: { type: 'spring', damping: 30, stiffness: 300 }
                }}
                className="hidden md:flex flex-col bg-[#F9F9F9] dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-hidden h-full z-20 shrink-0"
            >
                <div className="w-full h-full flex flex-col">
                    {/* Content Wrapper */}
                    <div className="flex-1 overflow-hidden">
                        <SidebarContent mobile={false} />
                    </div>

                    {/* Desktop Footer: Profile & Username */}
                    <div className="p-3 border-t border-gray-100/50 dark:border-gray-800 mt-auto shrink-0">
                        <button
                            onClick={onOpenSettings}
                            className={`flex items-center ${isOpen ? 'gap-3 px-2' : 'justify-center'} w-full p-2 py-2.5 hover:bg-white hover:shadow-sm rounded-xl transition-all group border border-transparent hover:border-gray-100`}
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-sm relative overflow-hidden">
                                {isOpen ? (
                                    <User size={16} />
                                ) : (
                                    <User size={18} />
                                )}
                            </div>

                            {/* Username - Only visible when expanded */}
                            {isOpen && (
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate w-full text-left">{username || 'User'}</span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-left">Free Plan</span>
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Mobile Sidebar - Fixed Full Window Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed inset-0 bg-white dark:bg-gray-900 z-[60] flex flex-col md:hidden"
                    >
                        <SidebarContent mobile={true} />
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: transparent;
                    border-radius: 2px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: #e5e7eb;
                }
            `}</style>
        </>
    );
};
