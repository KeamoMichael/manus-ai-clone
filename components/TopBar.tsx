import React, { useState } from 'react';
import { ChevronDown, Menu, ChevronLeft, Check } from 'lucide-react';
import { Model, MODELS } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatSettingsMenu } from './ChatSettingsMenu';

interface TopBarProps {
  currentModel: Model;
  setCurrentModel: (m: Model) => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  chatId: string;
  chatTitle: string;
  onRenameChat: (newTitle: string) => void;
  onDeleteChat: () => void;
  onShareChat: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentModel,
  setCurrentModel,
  onToggleHistory,
  historyOpen,
  chatId,
  chatTitle,
  onRenameChat,
  onDeleteChat,
  onShareChat
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#F9F9F9]/90 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* History Toggle - Desktop: always hamburger, Mobile: back arrow when open */}
        <button
          onClick={onToggleHistory}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Toggle history"
        >
          {/* Mobile: show back arrow when sidebar is open, hamburger when closed */}
          <div className="md:hidden">
            {historyOpen ? (
              <ChevronLeft size={20} className="text-gray-600" />
            ) : (
              <Menu size={20} className="text-gray-600" />
            )}
          </div>
          {/* Desktop: always show hamburger */}
          <div className="hidden md:block">
            <Menu size={20} className="text-gray-600" />
          </div>
        </button>

        {/* Model Selector */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:opacity-70 transition-opacity"
          >
            {currentModel.name}
            <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-10"
                  onClick={() => setIsOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-20"
                >
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setCurrentModel(model);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left ${currentModel.id === model.id ? 'bg-gray-50' : ''
                        }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{model.name}</span>
                          {model.tag && (
                            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-medium">
                              {model.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{model.description}</p>
                      </div>
                      {currentModel.id === model.id && (
                        <Check size={16} className="text-gray-900 flex-shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat Settings Menu */}
      <ChatSettingsMenu
        chatId={chatId}
        chatTitle={chatTitle}
        onRename={onRenameChat}
        onDelete={onDeleteChat}
        onShare={onShareChat}
      />
    </div>
  );
};