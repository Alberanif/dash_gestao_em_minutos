import React from 'react';

type Components = Record<string, React.ComponentType<{ children?: React.ReactNode; className?: string }>>;

interface ReactMarkdownProps {
  children: string;
  components?: Components;
  remarkPlugins?: unknown[];
}

function renderMarkdownNode(content: string, components: Components): React.ReactNode[] {
  const C = (tag: string, props: Record<string, unknown>, children: React.ReactNode, key: number) => {
    const Comp = components[tag];
    if (Comp) return <Comp key={key} {...(props as Record<string, unknown>)}>{children}</Comp>;
    return React.createElement(tag, { key, ...props }, children);
  };

  const parseLine = (line: string, key: number): React.ReactNode => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return line;
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith('**') && p.endsWith('**')
            ? C('strong', {}, p.slice(2, -2), i)
            : p
        )}
      </span>
    );
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  // table detection
  const isTableRow = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|');
  const isSeparator = (l: string) => /^\|[\s\-|:]+\|$/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];

    // heading
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const tag = `h${hMatch[1].length}`;
      elements.push(C(tag, {}, parseLine(hMatch[2], 0), i));
      i++;
      continue;
    }

    // table
    if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headers = line.split('|').filter(Boolean).map(h => h.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()));
        i++;
      }
      const Th = components['th'];
      const Td = components['td'];
      elements.push(
        C('table', {}, [
          C('thead', {}, C('tr', {}, headers.map((h, hi) =>
            Th ? <Th key={hi}>{h}</Th> : <th key={hi}>{h}</th>
          ), 0), 0),
          C('tbody', {}, rows.map((row, ri) =>
            C('tr', {}, row.map((cell, ci) =>
              Td ? <Td key={ci}>{cell}</Td> : <td key={ci}>{cell}</td>
            ), ri)
          ), 1),
        ], i)
      );
      continue;
    }

    // list
    if (line.startsWith('- ')) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(C('li', {}, parseLine(lines[i].slice(2), i), i));
        i++;
      }
      elements.push(C('ul', {}, items, elements.length));
      continue;
    }

    // paragraph
    if (line.trim()) {
      elements.push(C('p', {}, parseLine(line, i), i));
    }
    i++;
  }

  return elements;
}

export default function ReactMarkdown({ children, components = {}, remarkPlugins: _r }: ReactMarkdownProps) {
  return <div>{renderMarkdownNode(children, components)}</div>;
}
