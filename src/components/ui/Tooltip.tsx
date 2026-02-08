import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

export const Tooltip = ({ children, content, className = '' }: TooltipProps) => (
  <div className={`relative group/tooltip ${className}`}>
    {children}
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200">
      <div className="bg-slate-800 text-white text-xs rounded-lg shadow-xl px-3 py-2 max-w-72 w-max leading-relaxed">
        {content}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-slate-800 rotate-45" />
    </div>
  </div>
);
