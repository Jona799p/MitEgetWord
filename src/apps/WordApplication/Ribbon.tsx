import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript, Superscript,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Image as ImageIcon, Link as LinkIcon,
  Table as TableIcon, Minus, Type, Highlighter, PaintBucket, Indent, Outdent, Save,
  Printer, FileDown, FileText, Globe, FileCode, ChevronDown, Eye,
  Paintbrush, RemoveFormatting, CaseSensitive, AArrowUp, AArrowDown, ArrowDownUp,
  Sun, Moon, BookOpen, FilePlus, Sliders, Check, Bookmark, PanelTop, PanelBottom,
  Search, Maximize2, History, SpellCheck, RefreshCw, FolderOpen, Folder
} from 'lucide-react';
import { clearFormatting, transformCase } from './TypographyExtensions';
import PortalDropdown from './PortalDropdown';
import { ThemeMode } from './LayoutSettings';
import styles from './WordApplication.module.css';

interface RibbonProps {
  editor: Editor;
  onSave?: () => void;
  onPrint?: () => void;
  onOpenPreview?: () => void;
  onOpenLocalFile?: () => void;
  onExportWord?: () => void;
  onExportHtml?: () => void;
  onExportText?: () => void;
  isFormatPainterActive?: boolean;
  onToggleFormatPainter?: () => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onOpenFindReplace?: () => void;
  onToggleFocusMode?: () => void;
  onOpenVersionHistory?: () => void;
  onRunSpellCheck?: () => void;
  isSpellChecking?: boolean;
}

const fontFamilies = ['Arial', 'Times New Roman', 'Courier', 'Georgia', 'Verdana'];
const fontSizes = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '36pt', '48pt', '72pt'];

