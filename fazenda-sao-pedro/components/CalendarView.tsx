import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent, CalendarEventType } from '../types';
import Modal from './common/Modal';
import { TrashIcon } from './common/Icons';

interface CalendarViewProps {
  events: CalendarEvent[];
  onSave: (event: Omit<CalendarEvent, 'id'> & { id?: string }) => void;
  onDelete: (eventId: string) => void;
}

interface EventPillProps {
  event: CalendarEvent;
}

const EventPill = ({ event }: EventPillProps) => {
    const typeColors = {
        [CalendarEventType.Evento]: 'bg-blue-600/80',
        [CalendarEventType.Observacao]: 'bg-yellow-600/80',
        [CalendarEventType.Compromisso]: 'bg-green-600/80'
    };

    // This component will now need access to the function to open the modal
    // but for simplicity in this refactor, the parent div's onClick is sufficient.
    // In a more complex app, we'd pass the handler down.
    return (
        <div className={`p-1 text-[10px] text-white rounded mb-1 cursor-pointer truncate ${typeColors[event.type]}`}>
            {event.title}
        </div>
    );
};


const CalendarView = ({ events, onSave, onDelete }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { month, year, daysInMonth, firstDayOfMonth } = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    return { month, year, daysInMonth, firstDayOfMonth };
  }, [currentDate]);

  const changeMonth = (delta: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const openModalForNew = (day: number) => {
    setSelectedDate(new Date(year, month, day));
    setSelectedEvent(null);
    setIsModalOpen(true);
  };
  
  const openModalForEdit = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Agenda</h1>
      <div className="bg-base-800 p-4 rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => changeMonth(-1)} className="px-3 py-1 bg-base-700 rounded">&lt;</button>
          <h2 className="text-xl font-bold">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate)}</h2>
          <button onClick={() => changeMonth(1)} className="px-3 py-1 bg-base-700 rounded">&gt;</button>
        </div>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="p-2">{day}</div>)}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="border border-base-700/50 rounded-md"></div>)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = events.filter(e => new Date(e.date).getFullYear() === year && new Date(e.date).getMonth() === month && new Date(e.date).getDate() === day);
              return (
                <div key={day} className="border border-base-700/50 rounded-md min-h-[100px] p-1 overflow-hidden">
                  <div className="font-bold">{day}</div>
                  <div className="overflow-y-auto max-h-[70px]">
                    {dayEvents.map(event => 
                        <div key={event.id} onClick={() => openModalForEdit(event)}>
                            <EventPill event={event} />
                        </div>
                    )}
                  </div>
                   <button onClick={() => openModalForNew(day)} className="mt-1 text-xs text-brand-primary-light hover:underline opacity-50 hover:opacity-100 transition-opacity">+</button>
                </div>
              );
            })}
        </div>
      </div>
      <EventModal isOpen={isModalOpen} onClose={closeModal} event={selectedEvent} date={selectedDate} onSave={onSave} onDelete={onDelete} />
    </div>
  );
};

// --- Event Modal ---
interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: CalendarEvent | null;
    date: Date | null;
    onSave: (event: Omit<CalendarEvent, 'id'> & { id?: string }) => void;
    onDelete: (eventId: string) => void;
}

const EventModal = ({ isOpen, onClose, event, date, onSave, onDelete }: EventModalProps) => {
    const [formData, setFormData] = useState({ title: '', type: CalendarEventType.Evento, description: '' });
    const [formDate, setFormDate] = useState(new Date());

    const dateToInputValue = (d: Date) => {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) {
            return '';
        }
        return dateObj.toISOString().split('T')[0];
    };

    useEffect(() => {
        if (event) {
            setFormData({ title: event.title, type: event.type, description: event.description || '' });
            setFormDate(new Date(event.date));
        } else if (date) {
            setFormData({ title: '', type: CalendarEventType.Evento, description: '' });
            setFormDate(date);
        }
    }, [event, date, isOpen]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormDate(new Date(e.target.value + 'T00:00:00'));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isNaN(formDate.getTime())) {
            alert('Por favor, insira uma data válida.');
            return;
        }
        onSave({ id: event?.id, date: formDate, ...formData });
        onClose();
    };

    const handleDelete = () => {
        if (event && window.confirm('Tem certeza que deseja excluir este evento?')) {
            onDelete(event.id);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={event ? 'Editar Evento' : 'Adicionar Evento'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-300">Título</label>
                    <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2" required />
                </div>
                 <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-300">Data</label>
                    <input type="date" name="date" id="date" value={dateToInputValue(formDate)} onChange={handleDateChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2" required />
                </div>
                 <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-300">Tipo</label>
                    <select name="type" id="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2">
                         {Object.values(CalendarEventType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300">Descrição</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2"></textarea>
                </div>
                 <div className="pt-4 flex justify-between">
                    <div>
                        {event && (
                            <button type="button" onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700 font-bold py-2 px-4 rounded transition-colors flex items-center gap-2">
                                <TrashIcon className="w-4 h-4" /> Excluir
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors">
                            Salvar
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};


export default CalendarView;
