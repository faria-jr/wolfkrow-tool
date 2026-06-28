'use client';

import { addMonths, format, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { TasksCalendar } from './tasks-calendar';

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate?: string | null;
  tags: string[];
  category: string;
}

export function TasksCalendarView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [current, setCurrent] = useState(() => new Date());

  const load = useCallback(async () => {
    const res = await fetch('/api/tasks', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { tasks?: Task[] } | Task[];
      setTasks(Array.isArray(data) ? data : (data.tasks ?? []));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const year = current.getFullYear();
  const month = current.getMonth() + 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{format(current, 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrent((d) => subMonths(d, 1))}
            className="hover:bg-accent rounded p-1"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="hover:bg-accent rounded px-2 py-1 text-xs"
          >
            Today
          </button>
          <button
            onClick={() => setCurrent((d) => addMonths(d, 1))}
            className="hover:bg-accent rounded p-1"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <TasksCalendar tasks={tasks} year={year} month={month} />
    </div>
  );
}
