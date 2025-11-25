import React from 'react';
import { CalendarEvent, CalendarEventType } from '../types';
import { CalendarDaysIcon } from './common/Icons';

interface AgendaPreviewProps {
  events: CalendarEvent[];
}

const AgendaPreview = ({ events }: AgendaPreviewProps) => {
  const upcomingEvents = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    return events
      .filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate < sevenDaysFromNow && (event.type === CalendarEventType.Compromisso || event.type === CalendarEventType.Evento);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [events]);

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() === today.getTime()) {
      return 'Hoje';
    }
    if (eventDate.getTime() === tomorrow.getTime()) {
      return 'Amanhã';
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(eventDate);
  };

  const typeColors: Record<CalendarEventType, string> = {
    [CalendarEventType.Evento]: 'bg-blue-500',
    [CalendarEventType.Observacao]: 'bg-yellow-500',
    [CalendarEventType.Compromisso]: 'bg-green-500'
  };

  return (
    <div className="bg-base-800 p-4 mb-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <CalendarDaysIcon className="w-6 h-6 text-brand-primary-light mr-3" />
        <h2 className="text-xl font-bold text-white">Próximos Eventos na Agenda</h2>
      </div>
      {upcomingEvents.length > 0 ? (
        <ul className="space-y-3">
          {upcomingEvents.map(event => (
            <li key={event.id} className="flex items-center gap-4 p-2 bg-base-900/50 rounded-md">
              <div className="flex flex-col items-center justify-center bg-base-700 rounded-md p-2 w-16 text-center">
                  <span className="font-bold text-white text-sm">{formatDate(event.date)}</span>
                  <span className="text-xs text-gray-400">{new Date(event.date).toLocaleString('pt-BR', { weekday: 'short' })}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-200 text-sm truncate">{event.title}</p>
                <p className="text-xs text-gray-400 truncate">{event.description || 'Sem descrição'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${typeColors[event.type]}`}>
                  {event.type}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-4">Nenhum compromisso ou evento agendado para os próximos 7 dias.</p>
      )}
    </div>
  );
};

export default AgendaPreview;
