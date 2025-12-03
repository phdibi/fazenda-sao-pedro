import React, { useState, useMemo } from 'react';
import { Animal, ManagementArea } from '../types';
import { MapPinIcon, PencilIcon, PlusIcon, TrashIcon, UsersIcon } from './common/Icons';
import AddEditAreaModal from './AddEditAreaModal';
import ManageAnimalsModal from './ManageAnimalsModal';
import EditAreasListModal from './EditAreasListModal';

interface ManagementViewProps {
  animals: Animal[];
  areas: ManagementArea[];
  onSaveArea: (area: Omit<ManagementArea, 'id'> & { id?: string }) => void;
  onDeleteArea: (areaId: string) => void;
  onAssignAnimals: (areaId: string, animalIdsToAssign: string[]) => void;
}

const ManagementView = ({ animals, areas, onSaveArea, onDeleteArea, onAssignAnimals }: ManagementViewProps) => {
    const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
    const [isManageAnimalsModalOpen, setIsManageAnimalsModalOpen] = useState(false);
    const [isEditListModalOpen, setIsEditListModalOpen] = useState(false);
    const [selectedArea, setSelectedArea] = useState<ManagementArea | null>(null);

    const handleOpenNewAreaModal = () => {
        setSelectedArea(null);
        setIsAreaModalOpen(true);
    };

    const handleOpenManageAnimalsModal = (area: ManagementArea) => {
        setSelectedArea(area);
        setIsManageAnimalsModalOpen(true);
    };

    return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-white">Manejo de Áreas</h1>
            <div className="flex gap-2">
                <button onClick={() => setIsEditListModalOpen(true)} className="flex items-center gap-2 bg-base-700 hover:bg-base-600 text-white font-bold py-2 px-4 rounded transition-colors">
                    <PencilIcon className="w-5 h-5" />
                    Editar Áreas
                </button>
                <button onClick={handleOpenNewAreaModal} className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors">
                    <PlusIcon className="w-5 h-5" />
                    Nova Área
                </button>
            </div>
        </div>

        {areas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {areas.map(area => {
                const animalsInArea = animals.filter(a => a.managementAreaId === area.id);
                const totalWeight = animalsInArea.reduce((sum, a) => sum + a.pesoKg, 0);
                const kgPerHa = area.areaHa > 0 ? totalWeight / area.areaHa : 0;
                
                return (
                    <div key={area.id} className="bg-base-800 rounded-lg shadow-lg p-5 flex flex-col justify-between">
                        <div>
                            <div className="mb-4">
                                <h2 className="text-xl font-bold text-white">{area.name}</h2>
                                <p className="text-sm text-gray-400">{area.areaHa.toLocaleString('pt-BR')} ha</p>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-400">Nº de Animais:</span>
                                    <span className="font-bold text-white text-lg">{animalsInArea.length}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-400">Peso Vivo Total:</span>
                                    <span className="font-bold text-white text-lg">{totalWeight.toLocaleString('pt-BR')} kg</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-400">Densidade:</span>
                                    <span className={`font-bold text-lg ${kgPerHa > 500 ? 'text-yellow-400' : 'text-white'}`}>
                                        {kgPerHa.toFixed(2)} kg/ha
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => handleOpenManageAnimalsModal(area)} className="mt-6 w-full flex items-center justify-center gap-2 bg-base-700 hover:bg-base-600 text-white font-bold py-2 px-4 rounded transition-colors">
                            <UsersIcon className="w-5 h-5"/>
                            Gerenciar Animais
                        </button>
                    </div>
                );
            })}
            </div>
        ) : (
             <div className="text-center py-16 text-gray-500 bg-base-800 rounded-lg">
                <MapPinIcon className="w-12 h-12 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Nenhuma área de manejo cadastrada</h2>
                <p className="mt-2">Clique em "Nova Área" para começar a organizar seus pastos e invernadas.</p>
            </div>
        )}

        {isAreaModalOpen && (
            <AddEditAreaModal
                isOpen={isAreaModalOpen}
                onClose={() => setIsAreaModalOpen(false)}
                onSave={onSaveArea}
                area={selectedArea}
            />
        )}

        {isManageAnimalsModalOpen && selectedArea && (
             <ManageAnimalsModal
                isOpen={isManageAnimalsModalOpen}
                onClose={() => setIsManageAnimalsModalOpen(false)}
                onSave={onAssignAnimals}
                area={selectedArea}
                allAnimals={animals}
            />
        )}

        <EditAreasListModal
            isOpen={isEditListModalOpen}
            onClose={() => setIsEditListModalOpen(false)}
            areas={areas}
            onSave={onSaveArea}
            onDelete={onDeleteArea}
        />
    </div>
    );
};

export default ManagementView;
