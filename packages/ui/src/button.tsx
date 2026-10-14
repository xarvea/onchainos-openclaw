import * as React from 'react';

import { cn } from './cn';

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
  }
>(({ className, variant = 'default', size = 'md', ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn('micow-btn', `micow-btn--${variant}`, `micow-btn--${size}`, className)}
      {...props}
    />
  );
});
Button.displayName = 'Button';
