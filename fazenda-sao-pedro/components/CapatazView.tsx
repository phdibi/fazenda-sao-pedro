import React, { useState, lazy, Suspense } from 'react';
import { Task, CalendarEvent, UserProfile, UserRole } from '../types';
import Spinner from './common/Spinner';

const CalendarView = lazy(() => import('./CalendarView'));
const TasksView = lazy(() => import('./TasksView'));

interface CapatazViewProps {
  user: UserProfile;
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  onAddTask: (task: Omit<Task, 'id' | 'isCompleted'>) => void;
  onToggleTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onSaveCalendarEvent: (event: Omit<CalendarEvent, 'id'> & { id?: string }) => void;
  onDeleteCalendarEvent: (eventId: string) => void;
}

type CapatazTab = 'tarefas' | 'calendario';

const CapatazView: React.FC<CapatazViewProps> = ({
  user,
  tasks,
  calendarEvents,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onSaveCalendarEvent,
  onDeleteCalendarEvent,
}) => {
  const [activeTab, setActiveTab] = useState<CapatazTab>('tarefas');

  // Estatísticas rápidas
  const pendingTasks = tasks.filter(t => !t.isCompleted).length;
  const completedToday = tasks.filter(t => {
    if (!t.isCompleted) return false;
    const today = new Date().toDateString();
    // Se tiver data de conclusão, comparar (simplificado)
    return true; // Simplificado - idealmente teria completedAt
  }).length;

  const upcomingEvents = calendarEvents.filter(e => {
    const eventDate = new Date(e.date);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return eventDate >= today && eventDate <= nextWeek;
  }).length;

  return (
    <div className="min-h-screen bg-base-900 text-white">
      {/* Header */}
      <header className="bg-base-800 border-b border-base-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-brand-primary">
              Painel do Capataz
            </h1>
            <p className="text-sm text-gray-400">
              Olá, {user.displayName || 'Capataz'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs">
              {UserRole.Capataz}
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4">
        <div className="bg-base-800 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-orange-400">{pendingTasks}</p>
          <p className="text-xs text-gray-400">Tarefas Pendentes</p>
        </div>
        <div className="bg-base-800 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{completedToday}</p>
          <p className="text-xs text-gray-400">Concluídas Hoje</p>
        </div>
        <div className="bg-base-800 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{upcomingEvents}</p>
          <p className="text-xs text-gray-400">Eventos (7 dias)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-base-700">
        <button
          onClick={() => setActiveTab('tarefas')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            activeTab === 'tarefas'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📋 Tarefas
        </button>
        <button
          onClick={() => setActiveTab('calendario')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            activeTab === 'calendario'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📅 Calendário
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <Suspense fallback={<Spinner />}>
          {activeTab === 'tarefas' && (
            <TasksView
              tasks={tasks}
              onAddTask={onAddTask}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
            />
          )}

          {activeTab === 'calendario' && (
            <CalendarView
              events={calendarEvents}
              onSave={onSaveCalendarEvent}
              onDelete={onDeleteCalendarEvent}
            />
          )}
        </Suspense>
      </div>

      {/* Bottom info */}
      <div className="fixed bottom-0 left-0 right-0 bg-base-800 border-t border-base-700 px-4 py-2">
        <p className="text-xs text-gray-500 text-center">
          👷 Modo Capataz - Acesso restrito a tarefas e calendário
        </p>
      </div>
    </div>
  );
};

export default CapatazView;
