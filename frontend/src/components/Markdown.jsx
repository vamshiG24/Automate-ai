import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Check, Copy } from "lucide-react";

// Models often write LaTeX as \[ ... \] or \( ... \); remark-math expects $$ / $.
// (Plain Markdown would otherwise turn "\[" into "[" and show raw \frac{..}.)
// KaTeX rejects a bare "#" (e.g. \text{# outcomes}), so escape it inside math
const escapeHash = (math) => math.replace(/(?<!\\)#/g, "\\#");

// GPT-OSS sometimes writes browsing-style citations like 【1†L1-L4】 or 【1】;
// show them as a plain " [1]" instead of the raw marker
const cleanCitations = (text) => text.replace(/\s?【(\d+)(?:†[^】]*)?】/g, " [$1]");

const normalizeMath = (text) =>
  cleanCitations(text)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => `\n$$\n${escapeHash(math.trim())}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => `$${escapeHash(math.trim())}$`)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => `$$${escapeHash(math)}$$`);

// Code block with a language label and a copy button
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing else to do
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-slate-400">
        <span>{language || "code"}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/10 hover:text-white" aria-label="Copy code">
          {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-6"><code>{code}</code></pre>
    </div>
  );
}

const components = {
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-[15px] font-semibold text-slate-900 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold text-slate-900 first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-slate-400">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-slate-400">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-500">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-indigo-200 pl-3 text-slate-600">{children}</blockquote>,
  hr: () => <hr className="my-3 border-slate-200" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 text-slate-700">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-slate-100 px-3 py-2 align-top">{children}</td>,
  // Fenced blocks arrive as <pre><code>; inline code stays inline
  pre: ({ children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    // Display math (already rendered by KaTeX) is not a code block
    if (child?.props?.node?.tagName !== "code") {
      return <div className="my-3 overflow-x-auto">{children}</div>;
    }
    const className = child?.props?.className || "";
    const code = String(child?.props?.children ?? "").replace(/\n$/, "");
    return <CodeBlock language={className.replace("language-", "")} code={code} />;
  },
  code: ({ children }) => (
    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">{children}</code>
  ),
};

/**
 * Renders AI replies as formatted Markdown (lists, tables, links, code).
 * Raw HTML in the text is NOT rendered, so model output can't inject markup.
 */
export default function Markdown({ children, className = "" }) {
  return (
    <div className={`break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {normalizeMath(String(children ?? ""))}
      </ReactMarkdown>
    </div>
  );
}
