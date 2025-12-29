import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, MessageSquare, Calendar } from 'lucide-react';
import { ChatHistory } from '../types';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    chats: ChatHistory[];
    onSelectChat: (id: string) => void;
    onNewChat: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
    isOpen,
    onClose,
    chats,
    onSelectChat,
    onNewChat
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Reset search when opening
    useEffect(() => {
        if (isOpen) setSearchTerm('');
    }, [isOpen]);

    // Filter and group chats
    const groupedChats = useMemo(() => {
        const filtered = chats.filter(chat =>
            chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            chat.messages.some(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);

        const groups = {
            today: [] as ChatHistory[],
            yesterday: [] as ChatHistory[],
            last7Days: [] as ChatHistory[],
            older: [] as ChatHistory[]
        };

        filtered.forEach(chat => {
            const chatDate = new Date(chat.updatedAt); // Using updatedAt for sorting

            if (chatDate.toDateString() === today.toDateString()) {
                groups.today.push(chat);
            } else if (chatDate.toDateString() === yesterday.toDateString()) {
                groups.yesterday.push(chat);
            } else if (chatDate > lastWeek) {
                groups.last7Days.push(chat);
            } else {
                groups.older.push(chat);
            }
        });

        return groups;
    }, [chats, searchTerm]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 dark:bg-black/50 z-[9999]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="fixed inset-0 m-auto w-full max-w-[600px] h-fit max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-[10000] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700"
                        style={{
                            top: '20%',
                            bottom: 'auto'
                        }}
                    >
                        {/* Header / Search Input */}
                        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700 gap-3">
                            <Search size={20} className="text-gray-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search tasks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 text-base outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent h-10"
                            />
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Quick Action: New Task */}
                        <div className="p-2 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50">
                            <button
                                onClick={() => {
                                    onNewChat();
                                    onClose();
                                }}
                                className="flex items-center gap-3 px-3 py-2 w-full hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm rounded-lg transition-all text-sm font-medium text-gray-700 dark:text-gray-200 group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                            >
                                <div className="w-8 h-8 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white group-hover:border-gray-300 dark:group-hover:border-gray-500 transition-colors shadow-sm">
                                    <Plus size={16} />
                                </div>
                                New task
                            </button>
                        </div>

                        {/* Results List */}
                        <div className="overflow-y-auto max-h-[60vh] p-2 custom-scrollbar">
                            {(Object.entries(groupedChats) as [string, ChatHistory[]][]).map(([key, group]) => {
                                if (group.length === 0) return null;

                                const titleMap: Record<string, string> = {
                                    today: 'Today',
                                    yesterday: 'Yesterday',
                                    last7Days: 'Last 7 days',
                                    older: 'Older'
                                };

                                return (
                                    <div key={key} className="mb-4">
                                        <h3 className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                            {titleMap[key]}
                                        </h3>
                                        <div className="space-y-0.5">
                                            {group.map(chat => (
                                                <button
                                                    key={chat.id}
                                                    onClick={() => {
                                                        onSelectChat(chat.id);
                                                        onClose();
                                                    }}
                                                    className="flex items-start gap-3 w-full px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg group transition-colors text-left"
                                                >
                                                    <div className="mt-0.5 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0 group-hover:bg-white dark:group-hover:bg-gray-600 group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-200 dark:group-hover:border-gray-500">
                                                        <MessageSquare size={14} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-4">
                                                            {chat.title}
                                                        </h4>
                                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                                            {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
                                                        </p>
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 whitespace-nowrap mt-1">
                                                        {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty State */}
                            {Object.values(groupedChats).every((g: ChatHistory[]) => g.length === 0) && (
                                <div className="py-12 text-center">
                                    <p className="text-gray-400 text-sm">No tasks found matching "{searchTerm}"</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
