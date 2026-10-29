import React from "react";

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  // Simple, robust markdown parser tailored for research markdown docs with tables, blockquotes, headings, lists
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  const flushTable = () => {
    if (!inTable) return;
    elements.push(
      <div key={`table-${elements.length}`} className="overflow-x-auto my-4 border border-[#2e3548] rounded-md bg-[#131722]">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#2e3548] bg-[#1a2030] text-[#FFD700]">
              {tableHeaders.map((h, i) => (
                <th key={i} className="py-2 px-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={`border-b border-[#1f2638] hover:bg-[#1a2030]/60 ${
                  rIdx % 2 === 0 ? "bg-[#131722]" : "bg-[#161b28]"
                }`}
              >
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="py-2 px-3 text-[#d1d5db]">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  const flushBlockquote = () => {
    if (!inBlockquote) return;
    elements.push(
      <blockquote
        key={`quote-${elements.length}`}
        className="my-3 pl-4 border-l-4 border-[#FFD700] text-sm text-[#cbd5e1] italic bg-[#171b26]/70 py-2 pr-3 rounded-r"
      >
        {blockquoteLines.map((l, i) => (
          <p key={i} className="mb-1 last:mb-0">
            {renderInline(l)}
          </p>
        ))}
      </blockquote>
    );
    inBlockquote = false;
    blockquoteLines = [];
  };

  function renderInline(text: string): React.ReactNode {
    // Bold **text**
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={idx} className="italic text-[#93c5fd]">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-[#202738] text-[#00C9FF] text-xs font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Table detection: line contains |
    if (line.startsWith("|") && line.endsWith("|")) {
      flushBlockquote();
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Check if delimiter row like |---|---|
      const isDelimiter = cells.every((c) => /^:?-+:?$/.test(c));

      if (isDelimiter) {
        // Delimiter line, just marks that we have headers
        inTable = true;
      } else if (!inTable) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Blockquote detection
    if (line.startsWith(">")) {
      inBlockquote = true;
      blockquoteLines.push(line.replace(/^>\s?/, ""));
      continue;
    } else {
      flushBlockquote();
    }

    if (!line) {
      continue;
    }

    // Horizontal Rule
    if (line === "---" || line === "***") {
      elements.push(<hr key={i} className="my-5 border-[#283042]" />);
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl md:text-2xl font-bold text-[#FFD700] mt-4 mb-3 font-mono">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg md:text-xl font-bold text-white mt-5 mb-2 font-mono border-b border-[#222a3d] pb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm md:text-base font-semibold text-[#00C9FF] mt-4 mb-1.5 font-mono">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // List item: bullet
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-5 list-disc text-sm text-[#cbd5e1] mb-1 font-mono">
          {renderInline(line.slice(2))}
        </li>
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={i} className="ml-4 text-sm text-[#cbd5e1] mb-1.5 font-mono flex items-start gap-2">
          <span className="text-[#FFD700] font-semibold">{numMatch[1]}.</span>
          <div>{renderInline(numMatch[2])}</div>
        </div>
      );
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={i} className="text-sm text-[#cbd5e1] mb-3 leading-relaxed font-mono">
        {renderInline(line)}
      </p>
    );
  }

  flushTable();
  flushBlockquote();

  return <div className="space-y-1 font-mono text-xs md:text-sm">{elements}</div>;
};
