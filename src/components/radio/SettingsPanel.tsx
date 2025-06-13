
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'voice';
}

interface SettingsPanelProps {
  onClose: () => void;
  messages: Message[];
  onSendMessage: (message: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onClose,
  messages,
  onSendMessage
}) => {
  const [currentMessage, setCurrentMessage] = useState('');

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      onSendMessage(currentMessage);
      setCurrentMessage('');
    }
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-0 left-full w-full bg-gradient-to-b from-gray-800 to-black rounded-r-xl border-4 border-l-0 border-gray-700 h-full flex flex-col"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b-2 border-gray-600 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-green-400" />
          <span className="text-white font-mono text-sm">MESSAGES</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-green-400 text-xs font-mono">
                  {msg.sender}
                </span>
                <span className="text-gray-500 text-xs">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-white text-sm">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t-2 border-gray-600">
        <div className="flex space-x-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type message..."
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
