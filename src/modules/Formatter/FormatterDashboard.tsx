import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FileText, Download, Copy, Settings, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Select } from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Requires adding to package.json: npm install react-quill

interface FormatterSettings {
  fontFamily: string;
  fontSize: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  indent: number;
}

interface FormatterDashboardProps {
  session: any;
  unitSettings?: FormatterSettings;
  onUpdateSettings?: (settings: FormatterSettings) => void;
  isAdmin?: boolean;
}

const DEFAULT_SETTINGS: FormatterSettings = {
  fontFamily: 'Century Gothic',
  fontSize: 13,
  marginTop: 1.0,  // Changed to numeric inches/cm for easier conversion (approx 2.54cm)
  marginBottom: 1.0,
  marginLeft: 1.0,
  marginRight: 1.0,
  indent: 2.0 // cm indent for first line
};

// ... utility functions
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const extractTextFromHtml = (html: string): string => {
  if (typeof window === 'undefined') return html; // Fallback
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
  let text = '';
  let currentNode = walker.nextNode();
  const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'li'];

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const parent = currentNode.parentElement;
      if (parent && parent.closest('.ql-clipboard')) {
        currentNode = walker.nextNode();
        continue;
      }
      text += currentNode.textContent || '';
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = currentNode as HTMLElement;
      if (element.classList.contains('ql-clipboard')) {
        currentNode = walker.nextNode();
        continue;
      }
      if (blockTags.includes(element.tagName.toLowerCase())) {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
      }
    }
    currentNode = walker.nextNode();
  }
  // Remove sequential multiple newlines correctly
  return text.trim().replace(/\n{3,}/g, '\n\n'); 
};


