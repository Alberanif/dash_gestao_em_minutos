"use client";

interface SectionTabsProps {
  sections: string[];
  selected: string;
  onSelect: (section: string) => void;
}

export function SectionTabs({ sections, selected, onSelect }: SectionTabsProps) {
  return (
    <div className="flex border-b bg-white px-6">
      {sections.map((section) => (
        <button
          key={section}
          onClick={() => onSelect(section)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            section === selected
              ? "border-blue-600 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {section}
        </button>
      ))}
    </div>
  );
}
