'use client';

import { useState } from 'react';

import { TasksBoard } from './tasks-board';
import { TasksCalendarView } from './tasks-calendar-view';

type View = 'kanban' | 'calendar';

export function TasksPageTabs() {
  const [view, setView] = useState<View>('kanban');

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-lg border p-1">
        <button
          onClick={() => setView('kanban')}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            view === 'kanban'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Kanban
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            view === 'calendar'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Calendar
        </button>
      </div>
      {view === 'kanban' ? <TasksBoard /> : <TasksCalendarView />}
    </div>
  );
}
