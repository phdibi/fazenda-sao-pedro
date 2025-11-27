import React, { useState, useEffect, useRef } from 'react';
import { Animal } from '../types';
import { startChat } from '../services/geminiServiceOptimized';
import { ChatBubbleOvalLeftEllipsisIcon, XMarkIcon } from './common/Icons';
import Spinner from './common/Spinner';

interface ChatbotProps {
  animals: Animal[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

type ChatSession = {
    sendMessage: (message: string) => Promise<string>;
}

const Chatbot = ({ animals }: ChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSession = useRef<ChatSession | null>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        const initChat = async () => {
            const session = await startChat(animals);
            chatSession.current = session;
            setMessages([{ role: 'model', text: 'Olá! Sou o Titi, seu assistente de manejo. Como posso ajudar?' }]);
        };
        initChat();
    } else {
        // Reset chat when closed
        setMessages([]);
        setUserInput('');
        chatSession.current = null;
    }
  }, [isOpen, animals]);

  useEffect(() => {
    // Auto-scroll to the latest message
    if (chatBodyRef.current) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !chatSession.current) return;

    const userMessage: Message = { role: 'user', text: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
        const responseText = await chatSession.current.sendMessage(userInput);
        const modelMessage: Message = { role: 'model', text: responseText };
        setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
        console.error("Failed to send message:", error);
        const errorMessage: Message = { role: 'model', text: 'Ocorreu um erro ao me comunicar com a IA. Tente novamente.' };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Window */}
      <div className={`
        fixed z-40
        /* Mobile: ocupa mais espaço e fica acima da navbar */
        bottom-36 right-3 left-3 h-[50vh]
        /* Desktop: posição original */
        sm:bottom-24 sm:right-8 sm:left-auto sm:w-96 sm:h-[60vh]
        bg-base-800 shadow-2xl rounded-lg flex flex-col 
        transition-all duration-300 ease-in-out 
        ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
      `}>
        <header className="flex items-center justify-between p-3 bg-base-900/50 border-b border-base-700 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">🐂</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Titi - Assistente IA</h3>
              <p className="text-xs text-gray-400">Sempre pronto para ajudar</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div ref={chatBodyRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
            {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-white ${
                      msg.role === 'user' 
                        ? 'bg-brand-primary rounded-br-md' 
                        : 'bg-base-700 rounded-bl-md'
                    }`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-2xl rounded-bl-md bg-base-700 flex items-center gap-2">
                        <Spinner />
                        <span className="text-sm text-gray-400">Pensando...</span>
                    </div>
                </div>
            )}
        </div>

        <form onSubmit={handleSendMessage} className="p-3 border-t border-base-700 bg-base-800/50">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Pergunte algo..."
              className="flex-1 bg-base-700 border-base-600 rounded-full shadow-sm focus:ring-brand-primary focus:border-brand-primary text-sm px-4 py-2.5"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2.5 rounded-full disabled:bg-base-700 disabled:cursor-not-allowed transition-colors" 
              disabled={isLoading || !userInput.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086L2.279 16.76a.75.75 0 0 0 .95.826l16-5.333a.75.75 0 0 0 0-1.418l-16-5.333Z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* FAB (Floating Action Button) - Ajustado para ficar acima da navbar no mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed z-40
          /* Mobile: posição ajustada para não ficar coberto pela navbar */
          bottom-24 right-4
          /* Desktop: posição original */
          md:bottom-6 md:right-8
          bg-brand-primary hover:bg-brand-primary-light text-white 
          w-14 h-14 md:w-16 md:h-16 
          rounded-full shadow-lg 
          flex items-center justify-center 
          transform transition-all duration-300 hover:scale-110 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-dark focus:ring-offset-base-900
        `}
        aria-label={isOpen ? "Fechar assistente IA" : "Abrir assistente IA"}
      >
        {isOpen ? (
          <XMarkIcon className="w-7 h-7 md:w-8 md:h-8"/>
        ) : (
          <ChatBubbleOvalLeftEllipsisIcon className="w-7 h-7 md:w-8 md:h-8" />
        )}
      </button>
    </>
  );
};

export default Chatbot;