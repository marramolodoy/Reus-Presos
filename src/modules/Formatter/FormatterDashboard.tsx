import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { Type, Download, AlignJustify, Quote, RefreshCw, Copy, Check, Heading, FileText, Eraser } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';

interface FormatterDashboardProps {
    session: any;
}

interface Block {
    id: string;
    text: string;
    type: 'normal' | 'quote' | 'title';
}

function toRoman(num: number): string {
    const lookup: { [key: string]: number } = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let roman = '';
    let i: string;
    for (i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
}

function htmlToDocxChildren(html: string, size: number): TextRun[] {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const runs: TextRun[] = [];

    const walk = (node: Node, bold: boolean, italic: boolean, underline: boolean) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) {
                runs.push(new TextRun({
                    text: node.textContent, // docx package preserves spaces natively well
                    bold: bold,
                    italics: italic,
                    underline: underline ? { type: "single", color: "auto" } : undefined,
                    font: "Century Gothic",
                    size: size,
                }));
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            const isBold = bold || tag === 'strong' || tag === 'b' || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700;
            const isItalic = italic || tag === 'em' || tag === 'i' || el.style.fontStyle === 'italic';
            const isUnderline = underline || tag === 'u' || el.style.textDecoration.includes('underline');

            el.childNodes.forEach(c => walk(c, isBold, isItalic, isUnderline));
        }
    };

    walk(temp, false, false, false);
    return runs;
}

const stripHtml = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || '';
};

