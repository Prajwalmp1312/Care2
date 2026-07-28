import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const HealthChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Welcome message when chatbot opens for the first time
      setMessages([
        {
          id: Date.now(),
          text: `Hello ${user?.name}! 👋 I'm your CareConnect health assistant. I can help you with:\n\n• Understanding your medical records\n• General health information\n• Navigation through the platform\n• Scheduling appointments\n\nHow can I assist you today?`,
          isBot: true,
          timestamp: new Date().toISOString()
        }
      ]);
    }
  }, [isOpen, user]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = {
      id: Date.now(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(
        '/api/patient/chatbot',
        { message: inputMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const botMsg = {
        id: Date.now() + 1,
        text: response.data.response,
        isBot: true,
        timestamp: response.data.timestamp,
        contextUsed: response.data.context_used,
        recordsCount: response.data.records_count
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMsg = {
        id: Date.now() + 1,
        text: "I'm sorry, I'm having trouble responding right now. Please try again or contact your healthcare provider directly through our messaging system.",
        isBot: true,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { icon: 'fa-notes-medical', text: 'My health status', query: 'What is my current health status?' },
    { icon: 'fa-file-medical', text: 'View records', query: 'Tell me about my medical records' },
    { icon: 'fa-calendar-check', text: 'Book appointment', query: 'How do I schedule an appointment?' },
    { icon: 'fa-pills', text: 'Medications', query: 'I have questions about my medications' }
  ];

  const handleQuickAction = (query) => {
    setInputMessage(query);
  };

  const formatBotMessage = (text) => {
    let formatted = text;

    // Convert markdown tables before adding line breaks.
    // This helps lab-value answers render as real tables instead of pipe text.
    formatted = formatted.replace(/((?:^\|.*\|\s*$\r?\n?)+)/gm, (tableBlock) => {
      const rows = tableBlock
        .trim()
        .split(/\r?\n/)
        .filter(row => row.trim().startsWith('|') && row.trim().endsWith('|'));

      if (rows.length < 2) return tableBlock;

      const separator = rows[1].replace(/\|/g, '').trim();
      if (![...separator].every((char) => "-: \t".includes(char))) return tableBlock;

      const headers = rows[0].split('|').slice(1, -1).map(cell => cell.trim());
      const bodyRows = rows.slice(2).map(row =>
        row.split('|').slice(1, -1).map(cell => cell.trim())
      );

      const thead = `<thead><tr>${headers
        .map(header => `<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold whitespace-nowrap">${header}</th>`)
        .join('')}</tr></thead>`;

      const tbody = `<tbody>${bodyRows
        .map(row => `<tr>${row
          .map(cell => `<td class="border border-gray-300 px-3 py-2 align-top">${cell}</td>`)
          .join('')}</tr>`)
        .join('')}</tbody>`;

      return `<div class="overflow-x-auto my-3 rounded-lg border border-gray-200"><table class="min-w-full border-collapse text-xs">${thead}${tbody}</table></div>`;
    });

    // Convert markdown-style bold to HTML
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert bullet points
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul class="list-disc ml-4 my-2">$1</ul>');

    // Convert numbered lists
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Add line breaks
    formatted = formatted.replace(/\n\n/g, '<br/><br/>');
    formatted = formatted.replace(/\n/g, '<br/>');

    return formatted;
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-2xl flex items-center justify-center hover:shadow-blue-500/50 transition-all z-50 group"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <i className="fas fa-robot text-white text-2xl group-hover:animate-bounce"></i>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chatbot Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-[560px] md:w-[720px] lg:w-[820px] h-[calc(100vh-2rem)] sm:h-[760px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <i className="fas fa-robot text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-bold">Health Assistant</h3>
                    <p className="text-xs opacity-90">Always here to help</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="p-3 bg-blue-50 border-b border-blue-100">
                <p className="text-xs text-gray-600 mb-2 font-medium">Quick actions:</p>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickAction(action.query)}
                      className="flex items-center gap-2 p-2 bg-white hover:bg-blue-100 rounded-lg transition text-left text-xs border border-gray-200"
                    >
                      <i className={`fas ${action.icon} text-blue-600`}></i>
                      <span className="text-gray-700">{action.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`flex items-start gap-2 ${msg.isBot ? 'max-w-[96%]' : 'max-w-[85%] flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.isBot 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}>
                      <i className={`fas ${msg.isBot ? 'fa-robot' : 'fa-user'} text-white text-sm`}></i>
                    </div>
                    <div>
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          msg.isBot
                            ? msg.isError
                              ? 'bg-red-50 text-red-800 border border-red-200'
                              : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        }`}
                      >
                        {msg.isBot ? (
                          <div 
                            className="text-sm leading-relaxed prose prose-sm max-w-none overflow-x-auto"
                            dangerouslySetInnerHTML={{ __html: formatBotMessage(msg.text) }}
                          />
                        ) : (
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 px-2">
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                        {msg.contextUsed && (
                          <span className="ml-2 text-blue-600">
                            <i className="fas fa-check-circle"></i> Based on {msg.recordsCount} record{msg.recordsCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                      <i className="fas fa-robot text-white text-sm"></i>
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-200">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask me anything about your health..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-paper-plane text-sm"></i>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                <i className="fas fa-shield-alt mr-1"></i>
                Your health information is private and secure
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HealthChatbot;