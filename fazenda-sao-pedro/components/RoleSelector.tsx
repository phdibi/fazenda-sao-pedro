import React from 'react';
import { UserRole } from '../types';

interface RoleSelectorProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  isOpen: boolean;
  onClose: () => void;
}

const roleInfo: Record<UserRole, { icon: string; title: string; description: string }> = {
  [UserRole.Proprietario]: {
    icon: '👑',
    title: 'Proprietário',
    description: 'Acesso completo a todas as funcionalidades',
  },
  [UserRole.Capataz]: {
    icon: '👷',
    title: 'Capataz',
    description: 'Acesso apenas a Tarefas e Calendário',
  },
  [UserRole.Veterinario]: {
    icon: '🩺',
    title: 'Veterinário',
    description: 'Acesso a animais, relatórios sanitários e calendário',
  },
  [UserRole.Funcionario]: {
    icon: '🧑‍🌾',
    title: 'Funcionário',
    description: 'Acesso de visualização (somente leitura)',
  },
};

const RoleSelector: React.FC<RoleSelectorProps> = ({
  currentRole,
  onChangeRole,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-96 bg-base-800 rounded-lg shadow-xl z-50 overflow-hidden">
        <div className="p-4 border-b border-base-700">
          <h2 className="text-lg font-bold text-white">Selecionar Perfil de Acesso</h2>
          <p className="text-sm text-gray-400 mt-1">
            Escolha o nível de acesso para este dispositivo
          </p>
        </div>

        <div className="p-4 space-y-2">
          {Object.values(UserRole).map(role => {
            const info = roleInfo[role];
            const isSelected = currentRole === role;
            
            return (
              <button
                key={role}
                onClick={() => {
                  onChangeRole(role);
                  onClose();
                }}
                className={`w-full p-4 rounded-lg text-left transition-all ${
                  isSelected 
                    ? 'bg-brand-primary/20 border-2 border-brand-primary' 
                    : 'bg-base-700 border-2 border-transparent hover:border-base-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{info.title}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 bg-brand-primary text-white text-xs rounded-full">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{info.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 bg-base-900 border-t border-base-700">
          <p className="text-xs text-gray-500 text-center">
            💡 O perfil é salvo localmente neste dispositivo
          </p>
        </div>
      </div>
    </>
  );
};

export default RoleSelector;
