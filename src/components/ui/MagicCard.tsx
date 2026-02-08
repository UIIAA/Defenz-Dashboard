"use client";

import { motion } from "framer-motion";
// import { cn } from "@/lib/utils"; // Removed to fix lint error as we use local or direct clsx/tailwind-merge

// Since I don't see a src/lib/utils.ts in the file list earlier (only src/lib in QWEN which might be different),
// I will include the utility inside or assume standard shadcn structure. 
// Checking the file list from step 23, src exists but I didn't see lib explicitly listed in src children (it said 5 children).
// Let's safe-guard by including the utility function if I can, or I'll create the utils.ts first.

// Actually, let's just use twMerge and clsx directly here to be safe and fast.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface MagicCardProps {
    children: React.ReactNode;
    className?: string;
    gradientColor?: string;
}

export const MagicCard = ({ children, className, gradientColor = "from-blue-500/20" }: MagicCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className={cn(
                "relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md p-6",
                "shadow-lg shadow-slate-200/50",
                "group hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-500",
                className
            )}
        >
            <div
                className={cn(
                    "pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                    "bg-gradient-to-r via-slate-100/30 to-transparent",
                    gradientColor
                )}
            />
            <div className="relative z-10 h-full">{children}</div>
        </motion.div>
    );
};