const Ribbon: React.FC<RibbonProps> = ({ 
  editor, 
  onSave, 
  onPrint, 
  onOpenPreview,
  onOpenLocalFile,
  onExportWord, 
  onExportHtml, 
  onExportText,
  isFormatPainterActive,
  onToggleFormatPainter,
  themeMode = 'dark',
  onToggleTheme,
  onOpenFindReplace,
  onToggleFocusMode,
  onOpenVersionHistory,
  onRunSpellCheck,
  isSpellChecking = false,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImageDropdownOpen, setIsImageDropdownOpen] = useState(false);
  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState(false);
  const [isLineHeightDropdownOpen, setIsLineHeightDropdownOpen] = useState(false);
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [gridHover, setGridHover] = useState<{ rows: number; cols: number }>({ rows: 3, cols: 3 });
  const [includeHeaderRow, setIncludeHeaderRow] = useState(true);

  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const imageDropdownRef = useRef<HTMLDivElement>(null);
  const caseDropdownRef = useRef<HTMLDivElement>(null);
  const lineHeightDropdownRef = useRef<HTMLDivElement>(null);
  const tableDropdownRef = useRef<HTMLDivElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Local re-render trigger based on editor state changes - throttled via requestAnimationFrame for silky smooth typing
  const [, forceUpdate] = useState({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        forceUpdate({});
        rafRef.current = null;
      });
    };
    editor.on('selectionUpdate', update);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && editor) {
        editor.chain().focus().setImage({ src: dataUrl }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!editor) {
    return null;
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const insertCustomTable = (rows: number, cols: number, withHeaderRow: boolean) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();
    setIsTableDropdownOpen(false);
  };

  const insertImage = () => {
    const url = window.prompt('Enter Image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    
    // cancelled
    if (url === null) {
      return;
    }
    
    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={styles.ribbon}>
      {/* File & Export Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          {onSave && (
            <button 
              className={styles.ribbonBtn} 
              onClick={onSave}
              title="Gem dokument (Ctrl+S)"
            >
              <Save size={16} />
            </button>
          )}
          {onOpenLocalFile && (
            <button 
              className={styles.ribbonBtn} 
              onClick={onOpenLocalFile}
              title="Åbn fil fra computeren (.docx, .html, .txt, .md, .json)"
            >
              <FolderOpen size={16} />
            </button>
          )}
          {onOpenPreview && (
            <button 
              className={styles.ribbonBtn} 
              onClick={onOpenPreview}
              title="Vis udskrift & download A4 (Ctrl+P)"
            >
              <Eye size={16} />
            </button>
          )}
          <div className={styles.exportDropdownContainer} ref={exportDropdownRef}>
            <button 
              className={`${styles.ribbonBtn} ${styles.exportMenuTriggerBtn} ${isExportOpen ? styles.activeBtn : ''}`}
              onClick={() => setIsExportOpen(prev => !prev)}
              title="Eksportér eller download dokument"
            >
              <FileDown size={16} />
              <ChevronDown size={11} className={styles.dropdownCaret} />
            </button>

            <PortalDropdown
              isOpen={isExportOpen}
              onClose={() => setIsExportOpen(false)}
              triggerRef={exportDropdownRef}
              minWidth="230px"
            >
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsExportOpen(false);
                  onOpenPreview?.();
                }}
              >
                <Eye size={15} color="#4a90e2" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Vis udskrift (A4)</span>
                  <span className={styles.exportMenuSub}>Se siden & download PDF/Word (Ctrl+P)</span>
                </div>
              </button>
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsExportOpen(false);
                  onOpenPreview?.();
                }}
              >
                <FileDown size={15} color="#2563eb" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Download PDF (.pdf)</span>
                  <span className={styles.exportMenuSub}>Hent direkte som PDF-fil</span>
                </div>
              </button>
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsExportOpen(false);
                  onExportWord?.();
                }}
              >
                <FileText size={15} color="#2b579a" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Download Word (.doc)</span>
                  <span className={styles.exportMenuSub}>Åbn i Microsoft Word</span>
                </div>
              </button>
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsExportOpen(false);
                  onPrint?.();
                }}
              >
                <Printer size={15} color="#888888" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Send til printer</span>
                  <span className={styles.exportMenuSub}>Åbn systemets udskriftsdialog</span>
                </div>
              </button>
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsExportOpen(false);
                  onExportHtml?.();
                }}
              >
                <Globe size={15} color="#10b981" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Webside (.html)</span>
                  <span className={styles.exportMenuSub}>Selvstændigt HTML-dokument</span>
                </div>
              </button>
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsExportOpen(false);
                  onExportText?.();
                }}
              >
                <FileCode size={15} color="#f59e0b" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Ren tekst (.txt)</span>
                  <span className={styles.exportMenuSub}>Uformateret råtekst</span>
                </div>
              </button>
            </PortalDropdown>
          </div>
          <button 
            className={styles.ribbonBtn} 
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Fortryd (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>
          <button 
            className={styles.ribbonBtn} 
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Annuller fortryd (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>
        <span className={styles.groupLabel}>Fil & Eksport</span>
      </div>

      {/* Font Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          {onToggleFormatPainter && (
            <button 
              type="button"
              className={`${styles.ribbonBtn} ${isFormatPainterActive ? styles.activeBtn : ''}`}
              onClick={onToggleFormatPainter}
              title="Formatpensel (Kopiér formatering fra markering og overfør med et klik)"
              style={isFormatPainterActive ? { color: '#4a90e2', borderColor: '#4a90e2', backgroundColor: 'rgba(74, 144, 226, 0.2)' } : {}}
            >
              <Paintbrush size={16} />
            </button>
          )}
          <button 
            type="button"
            className={styles.ribbonBtn} 
            onClick={() => clearFormatting(editor)}
            title="Ryd al formatering (Ctrl + Mellemrum)"
          >
            <RemoveFormatting size={16} />
          </button>

          <div className={styles.ribbonDivider} />

          <select 
            className={styles.ribbonSelect}
            style={{ maxWidth: '125px' }}
            onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
            value={editor.getAttributes('textStyle').fontFamily || ''}
            title="Skrifttype"
          >
            <option value="">Default Font</option>
            {fontFamilies.map(font => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>

          {/* Skriftstørrelses-vælger */}
          <select 
            className={styles.ribbonSelect}
            style={{ width: '58px' }}
            onChange={(e) => editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run()}
            value={(editor.getAttributes('textStyle').fontSize as string) || '12pt'}
            title="Skriftstørrelse"
          >
            {fontSizes.map(size => (
              <option key={size} value={size}>{size.replace('pt', '')}</option>
            ))}
          </select>

          {/* Knapper til at øge / mindske skriftstørrelse */}
          <button 
            type="button"
            className={styles.ribbonBtn} 
            onClick={() => {
              const currentSize = (editor.getAttributes('textStyle').fontSize as string) || '12pt';
              const currentNum = parseInt(currentSize, 10) || 12;
              const next = fontSizes.find(s => parseInt(s, 10) > currentNum) || fontSizes[fontSizes.length - 1];
              editor.chain().focus().setMark('textStyle', { fontSize: next }).run();
            }}
            title="Øg skriftstørrelse"
          >
            <AArrowUp size={16} />
          </button>
          <button 
            type="button"
            className={styles.ribbonBtn} 
            onClick={() => {
              const currentSize = (editor.getAttributes('textStyle').fontSize as string) || '12pt';
              const currentNum = parseInt(currentSize, 10) || 12;
              const prevList = [...fontSizes].reverse();
              const prev = prevList.find(s => parseInt(s, 10) < currentNum) || fontSizes[0];
              editor.chain().focus().setMark('textStyle', { fontSize: prev }).run();
            }}
            title="Formindsk skriftstørrelse"
          >
            <AArrowDown size={16} />
          </button>

          {/* Tegnsætning & Bogstavstørrelse Dropdown */}
          <div className={styles.exportDropdownContainer} ref={caseDropdownRef}>
            <button 
              type="button"
              className={`${styles.ribbonBtn} ${isCaseDropdownOpen ? styles.activeBtn : ''}`}
              onClick={() => setIsCaseDropdownOpen(prev => !prev)}
              title="Tegnsætning & Bogstavstørrelse (VERSALER, små bogstaver osv.)"
            >
              <CaseSensitive size={16} />
              <ChevronDown size={10} className={styles.dropdownCaret} />
            </button>

            <PortalDropdown
              isOpen={isCaseDropdownOpen}
              onClose={() => setIsCaseDropdownOpen(false)}
              triggerRef={caseDropdownRef}
              minWidth="190px"
            >
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsCaseDropdownOpen(false);
                  transformCase(editor, 'sentence');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', width: '22px', textAlign: 'center' }}>Aa</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Sætningsstort</span>
                  <span className={styles.exportMenuSub}>Stort forbogstav efter punktum</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsCaseDropdownOpen(false);
                  transformCase(editor, 'lower');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', width: '22px', textAlign: 'center' }}>aa</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>små bogstaver</span>
                  <span className={styles.exportMenuSub}>Alle bogstaver med småt</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsCaseDropdownOpen(false);
                  transformCase(editor, 'upper');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', width: '22px', textAlign: 'center' }}>AA</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>VERSALER</span>
                  <span className={styles.exportMenuSub}>ALLE BOGSTAVER MED STORT</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsCaseDropdownOpen(false);
                  transformCase(editor, 'title');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', width: '22px', textAlign: 'center' }}>Aa</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Hvert Ord Med Stort</span>
                  <span className={styles.exportMenuSub}>Første Bogstav I Hvert Ord</span>
                </div>
              </button>
            </PortalDropdown>
          </div>
        </div>
        <div className={styles.buttonRow}>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('bold') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Fed (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('italic') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Kursiv (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('underline') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Understreget (Ctrl+U)"
          >
            <UnderlineIcon size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('strike') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Gennemstreget"
          >
            <Strikethrough size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('subscript') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Sænket skrift"
          >
            <Subscript size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('superscript') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            title="Hævet skrift"
          >
            <Superscript size={16} />
          </button>

          <div className={styles.ribbonDivider} />

          <input 
            type="color" 
            title="Tekstfarve"
            className={styles.colorPicker}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            value={editor.getAttributes('textStyle').color || '#ffffff'}
          />
          <input 
            type="color" 
            title="Fremhævningsfarve (Overstregning)"
            className={styles.colorPicker}
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </div>
        <span className={styles.groupLabel}>Font</span>
      </div>

      {/* Paragraph Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive({ textAlign: 'left' }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Venstrejuster"
          >
            <AlignLeft size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive({ textAlign: 'center' }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Centrer"
          >
            <AlignCenter size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive({ textAlign: 'right' }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Højrejuster"
          >
            <AlignRight size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive({ textAlign: 'justify' }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            title="Lige margener"
          >
            <AlignJustify size={16} />
          </button>

          <div className={styles.ribbonDivider} />

          {/* Linjeafstand & Afsnitsafstand Dropdown */}
          <div className={styles.exportDropdownContainer} ref={lineHeightDropdownRef}>
            <button 
              type="button"
              className={`${styles.ribbonBtn} ${isLineHeightDropdownOpen ? styles.activeBtn : ''}`}
              onClick={() => setIsLineHeightDropdownOpen(prev => !prev)}
              title="Linje- og afsnitsafstand (1.0, 1.15, 1.5, 2.0)"
            >
              <ArrowDownUp size={16} />
              <ChevronDown size={10} className={styles.dropdownCaret} />
            </button>

            <PortalDropdown
              isOpen={isLineHeightDropdownOpen}
              onClose={() => setIsLineHeightDropdownOpen(false)}
              triggerRef={lineHeightDropdownRef}
              minWidth="200px"
            >
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsLineHeightDropdownOpen(false);
                  (editor.commands as any).setLineHeight?.('1.0');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '12px', minWidth: '24px' }}>1.0</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Enkelt (1.0)</span>
                  <span className={styles.exportMenuSub}>Kompakt linjeafstand</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsLineHeightDropdownOpen(false);
                  (editor.commands as any).setLineHeight?.('1.15');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '12px', minWidth: '24px' }}>1.15</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Standard (1.15)</span>
                  <span className={styles.exportMenuSub}>Klassisk Word-afstand</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsLineHeightDropdownOpen(false);
                  (editor.commands as any).setLineHeight?.('1.5');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '12px', minWidth: '24px' }}>1.5</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Halvanden (1.5)</span>
                  <span className={styles.exportMenuSub}>Opgave- & rapportstandard</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsLineHeightDropdownOpen(false);
                  (editor.commands as any).setLineHeight?.('2.0');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '12px', minWidth: '24px' }}>2.0</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Dobbelt (2.0)</span>
                  <span className={styles.exportMenuSub}>Dobbelt linjeafstand</span>
                </div>
              </button>

              <div className={styles.ribbonDivider} style={{ width: '100%', height: '1px', margin: '4px 0' }} />

              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsLineHeightDropdownOpen(false);
                  (editor.commands as any).setParagraphSpacing?.('12px');
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '24px' }}>+§</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Tilføj afstand efter afsnit</span>
                  <span className={styles.exportMenuSub}>+12px luft under afsnit</span>
                </div>
              </button>
              <button 
                type="button"
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsLineHeightDropdownOpen(false);
                  (editor.commands as any).setParagraphSpacing?.(null);
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '24px' }}>-§</span>
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Fjern afstand efter afsnit</span>
                  <span className={styles.exportMenuSub}>Nulstil afsnitsafstand</span>
                </div>
              </button>
            </PortalDropdown>
          </div>
        </div>
        <div className={styles.buttonRow}>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('bulletList') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Punktopstilling"
          >
            <List size={16} />
          </button>
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${editor.isActive('orderedList') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Nummereret liste"
          >
            <ListOrdered size={16} />
          </button>
          <button 
            type="button"
            className={styles.ribbonBtn}
            onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            disabled={!editor.can().sinkListItem('listItem')}
            title="Øg indrykning"
          >
            <Indent size={16} />
          </button>
          <button 
            type="button"
            className={styles.ribbonBtn}
            onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            disabled={!editor.can().liftListItem('listItem')}
            title="Formindsk indrykning"
          >
            <Outdent size={16} />
          </button>
        </div>
        <span className={styles.groupLabel}>Paragraph</span>
      </div>

      {/* Insert Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          {/* Table Dropdown with Grid Matrix Picker */}
          <div className={styles.exportDropdownContainer} ref={tableDropdownRef}>
            <button 
              className={`${styles.ribbonBtn} ${isTableDropdownOpen ? styles.activeBtn : ''}`} 
              onClick={() => setIsTableDropdownOpen(prev => !prev)} 
              title="Indsæt tabel (vælg dimensioner)"
            >
              <TableIcon size={16} />
              <ChevronDown size={10} className={styles.dropdownCaret} />
            </button>

            <PortalDropdown
              isOpen={isTableDropdownOpen}
              onClose={() => setIsTableDropdownOpen(false)}
              triggerRef={tableDropdownRef}
              minWidth="230px"
            >
              <div className={styles.gridPickerContainer}>
                <div className={styles.gridPickerHeader}>
                  <span className={styles.gridPickerTitle}>
                    {gridHover.rows} × {gridHover.cols} Tabel
                  </span>
                </div>
                
                <div 
                  className={styles.gridMatrix}
                  onMouseLeave={() => setGridHover({ rows: 3, cols: 3 })}
                >
                  {Array.from({ length: 8 }).map((_, rIndex) => (
                    <div key={rIndex} className={styles.gridRow}>
                      {Array.from({ length: 8 }).map((_, cIndex) => {
                        const row = rIndex + 1;
                        const col = cIndex + 1;
                        const isHighlighted = row <= gridHover.rows && col <= gridHover.cols;
                        return (
                          <div
                            key={cIndex}
                            className={`${styles.gridCell} ${isHighlighted ? styles.gridCellActive : ''}`}
                            onMouseEnter={() => setGridHover({ rows: row, cols: col })}
                            onClick={() => insertCustomTable(row, col, includeHeaderRow)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                <label className={styles.gridHeaderToggle}>
                  <input
                    type="checkbox"
                    checked={includeHeaderRow}
                    onChange={(e) => setIncludeHeaderRow(e.target.checked)}
                  />
                  <span>Overskriftsrække</span>
                </label>

                <div className={styles.dropdownDivider} />

                <button
                  type="button"
                  className={styles.exportMenuItem}
                  onClick={() => insertCustomTable(3, 3, includeHeaderRow)}
                >
                  <TableIcon size={14} />
                  <span>Standard (3 × 3)</span>
                </button>
              </div>
            </PortalDropdown>
          </div>

          {/* Image Upload Dropdown & Hidden File Input */}
          <input 
            type="file" 
            ref={imageFileInputRef} 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={handleImageFileSelect} 
          />
          <div className={styles.exportDropdownContainer} ref={imageDropdownRef}>
            <button 
              className={`${styles.ribbonBtn} ${isImageDropdownOpen ? styles.activeBtn : ''}`}
              onClick={() => setIsImageDropdownOpen(prev => !prev)}
              title="Indsæt billede (fra computer eller URL)"
            >
              <ImageIcon size={16} />
              <ChevronDown size={10} className={styles.dropdownCaret} />
            </button>

            <PortalDropdown
              isOpen={isImageDropdownOpen}
              onClose={() => setIsImageDropdownOpen(false)}
              triggerRef={imageDropdownRef}
              minWidth="200px"
            >
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsImageDropdownOpen(false);
                  imageFileInputRef.current?.click();
                }}
              >
                <Folder size={15} color="#4a90e2" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Vælg fra computer</span>
                  <span className={styles.exportMenuSub}>Lokal fil (.png, .jpg, .webp)</span>
                </div>
              </button>
              <button 
                className={styles.exportMenuItem}
                onClick={() => {
                  setIsImageDropdownOpen(false);
                  const url = window.prompt('Indtast billed-URL:');
                  if (url) editor.chain().focus().setImage({ src: url }).run();
                }}
              >
                <Globe size={15} color="#10b981" />
                <div className={styles.exportMenuInfo}>
                  <span className={styles.exportMenuTitle}>Fra internetadresse</span>
                  <span className={styles.exportMenuSub}>Indtast direkte web-URL</span>
                </div>
              </button>
            </PortalDropdown>
          </div>

          <button 
            className={`${styles.ribbonBtn} ${editor.isActive('link') ? styles.activeBtn : ''}`}
            onClick={setLink} title="Hyperlink"
          >
            <LinkIcon size={16} />
          </button>
          <button 
            className={styles.ribbonBtn} 
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Vandret linje"
          >
            <Minus size={16} />
          </button>
        </div>
        <span className={styles.groupLabel}>Indsæt</span>
      </div>



      {/* Tema Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          {/* Theme Mode Toggle (Light / Dark) */}
          <button 
            type="button"
            className={`${styles.ribbonBtn} ${themeMode === 'light' ? styles.activeBtn : ''}`}
            onClick={onToggleTheme}
            title={themeMode === 'dark' ? 'Skift til Lyst tema (klassisk hvidt Word-lærred)' : 'Skift til Mørkt tema (aftenarbejde)'}
          >
            {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <span className={styles.groupLabel}>Tema</span>
      </div>

      {/* Værktøjer Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          {onOpenFindReplace && (
            <button 
              type="button"
              className={styles.ribbonBtn}
              onClick={onOpenFindReplace}
              title="Find og erstat (Ctrl + F)"
            >
              <Search size={16} />
            </button>
          )}

          {onRunSpellCheck && (
            <button 
              type="button"
              className={`${styles.ribbonBtn} ${isSpellChecking ? styles.activeBtn : ''}`}
              onClick={onRunSpellCheck}
              disabled={isSpellChecking}
              title="Korrektur (LanguageTool) - Tjek stavning og grammatik"
            >
              {isSpellChecking ? <RefreshCw size={16} className={styles.spin} /> : <SpellCheck size={16} />}
            </button>
          )}

          {onToggleFocusMode && (
            <button 
              type="button"
              className={styles.ribbonBtn}
              onClick={onToggleFocusMode}
              title="Fuldskærm / Fokus-tilstand (F11)"
            >
              <Maximize2 size={16} />
            </button>
          )}

          {onOpenVersionHistory && (
            <button 
              type="button"
              className={styles.ribbonBtn}
              onClick={onOpenVersionHistory}
              title="Versionshistorik (Se og gendan tidligere versioner)"
            >
              <History size={16} />
            </button>
          )}
        </div>
        <span className={styles.groupLabel}>Værktøjer</span>
      </div>

      {/* Overskrifter Group */}
      <div className={styles.ribbonGroup}>
        <div className={styles.buttonRow}>
          <button 
            className={`${styles.ribbonBtn} ${styles.headingBtn} ${editor.isActive('paragraph') ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Normal tekst (Alt + Q)"
          >
            Normal
          </button>
          <button 
            className={`${styles.ribbonBtn} ${styles.headingBtn} ${editor.isActive('heading', { level: 1 }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Overskrift 1 (Alt + 1)"
          >
            H1
          </button>
          <button 
            className={`${styles.ribbonBtn} ${styles.headingBtn} ${editor.isActive('heading', { level: 2 }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Overskrift 2 (Alt + 2)"
          >
            H2
          </button>
        </div>
        <div className={styles.buttonRow}>
          <button 
            className={`${styles.ribbonBtn} ${styles.headingBtn} ${editor.isActive('heading', { level: 3 }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Overskrift 3 (Alt + 3)"
          >
            H3
          </button>
          <button 
            className={`${styles.ribbonBtn} ${styles.headingBtn} ${editor.isActive('heading', { level: 4 }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            title="Overskrift 4 (Alt + 4)"
          >
            H4
          </button>
          <button 
            className={`${styles.ribbonBtn} ${styles.headingBtn} ${editor.isActive('heading', { level: 5 }) ? styles.activeBtn : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
            title="Overskrift 5 (Alt + 5)"
          >
            H5
          </button>
        </div>
        <span className={styles.groupLabel}>Overskrifter</span>
      </div>
    </div>
  );
};

export default Ribbon;