export const FormatterDashboard: React.FC<FormatterDashboardProps> = ({ session, unitSettings, onUpdateSettings, isAdmin }) => {
    const { unitId } = useUserRole(session);
    const [headerContent, setHeaderContent] = useState('');
    const [bodyContent, setBodyContent] = useState('');
    const [footerContent, setFooterContent] = useState('');
    const [headerImage, setHeaderImage] = useState<string | null>(null);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<FormatterSettings>(unitSettings || DEFAULT_SETTINGS);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial load from storage / props
    useEffect(() => {
        const loadInitialData = () => {
             // 1. Prioritize Props (which come from Context/Unit Config)
            if (unitSettings) {
                setSettings(unitSettings);
            } else {
                 // 2. Fallback to LocalStorage
                const savedSettings = localStorage.getItem('formatter_settings');
                if (savedSettings) {
                    try { setSettings(JSON.parse(savedSettings)); } catch(e){}
                }
            }
            
            // Layout (Drafts)
            const savedHeader = localStorage.getItem('formatter_header');
            const savedBody = localStorage.getItem('formatter_body');
            const savedFooter = localStorage.getItem('formatter_footer');
            const savedImg = localStorage.getItem('formatter_img');
            
            if (savedHeader) setHeaderContent(savedHeader);
            if (savedBody) setBodyContent(savedBody);
            if (savedFooter) setFooterContent(savedFooter);
            if (savedImg) setHeaderImage(savedImg);
        };
        loadInitialData();
    }, [unitSettings]);

    // Save drafts automatically
    useEffect(() => {
        localStorage.setItem('formatter_header', headerContent);
        localStorage.setItem('formatter_body', bodyContent);
        localStorage.setItem('formatter_footer', footerContent);
        if (headerImage) localStorage.setItem('formatter_img', headerImage);
    }, [headerContent, bodyContent, footerContent, headerImage]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const base64 = await blobToBase64(file);
        setHeaderImage(base64);
        localStorage.setItem('formatter_img', base64);
    };

    const removeImage = () => {
        setHeaderImage(null);
        localStorage.removeItem('formatter_img');
    };

    const updateSetting = (key: keyof FormatterSettings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        localStorage.setItem('formatter_settings', JSON.stringify(newSettings));
    };

    const handleSaveOfficialSettings = () => {
        if (onUpdateSettings) {
            onUpdateSettings(settings);
            alert("Padrão oficial da Unidade atualizado com sucesso!");
        }
        setIsSettingsOpen(false);
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        localStorage.setItem('formatter_settings', JSON.stringify(DEFAULT_SETTINGS));
    };

    const copyToClipboard = () => {
        // Simple plain text compilation
        const textToCopy = `${extractTextFromHtml(headerContent)}\n\n${extractTextFromHtml(bodyContent)}\n\n${extractTextFromHtml(footerContent)}`;
        navigator.clipboard.writeText(textToCopy);
        alert('Copiado para a área de transferência! (Versão em texto simples)');
    };

    // PDF Generation Logic
    const generatePDF = () => {
        try {
            // A4 page: 210mm x 297mm
            const doc = new jsPDF('p', 'mm', 'a4');
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();
            
            // Convert margins (inches -> mm) -> approx * 25.4
            const mTop = settings.marginTop * 25.4;
            const mBottom = settings.marginBottom * 25.4;
            const mLeft = settings.marginLeft * 25.4;
            const mRight = settings.marginRight * 25.4;
            
            const contentWidth = width - mLeft - mRight;
            
            doc.setFont(settings.fontFamily.toLowerCase(), 'normal');
            doc.setFontSize(settings.fontSize);
            
            let currentY = mTop;

            const addText = (text: string, isJustified: boolean = true) => {
                 if (!text || text.trim() === '') return;
                 const lines = text.split('\n');
                 
                 lines.forEach((line) => {
                     if (line.trim() === '') {
                         currentY += settings.fontSize * 0.5; // smaller gap for empty lines
                         return;
                     }
                     // Basic check for pagination
                     if (currentY > height - mBottom) {
                         doc.addPage();
                         currentY = mTop;
                     }
                     
                     // Quick and dirty justified text using splitTextToSize
                     // For true justification, doc.text supports `{ align: 'justify' }` in newer jsPDF versions
                     const splitLines = doc.splitTextToSize(line, contentWidth);
                     doc.text(splitLines, mLeft, currentY, { align: isJustified ? 'justify' : 'left', maxWidth: contentWidth });
                     currentY += splitLines.length * (settings.fontSize * 0.4); // advance Y based on lines
                 });
                 currentY += settings.fontSize * 0.5; // paragraph spacing
            };

            // 1. Header Image
            if (headerImage) {
                 // Try to guess aspect ratio or set fixed height (e.g. 25mm)
                 // A true implementation would load image width/height first
                 doc.addImage(headerImage, 'JPEG', (width / 2) - 15, currentY, 30, 30);
                 currentY += 35;
            }

            // 2. Header Text (Usually Center aligned)
            doc.setFont('helvetica', 'bold'); // Brasões/cabeçalhos costumam ter fonte diferente ou negrito
            // Centering text manually
            const headerTextParts = extractTextFromHtml(headerContent).split('\n');
            headerTextParts.forEach(l => {
                const textWidth = doc.getStringUnitWidth(l) * settings.fontSize / doc.internal.scaleFactor;
                const xOffset = (width - textWidth) / 2;
                doc.text(l, xOffset, currentY);
                currentY += settings.fontSize * 0.4;
            });
            currentY += 10;
            
            // 3. Body Text (Justified with indent)
            doc.setFont(settings.fontFamily.toLowerCase() === 'times new roman' ? 'times' : 'helvetica', 'normal');
            addText(extractTextFromHtml(bodyContent), true);

            // 4. Footer Text (Usually Center aligned)
            currentY += 15; // extra space before signature
            const footerTextParts = extractTextFromHtml(footerContent).split('\n');
            footerTextParts.forEach(l => {
                const textWidth = doc.getStringUnitWidth(l) * settings.fontSize / doc.internal.scaleFactor;
                const xOffset = (width - textWidth) / 2;
                doc.text(l, xOffset, currentY);
                currentY += settings.fontSize * 0.4;
            });

            doc.save(`documento_formatado_${new Date().getTime()}.pdf`);
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar PDF. Verifique se a imagem inserida é válida (JPEG/PNG pequeno).");
        }
    };


    const generateWord = async () => {
         try {
            const inchToTwip = (inches: number) => inches * 1440;
            const ptToHalfPt = (pt: number) => pt * 2;
            const cmToTwip = (cm: number) => cm * 567; // approx

            const createParagraphs = (html: string, align: AlignmentType, isBody: boolean = false) => {
                const text = extractTextFromHtml(html);
                if (!text || text.trim() === '') return [];
                const lines = text.split('\n');
                return lines.map(line => {
                    const isEmpty = line.trim() === '';
                    
                    const paragraphOptions: any = {
                        children: isEmpty ? [new TextRun(" ")] : [
                            new TextRun({
                                text: line,
                                font: settings.fontFamily,
                                size: ptToHalfPt(settings.fontSize)
                            })
                        ],
                        alignment: align,
                    };

                    // Add indent only to body paragraphs if it's the body section and not empty
                    if (isBody && !isEmpty && settings.indent > 0) {
                        paragraphOptions.indent = {
                            firstLine: cmToTwip(settings.indent)
                        }
                    }

                    // Add spacing after paragraph
                    paragraphOptions.spacing = {
                        after: isEmpty ? 120 : 200, // smaller spacing for empty lines, standard for filled
                        line: 276, // 1.15 line spacing approximation
                         lineRule: 'auto'
                    };

                    return new Paragraph(paragraphOptions);
                });
            };

            const childrenArray: any[] = [];

            // Image handling in docx is complex (requires dimensions). 
            // Skipping headerImage for this MVP to ensure robust file generation.
            // If requested, we'd need to parse base64 and create an ImageRun.

            childrenArray.push(...createParagraphs(headerContent, AlignmentType.CENTER));
            childrenArray.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 400 } })); // spacer
            childrenArray.push(...createParagraphs(bodyContent, AlignmentType.JUSTIFIED, true));
            childrenArray.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 600 } })); // spacer
            childrenArray.push(...createParagraphs(footerContent, AlignmentType.CENTER));

            const doc = new Document({
                creator: "App Reus Presos",
                title: "Documento Formatado",
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: inchToTwip(settings.marginTop),
                                bottom: inchToTwip(settings.marginBottom),
                                left: inchToTwip(settings.marginLeft),
                                right: inchToTwip(settings.marginRight),
                            }
                        }
                    },
                    children: childrenArray
                }]
            });

            const blob = await Packer.toBlob(doc);
            saveAs(blob, `documento_formatado_${new Date().getTime()}.docx`);

         } catch (e) {
             console.error(e);
             alert("Erro ao gerar arquivo Word. Tente remover formatações especiais do texto.");
         }
    };


    const modules = {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        ['clean']
      ],
      clipboard: {
        matchVisual: false,
      }
    };

    return (
        <div className="fade-in max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="text-justice-600" />
                        Formatador de Peças
                    </h2>
                    <p className="text-gray-500 text-sm">Crie, formate e padronize documentos oficiais do Tribunal.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="w-4 h-4 mr-2" /> Padrão da Vara
                    </Button>
                </div>
            </div>

            {isSettingsOpen && (
                <Card className="border-justice-200 shadow-md animate-in slide-in-from-top-4">
                    <div className="bg-justice-50 p-4 border-b border-justice-100 flex justify-between items-center rounded-t-lg">
                        <h3 className="font-bold text-justice-800">Regras de Formatação</h3>
                        <div className="flex gap-2">
                             <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(false)}>
                                Fechar
                            </Button>
                            {isAdmin && (
                                <Button variant="primary" size="sm" onClick={handleSaveOfficialSettings}>
                                    Salvar como Oficial
                                </Button>
                            )}
                        </div>
                    </div>
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Fonte</label>
                            <select 
                                value={settings.fontFamily} 
                                onChange={e => updateSetting('fontFamily', e.target.value)}
                                className="w-full text-sm border rounded-md p-2 bg-white"
                            >
                                <option value="Arial">Arial</option>
                                <option value="Century Gothic">Century Gothic</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Calibri">Calibri</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tamanho da Fonte</label>
                            <input 
                                type="number" 
                                value={settings.fontSize} 
                                onChange={e => updateSetting('fontSize', Number(e.target.value))}
                                className="w-full text-sm border rounded-md p-2"
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Margem Sup/Inf (in)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" step="0.1" 
                                    value={settings.marginTop} 
                                    onChange={e => updateSetting('marginTop', Number(e.target.value))}
                                    className="w-full text-sm border rounded-md p-2 text-center"
                                />
                                <input 
                                    type="number" step="0.1" 
                                    value={settings.marginBottom} 
                                    onChange={e => updateSetting('marginBottom', Number(e.target.value))}
                                    className="w-full text-sm border rounded-md p-2 text-center"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Margem Esq/Dir (in)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" step="0.1" 
                                    value={settings.marginLeft} 
                                    onChange={e => updateSetting('marginLeft', Number(e.target.value))}
                                    className="w-full text-sm border rounded-md p-2 text-center"
                                />
                                <input 
                                    type="number" step="0.1" 
                                    value={settings.marginRight} 
                                    onChange={e => updateSetting('marginRight', Number(e.target.value))}
                                    className="w-full text-sm border rounded-md p-2 text-center"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Recuo 1ª Linha (cm)</label>
                            <input 
                                type="number" step="0.5" 
                                value={settings.indent} 
                                onChange={e => updateSetting('indent', Number(e.target.value))}
                                className="w-full text-sm border rounded-md p-2"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button variant="ghost" size="sm" onClick={resetSettings} className="text-red-500 w-full mb-1">
                                Resetar Limpos
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 p-2 flex justify-between items-center sticky top-0 z-10">
                    <div className="text-sm font-medium text-gray-500 pl-2">Estúdio de Edição</div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyToClipboard} title="Copiar Texto HTML Bruto">
                            <Copy className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button variant="outline-primary" size="sm" onClick={generateWord}>
                            <Download className="w-4 h-4 mr-1" /> DOCX
                        </Button>
                       {/*
                       <Button variant="primary" size="sm" onClick={generatePDF}>
                            <Download className="w-4 h-4 mr-1" /> PDF
                        </Button>
                        */}
                    </div>
                </div>

                <div 
                    className="p-8 mx-auto"
                    style={{ 
                        maxWidth: '850px', // A4 width proportion
                        minHeight: '1000px', // A4 height proportion
                        backgroundColor: 'white',
                        boxShadow: '0 0 10px rgba(0,0,0,0.05)',
                        marginTop: '20px',
                        marginBottom: '20px'
                    }}
                >
                    {/* Header Image Upload */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        {headerImage ? (
                            <div className="relative group">
                                <img src={headerImage} alt="Brasão" className="h-24 object-contain" />
                                <button 
                                    onClick={removeImage}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    &times;
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center text-gray-400 hover:text-justice-600 hover:border-justice-400 transition-colors">
                                <span className="text-sm font-medium">Adicionar Brasão / Logo</span>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} />
                            </label>
                        )}
                    </div>

                    {/* Section 1: Header */}
                    <div className="mb-4">
                         <div className="text-xs text-gray-400 mb-1 border-b pb-1 font-mono uppercase">Cabeçalho (Centralizado)</div>
                         <ReactQuill 
                            theme="snow"
                            value={headerContent} 
                            onChange={setHeaderContent} 
                            modules={modules}
                            placeholder="EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO..."
                            className="editor-header text-center"
                        />
                    </div>

                    {/* Section 2: Body */}
                    <div className="mb-4">
                        <div className="text-xs text-gray-400 mb-1 border-b pb-1 font-mono uppercase">Corpo do Texto (Justificado + Recuo Especial)</div>
                        <ReactQuill 
                            theme="snow"
                            value={bodyContent} 
                            onChange={setBodyContent} 
                            modules={modules}
                            placeholder="O Ministério Público, por seu Promotor de Justiça infra-assinado..."
                            className="editor-body text-justify"
                        />
                    </div>

                    {/* Section 3: Footer/Signatures */}
                    <div className="mt-12">
                         <div className="text-xs text-gray-400 mb-1 border-b pb-1 font-mono uppercase">Rodapé e Assinaturas (Centralizado)</div>
                         <ReactQuill 
                            theme="snow"
                            value={footerContent} 
                            onChange={setFooterContent} 
                            modules={modules}
                            placeholder="Goianésia do Pará, (data)."
                            className="editor-footer text-center"
                        />
                    </div>
                </div>
            </div>
            
            <style>{`
                /* Custom Quill styling to reflect WYSIWYG based on settings */
                .ql-editor {
                    font-family: '${settings.fontFamily}', sans-serif !important;
                    font-size: ${settings.fontSize}pt !important;
                    line-height: 1.5;
                }
                .editor-header .ql-editor { text-align: center; }
                .editor-body .ql-editor { text-align: justify; }
                .editor-body .ql-editor p { text-indent: ${settings.indent}cm; }
                .editor-footer .ql-editor { text-align: center; }
                
                /* Hide toolbar boundaries for cleaner look * /
                .ql-toolbar.ql-snow { border: none; border-bottom: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px 8px 0 0; }
                .ql-container.ql-snow { border: none !important; }
            `}</style>
        </div>
    );
};
