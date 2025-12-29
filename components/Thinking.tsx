import React from 'react';
import { motion } from 'framer-motion';
import manusLogo from '../assets/Nexa AI agent logo PNG.png';

interface ThinkingProps {
  modelTag: string;
}

export const Thinking: React.FC<ThinkingProps> = ({ modelTag }) => {
  return (
    <div className="flex justify-start animate-in fade-in duration-300">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center gap-1 mb-2">
          <img src={manusLogo} alt="Manus" className="h-6 w-auto object-contain" />
          <span className="text-[11px] bg-gray-200 px-2 py-0.5 rounded-md text-gray-500 font-medium">
            {modelTag}
          </span>
        </div>

        {/* Animated Dots */}
        <div className="flex gap-1.5 h-6 items-center ml-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-gray-800 rounded-full"
              animate={{
                y: [0, -5, 0]
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
