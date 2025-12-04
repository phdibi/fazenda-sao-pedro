import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';

interface RoleSelectorProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_PASSWORD = '287672';

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
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [error, setError] = useState('');

  // Reset quando fecha
  useEffect(() => {
    if (!isOpen) {
      setShowPasswordInput(false);
      setPassword('');
      setSelectedRole(null);
      setError('');
    }
  }, [isOpen]);

  const handleRoleClick = (role: UserRole) => {
    if (role === currentRole) return; // Já é o perfil atual
    setSelectedRole(role);
    setShowPasswordInput(true);
    setPassword('');
    setError('');
  };

  const handlePasswordSubmit = () => {
    if (password === ROLE_PASSWORD) {
      if (selectedRole) {
        onChangeRole(selectedRole);
        onClose();
      }
    } else {
      setError('Senha incorreta');
      setPassword('');
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePasswordSubmit();
    }
  };

  const handleBack = () => {
    setShowPasswordInput(false);
    setPassword('');
    setSelectedRole(null);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-96 bg-base-800 rounded-lg shadow-xl z-50 overflow-hidden">
        {!showPasswordInput ? (
          <>
            {/* Seleção de perfil */}
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
                    onClick={() => handleRoleClick(role)}
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
                      {!isSelected && (
                        <span className="text-gray-500">🔒</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 bg-base-900 border-t border-base-700">
              <p className="text-xs text-gray-500 text-center">
                🔒 Alteração de perfil requer senha
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Tela de senha */}
            <div className="p-4 border-b border-base-700">
              <button 
                onClick={handleBack}
                className="text-gray-400 hover:text-white mb-2 flex items-center gap-1"
              >
                ← Voltar
              </button>
              <h2 className="text-lg font-bold text-white">Digite a Senha</h2>
              <p className="text-sm text-gray-400 mt-1">
                Para alterar para: {selectedRole && roleInfo[selectedRole].title}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Ícone do perfil selecionado */}
              <div className="text-center">
                <span className="text-5xl">
                  {selectedRole && roleInfo[selectedRole].icon}
                </span>
              </div>

              {/* Input de senha */}
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPassword(val);
                    setError('');
                  }}
                  onKeyDown={handlePasswordKeyDown}
                  placeholder="••••••"
                  className="w-full px-4 py-4 bg-base-700 border border-base-600 rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder:tracking-normal"
                  autoFocus
                />
                {error && (
                  <p className="text-red-400 text-sm text-center mt-2">{error}</p>
                )}
              </div>

              {/* Indicador de dígitos */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      password.length > i ? 'bg-brand-primary' : 'bg-base-600'
                    }`}
                  />
                ))}
              </div>

              {/* Botão confirmar */}
              <button
                onClick={handlePasswordSubmit}
                disabled={password.length !== 6}
                className="w-full py-3 bg-brand-primary text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default RoleSelector;
