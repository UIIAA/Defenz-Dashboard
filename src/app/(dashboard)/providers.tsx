"use client";

import { DateRangeProvider } from '@/providers/DateRangeProvider';

export const ClientProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <DateRangeProvider>
      {children}
    </DateRangeProvider>
  );
};
