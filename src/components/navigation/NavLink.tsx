"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export const NavLink = ({ href, children }: NavLinkProps) => {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

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
