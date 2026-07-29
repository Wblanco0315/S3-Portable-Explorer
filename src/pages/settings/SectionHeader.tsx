import React from "react";

/** Shared header for each settings section (icon + title). */
export default function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      {title}
    </h3>
  );
}
