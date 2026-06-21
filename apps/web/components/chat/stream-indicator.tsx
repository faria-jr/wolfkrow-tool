'use client';

export function StreamIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="AI is typing" role="status">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
