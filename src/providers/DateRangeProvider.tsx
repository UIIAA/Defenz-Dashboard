"use client";

import React, { createContext, useState, useContext } from 'react';

interface DateRangeContextValue {
  dateRange: string;
  setDateRange: (range: string) => void;
}

const DateRangeContext = createContext<DateRangeContextValue>({
  dateRange: 'today',
  setDateRange: () => {},
});

export const DateRangeProvider = ({ children }: { children: React.ReactNode }) => {
  const [dateRange, setDateRange] = useState('today');
  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
};

export const useDateRange = () => useContext(DateRangeContext);
