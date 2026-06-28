import { eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth } from 'date-fns';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-destructive',
  high: 'bg-warning',
  medium: 'bg-info',
  low: 'bg-muted-foreground',
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
      <div className="text-muted-foreground mb-2 grid grid-cols-7 text-center text-xs font-medium">
        {DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="bg-border grid grid-cols-7 gap-px rounded-lg border">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-background min-h-20 rounded-tl-lg" />
        ))}
        {days.map((day, i) => {
          const dayTasks = tasksWithDate.filter((t) => isSameDay(new Date(t.dueDate!), day));
          const isLast = i === days.length - 1;
          const roundedClass =
            i === 0 ? (firstDow === 0 ? 'rounded-tl-lg' : '') : isLast ? 'rounded-br-lg' : '';
          return (
            <div key={day.toISOString()} className={`bg-background min-h-20 p-1 ${roundedClass}`}>
              <p className="text-muted-foreground text-right text-xs">{format(day, 'd')}</p>
              <div className="mt-1 space-y-0.5">
                {dayTasks.map((t) => (
                  <div
                    key={t.id}
                    className="bg-accent flex items-center gap-1 rounded px-1 py-0.5 text-xs"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-muted-foreground'}`}
                    />
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
