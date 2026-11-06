import type { FC, ReactNode } from 'react';

const SidebarSection: FC<{ title: string; step?: number; summary?: string; defaultOpen?: boolean; children: ReactNode; className?: string }> = ({
  title, step, summary, defaultOpen = true, children, className,
}) => (
  <details open={defaultOpen} className={`collapse collapse-arrow rounded-none border-t border-base-300 bg-base-100 ${className ?? ''}`}>
    <summary className="collapse-title flex items-center gap-3 px-6 py-4 pr-12">
      {step && <span className="badge badge-soft badge-accent h-6 w-6 shrink-0 rounded-full font-bold">{step}</span>}
      <span className="min-w-0">
        <span className="block text-[15px] font-bold">{title}</span>
        {summary && <span className="mt-0.5 block text-[13px] text-neutral">{summary}</span>}
      </span>
    </summary>
    <div className="collapse-content space-y-3 px-6">{children}</div>
  </details>
);

export default SidebarSection;
