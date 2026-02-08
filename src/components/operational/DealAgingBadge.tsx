"use client";

interface DealAgingBadgeProps {
  days: number;
}

export const DealAgingBadge = ({ days }: DealAgingBadgeProps) => {
  let color: string;
  if (days <= 3) {
    color = 'bg-emerald-50 text-emerald-600 border-emerald-100';
  } else if (days <= 7) {
    color = 'bg-amber-50 text-amber-600 border-amber-100';
  } else if (days <= 14) {
    color = 'bg-orange-50 text-orange-600 border-orange-100';
  } else {
    color = 'bg-red-50 text-red-600 border-red-100';
  }

  return (
    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${color}`}>
      {days}d
    </span>
  );
};
