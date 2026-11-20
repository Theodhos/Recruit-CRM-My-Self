import { cn } from '@crm/ui';
import type { ReactNode } from 'react';

type Props = { children: ReactNode; className?: string };

/**
 * The form column of the sign-in pages, drawn like the registration form of the home page: a serif title, a plain
 * line of help, big square fields and one wide button. These keep the names and shape of the Card parts the pages
 * were built with, so the pages' own logic and markup stay exactly as they were.
 */
export function Card({ children, className }: Props) {
  return <div className={className}>{children}</div>;
}

export function CardHeader({ children, className }: Props) {
  return <div className={cn('mb-8', className)}>{children}</div>;
}

export function CardTitle({ children, className }: Props) {
  return <h2 className={cn('font-serif text-[2rem] font-bold leading-tight tracking-tight text-[#141414] sm:text-[2.4rem]', className)}>{children}</h2>;
}

export function CardDescription({ children, className }: Props) {
  return <p className={cn('mt-2 text-[17px] leading-snug text-[#4a4538]', className)}>{children}</p>;
}

const FORM =
  '[&_label]:text-[12px] [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-[0.1em] [&_label]:text-[#6b6657] ' +
  '[&_input]:h-12 [&_input]:rounded-[3px] [&_input]:text-[16px] [&_input]:border-[#cfc8b8] ' +
  '[&_button[type=submit]]:h-14 [&_button[type=submit]]:w-full [&_button[type=submit]]:text-[17px]';

export function CardContent({ children, className }: Props) {
  return <div className={cn(FORM, className)}>{children}</div>;
}
