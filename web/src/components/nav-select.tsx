"use client";

export function NavSelect({
  id,
  label,
  value,
  options,
  urlMap,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  urlMap: Record<string, string>;
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select
        id={id}
        defaultValue={value}
        onChange={(e) => {
          const url = urlMap[e.target.value];
          if (url) window.location.href = url;
        }}
        className="rounded-md border border-pool-border bg-surface px-2 py-1 text-xs font-medium text-foreground dark:border-pool-border dark:bg-surface-alt dark:text-pool-light"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </>
  );
}
