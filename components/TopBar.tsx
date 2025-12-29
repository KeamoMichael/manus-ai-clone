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
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#F9F9F9]/90 backdrop-blur-sm">
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
            className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:opacity-70 transition-opacity"
          >
            <span>{currentModel.displayName}</span>
            <ChevronDown size={14} className="text-gray-500" />
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
                  className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 origin-top-left"
                >
                  <div className="py-1">
                    {AVAILABLE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          onModelChange(model);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${currentModel.id === model.id ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        {model.displayName}
                        {currentModel.id === model.id && <Check size={14} className="text-gray-900" />}
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