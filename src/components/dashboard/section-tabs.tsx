"use client";

interface SectionTabsProps {
  sections: string[];
  selected: string;
  onSelect: (section: string) => void;
}

export function SectionTabs({ sections, selected, onSelect }: SectionTabsProps) {
  return (
    <div
      className="flex flex-wrap gap-1"
      style={{ borderBottom: "1px solid var(--color-border)", background: "transparent" }}
    >
      {sections.map((section) => (
        <button
          key={section}
          onClick={() => onSelect(section)}
          className="-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors hover:text-[var(--color-text)]"
          style={
            section === selected
              ? {
                  borderBottomColor: "var(--color-primary)",
                  color: "var(--color-primary)",
                  fontWeight: 600,
                }
              : {
                  borderBottomColor: "transparent",
                  color: "var(--color-text-muted)",
                  fontWeight: 400,
                }
          }
        >
          {section}
        </button>
      ))}
    </div>
  );
}
