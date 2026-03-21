"use client";

import { useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";

export default function AdminLogin() {
  const [key, setKey] = useState("");
  const pathname = usePathname();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    window.location.href = `${pathname}?key=${encodeURIComponent(key)}`;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <label
          htmlFor="admin-key"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="admin-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter admin key"
          className="rounded-md border border-pool-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-pool-mid focus:outline-none focus:ring-1 focus:ring-pool-mid dark:border-pool-border dark:bg-pool-deep/50 dark:placeholder:text-pool-light/30"
          autoFocus
        />
        <button
          type="submit"
          className="rounded-md bg-pool-mid px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pool-deep focus:outline-none focus:ring-2 focus:ring-pool-mid focus:ring-offset-2"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
