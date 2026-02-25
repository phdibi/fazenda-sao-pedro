import React, { useEffect } from 'react';
import { XMarkIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  // Trava o scroll do body quando o modal esta aberto
  useEffect(() => {
    if (isOpen) {
      // Salva a posicao do scroll atual
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restaura o scroll ao fechar
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Este manipulador previne que cliques dentro do modal se propaguem para
  // o backdrop, o que fecharia o modal incorretamente.
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Previne o scroll do backdrop de propagar para o body
  const handleTouchMove = (e: React.TouchEvent) => {
    // Permite scroll apenas dentro do conteudo do modal
    const target = e.target as HTMLElement;
    const scrollableParent = target.closest('.modal-scroll-content');
    if (!scrollableParent) {
      e.preventDefault();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-base-900 bg-opacity-75 flex justify-center items-end sm:items-center z-[60] p-0 sm:p-4"
      onClick={() => onClose()}
      onTouchMove={handleTouchMove}
    >
      <div
        className="bg-base-800 rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-4xl modal-max-h flex flex-col pb-safe-modal"
        onClick={handleContentClick}
      >
        <div className="flex justify-between items-center p-4 border-b border-base-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="modal-scroll-content p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
