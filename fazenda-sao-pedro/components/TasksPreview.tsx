import React from 'react';
import { Task } from '../types';
import { ClipboardDocumentCheckIcon } from './common/Icons';

interface TasksPreviewProps {
  tasks: Task[];
}

const TasksPreview = ({ tasks }: TasksPreviewProps) => {
  const upcomingTasks = React.useMemo(() => {
    return tasks
      .filter(task => !task.isCompleted)
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1; // a comes first
        if (b.dueDate) return 1; // b comes first
        return 0; // maintain original order
      })
      .slice(0, 3);
  }, [tasks]);

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) {
      return 'Hoje';
    }
    if (taskDate.getTime() === tomorrow.getTime()) {
      return 'Amanhã';
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(taskDate);
  };

  return (
    <div className="bg-base-800 p-4 mb-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <ClipboardDocumentCheckIcon className="w-6 h-6 text-brand-primary-light mr-3" />
        <h2 className="text-xl font-bold text-white">Próximas Tarefas Pendentes</h2>
      </div>
      {upcomingTasks.length > 0 ? (
        <ul className="space-y-3">
          {upcomingTasks.map(task => (
            <li key={task.id} className="flex items-center gap-4 p-2 bg-base-900/50 rounded-md">
              <div className="flex-1">
                <p className="font-semibold text-gray-200 text-sm">{task.description}</p>
              </div>
              {task.dueDate && (
                <div className="text-right">
                  <span className="text-xs font-bold text-white bg-base-700 rounded-md p-1.5">
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-4">Nenhuma tarefa pendente.</p>
      )}
    </div>
  );
};

export default TasksPreview;
