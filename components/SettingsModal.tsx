import React, { useState } from 'react';
import { X, User, Moon, Sun, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    setUsername: (name: string) => void;
    isDarkMode: boolean;
    setIsDarkMode: (isDark: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    username,
    setUsername,
    isDarkMode,
    setIsDarkMode
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile');

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Sidebar / Tabs (Center for mobile friendly) */}
                        <div className="flex items-center justify-center gap-2 px-6 py-2 border-b border-gray-100 overflow-x-auto no-scrollbar">
                            <TabButton
                                active={activeTab === 'profile'}
                                onClick={() => setActiveTab('profile')}
                                icon={<User size={16} />}
                                label="Profile"
                            />
                            <TabButton
                                active={activeTab === 'appearance'}
                                onClick={() => setActiveTab('appearance')}
                                icon={<Moon size={16} />}
                                label="Appearance"
                            />
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center">
                                        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg">
                                            {username.charAt(0)}
                                        </div>
                                        <button className="text-sm text-blue-600 font-medium hover:text-blue-700">Change Avatar</button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-500 uppercase">Display Name</label>
                                            <input
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                                            <input
                                                value="keamo@manus.ai"
                                                disabled
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'appearance' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Theme</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <ThemeOption
                                                label="Light"
                                                icon={<Sun size={24} />}
                                                active={!isDarkMode}
                                                onClick={() => setIsDarkMode(false)}
                                            />
                                            <ThemeOption
                                                label="Dark"
                                                icon={<Moon size={24} />}
                                                active={isDarkMode}
                                                onClick={() => setIsDarkMode(true)}
                                            />
                                            <ThemeOption
                                                label="System"
                                                icon={<Monitor size={24} />}
                                                active={false}
                                                onClick={() => { }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                            <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                                Done
                            </button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
    >
        {icon}
        {label}
    </button>
);

const ThemeOption = ({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${active ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
    >
        <div className="mb-2">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
    </button>
);
