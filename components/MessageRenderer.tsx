import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal } from 'lucide-react';

interface MessageRendererProps {
    content: string;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content }) => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
        <div className="space-y-5 text-[15px] leading-7 text-gray-800 font-normal font-sans">
            {parts.map((part, index) => {
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
                    const lang = match ? match[1] : '';
                    const code = match ? match[2] : part.slice(3, -3);
                    return <CodeBlock key={index} language={lang || ''} code={code.trim()} />;
                } else {
                    return <MarkdownText key={index} text={part} />;
                }
            })}
        </div>
    );
};

interface CodeBlockProps {
    language: string;
    code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Basic syntax highlighting for demo purposes
    const highlightedCode = code.split(/(\b(?:def|class|return|import|from|if|else|while|for|in|try|except|await|async|const|let|var|function|true|false|null|undefined)\b|"[^"]*"|'[^']*'|#[^\n]*)/g).map((part, i) => {
        if (['def', 'class', 'return', 'import', 'from', 'if', 'else', 'while', 'for', 'in', 'try', 'except', 'await', 'async', 'const', 'let', 'var', 'function'].includes(part)) {
            return <span key={i} className="text-purple-600 font-semibold">{part}</span>;
        }
        if (['true', 'false', 'null', 'undefined'].includes(part)) {
            return <span key={i} className="text-blue-600">{part}</span>;
        }
        if (part.startsWith('"') || part.startsWith("'")) {
            return <span key={i} className="text-green-600">{part}</span>;
        }
        if (part.startsWith('#')) {
            return <span key={i} className="text-gray-400 italic">{part}</span>;
        }
        return part;
    });

    return (
        <div className="my-5 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500 font-medium select-none">
                <div className="flex items-center gap-2">
                    {language === 'python' || language === 'py' ? <FileCode size={14} className="text-blue-500" /> : <Terminal size={14} />}
                    <span className="uppercase">{language || 'CODE'}</span>
                </div>
                <button onClick={handleCopy} className="hover:text-gray-900 transition-colors flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md">
                    {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="p-4 overflow-x-auto bg-[#FAFAFA]">
                <pre className="font-mono text-[13px] leading-relaxed text-gray-800 whitespace-pre tab-4">
                    {highlightedCode}
                </pre>
            </div>
        </div>
    );
};

interface MarkdownTextProps {
    text: string;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ text }) => {
    // Process paragraphs, handling multiple newlines
    const paragraphs = text.split(/\n\n+/).filter(Boolean);

    return (
        <>
            {paragraphs.map((para, i) => {
                // Header (e.g. ### Header)
                if (para.match(/^#{1,6}\s/)) {
                    const level = para.match(/^#{1,6}/)![0].length;
                    const content = para.replace(/^#{1,6}\s/, '');
                    const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
                    const className = `font-sans font-bold text-gray-900 mt-6 mb-3 ${sizes[level - 1] || 'text-base'} tracking-tight`;
                    return <div key={i} className={className}>{parseInline(content)}</div>;
                }

                // Unordered List
                if (para.match(/^[\*\-]\s/m)) {
                    const items = para.split(/\n/).filter(l => l.match(/^\s*[\*\-]\s/));
                    return (
                        <ul key={i} className="space-y-2 mb-4">
                            {items.map((item, j) => (
                                <li key={j} className="flex gap-3 text-gray-700">
                                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2.5" />
                                    <span>{parseInline(item.replace(/^\s*[\*\-]\s/, ''))}</span>
                                </li>
                            ))}
                        </ul>
                    );
                }

                // Ordered List (basic support)
                if (para.match(/^\d+\.\s/m)) {
                    const items = para.split(/\n/).filter(l => l.match(/^\s*\d+\.\s/));
                    return (
                        <ol key={i} className="list-decimal pl-5 space-y-2 mb-4 text-gray-700 marker:text-gray-400 marker:font-medium">
                            {items.map((item, j) => (
                                <li key={j} className="pl-1">{parseInline(item.replace(/^\s*\d+\.\s/, ''))}</li>
                            ))}
                        </ol>
                    );
                }

                // Blockquote / Callout
                if (para.startsWith('> ')) {
                    const content = para.replace(/^>\s+/, '');
                    // Check for specific callout types conceptually (simulated)
                    const isWarning = content.toLowerCase().includes('limit') || content.toLowerCase().includes('warning');

                    return (
                        <div key={i} className={`flex gap-3 pl-4 pr-4 py-3 my-5 rounded-lg border-l-4 ${isWarning ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-300'}`}>
                            <div className="italic text-gray-700 leading-relaxed">
                                {parseInline(content)}
                            </div>
                        </div>
                    );
                }

                return <p key={i} className="mb-4 text-gray-800">{parseInline(para)}</p>;
            })}
        </>
    );
};

const parseInline = (text: string) => {
    // Bold, Italic, Inline Code
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-[13px] font-mono text-gray-800">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="italic text-gray-800">{part.slice(1, -1)}</em>;
        }
        return part;
    });
};