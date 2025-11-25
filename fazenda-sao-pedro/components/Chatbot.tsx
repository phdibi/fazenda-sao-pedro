import React, { useState, useEffect, useRef } from 'react';
import { Animal } from '../types';
import { startChat } from '../services/geminiService';
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
      <div className={`fixed bottom-24 right-4 sm:right-8 w-[calc(100%-2rem)] sm:w-96 h-[60vh] bg-base-800 shadow-2xl rounded-lg flex flex-col transition-all duration-300 ease-in-out z-50 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        <header className="flex items-center justify-between p-3 bg-base-900/50 border-b border-base-700 rounded-t-lg">
          <h3 className="font-bold text-white">Titi</h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div ref={chatBodyRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
            {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-white ${msg.role === 'user' ? 'bg-brand-primary' : 'bg-base-700'}`}>
                        <p className="text-sm">{msg.text}</p>
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg bg-base-700 flex items-center gap-2">
                        <Spinner />
                        <span className="text-sm text-gray-400">Pensando...</span>
                    </div>
                </div>
            )}
        </div>

        <form onSubmit={handleSendMessage} className="p-3 border-t border-base-700">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Pergunte algo..."
              className="flex-1 bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2"
              disabled={isLoading}
            />
            <button type="submit" className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded-md disabled:bg-base-700 disabled:cursor-not-allowed" disabled={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086L2.279 16.76a.75.75 0 0 0 .95.826l16-5.333a.75.75 0 0 0 0-1.418l-16-5.333Z" /></svg>
            </button>
          </div>
        </form>
      </div>

      {/* FAB (Floating Action Button) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-4 sm:right-8 bg-brand-primary hover:bg-brand-primary-light text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center transform transition-transform duration-300 hover:scale-110 z-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-dark focus:ring-offset-base-900"
        aria-label="Abrir assistente IA"
      >
        {isOpen ? <XMarkIcon className="w-8 h-8"/> : <ChatBubbleOvalLeftEllipsisIcon className="w-8 h-8" />}
      </button>
    </>
  );
};

export default Chatbot;
