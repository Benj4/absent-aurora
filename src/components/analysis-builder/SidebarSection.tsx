import type { FC, ReactNode } from 'react';

const SidebarSection: FC<{ title: string; defaultOpen?: boolean; children: ReactNode }> = ({
  title,
  defaultOpen = true,
  children,
}) => (
  <details open={defaultOpen} className="group border-b border-base-200 last:border-b-0">
    <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest text-base-content/50 hover:bg-base-200/60 transition-colors list-none">
      {title}
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </summary>
    <div className="px-4 pb-4 pt-2 space-y-3">{children}</div>
  </details>
);

export default SidebarSection;
