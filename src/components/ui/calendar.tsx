"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Contraste: a versão anterior usava `text-muted-foreground` + `opacity-50` empilhados.
// Dois níveis de clareamento sobre um cinza que já é claro deixavam dia desabilitado e dia
// de fora do mês praticamente invisíveis — o calendário parecia quebrado. Aqui os tons são
// explícitos, cada estado tem UM nível de cor, e nada usa opacity para escurecer texto.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-6",
        month: "flex flex-col gap-3",
        // A nav era `absolute` DENTRO de cada mês. Com 2 meses lado a lado ela escapava do
        // card e caía por cima do texto de ajuda do popover. Agora é uma faixa própria,
        // ancorada no topo do calendário inteiro.
        nav: "absolute top-3 right-3 z-10 flex items-center gap-1",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-300 disabled:hover:bg-white transition-colors",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-300 disabled:hover:bg-white transition-colors",
        month_caption: "flex h-7 items-center justify-start pl-1",
        caption_label: "text-sm font-semibold text-slate-900 capitalize",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md p-0 font-medium text-slate-700",
          "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/30",
          "disabled:pointer-events-none"
        ),
        // Extremos do intervalo em vermelho da marca; miolo num tom bem mais claro, para o
        // intervalo ser legível como faixa sem competir com as pontas.
        selected: "[&>button]:bg-red-600 [&>button]:text-white [&>button]:hover:bg-red-700",
        range_start: "rounded-l-md",
        range_end: "rounded-r-md",
        range_middle: "bg-red-50 [&>button]:bg-transparent [&>button]:text-red-900 [&>button]:hover:bg-red-100",
        today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-red-400 [&>button]:font-bold",
        outside: "[&>button]:text-slate-300",
        disabled: "[&>button]:text-slate-300 [&>button]:cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
