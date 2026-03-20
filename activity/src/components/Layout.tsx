import { type ReactNode } from 'react';
import { StatusMessage } from './StatusMessage';

interface LayoutProps {
  children: ReactNode;
  onNavigateHome: () => void;
}

export function Layout({ children, onNavigateHome: _onNavigateHome }: LayoutProps) {
  return (
    <div id="app">
      <StatusMessage />
      {children}
    </div>
  );
}
