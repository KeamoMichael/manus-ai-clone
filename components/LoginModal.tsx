import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onLogin: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-white/60 backdrop-blur-md"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden p-8 text-center"
      >
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Lock size={20} className="text-gray-900" />
        </div>

        <h2 className="text-2xl font-sans font-semibold text-gray-900 mb-2">
          Unlock Manus
        </h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          You've reached the limit for guest access. Log in to continue your task and access the full planner capabilities.
        </p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 group"
          >
            Continue with Google
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={onLogin}
            className="w-full bg-white text-gray-900 border border-gray-200 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Log in with Email
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Sparkles size={12} />
          <span>Powered by Gemini 1.5 Pro</span>
        </div>
      </motion.div>
    </div>
  );
};