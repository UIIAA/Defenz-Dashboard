"use client";

import { Phone, Mail, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DealActivity } from '@/lib/types';

const iconMap = {
  call: { icon: Phone, color: 'text-blue-500 bg-blue-50' },
  email: { icon: Mail, color: 'text-purple-500 bg-purple-50' },
  meeting: { icon: Calendar, color: 'text-emerald-500 bg-emerald-50' },
};

interface ActivityTimelineProps {
  activities: DealActivity[];
}

export const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  if (activities.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic py-2 pl-4">Nenhuma atividade registrada</p>
    );
  }

  return (
    <div className="pl-4 border-l-2 border-slate-100 space-y-2 py-2">
      {activities.slice(0, 10).map((activity, idx) => {
        const { icon: Icon, color } = iconMap[activity.tipo] || iconMap.call;
        return (
          <motion.div
            key={`${activity.data}-${activity.tipo}-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-start gap-2 text-xs"
          >
            <div className={`p-1 rounded ${color} shrink-0 mt-0.5`}>
              <Icon size={10} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-mono">{activity.data}</span>
                <span className="text-slate-400 capitalize">{activity.tipo}</span>
              </div>
              <p className="text-slate-600 truncate">{activity.descricao}</p>
              {activity.vendedor !== '-' && (
                <p className="text-slate-400">{activity.vendedor}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
