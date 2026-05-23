import React from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export default function GlassPanel({ children, hoverable = false, className = '', ...props }: GlassPanelProps) {
  const baseClass = 'glass-panel';
  const hoverClass = hoverable ? ' glass-panel-hover' : '';
  
  return (
    <div className={`${baseClass}${hoverClass} ${className}`} {...props}>
      {children}
    </div>
  );
}
