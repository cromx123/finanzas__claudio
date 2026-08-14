export function StaleBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-accent-100 text-accent-800 px-4 sm:px-7 py-1.5 text-[11.5px] tracking-wide">
      {children}
    </div>
  );
}
