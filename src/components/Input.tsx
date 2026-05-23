import React from 'react';

export default function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className={`glass-input ${className}`} 
      {...props} 
    />
  );
}
