import { type ReactNode } from 'react';
import { StatusMessage } from './StatusMessage';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div id="app">
      <StatusMessage />
      {children}
    </div>
  );
}
