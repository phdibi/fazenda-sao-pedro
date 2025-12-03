import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Spinner = ({ size = 'md', className = '' }: SpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-b-2',
    md: 'h-5 w-5 border-b-2',
    lg: 'h-8 w-8 border-b-3'
  };

  return (
    <div 
      className={`animate-spin rounded-full border-white ${sizeClasses[size]} ${className}`}
    />
  );
};

export default Spinner;