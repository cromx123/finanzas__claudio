export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[1280px] mx-auto px-4 sm:px-7 pt-7 sm:pt-8 pb-14">{children}</div>;
}

export function PageHeader({
  kicker,
  title,
  aside,
  help,
}: {
  kicker: string;
  title: string;
  aside?: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3.5 flex-wrap mb-5">
      <div>
        <div className="text-[10px] tracking-[0.12em] text-accent font-bold mb-1">{kicker}</div>
        <h1 className="text-[28px] sm:text-[34px] m-0 tracking-[-0.015em] font-sans font-extrabold">{title}</h1>
      </div>
      {aside || help ? (
        <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
          {aside ? <span className="text-muted text-xs">{aside}</span> : null}
          {help}
        </div>
      ) : null}
    </div>
  );
}

export function PageFooter({ moduleLabel, right }: { moduleLabel: string; right?: React.ReactNode }) {
  return (
    <>
      <hr className="h-0.5 border-0 bg-divider mt-[52px] mb-3.5" />
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="text-[10px] tracking-[0.12em] font-bold text-accent">{moduleLabel}</span>
        {right ? <span className="text-muted text-xs ml-auto">{right}</span> : null}
      </div>
    </>
  );
}
