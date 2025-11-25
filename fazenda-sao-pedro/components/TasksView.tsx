import React, { useState } from 'react';
import { Task } from '../types';
import { TrashIcon } from './common/Icons';

interface TasksViewProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'isCompleted'>) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const TasksView = ({ tasks, onAddTask, onToggleTask, onDeleteTask }: TasksViewProps) => {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onAddTask({ description, dueDate: dueDate ? new Date(dueDate + 'T00:00:00') : undefined });
    setDescription('');
    setDueDate('');
  };

  const pendingTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  const TaskItem = ({ task }: { task: Task }) => (
    <div className={`flex items-center p-3 rounded-md transition-colors ${task.isCompleted ? 'bg-base-800/50' : 'bg-base-800'}`}>
        <input 
            type="checkbox" 
            checked={task.isCompleted} 
            onChange={() => onToggleTask(task.id)}
            className="h-5 w-5 rounded-full border-gray-500 text-brand-primary focus:ring-brand-primary-dark bg-base-900"
        />
        <div className="ml-3 flex-1">
            <p className={`text-sm ${task.isCompleted ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{task.description}</p>
            {task.dueDate && <p className="text-xs text-gray-400">Vencimento: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</p>}
        </div>
        <button onClick={() => onDeleteTask(task.id)} className="text-gray-500 hover:text-red-500 transition-colors">
            <TrashIcon className="w-5 h-5"/>
        </button>
    </div>
  );

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Tarefas da Propriedade</h1>
      
      {/* Add Task Form */}
      <div className="bg-base-800 p-4 rounded-lg shadow-lg mb-8">
        <h2 className="text-lg font-semibold mb-2">Adicionar Nova Tarefa</h2>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label htmlFor="description" className="text-xs text-gray-400">Descrição</label>
                <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="O que precisa ser feito?"
                    className="w-full bg-base-700 border-base-600 rounded-md p-2"
                    required
                />
            </div>
            <div className="w-full md:w-auto">
                <label htmlFor="dueDate" className="text-xs text-gray-400">Prazo</label>
                <input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-base-700 border-base-600 rounded-md p-2"
                />
            </div>
            <button type="submit" className="w-full md:w-auto bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors">
                Adicionar
            </button>
        </form>
      </div>

      {/* Task Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
            <h2 className="text-xl font-bold text-white mb-4">Pendentes</h2>
            <div className="space-y-3">
                {pendingTasks.length > 0 ? (
                    pendingTasks.map(task => <TaskItem key={task.id} task={task} />)
                ) : (
                    <p className="text-gray-500">Nenhuma tarefa pendente.</p>
                )}
            </div>
        </div>
        <div>
            <h2 className="text-xl font-bold text-white mb-4">Concluídas</h2>
            <div className="space-y-3">
                 {completedTasks.length > 0 ? (
                    completedTasks.map(task => <TaskItem key={task.id} task={task} />)
                ) : (
                    <p className="text-gray-500">Nenhuma tarefa concluída.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default TasksView;
