import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  startOfMonth,
} from 'date-fns';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-400',
};

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate?: string | null;
}

interface Props {
  tasks: Task[];
  year: number;
  month: number; // 1-based
}

export function TasksCalendar({ tasks, year, month }: Props) {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const firstDow = getDay(start);

  const tasksWithDate = tasks.filter((t) => !!t.dueDate);

  return (
    <div className="select-none">
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {DOW.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-background min-h-[80px] rounded-tl-lg" />
        ))}
        {days.map((day, i) => {
          const dayTasks = tasksWithDate.filter((t) => isSameDay(new Date(t.dueDate!), day));
          const isLast = i === days.length - 1;
          const roundedClass = i === 0 ? (firstDow === 0 ? 'rounded-tl-lg' : '') : isLast ? 'rounded-br-lg' : '';
          return (
            <div key={day.toISOString()} className={`bg-background min-h-[80px] p-1 ${roundedClass}`}>
              <p className="text-right text-xs text-muted-foreground">{format(day, 'd')}</p>
              <div className="mt-1 space-y-0.5">
                {dayTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 rounded px-1 py-0.5 text-xs bg-accent">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-gray-400'}`} />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
