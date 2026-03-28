import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { Type, Download, AlignJustify, Quote, RefreshCw, Copy, Check, Heading, FileText, Eraser, AlignCenter, Bold, Settings, Save, X } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';

interface FormatterDashboardProps {
    session: any;
    unitSettings: {
        fontFamily: string;
        fontSize: number;
        marginTop: number;
        marginBottom: number;
        marginLeft: number;
        marginRight: number;
        indent: number;
    };
    onUpdateSettings: (newSettings: any) => Promise<void>;
    isAdmin: boolean;
}

interface Block {
    id: string;
    text: string;
    type: 'normal' | 'quote' | 'title';
    isCenter?: boolean;
    isBold?: boolean;
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

function htmlToDocxChildren(html: string, size: number, fontFamily: string): TextRun[] {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const runs: TextRun[] = [];

    const walk = (node: Node, bold: boolean, italic: boolean, underline: boolean) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) {
                runs.push(new TextRun({
                    text: node.textContent,
                    bold: bold,
                    italics: italic,
                    underline: underline ? { type: "single", color: "auto" } : undefined,
                    font: fontFamily,
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

export const FormatterDashboard: React.FC<FormatterDashboardProps> = ({ session, unitSettings, onUpdateSettings, isAdmin }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [copied, setCopied] = useState(false);
    const [autoClean, setAutoClean] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [localSettings, setLocalSettings] = useState(unitSettings);

    // Sync local settings when prop changes
    React.useEffect(() => {
        setLocalSettings(unitSettings);
    }, [unitSettings]);

    const handleClear = () => {
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setBlocks([]);
        setCopied(false);
    };

    const handleProcessText = () => {
        if (!editorRef.current) return;

        // Walk a node and produce a plain string with \n at each block boundary
        const processNode = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent || '';
                
                // Em HTML, quebras de linhas manuais dentro de um text node (ex: \n puro) 
                // são interpretadas visualmente apenas como espaço. Se não a substituirmos, 
                // a lógica de quebra em parágrafos do formatador separará a frase no meio.
                text = text.replace(/[\r\n\t]+/g, ' ');

                if (autoClean) {
                    text = text.replace(/\s*\[\s*\d{7}-\d{2}[^\]]*\|\s*[a-zA-Z]+\s*\]/g, '');
                    text = text.replace(/((\b(?:de|do|da|dos|das|no|na|nos|nas|ao|à|aos|às|pelo|pela|pelos|pelas)\s+)?)(?:\()?Id\.?\s*(\d+)(?:\s*[-–,]\s*P[aá]g\.?\s*(\d+))?(?:\)?)/gi, (_m, fullPrep, prep, id, pag) => {
                        const formattedId = pag ? `Id. ${id} - Pág. ${pag}` : `Id. ${id}`;
                        return prep ? `${fullPrep}${formattedId}` : `(${formattedId})`;
                    });
                }
                return text;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tag = el.tagName.toLowerCase();

                let inner = '';
                el.childNodes.forEach(c => { inner += processNode(c); });

                const isBold = ['b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th'].includes(tag) ||
                    el.style.fontWeight === 'bold' ||
                    parseInt(el.style.fontWeight || '400') >= 700;
                const isItalic = ['i', 'em'].includes(tag) || el.style.fontStyle === 'italic';
                const isUnderline = ['u'].includes(tag) || el.style.textDecoration.includes('underline');

                let result = inner;
                if (result.trim()) {
                    if (isBold) result = result.split('\n').map(l => l.trim() ? `<strong>${l}</strong>` : l).join('\n');
                    if (isItalic) result = result.split('\n').map(l => l.trim() ? `<em>${l}</em>` : l).join('\n');
                    if (isUnderline) result = result.split('\n').map(l => l.trim() ? `<u>${l}</u>` : l).join('\n');
                }

                const blockTags = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'];
                if (blockTags.includes(tag)) return '\n' + result + '\n';
                if (tag === 'br') return '\n';
                return result;
            }
            return '';
        };

        let rawHtml = '';
        editorRef.current.childNodes.forEach(child => {
            rawHtml += processNode(child);
        });

        // Collapse multiple consecutive \n into one, then split into lines
        const lines = rawHtml.replace(/\n{2,}/g, '\n').split('\n').filter(line => line.trim() !== '');

        setBlocks(prevBlocks => {
            return lines.map((line, index) => {
                const cleanText = stripHtml(line).trim();
                const trimmedLine = line.trim();
                // Detectar automaticamente se é um título estrito e sem numeração prévia
                // Considera apenas (Relatório, Fundamentação, Dispositivo, Conclusão, etc.)
                // A regex permite flexibilidade de acentuação e espaços, agindo apenas em palavras isoladas
                const isTypicalTitle = /^\s*(relat[óo]rio|fundamenta[çc][ãa]o|dispositivo|conclus[ãa]o|decis[ãa]o|senten[çc]a|despacho|ementa|voto)\s*$/i.test(cleanText);
                
                // 1. Try exact match to preserve state when paragraphs are added/removed above this line
                let existingBlock = prevBlocks.find(b => b.text === trimmedLine);
                // 2. Try index match as a fallback for slow typers editing a line in place
                if (!existingBlock) {
                    existingBlock = prevBlocks[index];
                }

                if (existingBlock) {
                    return { ...existingBlock, text: trimmedLine };
                }

                return {
                    id: `block-${index}-${Date.now()}`,
                    text: trimmedLine,
                    type: isTypicalTitle ? 'title' : 'normal'
                };
            });
        });

        setCopied(false);
    };

    const setBlockType = (id: string, type: 'normal' | 'quote' | 'title') => {
        setBlocks(blocks.map(b => (b.id === id ? { ...b, type } : b)));
        setCopied(false);
    };

    const toggleBlockProperty = (id: string, property: 'isCenter' | 'isBold') => {
        setBlocks(blocks.map(b => (b.id === id ? { ...b, [property]: !b[property] } : b)));
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

                if (block.isCenter) {
                    el.style.textAlign = 'center';
                    el.style.textIndent = '0';
                }
                
                if (block.isBold && block.type !== 'title') {
                    // Title is already bolded above, but let's apply for normal/quote
                    el.innerHTML = `<strong>${el.innerHTML}</strong>`;
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

            let pStyle = 'Normal';
            let indent: any = { firstLine: convertInchesToTwip(unitSettings.indent / 2.54) }; // Convert cm to inches then to twips
            let alignment: any = AlignmentType.JUSTIFIED;

            if (isQuote) {
                pStyle = 'QuoteStyle';
                indent = { left: convertInchesToTwip(1.5748) }; // 4cm still default for long quotes? 
            } else if (isTitle) {
                pStyle = 'TitleStyle';
                indent = { firstLine: convertInchesToTwip(unitSettings.indent / 2.54) };
            }

            if (block.isCenter) {
                alignment = AlignmentType.CENTER;
                indent = undefined; // Center usually overrides first line indent
            }

            let outputText = block.text;
            if (block.isBold && !isTitle) { // Titles are bolded by default
                outputText = `<strong>${outputText}</strong>`;
            }

            const runs = htmlToDocxChildren(outputText, isQuote ? 22 : 26, unitSettings.fontFamily);

            if (isTitle) {
                const prefix = `${toRoman(titleCounter++)} - `;
                runs.unshift(new TextRun({
                    text: prefix,
                    font: unitSettings.fontFamily,
                    size: unitSettings.fontSize * 2,
                    bold: true,
                }));
            }

            return new Paragraph({
                alignment: alignment,
                indent: indent,
                spacing: {
                    line: 360, // 240 is single space, 360 is 1.5 space
                    lineRule: "auto",
                    before: 0,
                    after: 240, // 12pt space after paragraph (twips = pt * 20)
                },
                children: runs
            });
        });

        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: convertInchesToTwip(unitSettings.marginTop / 2.54),
                                right: convertInchesToTwip(unitSettings.marginRight / 2.54),
                                bottom: convertInchesToTwip(unitSettings.marginBottom / 2.54),
                                left: convertInchesToTwip(unitSettings.marginLeft / 2.54),
                            },
                        },
                    },
                    children: docParagraphs,
                },
            ],
        });

        try {
            const blob = await Packer.toBlob(doc);
            saveAs(blob, "Minuta_Formatada.docx");
        } catch (error) {
            console.error("Erro ao gerar DOCX:", error);
            alert("Erro ao gerar o arquivo Word. Verifique o console para mais detalhes.");
        }
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
                    @page { 
                        size: A4; 
                        margin-top: ${unitSettings.marginTop}cm; 
                        margin-left: ${unitSettings.marginLeft}cm; 
                        margin-right: ${unitSettings.marginRight}cm; 
                        margin-bottom: ${unitSettings.marginBottom}cm; 
                    }
                    body { 
                        font-family: "${unitSettings.fontFamily}", "Century Gothic", CenturyGothic, AppleGothic, sans-serif;
                        font-size: ${unitSettings.fontSize}pt;
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
            let styleStr = '';
            if (block.isCenter) styleStr += 'text-align: center; text-indent: 0; ';
            if (block.isBold && block.type !== 'title') styleStr += 'font-weight: bold; ';

            if (block.type === 'quote') {
                htmlContent += `<p class="quote" style="${styleStr}">${block.text}</p>`;
            } else if (block.type === 'title') {
                const prefix = `${toRoman(titleCounter++)} - `;
                htmlContent += `<p class="title" style="${styleStr}">${prefix}${stripHtml(block.text).toUpperCase()}</p>`;
            } else {
                htmlContent += `<p class="normal" style="${styleStr}">${block.text}</p>`;
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
                    {isAdmin && (
                        <button 
                            onClick={() => setShowSettings(true)} 
                            className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2 font-medium"
                            title="Configurar Padrão da Unidade"
                        >
                            <Settings size={18} /> Configurações
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleProcessText}
                            className="bg-justice-100 text-justice-700 px-4 py-2 rounded-lg hover:bg-justice-200 transition-all flex items-center gap-2 font-medium"
                            title="Forçar atualização da formatação"
                        >
                            <RefreshCw size={18} /> Atualizar
                        </button>
                        <button onClick={handleClear} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-all flex items-center gap-2 font-medium border border-red-100">
                            <Eraser size={18} /> Limpar
                        </button>
                    </div>
                    <button onClick={handleExportDOCX} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-all flex items-center gap-2 font-medium">
                        <FileText size={18} /> Baixar Word
                    </button>
                    <button onClick={handleExportPDF} className="bg-justice-800 text-white px-4 py-2 rounded-lg shadow hover:bg-black transition-all flex items-center gap-2 font-medium">
                        <Download size={18} /> Baixar PDF
                    </button>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-justice-900 p-4 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Settings size={20} /> Padrão da Unidade
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fonte</label>
                                    <select 
                                        value={localSettings.fontFamily}
                                        onChange={(e) => setLocalSettings({...localSettings, fontFamily: e.target.value})}
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                    >
                                        <option value="Century Gothic">Century Gothic</option>
                                        <option value="Arial">Arial</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Verdana">Verdana</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tamanho (pt)</label>
                                    <input 
                                        type="number"
                                        value={localSettings.fontSize}
                                        onChange={(e) => setLocalSettings({...localSettings, fontSize: parseInt(e.target.value)})}
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Margem Superior (cm)</label>
                                    <input 
                                        type="number" step="0.1"
                                        value={localSettings.marginTop}
                                        onChange={(e) => setLocalSettings({...localSettings, marginTop: parseFloat(e.target.value)})}
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Margem Esquerda (cm)</label>
                                    <input 
                                        type="number" step="0.1"
                                        value={localSettings.marginLeft}
                                        onChange={(e) => setLocalSettings({...localSettings, marginLeft: parseFloat(e.target.value)})}
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Margem Inferior (cm)</label>
                                    <input 
                                        type="number" step="0.1"
                                        value={localSettings.marginBottom}
                                        onChange={(e) => setLocalSettings({...localSettings, marginBottom: parseFloat(e.target.value)})}
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Margem Direita (cm)</label>
                                    <input 
                                        type="number" step="0.1"
                                        value={localSettings.marginRight}
                                        onChange={(e) => setLocalSettings({...localSettings, marginRight: parseFloat(e.target.value)})}
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Recuo de Parágrafo (cm)</label>
                                <input 
                                    type="number" step="0.1"
                                    value={localSettings.indent}
                                    onChange={(e) => setLocalSettings({...localSettings, indent: parseFloat(e.target.value)})}
                                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-justice-500"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setShowSettings(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-bold"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={async () => {
                                        await onUpdateSettings(localSettings);
                                        setShowSettings(false);
                                    }}
                                    className="flex-1 bg-justice-600 text-white px-4 py-2 rounded-lg hover:bg-justice-700 shadow-md transition-colors font-bold flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> Salvar Padrão
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                            className={`text-xs px-3 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1 ${copied ? 'bg-green-100 text-green-700' : 'bg-justice-100 text-justice-700 hover:bg-justice-200'} `}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copiado!' : 'Copiar Formatado'}
                        </button>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto bg-white custom-scrollbar w-full pl-10"
                        style={{
                            paddingTop: `${unitSettings.marginTop}cm`,
                            paddingLeft: `${unitSettings.marginLeft}cm`,
                            paddingRight: `${unitSettings.marginRight}cm`,
                            paddingBottom: `${unitSettings.marginBottom}cm`,
                            fontFamily: `"${unitSettings.fontFamily}", "Century Gothic", CenturyGothic, AppleGothic, sans-serif`,
                            fontSize: `${unitSettings.fontSize}pt`,
                            lineHeight: '1.5',
                        }}
                    >
                        {blocks.length === 0 ? (
                            <div className="text-center text-gray-300 pt-20 flex flex-col items-center">
                                <Type size={48} className="mb-4 opacity-50" />
                                <p>Nenhum texto formatado.</p>
                                <p className="text-sm">Cole o texto ao lado e clique em <b>Atualizar</b>.</p>
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
                                            textIndent: block.isCenter || block.type === 'quote' ? '0' : `${unitSettings.indent}cm`,
                                            fontSize: block.type === 'quote' ? '11pt' : `${unitSettings.fontSize}pt`,
                                            fontWeight: (block.type === 'title' || block.isBold) ? 'bold' : undefined,
                                            textTransform: block.type === 'title' ? 'uppercase' : 'none',
                                            textAlign: block.isCenter ? 'center' : 'justify',
                                        }}
                                    >
                                        {/* Floating Menu Action Palette */}
                                        {/* Floating Menu Action Palette */}
                                        <div
                                            className="absolute top-0 right-2 flex flex-row items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10 bg-white border border-gray-200 shadow-md rounded-lg p-1 -mt-3"
                                        >
                                            <div
                                                className={`cursor-pointer transition-all p-1.5 rounded-md ${block.type === 'normal' ? 'bg-justice-50 text-justice-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                                onClick={() => setBlockType(block.id, 'normal')}
                                                title="Texto Normal"
                                            >
                                                <AlignJustify size={14} />
                                            </div>
                                            <div
                                                className={`cursor-pointer transition-all p-1.5 rounded-md ${block.type === 'title' ? 'bg-justice-50 text-justice-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                                onClick={() => setBlockType(block.id, 'title')}
                                                title="Título Numérico"
                                            >
                                                <Heading size={14} />
                                            </div>
                                            <div
                                                className={`cursor-pointer transition-all p-1.5 rounded-md ${block.type === 'quote' ? 'bg-justice-50 text-justice-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                                onClick={() => setBlockType(block.id, 'quote')}
                                                title="Citação"
                                            >
                                                <Quote size={14} />
                                            </div>

                                            <div className="w-px h-4 bg-gray-200 mx-1"></div>

                                            <div
                                                className={`cursor-pointer transition-all p-1.5 rounded-md ${block.isCenter ? 'bg-justice-50 text-justice-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                                onClick={() => toggleBlockProperty(block.id, 'isCenter')}
                                                title="Centralizar"
                                            >
                                                <AlignCenter size={14} />
                                            </div>
                                            <div
                                                className={`cursor-pointer transition-all p-1.5 rounded-md ${block.isBold ? 'bg-justice-50 text-justice-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                                onClick={() => toggleBlockProperty(block.id, 'isBold')}
                                                title="Negrito"
                                            >
                                                <Bold size={14} />
                                            </div>
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
