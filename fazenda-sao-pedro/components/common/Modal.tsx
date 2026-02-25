import React from 'react';
import { XMarkIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;

  // Este manipulador previne que cliques dentro do modal se propaguem para
  // o backdrop, o que fecharia o modal incorretamente.
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 bg-base-900 bg-opacity-75 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4"
      onClick={() => onClose()}
    >
      <div
        className="bg-base-800 rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-4xl modal-max-h flex flex-col"
        onClick={handleContentClick}
      >
        <div className="flex justify-between items-center p-4 border-b border-base-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;