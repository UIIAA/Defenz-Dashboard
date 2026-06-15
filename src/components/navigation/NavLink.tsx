"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  /** Translucent + non-clickable (feature ainda não liberada). */
  disabled?: boolean;
}

export const NavLink = ({ href, children, disabled }: NavLinkProps) => {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title="Em breve"
        className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-400 opacity-40 cursor-not-allowed select-none"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
        isActive
          ? 'text-red-700 bg-red-50 border border-red-100'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      {children}
    </Link>
  );
};
