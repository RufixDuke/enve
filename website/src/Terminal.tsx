interface TerminalProps {
  children: React.ReactNode;
  title?: string;
}

export function TerminalWindow({ children, title = 'terminal' }: TerminalProps) {
  return (
    <div className="terminal-window overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-xs text-white/40 font-mono">{title}</span>
      </div>
      <div className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-white/90">
        {children}
      </div>
    </div>
  );
}