export const FormatterDashboard: React.FC<FormatterDashboardProps> = ({ session }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [copied, setCopied] = useState(false);
    const [autoClean, setAutoClean] = useState(true);

    const handleClear = () => {
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setBlocks([]);
        setCopied(false);
    };

    const handleProcessText = () => {
        if (!editorRef.current) return;

        const processNode = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent || '';

                // Prevent hidden \n from Word/PDF breaking our line splits
                text = text.replace(/[\r\n]+/g, ' ');

                if (autoClean) {
                    text = text.replace(/\s*\[\s*\d{7}-\d{2}[^\]]*\|\s*[a-zA-Z]+\s*\]/g, '');
                }

                return text;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tag = el.tagName.toLowerCase();

                let inner = '';
                el.childNodes.forEach(c => inner += processNode(c));

                // Inline styles from Word (like <b>, <i> or inline CSS)
                let isBold = ['b', 'strong'].includes(tag) || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700;
                let isItalic = ['i', 'em'].includes(tag) || el.style.fontStyle === 'italic';
                let isUnderline = ['u'].includes(tag) || el.style.textDecoration.includes('underline');

                let result = inner;
                if (isBold && result.trim()) result = `<strong>${result}</strong>`;
                if (isItalic && result.trim()) result = `<em>${result}</em>`;
                if (isUnderline && result.trim()) result = `<u>${result}</u>`;

                const blockTags = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'];
                if (blockTags.includes(tag)) {
                    return result + '\n';
                }
                if (tag === 'br') {
                    return result + '\n';
                }
                return result;
            }
            return '';
        };

        const rawHtml = processNode(editorRef.current).replace(/\n\n+/g, '\n').trim();
        const lines = rawHtml.split('\n').filter(line => line.trim() !== '');

        const newBlocks: Block[] = lines.map((line, index) => ({
            id: `block-${index}-${Date.now()}`,
            text: line.trim(),
            type: 'normal'
        }));

        setBlocks(newBlocks);
        setCopied(false);
    };

    const toggleBlockType = (id: string) => {
        setBlocks(blocks.map(b => {
            if (b.id === id) {
                let nextType: 'normal' | 'quote' | 'title' = 'normal';
                if (b.type === 'normal') nextType = 'title';
                else if (b.type === 'title') nextType = 'quote';
                else if (b.type === 'quote') nextType = 'normal';
                return { ...b, type: nextType };
            }
            return b;
        }));
        setCopied(false);
    };

    const updateBlockText = (id: string, newText: string) => {
        setBlocks(blocks.map(b => (b.id === id ? { ...b, text: newText } : b)));
        setCopied(false);
    };

    const handleCopyToClipboard = async () => {
        if (blocks.length === 0) {
            alert("Não há texto para copiar.");
            return;
        }

        try {
            // Create a temporary container to hold the HTML formulation
            const container = document.createElement('div');
            container.style.fontFamily = '"Century Gothic", CenturyGothic, AppleGothic, sans-serif';
            container.style.fontSize = '13pt';
            container.style.lineHeight = '1.5';
            container.style.textAlign = 'justify';

            let titleCounter = 1;

            blocks.forEach(block => {
                const el = document.createElement('p');
                el.style.margin = '0 0 12pt 0'; // 12pt margin bottom
                el.style.padding = '0';
                el.style.textAlign = 'justify';
                el.style.lineHeight = '1.5';

                if (block.type === 'quote') {
                    el.style.marginLeft = '4cm';
                    el.style.textIndent = '0';
                    el.innerHTML = `<span style="font-size: 11pt; line-height: 1.5;">${block.text}</span>`;
                } else if (block.type === 'title') {
                    const prefix = `${toRoman(titleCounter++)} - `;
                    el.style.marginLeft = '0';
                    el.style.textIndent = '2cm';
                    el.innerHTML = `<span style="font-size: 13pt; line-height: 1.5;"><strong>${prefix}${stripHtml(block.text).toUpperCase()}</strong></span>`;
                } else {
                    el.style.marginLeft = '0';
                    el.style.textIndent = '2cm';
                    el.innerHTML = `<span style="font-size: 13pt; line-height: 1.5;">${block.text}</span>`;
                }

                container.appendChild(el);
            });

            document.body.appendChild(container);

            // Select the text
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(container);
            selection?.removeAllRanges();
            selection?.addRange(range);

            // Execute copy
            document.execCommand('copy');

            // Cleanup
            selection?.removeAllRanges();
            document.body.removeChild(container);

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy html: ', err);
            // Fallback to plain text
            const plainText = blocks.map(b => (b.type === 'quote' ? '    ' : '  ') + b.text).join('\n\n');
            navigator.clipboard.writeText(plainText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleExportDOCX = async () => {
        if (blocks.length === 0) {
            alert("Não há texto para exportar.");
            return;
        }

        let titleCounter = 1;

        const docParagraphs = blocks.map(block => {
            const isQuote = block.type === 'quote';
            const isTitle = block.type === 'title';

            let textContent = block.text;
            let childrenRuns: TextRun[] = [];

            if (isTitle) {
                const prefix = `${toRoman(titleCounter++)} - `;
                textContent = `${prefix}${stripHtml(block.text).toUpperCase()}`;
                childrenRuns = [new TextRun({
                    text: textContent,
                    font: "Century Gothic",
                    size: 26,
                    bold: true,
                })];
            } else {
                childrenRuns = htmlToDocxChildren(block.text, isQuote ? 22 : 26);
            }

            return new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                indent: isQuote
                    ? { left: convertInchesToTwip(1.57) } // 4cm
                    : { firstLine: convertInchesToTwip(0.79) }, // 2cm
                spacing: {
                    line: 360, // 240 is single space, 360 is 1.5 space
                    lineRule: "auto",
                    before: 0,
                    after: 240, // 12pt space after paragraph (twips = pt * 20)
                },
                children: childrenRuns
            });
        });

        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: convertInchesToTwip(0.39), // 1cm
                                right: convertInchesToTwip(0.39),
                                bottom: convertInchesToTwip(0.39),
                                left: convertInchesToTwip(0.39),
                            },
                        },
                    },
                    children: docParagraphs,
                },
            ],
        });

        Packer.toBlob(doc).then(blob => {
            saveAs(blob, "Minuta_Formatada.docx");
        });
    };

    const handleExportPDF = () => {
        if (blocks.length === 0) {
            alert("Não há texto para exportar.");
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Minuta_Formatada</title>
                <style>
                    @page { size: A4; margin: 1cm; }
                    body { 
                        font-family: "Century Gothic", CenturyGothic, AppleGothic, sans-serif;
                        font-size: 13pt;
                        line-height: 1.5;
                        text-align: justify;
                        color: black;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .quote {
                        margin-left: 4cm;
                        font-size: 11pt;
                    }
                    .title {
                        font-weight: bold;
                        text-transform: uppercase;
                        text-indent: 2cm;
                    }
                    .normal {
                        text-indent: 2cm;
                    }
                    p {
                        margin: 0 0 12pt 0;
                    }
                </style>
            </head>
            <body>
        `;

        let titleCounter = 1;
        blocks.forEach(block => {
            if (block.type === 'quote') {
                htmlContent += `<p class="quote">${block.text}</p>`;
            } else if (block.type === 'title') {
                const prefix = `${toRoman(titleCounter++)} - `;
                htmlContent += `<p class="title">${prefix}${stripHtml(block.text).toUpperCase()}</p>`;
            } else {
                htmlContent += `<p class="normal">${block.text}</p>`;
            }
        });

        htmlContent += `
            </body >
            </html >
    `;

        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();

            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();

                // Cleanup after print dialog is closed
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 3000);
            }, 500);
        }
    };

    let renderTitleCounter = 1;

    return (
        <div className="p-6 h-full min-h-screen relative overflow-hidden bg-stone-100/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-justice-900 font-serif">Formatador de Minutas</h1>
                    <p className="text-sm text-gray-500">Padronização de ofícios, portarias e decisões</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportDOCX} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-all flex items-center gap-2 font-medium">
                        <FileText size={18} /> Baixar Word
                    </button>
                    <button onClick={handleExportPDF} className="bg-justice-800 text-white px-4 py-2 rounded-lg shadow hover:bg-black transition-all flex items-center gap-2 font-medium">
                        <Download size={18} /> Baixar PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-180px)]">

                {/* Editor Column */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="bg-gray-50 border-b p-3 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-gray-700">
                            <Type size={16} /> Texto Original
                        </h3>
                        <div className="flex gap-4 text-xs font-medium text-gray-600">
                            <label className="flex items-center gap-1 cursor-pointer hover:text-justice-600">
                                <input
                                    type="checkbox"
                                    checked={autoClean}
                                    onChange={(e) => { setAutoClean(e.target.checked); setTimeout(handleProcessText, 0); }}
                                    className="rounded border-gray-300 text-justice-600 focus:ring-justice-500"
                                />
                                Ocultar Rastros PJe
                            </label>
                            <button
                                onClick={handleClear}
                                className="flex items-center gap-1 text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                            >
                                <Eraser size={14} />
                                Limpar
                            </button>
                        </div>
                    </div>
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleProcessText}
                        className="flex-1 w-full p-4 overflow-y-auto focus:outline-none focus:ring-inset focus:ring-2 focus:ring-justice-200 text-sm leading-relaxed custom-scrollbar bg-white"
                        style={{ minHeight: '300px' }}
                    />
                </div>

                {/* Preview Column */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative">
                    <div className="bg-gray-50 border-b p-3 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2 text-gray-700">
                            <AlignJustify size={16} /> Visualização (Padrão Oficial)
                        </h3>
                        <button
                            onClick={handleCopyToClipboard}
                            className={`text - xs px - 3 py - 1.5 rounded - md font - bold transition - colors flex items - center gap - 1 ${copied ? 'bg-green-100 text-green-700' : 'bg-justice-100 text-justice-700 hover:bg-justice-200'} `}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copiado!' : 'Copiar Formatado'}
                        </button>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto bg-white custom-scrollbar w-full pl-10"
                        style={{
                            paddingTop: '10mm',
                            paddingRight: '10mm',
                            paddingBottom: '10mm',
                            fontFamily: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif',
                            fontSize: '13pt',
                            lineHeight: '1.5',
                        }}
                    >
                        {blocks.length === 0 ? (
                            <div className="text-center text-gray-300 pt-20 flex flex-col items-center">
                                <Type size={48} className="mb-4 opacity-50" />
                                <p>Nenhum texto formatado.</p>
                                <p className="text-sm">Cole o texto ao lado e clique em Atualizar.</p>
                            </div>
                        ) : (
                            blocks.map((block) => {
                                let prefix = '';
                                if (block.type === 'title') {
                                    prefix = `${toRoman(renderTitleCounter++)} - `;
                                }

                                return (
                                    <div
                                        key={block.id}
                                        className="mb-4 text-justify relative group"
                                        style={{
                                            marginLeft: block.type === 'quote' ? '4cm' : '0',
                                            textIndent: block.type === 'quote' ? '0' : '2cm',
                                            fontSize: block.type === 'quote' ? '11pt' : '13pt',
                                            fontWeight: block.type === 'title' ? 'bold' : 'normal',
                                            textTransform: block.type === 'title' ? 'uppercase' : 'none',
                                        }}
                                    >
                                        <div
                                            className="absolute -left-8 top-1 opacity-20 group-hover:opacity-100 text-gray-500 cursor-pointer hover:text-justice-600 transition-all p-1 bg-gray-50 rounded-md shadow-sm border border-gray-100"
                                            onClick={() => toggleBlockType(block.id)}
                                            title="Clique para alternar estilo (Título / Citação / Normal)"
                                        >
                                            {block.type === 'quote' && <Quote size={14} />}
                                            {block.type === 'title' && <Heading size={14} />}
                                            {block.type === 'normal' && <AlignJustify size={14} />}
                                        </div>
                                        {prefix}
                                        <span
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => updateBlockText(block.id, e.currentTarget.innerHTML)}
                                            className="outline-none focus:bg-yellow-50/50 rounded px-1 transition-colors min-w-[20px] break-words"
                                            dangerouslySetInnerHTML={{ __html: block.text }}
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
