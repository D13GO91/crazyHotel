import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export default function Button({ 
  children, 
  variant = 'primary', 
  loading = false, 
  className = '', 
  disabled, 
  ...props 
}: ButtonProps) {
  const btnClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  
  return (
    <button 
      className={`${btnClass} ${className}`} 
      disabled={disabled || loading} 
      {...props}
    >
      {loading ? (
        <span className="flex-center" style={{ gap: '0.5rem' }}>
          <svg className="animate-spin" style={{ width: '1.25rem', height: '1.25rem', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%' }} viewBox="0 0 24 24" />
          Carregando...
        </span>
      ) : children}
    </button>
  );
}
