import type { ReactNode } from 'react';

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  // Each route group defines its own document shell (HTML, body, scripts).
  return children;
}
