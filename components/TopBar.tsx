import React, { useState } from 'react';
import { Menu, ChevronDown, Check, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_MODELS, Model } from '../services/geminiService';
import { ChatSettingsMenu } from './ChatSettingsMenu';

interface TopBarProps {
  currentModel: Model;
  onModelChange: (model: Model) => void;
  onToggleHistory: () => void;
  // Chat Settings Props
  currentChatId: string;
  currentChatTitle: string;
  onOpenRenameModal: () => void;
  onDeleteChat: () => void;
  onShareChat: (id: string) => void;
  historyOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentModel,
  onModelChange,
  onToggleHistory,
  currentChatId,
  currentChatTitle,
  onOpenRenameModal,
  onDeleteChat,
  onShareChat,
  historyOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#F9F9F9]/90 dark:bg-gray-900/90 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* History Toggle - Mobile Only */}
        <button
          onClick={onToggleHistory}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
          title="History"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>

        {/* Model Selector */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors group"
          >
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{currentModel.displayName}</span>
            <ChevronDown size={14} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors" />
          </button>

          <AnimatePresence>
            {isOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 z-40 bg-transparent"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="fixed left-4 right-4 top-[60px] md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 w-auto md:w-[320px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 origin-top md:origin-top-left p-1.5"
                >
                  <div className="flex flex-col gap-0.5">
                    {AVAILABLE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          onModelChange(model);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors relative ${currentModel.id === model.id ? 'bg-gray-50 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{model.displayName}</span>
                            {model.badge && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wide">
                                {model.badge}
                              </span>
                            )}
                          </div>
                          {model.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed pr-6">{model.description}</p>
                          )}
                        </div>

                        {currentModel.id === model.id && (
                          <div className="shrink-0 mt-0.5">
                            <Check size={16} className="text-gray-900 dark:text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Side: Chat settings */}
      <ChatSettingsMenu
        chatId={currentChatId}
        chatTitle={currentChatTitle}
        onOpenRename={onOpenRenameModal}
        onDelete={onDeleteChat}
        onShare={() => onShareChat(currentChatId)}
      />
    </div>
  );
};