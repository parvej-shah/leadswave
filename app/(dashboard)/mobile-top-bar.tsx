"use client";

import { Icon } from "@/components/ui";

export function MobileTopBar() {
  function openCommand() {
    window.dispatchEvent(new CustomEvent("lw:open-command"));
  }

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-4 h-12 bg-sidebar border-b border-border pt-[env(safe-area-inset-top)] box-content">
      <img
        src="/logo.png"
        alt="LeadsWave"
        width={2508}
        height={627}
        className="h-auto w-[132px]"
      />
      <button
        type="button"
        onClick={openCommand}
        title="Search"
        className="ml-auto w-9 h-9 flex items-center justify-center bg-[oklch(0.12_0_0)] border border-border hover:border-[oklch(0.20_0_0)] text-fg-4 hover:text-fg-3 rounded-md transition-colors duration-150 cursor-pointer"
      >
        <Icon name="search" size={15} />
      </button>
    </header>
  );
}
