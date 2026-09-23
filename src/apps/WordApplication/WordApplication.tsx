import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import FontFamily from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import { CustomTableCell, CustomTableHeader } from './TableExtensions';
import { CustomTextStyle, LineHeightExtension, ClearFormattingExtension, clearFormatting } from './TypographyExtensions';
import ResizableImage from './ResizableImage';
import Link from '@tiptap/extension-link';
import { ChevronUp, ChevronDown, FileText, History } from 'lucide-react';

import { Extension } from '@tiptap/core';
import { NodeSelection, TextSelection, Selection } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';

import { ThemeMode } from './LayoutSettings';
import Ribbon from './Ribbon';

import StatusBar, { SaveStatus } from './StatusBar';
import DocumentOutline from './DocumentOutline';
import SearchAndReplaceExtension from './SearchAndReplaceExtension';
import CollapsibleHeadingExtension from './CollapsibleHeadingExtension';
import FindReplaceDialog from './FindReplaceDialog';
import DocumentStatsModal from './DocumentStatsModal';
import VersionHistoryModal, { DocumentVersion } from './VersionHistoryModal';
import { saveDocument, createDocument, createVersionSnapshot, isDocumentSavedLocally, getDocument } from '../../store/documentStore';
import { printDocument, exportToWord, exportToHtml, exportToText, exportToPdfFromHtml } from './exportUtils';
import PrintPreviewModal from './PrintPreviewModal';
import { parseLocalFile } from './localFileUtils';
import { tiptapHtmlToMarkdown, textToTipTapHtml } from '../../DocumentEditor';
import SuggestionExtension from './SuggestionExtension';
import FloatingSuggestionMenu, { SuggestionSubmitData } from './FloatingSuggestionMenu';
import SuggestionsMargin, { SuggestionItem } from './SuggestionsMargin';
import SpellCheckExtension from './SpellCheckExtension';
import SpellCheckContextMenu, { SpellCheckMenuData } from './SpellCheckContextMenu';
import TableContextMenu from './TableContextMenu';
import { 
  getSettings, checkTextWithLanguageTool, isLanguageToolAvailable,
  isCamelCaseOrAcronym, isInCustomDictionary, addToCustomDictionary, 
  filterValidEnglishWords 
} from '../../store/settingsStore';
import styles from './WordApplication.module.css';

export interface WordApplicationProps {
  appId: string;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isActive: boolean;
  docId?: string;
  docTitle?: string;
  fileData?: string | null;
  folderId?: string | null;
  isSavedLocally?: boolean;
  onSave?: (data: string, title?: string) => Promise<void> | void;
  onTitleChange?: (newTitle: string) => void;
}

// Prevent accidental deletion of images when pressing Backspace or Delete in adjacent text
const ImageSafetyExtension = Extension.create({
  name: 'imageSafety',
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.parentOffset === 0 && $from.depth > 0) {
          const index = $from.index($from.depth - 1);
          if (index > 0) {
            const prevNode = $from.node($from.depth - 1).child(index - 1);
            if (prevNode.type.name === 'image') {
              const imagePos = $from.pos - 1 - prevNode.nodeSize;
              dispatch(state.tr.setSelection(NodeSelection.create(state.doc, imagePos)));
              return true;
            }
          }
        }
        return false;
      },
      Delete: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.parentOffset === $from.parent.content.size && $from.depth > 0) {
          const parent = $from.node($from.depth - 1);
          const index = $from.index($from.depth - 1);
          if (index < parent.childCount - 1) {
            const nextNode = parent.child(index + 1);
            if (nextNode.type.name === 'image') {
              const imagePos = $from.pos + 1;
              dispatch(state.tr.setSelection(NodeSelection.create(state.doc, imagePos)));
              return true;
            }
          }
        }
        return false;
      },
    };
  },
});

// Clean any legacy page wrappers from existing files so content flows smoothly on the canvas
const sanitizeContent = (data?: string | null): string => {
  if (!data || data.trim() === '') return '<p></p>';
  return data
    .replace(/<div\s+[^>]*data-type=["']page["'][^>]*>/gi, '')
    .replace(/<div\s+[^>]*class=["'][^"']*page-break[^"']*["'][^>]*>.*?<\/div>/gi, '')
    .replace(/<div\s+[^>]*class=["'][^"']*page[^"']*["'][^>]*>/gi, '')
    .replace(/<\/div>/gi, '');
};

export const WordApplication: React.FC<WordApplicationProps> = ({
  appId,
  onClose,
  onMinimize,
  onMaximize,
  isActive,
  docId,
  docTitle = 'Navnløst dokument',
  fileData,
  folderId = null,
  isSavedLocally: propIsSavedLocally,
  onSave,
  onTitleChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('mitEgetWord_settings') || '{}');
      return s.defaultWordCanvas === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e.detail?.defaultWordCanvas) {
        setThemeMode(e.detail.defaultWordCanvas);
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const [isRibbonVisible, setIsRibbonVisible] = useState(true);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isSuggestionsSidebarOpen, setIsSuggestionsSidebarOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [currentDocId, setCurrentDocId] = useState(docId || '');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderId || null);
  const [isSavedLocallyState, setIsSavedLocallyState] = useState<boolean>(() => {
    if (propIsSavedLocally !== undefined) return propIsSavedLocally;
    if (docId) return isDocumentSavedLocally(docId);
    return false;
  });

  useEffect(() => {
    if (propIsSavedLocally !== undefined) {
      setIsSavedLocallyState(propIsSavedLocally);
    } else if (currentDocId) {
      setIsSavedLocallyState(isDocumentSavedLocally(currentDocId));
    }
  }, [propIsSavedLocally, currentDocId]);

  const [title, setTitle] = useState(docTitle);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [isSpellChecking, setIsSpellChecking] = useState(false);
  const [spellCheckToast, setSpellCheckToast] = useState<{ message: string; type?: 'info' | 'success' | 'warning' } | null>(null);
  const [spellCheckMenu, setSpellCheckMenu] = useState<SpellCheckMenuData | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number } | null>(null);
  const autoSaveTimeoutRef = useRef<any>(null);
  const lastSnapshotContentRef = useRef<string>('');
  const lastSnapshotTimeRef = useRef<number>(Date.now());
  const editorLocalFileInputRef = useRef<HTMLInputElement>(null);

  // Lyt på Tilbage-kommando (museknap på siden, Alt+Venstre pil eller panel overskrift)
  useEffect(() => {
    const handleNavigateBack = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail?.panelId && appId && customEv.detail.panelId !== appId) {
        return;
      }

      // 1. Luk åbne modaler i Word, hvis en er aktiv
      if (isPreviewOpen) {
        setIsPreviewOpen(false);
        e.preventDefault();
        return;
      }
      if (isFindReplaceOpen) {
        setIsFindReplaceOpen(false);
        e.preventDefault();
        return;
      }
      if (isStatsModalOpen) {
        setIsStatsModalOpen(false);
        e.preventDefault();
        return;
      }
      if (isVersionHistoryOpen) {
        setIsVersionHistoryOpen(false);
        e.preventDefault();
        return;
      }
      if (spellCheckMenu) {
        setSpellCheckMenu(null);
        e.preventDefault();
        return;
      }
      if (tableContextMenu) {
        setTableContextMenu(null);
        e.preventDefault();
        return;
      }

      // Hvis ingen modaler er åbne, forhindres handlingen ikke (e.preventDefault kaldes ikke),
      // så overordnet panel (App.jsx) popper stakken og navigerer tilbage til f.eks. dashboardet!
    };

    window.addEventListener('os:navigate-back', handleNavigateBack);
    return () => {
      window.removeEventListener('os:navigate-back', handleNavigateBack);
    };
  }, [appId, isPreviewOpen, isFindReplaceOpen, isStatsModalOpen, isVersionHistoryOpen, spellCheckMenu]);

  // Sync title when docTitle prop changes
  useEffect(() => {
    if (docTitle) {
      setTitle(docTitle);
    }
  }, [docTitle]);

  // Sync docId when prop changes
  useEffect(() => {
    if (docId) {
      setCurrentDocId(docId);
    }
  }, [docId]);

  // Sync folderId when prop changes
  useEffect(() => {
    if (folderId !== undefined) {
      setCurrentFolderId(folderId);
    }
  }, [folderId]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSelectionRef = useRef<boolean>(false);
  const dragAnchorPosRef = useRef<number | null>(null);
  const dragStartCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedBeyondThresholdRef = useRef<boolean>(false);
  const dragStartedOutsideRef = useRef<boolean>(false);
  const hasLeftEditorRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef<number>(0);
  const lastThumbnailTimeRef = useRef<number>(0);
  const idleThumbnailTimerRef = useRef<any>(null);
  const handleSaveRef = useRef<((customTitle?: string, forceThumbnail?: boolean) => Promise<void>) | null>(null);

  // Caching og debouncing til lynhurtig automatisk baggrundsstavekontrol (Word / Docs stil)
  const blockSpellCacheRef = useRef<Map<string, any[]>>(new Map());
  const validEnglishWordsCacheRef = useRef<Set<string>>(new Set());
  const autoSpellTimeoutRef = useRef<any>(null);
  const spellAbortControllerRef = useRef<AbortController | null>(null);
  const runSpellCheckRef = useRef<((options?: { silent?: boolean; clearCache?: boolean; onlySelected?: boolean }) => Promise<void>) | null>(null);
  const lastSelfSavedHtmlRef = useRef<string | null>(fileData || null);

  // Format Painter state: copies inline marks & block attributes to transfer to another selection
  const [formatPainter, setFormatPainter] = useState<{
    active: boolean;
    format: {
      marks: Array<{ type: string; attrs?: Record<string, any> }>;
      blockAttrs: {
        textAlign?: string;
        lineHeight?: string;
        paragraphSpacing?: string;
      };
    } | null;
  }>({ active: false, format: null });

  const captureThumbnail = async (element: HTMLElement): Promise<string | null> => {
    if (!element || !editor) return null;
    try {
      const textContent = editor.getText();
      const lines = textContent.split('\n').filter(l => l.trim().length > 0).slice(0, 8);
      
      let computedBg = window.getComputedStyle(element).backgroundColor;
      if (!computedBg || computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent') {
        computedBg = themeMode === 'light' ? '#ffffff' : '#0a0c10';
      }
      const isDark = computedBg === '#0a0c10' || computedBg === 'rgb(10, 12, 16)';
      const textColor = isDark ? '#d4d4d4' : '#333333';
      const titleColor = isDark ? '#ffffff' : '#000000';
      
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="${computedBg}" />
        <text x="40" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${titleColor}">${(title || 'Dokument').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
        <line x1="40" y1="85" x2="560" y2="85" stroke="${isDark ? '#333' : '#e0e0e0'}" stroke-width="2" />`;
        
      let y = 140;
      for (const line of lines) {
        const safeLine = line.substring(0, 60).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        svgContent += `<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="16" fill="${textColor}">${safeLine}...</text>`;
        y += 30;
      }
      svgContent += `</svg>`;
      
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgContent)));
    } catch (err) {
      console.warn('Fejl ved generering af miniature:', err);
      return null;
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        link: false,
        underline: false,
      }),
      CollapsibleHeadingExtension.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      CustomTextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      FontFamily,
      LineHeightExtension,
      ClearFormattingExtension,
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
      ResizableImage,
      ImageSafetyExtension,
      SearchAndReplaceExtension,
      Link.configure({ openOnClick: false }),
      SuggestionExtension,
      SpellCheckExtension,
    ],
    editorProps: {
      attributes: {
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
      },
      handleDrop: (view, event, slice, moved) => {
        // Safe internal node move (e.g. dragging an image within editor)
        let movedImageNode: any = null;
        if (moved && slice && slice.content) {
          slice.content.forEach((child: any) => {
            if (child.type.name === 'image') {
              movedImageNode = child;
            }
          });
        }
        if (movedImageNode) {
          event.preventDefault();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!coords) {
            // Dropped outside editor bounds: safely keep the image without deleting it
            return true;
          }

          try {
            const { tr } = view.state;
            let insertPos = dropPoint(tr.doc, coords.pos, slice);
            if (insertPos === null) {
              const $pos = tr.doc.resolve(coords.pos);
              insertPos = $pos.depth > 0 ? $pos.after($pos.depth) : coords.pos;
            }
            insertPos = Math.max(0, Math.min(insertPos, tr.doc.content.size));

            const draggingNode = (view as any).dragging?.node;
            if (draggingNode && typeof draggingNode.replace === 'function') {
              draggingNode.replace(tr);
            } else {
              tr.deleteSelection();
            }

            const mappedPos = Math.min(tr.mapping.map(insertPos), tr.doc.content.size);
            tr.insert(mappedPos, movedImageNode);

            const $newPos = tr.doc.resolve(mappedPos);
            if (NodeSelection.isSelectable(movedImageNode)) {
              tr.setSelection(new NodeSelection($newPos));
            }
            view.dispatch(tr);
            view.focus();
          } catch (err) {
            console.error('Fejl ved flytning af billede:', err);
          }
          return true;
        }

        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files);
          const imageFiles = files.filter(file => file.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            event.preventDefault();
            imageFiles.forEach(file => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (dataUrl) {
                  const { schema } = view.state;
                  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                  const node = schema.nodes.image.create({ src: dataUrl });
                  const transaction = view.state.tr.insert(coordinates?.pos ?? view.state.selection.from, node);
                  view.dispatch(transaction);
                }
              };
              reader.readAsDataURL(file);
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          const files = Array.from(event.clipboardData.files);
          const imageFiles = files.filter(file => file.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            event.preventDefault();
            imageFiles.forEach(file => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (dataUrl) {
                  const { schema } = view.state;
                  const node = schema.nodes.image.create({ src: dataUrl });
                  const transaction = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(transaction);
                }
              };
              reader.readAsDataURL(file);
            });
            return true;
          }
        }
        return false;
      },
    },
    content: sanitizeContent(fileData),
    onUpdate: () => {
      setSaveStatus(prev => prev === 'unsaved' ? prev : 'unsaved');

      // Snappy, non-blocking auto-save debounce (4000ms)
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSaveRef.current?.();
      }, 4000);

      // Intelligent automatisk baggrundsstavekontrol (debounced, silent, ultra-let for serveren)
      const settings = getSettings();
      if (settings.languageToolEnabled !== false && settings.languageToolAutoCheck !== false) {
        if (autoSpellTimeoutRef.current) {
          clearTimeout(autoSpellTimeoutRef.current);
        }
        const debounceDelay = Math.max(3500, settings.languageToolDebounceMs || 3500);
        autoSpellTimeoutRef.current = setTimeout(() => {
          runSpellCheckRef.current?.({ silent: true });
        }, debounceDelay);
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection;
      if (!empty && from !== to) {
        const selectedText = ed.state.doc.textBetween(from, to, '\n', '\n');
        window.dispatchEvent(new CustomEvent('editorContextSelection', { detail: selectedText }));
      } else {
        window.dispatchEvent(new CustomEvent('editorContextSelection', { detail: '' }));
      }
    },
    onCreate: ({ editor: ed }) => {
      if (ed?.view?.dom) {
        ed.view.dom.setAttribute('spellcheck', 'false');
        ed.view.dom.setAttribute('autocorrect', 'off');
        ed.view.dom.setAttribute('autocapitalize', 'off');
      }
    },
  });

  // Deaktiver browserens indbyggede stavekontrol helt, så kun LanguageTool styrer understregninger
  useEffect(() => {
    if (editor?.view?.dom) {
      editor.view.dom.setAttribute('spellcheck', 'false');
      editor.view.dom.setAttribute('autocorrect', 'off');
      editor.view.dom.setAttribute('autocapitalize', 'off');
    }
  }, [editor]);

  const handleToggleFormatPainter = useCallback(() => {
    if (!editor) return;
    if (formatPainter.active) {
      setFormatPainter({ active: false, format: null });
      return;
    }

    const marksToCopy: Array<{ type: string; attrs?: Record<string, any> }> = [];
    const textStyle = editor.getAttributes('textStyle');
    if (textStyle && Object.keys(textStyle).length > 0) {
      marksToCopy.push({ type: 'textStyle', attrs: textStyle });
    }
    ['bold', 'italic', 'underline', 'strike', 'highlight', 'subscript', 'superscript', 'link'].forEach(markName => {
      if (editor.isActive(markName)) {
        marksToCopy.push({ type: markName, attrs: editor.getAttributes(markName) });
      }
    });

    const blockAttrs: any = {};
    const paraAttrs = editor.getAttributes('paragraph');
    const headAttrs = editor.getAttributes('heading');
    const merged = { ...paraAttrs, ...headAttrs };
    if (merged.textAlign) blockAttrs.textAlign = merged.textAlign;
    if (merged.lineHeight) blockAttrs.lineHeight = merged.lineHeight;
    if (merged.paragraphSpacing) blockAttrs.paragraphSpacing = merged.paragraphSpacing;

    setFormatPainter({
      active: true,
      format: { marks: marksToCopy, blockAttrs },
    });
  }, [editor, formatPainter.active]);

  const handleEditorMouseUp = useCallback(() => {
    if (!formatPainter.active || !formatPainter.format || !editor) return;

    const { marks, blockAttrs } = formatPainter.format;
    const { state } = editor;
    const { empty } = state.selection;

    editor.chain().focus();

    if (!empty) {
      editor.commands.unsetAllMarks();
      marks.forEach(m => {
        if (m.type === 'textStyle') {
          editor.commands.setMark('textStyle', m.attrs);
        } else {
          editor.commands.setMark(m.type, m.attrs);
        }
      });
    }

    if (blockAttrs.textAlign) {
      editor.commands.setTextAlign(blockAttrs.textAlign);
    }
    if (blockAttrs.lineHeight) {
      (editor.commands as any).setLineHeight?.(blockAttrs.lineHeight);
    }
    if (blockAttrs.paragraphSpacing) {
      (editor.commands as any).setParagraphSpacing?.(blockAttrs.paragraphSpacing);
    }

    setFormatPainter({ active: false, format: null });
  }, [editor, formatPainter]);

  // Intelligent mapping from viewport coordinates to ProseMirror document position.
  // Handles X/Y clamping to allow seamless selection from outside/margins and across page borders.
  const getDocPosFromCoords = useCallback((view: any, clientX: number, clientY: number): number => {
    if (!view || !view.dom) return 0;
    const dom = view.dom as HTMLElement;
    const rect = dom.getBoundingClientRect();
    const doc = view.state.doc;
    const docSize = doc.content.size;
    if (docSize <= 0) return 0;

    // Above editor bounds entirely
    if (clientY <= rect.top) {
      return 0;
    }
    // Below editor bounds entirely
    if (clientY >= rect.bottom) {
      return docSize;
    }

    // Check first element top
    const firstChild = dom.firstElementChild as HTMLElement | null;
    if (firstChild) {
      const fRect = firstChild.getBoundingClientRect();
      if (clientY < fRect.top) return 0;
    }

    // Check last element bottom
    const lastChild = dom.lastElementChild as HTMLElement | null;
    if (lastChild) {
      const lRect = lastChild.getBoundingClientRect();
      if (clientY > lRect.bottom) return docSize;
    }

    const isToLeft = clientX < rect.left;
    const isToRight = clientX > rect.right;

    // Use exact clientX when within horizontal editor bounds.
    // In margins, test 1.5px inside edge so we hit directly at the first/last character.
    const clampedX = isToLeft
      ? rect.left + 1.5
      : isToRight
      ? rect.right - 1.5
      : clientX;
    const clampedY = Math.max(rect.top + 2, Math.min(rect.bottom - 2, clientY));

    let pos: number | null = null;
    const posInfo = view.posAtCoords({ left: clampedX, top: clampedY });
    if (posInfo && typeof posInfo.pos === 'number') {
      pos = posInfo.pos;
    }

    // If directly in spacing between block elements, probe slightly vertically
    if (pos === null) {
      for (const offset of [-6, 6, -12, 12, -20, 20]) {
        const testY = clampedY + offset;
        if (testY >= rect.top && testY <= rect.bottom) {
          const probeInfo = view.posAtCoords({ left: clampedX, top: testY });
          if (probeInfo && typeof probeInfo.pos === 'number') {
            pos = probeInfo.pos;
            break;
          }
        }
      }
    }

    // Fallback: find nearest child block element
    if (pos === null) {
      let closestPos = clientY < rect.top + rect.height / 2 ? 0 : docSize;
      let minDistance = Infinity;
      for (let i = 0; i < dom.children.length; i++) {
        const child = dom.children[i] as HTMLElement;
        if (!child.getBoundingClientRect) continue;
        const cRect = child.getBoundingClientRect();
        const midY = (cRect.top + cRect.bottom) / 2;
        const dist = Math.abs(clientY - midY);
        if (dist < minDistance) {
          minDistance = dist;
          const childPosInfo = view.posAtCoords({ left: clampedX, top: midY });
          if (childPosInfo && typeof childPosInfo.pos === 'number') {
            closestPos = childPosInfo.pos;
          }
        }
      }
      pos = closestPos;
    }

    // If mouse is in the left margin, ensure we are at the very beginning of this visual line
    if (isToLeft && typeof pos === 'number' && pos > 0) {
      try {
        const curCoords = view.coordsAtPos(pos);
        // Step back while on the exact same visual line (same vertical top within 6px) and to the left
        while (pos > 0) {
          const prevCoords = view.coordsAtPos(pos - 1);
          if (Math.abs(curCoords.top - prevCoords.top) < 6 && prevCoords.left < curCoords.left) {
            pos = pos - 1;
          } else {
            break;
          }
        }
      } catch {
        try {
          const $pos = doc.resolve(pos);
          if ($pos.parentOffset <= 1) {
            pos = $pos.start();
          }
        } catch {}
      }
    }

    // If mouse is in the right margin, ensure we are at the very end of this visual line
    if (isToRight && typeof pos === 'number' && pos < docSize) {
      try {
        const curCoords = view.coordsAtPos(pos);
        // Step forward while on the exact same visual line and to the right
        while (pos < docSize) {
          const nextCoords = view.coordsAtPos(pos + 1);
          if (Math.abs(curCoords.top - nextCoords.top) < 6 && nextCoords.left > curCoords.left) {
            pos = pos + 1;
          } else {
            break;
          }
        }
      } catch {
        try {
          const $pos = doc.resolve(pos);
          if ($pos.parentOffset >= $pos.parent.content.size - 1) {
            pos = $pos.end();
          }
        } catch {}
      }
    }

    return pos ?? 0;
  }, []);

  const createSafeSelection = useCallback((doc: any, anchor: number, head: number) => {
    const safeAnchor = Math.max(0, Math.min(anchor, doc.content.size));
    const safeHead = Math.max(0, Math.min(head, doc.content.size));
    try {
      const $anchor = doc.resolve(safeAnchor);
      const $head = doc.resolve(safeHead);
      return TextSelection.between($anchor, $head);
    } catch {
      try {
        return TextSelection.create(doc, safeAnchor, safeHead);
      } catch {
        return Selection.near(doc.resolve(safeAnchor));
      }
    }
  }, []);

  const stopSelectionDrag = useCallback(() => {
    isDraggingSelectionRef.current = false;
    hasMovedBeyondThresholdRef.current = false;
    dragStartedOutsideRef.current = false;
    hasLeftEditorRef.current = false;
    dragAnchorPosRef.current = null;
    lastMousePosRef.current = null;
    autoScrollSpeedRef.current = 0;
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const handleCanvasContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !editor || !editor.view) return;

    const targetEl = e.target as HTMLElement | null;
    if (targetEl) {
      // Don't intercept clicks on buttons, inputs, modals, image resizing handles or dropdowns
      if (
        targetEl.closest('button, input, select, textarea, [data-resize-handle], .imageResizer, .tableDropdown, a, [data-suggestion-ui]') ||
        targetEl.tagName === 'BUTTON' ||
        targetEl.tagName === 'INPUT'
      ) {
        return;
      }
    }

    const view = editor.view;
    const isInsideEditor = view.dom.contains(targetEl);

    isDraggingSelectionRef.current = true;
    dragStartCoordsRef.current = { x: e.clientX, y: e.clientY };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedBeyondThresholdRef.current = false;
    hasLeftEditorRef.current = false;

    if (!isInsideEditor) {
      // Click started in margin, canvas padding or container outside text
      dragStartedOutsideRef.current = true;
      const startPos = getDocPosFromCoords(view, e.clientX, e.clientY);
      dragAnchorPosRef.current = startPos;
      e.preventDefault(); // Stop default container drag
      view.focus();

      // Place cursor at the line boundary immediately
      try {
        const tr = view.state.tr;
        const sel = createSafeSelection(view.state.doc, startPos, startPos);
        view.dispatch(tr.setSelection(sel));
      } catch (err) {
        console.warn('Fejl ved markørplacering:', err);
      }
    } else {
      dragStartedOutsideRef.current = false;
      // Do not pre-set dragAnchorPosRef; let ProseMirror establish the exact native anchor on mousedown
      dragAnchorPosRef.current = null;
    }
  }, [editor, getDocPosFromCoords, createSafeSelection]);

  // Window-level mouse tracking for drag selection (auto-scroll, margin selection, edge dragging)
  useEffect(() => {
    if (!editor) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingSelectionRef.current || !editor || !editor.view) return;

      // If mouse button was released outside window
      if (e.buttons !== 1) {
        stopSelectionDrag();
        return;
      }

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      const view = editor.view;
      const startCoords = dragStartCoordsRef.current;

      if (!hasMovedBeyondThresholdRef.current) {
        if (Math.hypot(e.clientX - startCoords.x, e.clientY - startCoords.y) > 4) {
          hasMovedBeyondThresholdRef.current = true;
          // Capture exact native anchor from ProseMirror if drag started inside editor
          if (!dragStartedOutsideRef.current && dragAnchorPosRef.current === null) {
            dragAnchorPosRef.current = view.state.selection.anchor;
          }
        } else {
          return;
        }
      }

      const rect = view.dom.getBoundingClientRect();
      const isOutsideBounds =
        e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;

      if (isOutsideBounds) {
        hasLeftEditorRef.current = true;
      }

      // If drag started outside OR mouse has moved outside editor boundary:
      // take over and ensure smooth selection clamping all the way to line/doc edges
      if (dragStartedOutsideRef.current || hasLeftEditorRef.current) {
        const anchor = dragAnchorPosRef.current !== null ? dragAnchorPosRef.current : view.state.selection.anchor;
        const currentPos = getDocPosFromCoords(view, e.clientX, e.clientY);

        try {
          const tr = view.state.tr;
          const sel = createSafeSelection(view.state.doc, anchor, currentPos);
          view.dispatch(tr.setSelection(sel));
        } catch (err) {
          console.warn('Fejl ved opdatering af trækmarkering:', err);
        }
      }

      // Handle auto-scroll near edges
      if (canvasContainerRef.current) {
        const containerRect = canvasContainerRef.current.getBoundingClientRect();
        const edgeThreshold = 45;
        let speed = 0;

        if (e.clientY > containerRect.bottom - edgeThreshold) {
          const overflow = e.clientY - (containerRect.bottom - edgeThreshold);
          speed = Math.min(28, Math.max(4, overflow * 0.45));
        } else if (e.clientY < containerRect.top + edgeThreshold) {
          const overflow = (containerRect.top + edgeThreshold) - e.clientY;
          speed = -Math.min(28, Math.max(4, overflow * 0.45));
        }

        autoScrollSpeedRef.current = speed;

        if (speed !== 0 && !autoScrollRafRef.current) {
          const scrollStep = () => {
            if (!isDraggingSelectionRef.current || !canvasContainerRef.current || autoScrollSpeedRef.current === 0) {
              autoScrollRafRef.current = null;
              return;
            }

            canvasContainerRef.current.scrollTop += autoScrollSpeedRef.current;

            // Re-evaluate selection at current mouse position after scrolling
            if (editor && editor.view && lastMousePosRef.current && dragAnchorPosRef.current !== null) {
              const currentPos = getDocPosFromCoords(editor.view, lastMousePosRef.current.x, lastMousePosRef.current.y);
              try {
                const tr = editor.view.state.tr;
                const sel = createSafeSelection(editor.view.state.doc, dragAnchorPosRef.current, currentPos);
                editor.view.dispatch(tr.setSelection(sel));
              } catch {}
            }

            autoScrollRafRef.current = requestAnimationFrame(scrollStep);
          };
          autoScrollRafRef.current = requestAnimationFrame(scrollStep);
        } else if (speed === 0 && autoScrollRafRef.current) {
          cancelAnimationFrame(autoScrollRafRef.current);
          autoScrollRafRef.current = null;
        }
      }
    };

    const handleWindowMouseUp = () => {
      if (!isDraggingSelectionRef.current) return;
      const hadMoved = hasMovedBeyondThresholdRef.current;
      stopSelectionDrag();

      if (hadMoved && formatPainter.active && formatPainter.format) {
        handleEditorMouseUp();
      }
    };

    const handleDragStart = () => {
      // HTML5 drag (e.g. image drag) started, cancel selection drag
      stopSelectionDrag();
    };

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('dragstart', handleDragStart);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('dragstart', handleDragStart);
      stopSelectionDrag();
    };
  }, [editor, getDocPosFromCoords, createSafeSelection, stopSelectionDrag, formatPainter, handleEditorMouseUp]);

  // Sync fileData KUN hvis den er opdateret udefra (ikke af vores egen autosave/tastning)
  useEffect(() => {
    if (!editor || fileData === undefined || fileData === null) return;
    if (fileData === lastSelfSavedHtmlRef.current) return;

    // Hvis brugeren er i gang med at skrive (editoren har fokus), må vi ALDRIG overskrive dokumentet og flytte markøren!
    if (editor.isFocused) return;

    const sanitized = sanitizeContent(fileData);
    if (editor.getHTML() !== sanitized) {
      lastSelfSavedHtmlRef.current = fileData;
      editor.commands.setContent(sanitized, { emitUpdate: false });
    }
  }, [fileData, editor]);

  // Sikkerhedsnet: Hvis dokumentet er åbnet med docId, men fileData mangler eller var tomt metadata, hent det fulde indhold
  useEffect(() => {
    let isCancelled = false;
    if (docId && (!fileData || fileData.trim() === '' || fileData === '<p></p>')) {
      getDocument(docId).then(fullDoc => {
        if (isCancelled || !fullDoc || !fullDoc.content || !editor) return;
        if (!editor.isFocused && (editor.isEmpty || editor.getHTML() === '<p></p>')) {
          const sanitized = sanitizeContent(fullDoc.content);
          lastSelfSavedHtmlRef.current = fullDoc.content;
          editor.commands.setContent(sanitized, { emitUpdate: false });
        }
      }).catch(err => {
        console.warn('Defensiv indlæsning af dokument-indhold fejlede:', err);
      });
    }
    return () => { isCancelled = true; };
  }, [docId, fileData, editor]);

  // Håndter værktøjskald fra AI assistenten (Exact String Match & DocumentEditor)
  useEffect(() => {
    if (!editor) return;

    (window as any).__activeWordEditor = editor;
    (window as any).__tiptapHtmlToMarkdown = tiptapHtmlToMarkdown;
    (window as any).__textToTipTapHtml = textToTipTapHtml;

    const createAiSuggestion = (params: {
      type: 'replacement' | 'deletion' | 'addition';
      from?: number;
      to?: number;
      originalText?: string;
      suggestedText?: string;
      comment?: string;
    }): { success: boolean; message: string } => {
      const suggestionId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createdAt = new Date().toISOString();
      const author = 'AI Assistent';
      const { type, originalText = '', suggestedText = '', comment } = params;
      let { from, to } = params;

      if (type === 'addition') {
        const insertPos = typeof from === 'number' ? from : (typeof to === 'number' ? to : editor.state.selection.to);
        const html = textToTipTapHtml(suggestedText);
        const prevSize = editor.state.doc.content.size;

        editor.chain().focus().insertContentAt(insertPos, html).run();

        const newSize = editor.state.doc.content.size;
        const addedLen = newSize - prevSize;

        if (addedLen > 0) {
          const markAddition = editor.schema.marks.suggestion.create({
            suggestionId,
            suggestionType: 'addition',
            originalText: '',
            suggestedText,
            comment: comment || 'AI forslag til tilføjelse',
            createdAt,
            author,
          });
          const tr = editor.state.tr;
          tr.addMark(insertPos, insertPos + addedLen, markAddition);
          editor.view.dispatch(tr);
        }
      } else if (type === 'deletion') {
        if (typeof from !== 'number' || typeof to !== 'number' || from >= to) {
          return { success: false, message: 'Fejl: Ugyldigt interval til sletning.' };
        }
        const markDeletion = editor.schema.marks.suggestion.create({
          suggestionId,
          suggestionType: 'deletion',
          originalText,
          suggestedText: '',
          comment: comment || 'AI forslag til sletning',
          createdAt,
          author,
        });
        const tr = editor.state.tr;
        tr.addMark(from, to, markDeletion);
        editor.view.dispatch(tr);
      } else if (type === 'replacement') {
        if (typeof from !== 'number' || typeof to !== 'number' || from >= to) {
          return { success: false, message: 'Fejl: Ugyldigt interval til erstatning.' };
        }

        // 1. Markér den oprindelige tekst som sletning (rød overstregning i Google Docs stil)
        const markDeletion = editor.schema.marks.suggestion.create({
          suggestionId,
          suggestionType: 'deletion',
          originalText,
          suggestedText,
          comment: comment || 'AI forslag til ændring',
          createdAt,
          author,
        });
        const tr = editor.state.tr;
        tr.addMark(from, to, markDeletion);
        editor.view.dispatch(tr);

        // 2. Indsæt den nye tekst umiddelbart efter to
        const insertPos = to;
        const html = textToTipTapHtml(suggestedText);
        const prevSize = editor.state.doc.content.size;

        editor.chain().focus().insertContentAt(insertPos, html).run();

        const newSize = editor.state.doc.content.size;
        const addedLen = newSize - prevSize;

        // 3. Markér den nyligt indsatte tekst som tilføjelse (grøn understregning i Google Docs stil)
        if (addedLen > 0) {
          const markAddition = editor.schema.marks.suggestion.create({
            suggestionId,
            suggestionType: 'addition',
            originalText,
            suggestedText,
            comment: comment || 'AI forslag til ændring',
            createdAt,
            author,
          });
          const tr2 = editor.state.tr;
          tr2.addMark(insertPos, insertPos + addedLen, markAddition);
          editor.view.dispatch(tr2);
        }
      }

      const newSug: SuggestionItem = {
        id: suggestionId,
        type,
        originalText,
        suggestedText,
        comment: comment || (type === 'deletion' ? 'AI forslag til sletning' : type === 'addition' ? 'AI forslag til tilføjelse' : 'AI forslag til ændring'),
        createdAt,
        author,
      };

      setSuggestions(prev => {
        const updated = [newSug, ...prev];
        window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: updated }));
        return updated;
      });
      setActiveSuggestionId(suggestionId);
      setSaveStatus('unsaved');

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSaveRef.current?.(undefined, false);
      }, 800);

      return {
        success: true,
        message: type === 'deletion'
          ? `Succes: Oprettede forslag om at slette '${originalText}'.`
          : type === 'addition'
          ? `Succes: Oprettede forslag om at tilføje tekst.`
          : `Succes: Oprettede forslag om at erstatte '${originalText}' med den nye tekst.`,
      };
    };

    const executeTipTapReplace = (exactText: string, newText: string) => {
      if (typeof exactText !== 'string' || exactText.length === 0) {
        return { success: false, message: "Fejl: Mangler 'exact_text_to_replace'." };
      }

      const replacement = typeof newText === 'string' ? newText : '';
      const { state } = editor.view;
      const doc = state.doc;
      const { from, to, empty } = state.selection;

      // 1. Hvis markeringen matcher
      if (!empty) {
        const selectedText = doc.textBetween(from, to, '\n', '\n');
        if (
          selectedText === exactText ||
          selectedText.trim() === exactText.trim() ||
          exactText.includes(selectedText)
        ) {
          return createAiSuggestion({
            type: replacement === '' ? 'deletion' : 'replacement',
            from,
            to,
            originalText: selectedText,
            suggestedText: replacement,
            comment: replacement === '' ? 'AI sletning af markering' : 'AI forslag til markering',
          });
        }
      }

      // Rens eventuelle Markdown-tags fra søgeteksten, så det matcher TipTap tekstelementer
      const cleanTarget = exactText
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/<u>(.*?)<\/u>/g, '$1')
        .trim();

      // 2. Hurtig søgning i enkelt tekstknude
      let singleNodeRange: { from: number; to: number; matchedText: string } | null = null;
      doc.descendants((node: any, pos: number) => {
        if (singleNodeRange) return false;
        if (node.isText && node.text) {
          const idxExact = node.text.indexOf(exactText);
          if (idxExact !== -1) {
            singleNodeRange = {
              from: pos + idxExact,
              to: pos + idxExact + exactText.length,
              matchedText: exactText,
            };
            return false;
          }
          if (cleanTarget && cleanTarget !== exactText) {
            const idxClean = node.text.indexOf(cleanTarget);
            if (idxClean !== -1) {
              singleNodeRange = {
                from: pos + idxClean,
                to: pos + idxClean + cleanTarget.length,
                matchedText: cleanTarget,
              };
              return false;
            }
          }
        }
      });

      if (singleNodeRange) {
        const sr = singleNodeRange as { from: number; to: number; matchedText: string };
        let targetFrom = sr.from;
        let targetTo = sr.to;
        return createAiSuggestion({
          type: replacement === '' ? 'deletion' : 'replacement',
          from: targetFrom,
          to: targetTo,
          originalText: sr.matchedText,
          suggestedText: replacement,
          comment: replacement === '' ? 'AI sletning' : 'AI forslag til ændring',
        });
      }

      // 3. Tværgående søgning over blokke/knuder med fleksibel whitespace
      const chars: { char: string; from: number; to: number }[] = [];
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text) {
          for (let i = 0; i < node.text.length; i++) {
            chars.push({ char: node.text[i], from: pos + i, to: pos + i + 1 });
          }
        } else if (node.isBlock && chars.length > 0) {
          const last = chars[chars.length - 1];
          if (last && last.char !== '\n') {
            chars.push({ char: '\n', from: pos, to: pos });
          }
        }
      });

      const docText = chars.map(c => c.char).join('');
      const targetSearch = (cleanTarget || exactText).trim();
      const words = targetSearch.split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      if (words.length > 0) {
        const pattern = words.join('\\s+');
        const re = new RegExp(pattern, 'i');
        const match = re.exec(docText);

        if (match) {
          const startChar = chars[match.index];
          const endChar = chars[match.index + match[0].length - 1];
          let targetFrom = startChar.from;
          let targetTo = endChar.to;

          return createAiSuggestion({
            type: replacement === '' ? 'deletion' : 'replacement',
            from: targetFrom,
            to: targetTo,
            originalText: targetSearch,
            suggestedText: replacement,
            comment: replacement === '' ? 'AI sletning' : 'AI forslag til ændring',
          });
        }
      }

      // 4. Case-insensitive fallback
      const docLower = docText.toLowerCase();
      const searchLower = (cleanTarget || exactText).trim().toLowerCase();
      const lowerIdx = docLower.indexOf(searchLower);
      if (lowerIdx !== -1 && chars[lowerIdx] && chars[lowerIdx + searchLower.length - 1]) {
        const targetFrom = chars[lowerIdx].from;
        const targetTo = chars[lowerIdx + searchLower.length - 1].to;
        return createAiSuggestion({
          type: replacement === '' ? 'deletion' : 'replacement',
          from: targetFrom,
          to: targetTo,
          originalText: docText.slice(lowerIdx, lowerIdx + searchLower.length),
          suggestedText: replacement,
          comment: replacement === '' ? 'AI sletning' : 'AI forslag til ændring',
        });
      }

      // 5. Hvis brugeren havde en markering og bad om at slette den
      if (!empty && (exactText === '' || exactText.toLowerCase().includes('markering'))) {
        const selText = doc.textBetween(from, to, '\n', '\n');
        return createAiSuggestion({
          type: 'deletion',
          from,
          to,
          originalText: selText,
          suggestedText: '',
          comment: 'AI sletning af markering',
        });
      }

      return {
        success: false,
        message: `Error: Could not find the exact text '${exactText}' in the document. Please try again with the exact wording and punctuation.`,
      };
    };

    const executeTipTapAppend = (textToAdd: string) => {
      if (typeof textToAdd !== 'string' || textToAdd.trim().length === 0) {
        return { success: false, message: "Fejl: Mangler 'text_to_add'." };
      }
      const endPos = editor.state.doc.content.size;
      return createAiSuggestion({
        type: 'addition',
        from: endPos,
        to: endPos,
        originalText: '',
        suggestedText: textToAdd,
        comment: 'AI forslag til tilføjelse til slutning',
      });
    };

    // Lyt efter det nye strukturerede executeEditorTool event
    const handleExecuteTool = (e: any) => {
      const { toolName, args, callback } = e.detail || {};
      let result = { success: false, message: '' };

      if (toolName === 'replace_entire_document') {
        const newContent = args?.new_content;
        if (typeof newContent !== 'string' || newContent.trim().length === 0) {
          result = { success: false, message: "Fejl: Mangler indhold i 'new_content'." };
        } else {
          const doc = editor.state.doc;
          const docSize = doc.content.size;
          const isDocEmpty = doc.textContent.trim().length === 0;

          if (isDocEmpty) {
            result = createAiSuggestion({
              type: 'addition',
              from: 0,
              to: 0,
              suggestedText: newContent,
              comment: 'AI nyt indhold',
            });
          } else {
            result = createAiSuggestion({
              type: 'replacement',
              from: 0,
              to: docSize,
              originalText: doc.textContent.slice(0, 80) + (doc.textContent.length > 80 ? '...' : ''),
              suggestedText: newContent,
              comment: 'AI forslag til hele dokumentet',
            });
          }
        }
      } else if (toolName === 'replace_selected_text') {
        const newText = args?.new_text;
        if (typeof newText !== 'string' || newText.trim().length === 0) {
          result = { success: false, message: "Fejl: Mangler opdateret tekst i 'new_text'." };
        } else if (editor.state.selection.empty) {
          if (args?.original_text && typeof args.original_text === 'string') {
            result = executeTipTapReplace(args.original_text, newText);
          } else {
            result = { success: false, message: "Fejl: Ingen aktiv tekstmarkering i dokumentet." };
          }
        } else {
          const { from, to } = editor.state.selection;
          const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n');
          result = createAiSuggestion({
            type: 'replacement',
            from,
            to,
            originalText: selectedText,
            suggestedText: newText,
            comment: 'AI forslag til markering',
          });
        }
      } else if (toolName === 'clear_formatting') {
        if (editor.state.selection.empty) {
          editor.chain().focus().selectAll().unsetAllMarks().clearNodes().run();
          result = { success: true, message: "Succes: Formatering for hele dokumentet er fjernet, og teksten er bevaret." };
        } else {
          editor.chain().focus().unsetAllMarks().clearNodes().run();
          result = { success: true, message: "Succes: Formateringen er fjernet, og teksten er bevaret." };
        }
      } else if (toolName === 'delete_selected_text') {
        if (editor.state.selection.empty) {
          result = { success: false, message: "Fejl: Ingen aktiv markering at slette." };
        } else {
          const { from, to } = editor.state.selection;
          const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n');
          result = createAiSuggestion({
            type: 'deletion',
            from,
            to,
            originalText: selectedText,
            suggestedText: '',
            comment: 'AI sletning af markering',
          });
        }
      } else if (toolName === 'replace_text') {
        result = executeTipTapReplace(args?.exact_text_to_replace ?? '', args?.new_text ?? '');
      } else if (toolName === 'append_text') {
        result = executeTipTapAppend(args?.text_to_add ?? '');
      } else if (toolName === 'insert_text' || toolName === 'insert_at_cursor') {
        const textToInsert = args?.text ?? args?.text_to_insert ?? args?.new_text ?? '';
        if (typeof textToInsert !== 'string' || textToInsert.trim().length === 0) {
          result = { success: false, message: "Fejl: Mangler tekst at indsætte." };
        } else {
          const cursor = editor.state.selection.to;
          result = createAiSuggestion({
            type: 'addition',
            from: cursor,
            to: cursor,
            originalText: '',
            suggestedText: textToInsert,
            comment: 'AI forslag til tilføjelse',
          });
        }
      } else {
        result = { success: false, message: `Ukendt værktøj '${toolName}'.` };
      }

      if (typeof callback === 'function') {
        callback(result);
      }
    };

    // Lyt efter legacy executeEditorReplace event
    const handleExecuteReplace = (e: any) => {
      const content = e.detail;
      if (typeof content === 'string' && content.trim().length > 0) {
        createAiSuggestion({
          type: 'addition',
          suggestedText: content,
          comment: 'AI forslag',
        });
      }
    };

    // Lyt efter tale-til-tekst indsættelse ved cursor
    window.addEventListener('executeEditorTool', handleExecuteTool);
    window.addEventListener('executeEditorReplace', handleExecuteReplace);

    return () => {
      if ((window as any).__activeWordEditor === editor) {
        (window as any).__activeWordEditor = null;
        (window as any).__tiptapHtmlToMarkdown = null;
        (window as any).__textToTipTapHtml = null;
      }
      window.removeEventListener('executeEditorTool', handleExecuteTool);
      window.removeEventListener('executeEditorReplace', handleExecuteReplace);
    };
  }, [editor]);

  const handleToggleTheme = useCallback(() => {
    setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const handleToggleFocusMode = useCallback(() => {
    setIsFocusMode(prev => {
      const next = !prev;
      if (next) {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFocusMode]);

  const handleSave = useCallback(async (customTitle?: string, forceThumbnail = false) => {
    if (!editor) return;
    const currentTitle = customTitle !== undefined ? customTitle : title;
    const content = editor.getHTML();
    lastSelfSavedHtmlRef.current = content;
    
    setSaveStatus('saving');
    try {
      const now = Date.now();
      let thumbnail: string | undefined = undefined;

      // Capture thumbnail ONLY on explicit manual save, closing document, or when forced
      if (forceThumbnail && canvasRef.current) {
        const captured = await captureThumbnail(canvasRef.current);
        if (captured) {
          thumbnail = captured;
          lastThumbnailTimeRef.current = now;
        }
      }

      let activeId = currentDocId;
      if (!activeId) {
        // Document didn't have an ID yet, create one on the server!
        const created = await createDocument(currentTitle, content, currentFolderId, [], null, isSavedLocallyState);
        if (created && created.id) {
          activeId = created.id;
          setCurrentDocId(created.id);
          if (created.folderId !== undefined) {
            setCurrentFolderId(created.folderId);
          }
          if (thumbnail) {
            await saveDocument(activeId, currentTitle, content, thumbnail, undefined, created.folderId !== undefined ? created.folderId : currentFolderId, undefined, undefined, undefined, undefined, isSavedLocallyState);
          }
        }
      } else {
        await saveDocument(activeId, currentTitle, content, thumbnail, undefined, currentFolderId, undefined, undefined, undefined, undefined, isSavedLocallyState);
      }
      if (onSave) {
        await onSave(content, currentTitle);
      }

      // Snapshot creation logic for version history (optimized to avoid UI stalls)
      if (activeId && content && content !== lastSnapshotContentRef.current) {
        const timeSinceLast = now - lastSnapshotTimeRef.current;
        const charDiff = Math.abs(content.length - lastSnapshotContentRef.current.length);
        
        // Save snapshot if:
        // 1. Force save (manual Ctrl+S or Gem-knap)
        // 2. Significant edit (>= 300 chars difference and at least 60s)
        // 3. Or more than 5 minutes have passed since last snapshot
        // 4. Or initial snapshot for doc
        if (forceThumbnail || (charDiff >= 300 && timeSinceLast >= 60000) || timeSinceLast >= 300000 || !lastSnapshotContentRef.current) {
          const plainText = content.replace(/<[^>]*>/g, ' ');
          const words = plainText.match(/\S+/g);
          const wordCount = words ? words.length : 0;
          const label = forceThumbnail ? 'Manuelt gemt' : (charDiff >= 300 ? 'Større ændring' : 'Automatisk snapshot');

          createVersionSnapshot(
            activeId,
            currentTitle,
            content,
            label,
            wordCount,
            plainText.length
          ).catch((err: any) => console.warn('Kunne ikke oprette snapshot:', err));

          lastSnapshotContentRef.current = content;
          lastSnapshotTimeRef.current = now;
        }
      }

      setSaveStatus('saved');
    } catch (err) {
      console.error('Fejl ved gem:', err);
      setSaveStatus('error');
    }
  }, [editor, currentDocId, title, onSave, currentFolderId, isSavedLocallyState]);

  const handleRestoreVersion = useCallback((version: DocumentVersion) => {
    if (!editor) return;

    // Safety snapshot of current state before replacing
    const currentContent = editor.getHTML();
    if (currentDocId && currentContent && currentContent !== version.content) {
      const tempEl = document.createElement('div');
      tempEl.innerHTML = currentContent;
      const text = tempEl.textContent || tempEl.innerText || '';
      createVersionSnapshot(
        currentDocId,
        title,
        currentContent,
        'Sikkerhedskopi før gendannelse',
        text.trim() ? text.trim().split(/\s+/).length : 0,
        text.length
      ).catch(() => {});
    }

    // Set restored content in editor
    editor.commands.setContent(version.content || '<p></p>');
    if (version.title && version.title !== title) {
      setTitle(version.title);
      onTitleChange?.(version.title);
    }

    lastSnapshotContentRef.current = version.content;
    lastSnapshotTimeRef.current = Date.now();

    // Trigger save with restored content
    setTimeout(() => {
      handleSaveRef.current?.(version.title, true);
    }, 100);
  }, [editor, currentDocId, title, onTitleChange]);

  const handleCreateCopyFromVersion = useCallback(async (version: DocumentVersion) => {
    const copyTitle = `${version.title || 'Dokument'} (Kopi af version)`;
    try {
      await createDocument(copyTitle, version.content);
      alert(`Kopien "${copyTitle}" er oprettet!`);
    } catch (err) {
      console.error('Fejl ved oprettelse af kopi fra version:', err);
    }
  }, []);

  handleSaveRef.current = handleSave;

  // Flush pending auto-save on blur or component unmount (without freezing UI with html2canvas)
  useEffect(() => {
    const handleWindowBlur = () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        handleSaveRef.current?.(undefined, false);
      }
    };
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        handleSaveRef.current?.(undefined, false);
      }
    };
  }, []);

  // Extract initial suggestions from document marks when editor is ready or document changes
  useEffect(() => {
    if (!editor) return;
    const map = new Map<string, SuggestionItem>();
    editor.state.doc.descendants((node: any) => {
      if (node.isText && node.marks) {
        const mark = node.marks.find((m: any) => m.type.name === 'suggestion');
        if (mark && mark.attrs.suggestionId) {
          const id = mark.attrs.suggestionId;
          const markType = mark.attrs.suggestionType || 'replacement';
          if (!map.has(id)) {
            map.set(id, {
              id,
              type: markType,
              originalText: mark.attrs.originalText || (markType === 'deletion' ? node.text : '') || '',
              suggestedText: mark.attrs.suggestedText || (markType === 'addition' ? node.text : '') || '',
              comment: mark.attrs.comment || '',
              createdAt: mark.attrs.createdAt || new Date().toISOString(),
              author: mark.attrs.author || (id.startsWith('ai-') ? 'AI Assistent' : id.startsWith('lt-') ? 'LanguageTool' : undefined),
            });
          } else {
            const existing = map.get(id)!;
            if (!existing.originalText && mark.attrs.originalText) {
              existing.originalText = mark.attrs.originalText;
            }
            if (!existing.suggestedText && mark.attrs.suggestedText) {
              existing.suggestedText = mark.attrs.suggestedText;
            }
            if (mark.attrs.suggestionType && mark.attrs.suggestionType !== existing.type) {
              existing.type = 'replacement';
            }
          }
        }
      }
    });
    const loadedList = Array.from(map.values());
    setSuggestions(loadedList);
    window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: loadedList }));
  }, [editor, currentDocId]);

  const handleCreateSuggestion = useCallback((data: SuggestionSubmitData) => {
    if (!editor) return;
    const { originalText, suggestedText, comment, range } = data;
    const suggestionId = `sug-${Date.now()}`;

    // Apply suggestion mark to selection in TipTap
    editor
      .chain()
      .focus()
      .setTextSelection(range)
      .setMark('suggestion', {
        suggestionId,
        originalText,
        suggestedText,
        comment,
        createdAt: new Date().toISOString(),
      })
      .run();

    const newSuggestion: SuggestionItem = {
      id: suggestionId,
      originalText,
      suggestedText,
      comment,
      createdAt: new Date().toISOString(),
    };

    setSuggestions(prev => [newSuggestion, ...prev]);
    setActiveSuggestionId(suggestionId);
    setSaveStatus('unsaved');

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveRef.current?.(undefined, false);
    }, 800);
  }, [editor]);

  const handleAcceptSuggestion = useCallback((id: string) => {
    if (!editor) return;

    const targetSug = suggestions.find(s => s.id === id);
    const { tr, doc } = editor.state;
    const deletions: { from: number; to: number }[] = [];
    let hasMatchingMark = false;

    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        const mark = node.marks.find((m: any) => m.type.name === 'suggestion' && m.attrs.suggestionId === id);
        if (mark) {
          hasMatchingMark = true;
          const type = mark.attrs.suggestionType;
          if (type === 'deletion') {
            deletions.push({ from: pos, to: pos + node.nodeSize });
          } else if (type === 'addition') {
            tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.suggestion);
          } else {
            // legacy single mark replacement
            if (targetSug?.suggestedText) {
              tr.insertText(targetSug.suggestedText, pos, pos + node.nodeSize);
            }
            tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.suggestion);
          }
        }
      }
    });

    if (hasMatchingMark) {
      deletions.sort((a, b) => b.from - a.from);
      deletions.forEach(r => {
        tr.delete(r.from, r.to);
      });
      editor.view.dispatch(tr);
    }

    const updated = suggestions.filter(s => s.id !== id);
    setSuggestions(updated);
    setActiveSuggestionId(prev => prev === id ? null : prev);
    setSaveStatus('unsaved');
    window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: updated }));

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveRef.current?.(undefined, false);
    }, 800);
  }, [editor, suggestions]);

  const handleRejectSuggestion = useCallback((id: string) => {
    if (!editor) return;

    const { tr, doc } = editor.state;
    const additions: { from: number; to: number }[] = [];
    let hasMatchingMark = false;

    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        const mark = node.marks.find((m: any) => m.type.name === 'suggestion' && m.attrs.suggestionId === id);
        if (mark) {
          hasMatchingMark = true;
          const type = mark.attrs.suggestionType;
          if (type === 'addition') {
            additions.push({ from: pos, to: pos + node.nodeSize });
          } else {
            // deletion eller legacy: fjern markering så original tekst forbliver normal tekst
            tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.suggestion);
          }
        }
      }
    });

    if (hasMatchingMark) {
      additions.sort((a, b) => b.from - a.from);
      additions.forEach(r => {
        tr.delete(r.from, r.to);
      });
      editor.view.dispatch(tr);
    }

    const updated = suggestions.filter(s => s.id !== id);
    setSuggestions(updated);
    setActiveSuggestionId(prev => prev === id ? null : prev);
    setSaveStatus('unsaved');
    window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: updated }));

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveRef.current?.(undefined, false);
    }, 800);
  }, [editor, suggestions]);

  const handleAcceptAllSuggestions = useCallback(() => {
    if (!editor) return;

    const { tr, doc } = editor.state;
    const deletions: { from: number; to: number }[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        const mark = node.marks.find((m: any) => m.type.name === 'suggestion');
        if (mark) {
          const type = mark.attrs.suggestionType;
          if (type === 'deletion') {
            deletions.push({ from: pos, to: pos + node.nodeSize });
          } else {
            tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.suggestion);
          }
        }
      }
    });

    deletions.sort((a, b) => b.from - a.from);
    deletions.forEach(r => {
      tr.delete(r.from, r.to);
    });

    editor.view.dispatch(tr);
    setSuggestions([]);
    setActiveSuggestionId(null);
    setSaveStatus('unsaved');
    window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: [] }));

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveRef.current?.(undefined, false);
    }, 800);
  }, [editor]);

  const handleRejectAllSuggestions = useCallback(() => {
    if (!editor) return;

    const { tr, doc } = editor.state;
    const additions: { from: number; to: number }[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        const mark = node.marks.find((m: any) => m.type.name === 'suggestion');
        if (mark) {
          const type = mark.attrs.suggestionType;
          if (type === 'addition') {
            additions.push({ from: pos, to: pos + node.nodeSize });
          } else {
            tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.suggestion);
          }
        }
      }
    });

    additions.sort((a, b) => b.from - a.from);
    additions.forEach(r => {
      tr.delete(r.from, r.to);
    });

    editor.view.dispatch(tr);
    setSuggestions([]);
    setActiveSuggestionId(null);
    setSaveStatus('unsaved');
    window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: [] }));

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveRef.current?.(undefined, false);
    }, 800);
  }, [editor]);

  // Lyt efter globale events til masse-godkendelse og afvisning af forslag (f.eks. fra AI baren i bunden)
  useEffect(() => {
    const handleAcceptAll = () => {
      handleAcceptAllSuggestions();
    };

    const handleRejectAll = () => {
      handleRejectAllSuggestions();
    };

    const handleQuery = () => {
      window.dispatchEvent(new CustomEvent('word:suggestions-updated', { detail: suggestions }));
    };

    window.addEventListener('word:accept-all-suggestions', handleAcceptAll);
    window.addEventListener('word:reject-all-suggestions', handleRejectAll);
    window.addEventListener('word:query-suggestions', handleQuery);

    return () => {
      window.removeEventListener('word:accept-all-suggestions', handleAcceptAll);
      window.removeEventListener('word:reject-all-suggestions', handleRejectAll);
      window.removeEventListener('word:query-suggestions', handleQuery);
    };
  }, [handleAcceptAllSuggestions, handleRejectAllSuggestions, suggestions]);

  const runSpellCheck = useCallback(async (options: { silent?: boolean; clearCache?: boolean; onlySelected?: boolean } = {}) => {
    const { silent = false, clearCache = false, onlySelected = false } = options;
    if (!editor) return;

    const settings = getSettings();
    if (settings.languageToolEnabled === false) {
      if (!silent) {
        setSpellCheckToast({
          message: 'LanguageTool er slået fra. Åbn Indstillinger > Sprog & Korrektur for at aktivere.',
          type: 'warning'
        });
        setTimeout(() => setSpellCheckToast(null), 5000);
      }
      return;
    }

    if (!settings.languageToolUrl || !settings.languageToolUrl.trim()) {
      if (!silent) {
        setSpellCheckToast({
          message: 'Indtast venligst adressen på din LanguageTool server i Indstillinger > Sprog & Korrektur.',
          type: 'warning'
        });
        setTimeout(() => setSpellCheckToast(null), 5000);
      }
      return;
    }

    if (clearCache) {
      blockSpellCacheRef.current.clear();
    }

    // Afbryd eventuel igangværende forespørgsel for at minimere server-belastning
    if (spellAbortControllerRef.current) {
      spellAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    spellAbortControllerRef.current = abortController;

    if (silent) {
      const isOnline = await isLanguageToolAvailable();
      if (!isOnline) {
        return; // Hurtig afbrydelse i baggrunden: undgå spildte anmodninger og lag når LanguageTool ikke kører
      }
    }

    if (!silent) {
      setIsSpellChecking(true);
      setSpellCheckToast({ message: 'Tjekker stavning og grammatik via LanguageTool...', type: 'info' });
    }

    try {
      const initialDoc = editor.state.doc;
      const { selection } = editor.state;
      const isRangeSelected = onlySelected && !selection.empty && selection.from !== selection.to;

      interface PendingSpellMatch {
        from: number;
        to: number;
        originalText: string;
        replacements: string[];
        message: string;
        ruleId: string;
      }

      const rawMatches: PendingSpellMatch[] = [];

      if (isRangeSelected) {
        // Tjek kun den markerede tekst
        const selText = editor.state.doc.textBetween(selection.from, selection.to, '\n');
        if (selText.trim().length > 0) {
          let matches = blockSpellCacheRef.current.get(selText);
          if (!matches) {
            const res = await checkTextWithLanguageTool(selText, { signal: abortController.signal });
            matches = res.matches || [];
            blockSpellCacheRef.current.set(selText, matches || []);
          }

          matches?.forEach((match: any) => {
            const matchFrom = selection.from + match.offset;
            const matchTo = selection.from + match.offset + match.length;
            const originalText = selText.slice(match.offset, match.offset + match.length);
            const replacements = (match.replacements || []).slice(0, 8).map((r: any) => r.value);
            const message = match.message || 'Mulig stavefejl fundet.';
            const ruleId = match.rule?.id || '';

            rawMatches.push({
              from: matchFrom,
              to: matchTo,
              originalText,
              replacements,
              message,
              ruleId,
            });
          });
        }
      } else {
        // Tjek dokumentet tekstblok for tekstblok med intelligent afsnits-caching.
        // Hvis silent (løbende skrivning), begrænses scanningen til det aktive afsnit for lynhurtig respons.
        const blocks: Array<{ pos: number; node: any; text: string }> = [];
        const cursorPos = editor.state.selection.from;

        editor.state.doc.descendants((node: any, pos: number) => {
          if (node.isBlock && node.isTextblock && node.textContent && node.textContent.trim().length > 0) {
            if (silent) {
              const nodeEnd = pos + node.nodeSize;
              if (cursorPos >= pos && cursorPos <= nodeEnd) {
                blocks.push({
                  pos,
                  node,
                  text: node.textContent,
                });
              }
            } else {
              blocks.push({
                pos,
                node,
                text: node.textContent,
              });
            }
            return false;
          }
        });

        for (const block of blocks) {
          if (abortController.signal.aborted) return;
          try {
            let matches = blockSpellCacheRef.current.get(block.text);
            if (!matches) {
              const res = await checkTextWithLanguageTool(block.text, { signal: abortController.signal });
              matches = res.matches || [];
              blockSpellCacheRef.current.set(block.text, matches || []);
            }

            for (const match of (matches || [])) {
              let currentOffset = 0;
              let currentPos = block.pos + 1;
              let matchFrom = currentPos;
              let matchTo = currentPos;

              for (let i = 0; i < block.node.childCount; i++) {
                const child = block.node.child(i);
                if (child.isText) {
                  const textLen = child.text?.length || 0;
                  if (match.offset >= currentOffset && match.offset < currentOffset + textLen) {
                    matchFrom = currentPos + (match.offset - currentOffset);
                  }
                  if ((match.offset + match.length) >= currentOffset && (match.offset + match.length) <= currentOffset + textLen) {
                    matchTo = currentPos + ((match.offset + match.length) - currentOffset);
                  }
                  currentOffset += textLen;
                  currentPos += child.nodeSize;
                } else {
                  currentPos += child.nodeSize;
                }
              }

              if (matchFrom >= block.pos + 1 && matchTo > matchFrom) {
                const originalText = block.text.slice(match.offset, match.offset + match.length);
                const replacements = (match.replacements || []).slice(0, 8).map((r: any) => r.value);
                const message = match.message || 'Mulig stavefejl fundet.';
                const ruleId = match.rule?.id || '';

                rawMatches.push({
                  from: matchFrom,
                  to: matchTo,
                  originalText,
                  replacements,
                  message,
                  ruleId,
                });
              }
            }
          } catch (bErr: any) {
            if (bErr?.name !== 'AbortError') {
              console.warn('LanguageTool tjek fejlede for en blok:', bErr);
            }
          }
        }
      }

      if (abortController.signal.aborted) return;

      // ================= FILTER PIPELINE =================
      // 1. Filtrer ord fra brugerens personlige ordbog
      let survivingMatches = rawMatches.filter(m => !isInCustomDictionary(m.originalText));

      // 2. Filtrer CamelCase ord & akronymer (f.eks. MitEgetWord, QoL, API, HTML)
      if (settings.languageToolIgnoreCamelCase !== false) {
        survivingMatches = survivingMatches.filter(m => !isCamelCaseOrAcronym(m.originalText));
      }

      // 3. Valider mod engelsk ordbog hvis slået til (undgår at 'task', 'rework', 'feature' markeres som fejl i dansk tekst)
      if (settings.languageToolRecognizeEnglish !== false && survivingMatches.length > 0) {
        const wordsToTest = Array.from(new Set(survivingMatches.map(m => m.originalText)))
          .filter(w => !validEnglishWordsCacheRef.current.has(w.trim().toLowerCase()));

        if (wordsToTest.length > 0) {
          try {
            const newlyValid = await filterValidEnglishWords(wordsToTest, { signal: abortController.signal });
            if (newlyValid && newlyValid.size > 0) {
              newlyValid.forEach((w: string) => validEnglishWordsCacheRef.current.add(w));
            }
          } catch (eFilter) {
            console.warn('Fejl under validering mod engelsk ordbog:', eFilter);
          }
        }

        survivingMatches = survivingMatches.filter(m => {
          const clean = m.originalText.trim().toLowerCase().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '');
          return !validEnglishWordsCacheRef.current.has(clean);
        });
      }

      if (abortController.signal.aborted) return;
      if (!editor || editor.isDestroyed) return;

      // Hvis brugeren har tastet videre under baggrundstjekket, afbrydes her så markøren aldrig flyttes
      if (editor.state.doc !== initialDoc) {
        return;
      }

      // Opret transaktionen FRISK her lige før dispatch
      const tr = editor.state.tr;
      tr.setMeta('addToHistory', false); // Påvirker ikke Ctrl+Z fortryd-historik
      const currentSelection = editor.state.selection;

      // 1. Ryd eksisterende spellCheck-markeringer
      if (silent && blocks.length === 1) {
        // I silent baggrundstilstand ryddes kun det aktive afsnit, så andre afsnit bevarer deres markeringer
        const blk = blocks[0];
        tr.removeMark(blk.pos, blk.pos + blk.node.nodeSize, editor.state.schema.marks.spellCheck);
      } else {
        tr.removeMark(0, tr.doc.content.size, editor.state.schema.marks.spellCheck);

        // Ryd også eventuelle gamle lt- suggestions fra sidemargenen ved fuld scanning
        editor.state.doc.descendants((node: any, pos: number) => {
          if (node.isText && node.marks) {
            const ltMark = node.marks.find((m: any) => m.type.name === 'suggestion' && m.attrs.suggestionId?.startsWith('lt-'));
            if (ltMark) {
              tr.removeMark(pos, pos + node.nodeSize, ltMark.type);
            }
          }
        });
      }

      // 2. Påfør markeringer i editoren med streng bounds checking
      let errorCount = 0;
      survivingMatches.forEach((m, idx) => {
        if (m.to <= tr.doc.content.size && m.from >= 0 && m.from < m.to) {
          const errorId = `sp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
          tr.addMark(m.from, m.to, editor.state.schema.marks.spellCheck.create({
            errorId,
            originalText: m.originalText,
            replacements: m.replacements,
            message: m.message,
            ruleId: m.ruleId,
          }));
          errorCount++;
        }
      });

      // Lås markøren fast så den ALDRIG flytter sig under stavekontrol!
      try {
        tr.setSelection(currentSelection);
      } catch {}

      if (tr.docChanged || tr.steps.length > 0) {
        editor.view.dispatch(tr);
      }

      if (!silent) {
        if (errorCount > 0) {
          setSpellCheckToast({
            message: `LanguageTool fandt ${errorCount} ${errorCount === 1 ? 'mulig fejl' : 'mulige fejl'}. Højreklik på et understreget ord for at se forslag.`,
            type: 'info'
          });
        } else {
          setSpellCheckToast({
            message: 'Ingen sprogfejl fundet! Teksten ser fejlfri ud.',
            type: 'success'
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !silent) {
        setSpellCheckToast({
          message: `Kunne ikke forbinde til LanguageTool: ${err.message || 'Tjek forbindelsen til din server'}`,
          type: 'warning'
        });
      }
    } finally {
      if (!silent) {
        setIsSpellChecking(false);
        setTimeout(() => {
          setSpellCheckToast(null);
        }, 6000);
      }
    }
  }, [editor]);

  runSpellCheckRef.current = runSpellCheck;

  const handleRunSpellCheck = useCallback(() => {
    return runSpellCheck({ silent: false, clearCache: true });
  }, [runSpellCheck]);

  const handleEditorContextMenu = useCallback((e: React.MouseEvent) => {
    if (!editor) return;

    // Tjek om der blev højreklikket på en stavefejl (.spellcheck-error-mark)
    const target = e.target as HTMLElement;
    const errorSpan = target.closest('.spellcheck-error-mark') as HTMLElement | null;

    if (errorSpan) {
      e.preventDefault();
      setTableContextMenu(null);
      const errorId = errorSpan.getAttribute('data-error-id') || '';
      const originalText = errorSpan.getAttribute('data-original-text') || errorSpan.textContent || '';
      let replacements: string[] = [];
      try {
        replacements = JSON.parse(errorSpan.getAttribute('data-replacements') || '[]');
      } catch {}
      const message = errorSpan.getAttribute('data-message') || 'Mulig stavefejl fundet.';

      setSpellCheckMenu({
        x: e.clientX,
        y: e.clientY,
        errorId,
        originalText,
        replacements,
        message,
      });
      return;
    }

    // Tjek om der blev højreklikket i en tabel eller celle
    const cellEl = target.closest('td, th') as HTMLElement | null;
    const tableEl = target.closest('table') as HTMLElement | null;
    const posInfo = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });

    let isInsideTable = Boolean(cellEl || tableEl);
    if (!isInsideTable && posInfo && typeof posInfo.pos === 'number') {
      const { doc } = editor.state;
      const $pos = doc.resolve(posInfo.pos);
      for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === 'table') {
          isInsideTable = true;
          break;
        }
      }
    }

    if (isInsideTable) {
      e.preventDefault();
      // Hvis der ikke er en aktiv flercelle-markering (CellSelection), flyt markøren hen i cellen
      if (posInfo && typeof posInfo.pos === 'number') {
        const sel = editor.state.selection as any;
        const isCellSelection = sel && (sel.constructor?.name === 'CellSelection' || sel.$anchorCell);
        if (!isCellSelection) {
          editor.commands.setTextSelection(posInfo.pos);
        }
      }
      setSpellCheckMenu(null);
      setTableContextMenu({
        x: e.clientX,
        y: e.clientY,
      });
      return;
    }

    // Fallback: Tjek ProseMirror position under musen for stavefejl
    if (posInfo && typeof posInfo.pos === 'number') {
      const { doc } = editor.state;
      const $pos = doc.resolve(posInfo.pos);
      const marks = $pos.marks();
      const spellMark = marks.find((m: any) => m.type.name === 'spellCheck');
      if (spellMark && spellMark.attrs.errorId) {
        e.preventDefault();
        setTableContextMenu(null);
        setSpellCheckMenu({
          x: e.clientX,
          y: e.clientY,
          errorId: spellMark.attrs.errorId,
          originalText: spellMark.attrs.originalText || '',
          replacements: Array.isArray(spellMark.attrs.replacements) ? spellMark.attrs.replacements : [],
          message: spellMark.attrs.message || 'Mulig stavefejl fundet.',
        });
        return;
      }
    }

    setSpellCheckMenu(null);
    setTableContextMenu(null);
  }, [editor]);

  const handleSelectReplacement = useCallback((errorId: string, replacement: string, originalText?: string) => {
    if (!editor) return;
    const { state } = editor;
    const { doc } = state;
    let from = -1;
    let to = -1;

    // 1. Primær søgning: Find via errorId på spellCheck mark
    if (errorId) {
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.marks) {
          const mark = node.marks.find((m: any) => m.type.name === 'spellCheck' && m.attrs.errorId === errorId);
          if (mark) {
            if (from === -1) from = pos;
            to = pos + node.nodeSize;
          }
        }
      });
    }

    // 2. Sekundær søgning: Find via originalText på spellCheck mark
    if (from === -1 && originalText) {
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.marks) {
          const mark = node.marks.find((m: any) => 
            m.type.name === 'spellCheck' && 
            (m.attrs.originalText === originalText || node.text === originalText)
          );
          if (mark && from === -1) {
            from = pos;
            to = pos + node.nodeSize;
          }
        }
      });
    }

    // 3. Tertiær søgning: Find ordet i dokumentets tekstnoder
    if (from === -1 && originalText) {
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text && from === -1) {
          const idx = node.text.indexOf(originalText);
          if (idx !== -1) {
            from = pos + idx;
            to = from + originalText.length;
          }
        }
      });
    }

    if (from !== -1 && to !== -1) {
      // Udfør erstatning direkte i en atomisk ProseMirror transaktion
      const tr = state.tr;
      tr.removeMark(from, to, state.schema.marks.spellCheck);
      tr.insertText(replacement, from, to);
      tr.removeMark(from, from + replacement.length, state.schema.marks.spellCheck);
      
      editor.view.dispatch(tr);
      editor.view.focus();
      
      setSaveStatus('unsaved');

      // Ryd afsnits-cache så stavekontrollen ikke tror den gamle fejl stadig findes
      blockSpellCacheRef.current.clear();

      // Trigger en debounced baggrundskontrol
      if (autoSpellTimeoutRef.current) {
        clearTimeout(autoSpellTimeoutRef.current);
      }
      autoSpellTimeoutRef.current = setTimeout(() => {
        runSpellCheckRef.current?.({ silent: true });
      }, 1000);
    }

    setSpellCheckMenu(null);
  }, [editor]);

  const handleIgnoreSpellCheck = useCallback((errorId: string, originalText?: string) => {
    if (!editor) return;
    const { doc } = editor.state;
    let from = -1;
    let to = -1;

    if (errorId) {
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.marks) {
          const mark = node.marks.find((m: any) => m.type.name === 'spellCheck' && m.attrs.errorId === errorId);
          if (mark) {
            if (from === -1) from = pos;
            to = pos + node.nodeSize;
          }
        }
      });
    }

    if (from === -1 && originalText) {
      doc.descendants((node: any, pos: number) => {
        if (node.isText && node.marks) {
          const mark = node.marks.find((m: any) => 
            m.type.name === 'spellCheck' && 
            (m.attrs.originalText === originalText || node.text === originalText)
          );
          if (mark && from === -1) {
            from = pos;
            to = pos + node.nodeSize;
          }
        }
      });
    }

    if (from !== -1 && to !== -1) {
      const tr = editor.state.tr;
      tr.removeMark(from, to, editor.state.schema.marks.spellCheck);
      editor.view.dispatch(tr);
    }
    setSpellCheckMenu(null);
  }, [editor]);

  const handleIgnoreAllSpellCheck = useCallback(() => {
    if (!editor) return;
    const tr = editor.state.tr;
    tr.removeMark(0, editor.state.doc.content.size, editor.state.schema.marks.spellCheck);
    editor.view.dispatch(tr);
    setSpellCheckMenu(null);
    setSpellCheckToast({ message: 'Alle stavekontrolmarkeringer er fjernet.', type: 'info' });
    setTimeout(() => setSpellCheckToast(null), 3000);
  }, [editor]);

  const handleAddToDictionary = useCallback((word: string) => {
    if (!editor || !word) return;
    addToCustomDictionary(word);
    blockSpellCacheRef.current.clear();

    // Fjern stavefejlmarkeringer for dette ord i hele dokumentet
    const tr = editor.state.tr;
    const cleanWord = word.trim().toLowerCase().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '');
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.isText && node.marks) {
        const mark = node.marks.find((m: any) => m.type.name === 'spellCheck');
        if (mark) {
          const orig = (mark.attrs.originalText || node.text || '').trim().toLowerCase().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '');
          if (orig === cleanWord) {
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
          }
        }
      }
    });
    editor.view.dispatch(tr);
    setSpellCheckMenu(null);
    setSpellCheckToast({
      message: `"${word}" er tilføjet til din ordbog.`,
      type: 'success'
    });
    setTimeout(() => setSpellCheckToast(null), 3500);
  }, [editor]);

  // Automatisk scanning ved opstart / åbning af dokument
  useEffect(() => {
    if (!editor) return;
    const settings = getSettings();
    if (settings.languageToolEnabled !== false && settings.languageToolAutoCheck !== false) {
      const timer = setTimeout(() => {
        runSpellCheckRef.current?.({ silent: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [editor]);

  // Reager hvis LanguageTool indstillinger opdateres (f.eks. tilføjelse til ordbog i modal, eller ændring af sprog)
  useEffect(() => {
    const handleSettingsUpdated = () => {
      blockSpellCacheRef.current.clear();
      validEnglishWordsCacheRef.current.clear();
      const settings = getSettings();
      if (settings.languageToolEnabled !== false && settings.languageToolAutoCheck !== false) {
        runSpellCheckRef.current?.({ silent: true });
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdated);
  }, []);

  const handleSelectSuggestion = useCallback((id: string) => {
    setActiveSuggestionId(id);
    const el = canvasRef.current?.querySelector(`[data-suggestion-id="${id}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.suggestionPulse);
      setTimeout(() => {
        el.classList.remove(styles.suggestionPulse);
      }, 1200);
    }
  }, []);

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (spellCheckMenu) {
      setSpellCheckMenu(null);
    }
    if (tableContextMenu) {
      setTableContextMenu(null);
    }
    const target = e.target as HTMLElement;
    const suggestionSpan = target.closest('[data-suggestion-id]') as HTMLElement | null;
    if (suggestionSpan) {
      const sugId = suggestionSpan.getAttribute('data-suggestion-id');
      if (sugId) {
        setActiveSuggestionId(sugId);
      }
    }
  }, [spellCheckMenu, tableContextMenu]);

  // Global shortcuts: Ctrl+S (Save), Alt+1..5 (Headings), Alt+Q (Normal text)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      // Save: Ctrl + S (forces fresh thumbnail)
      if ((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        handleSave(undefined, true);
        return;
      }

      // Print / PDF: Ctrl + P (opens page preview & download modal)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPreviewOpen(true);
        return;
      }

      // Clear Formatting: Ctrl + Space (resets bold, italic, fontSize, color, etc.)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        clearFormatting(editor);
        return;
      }

      // Cancel Format Painter: Escape
      if (e.key === 'Escape') {
        if (formatPainter.active) {
          e.preventDefault();
          setFormatPainter({ active: false, format: null });
          return;
        }
        if (isFindReplaceOpen) {
          e.preventDefault();
          setIsFindReplaceOpen(false);
          return;
        }
        if (isStatsModalOpen) {
          e.preventDefault();
          setIsStatsModalOpen(false);
          return;
        }
        if (isFocusMode) {
          e.preventDefault();
          handleToggleFocusMode();
          return;
        }
      }

      // Find & Replace: Ctrl + F
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF') && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setIsFindReplaceOpen(prev => !prev);
        return;
      }

      // Fullscreen / Focus Mode: F11
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFocusMode();
        return;
      }

      // Toggle Header: Ctrl + F1
      if ((e.ctrlKey || e.metaKey) && e.key === 'F1') {
        e.preventDefault();
        setIsRibbonVisible(prev => !prev);
        return;
      }

      // Toggle Document Outline: Alt + A
      // Toggle Suggestions Sidebar: Alt + W
      // Heading Shortcuts: Alt + 1..5, Alt + Q (Normal)
      // Check !e.ctrlKey to avoid triggering on AltGr on Windows/Danish keyboards
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'w' || e.code === 'KeyW') {
          e.preventDefault();
          setIsSuggestionsSidebarOpen(prev => !prev);
          return;
        }
        if (e.key.toLowerCase() === 'a' || e.code === 'KeyA') {
          e.preventDefault();
          setIsOutlineOpen(prev => !prev);
          return;
        }
        if (e.key === '1' || e.code === 'Digit1') {
          e.preventDefault();
          editor?.chain().focus().toggleHeading({ level: 1 }).run();
          return;
        }
        if (e.key === '2' || e.code === 'Digit2') {
          e.preventDefault();
          editor?.chain().focus().toggleHeading({ level: 2 }).run();
          return;
        }
        if (e.key === '3' || e.code === 'Digit3') {
          e.preventDefault();
          editor?.chain().focus().toggleHeading({ level: 3 }).run();
          return;
        }
        if (e.key === '4' || e.code === 'Digit4') {
          e.preventDefault();
          editor?.chain().focus().toggleHeading({ level: 4 }).run();
          return;
        }
        if (e.key === '5' || e.code === 'Digit5') {
          e.preventDefault();
          editor?.chain().focus().toggleHeading({ level: 5 }).run();
          return;
        }
        if (e.key.toLowerCase() === 'q' || e.code === 'KeyQ') {
          e.preventDefault();
          editor?.chain().focus().setParagraph().run();
          return;
        }
      }
    };

    const handleGlobalSave = () => {
      if (isActive) {
        handleSave(undefined, true);
      }
    };

    window.addEventListener('os:save-document', handleGlobalSave);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('os:save-document', handleGlobalSave);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [isActive, editor, handleSave, formatPainter.active, isFindReplaceOpen, isStatsModalOpen, isFocusMode, handleToggleFocusMode]);

  const handlePrint = useCallback(() => {
    if (!editor) return;
    printDocument(title, editor.getHTML(), { topPx: 94, rightPx: 94, bottomPx: 94, leftPx: 94, css: '2.5cm' }, { showHeader: false, showFooter: false, headerType: 'none', footerType: 'none', pageNumberFormat: 'X af Y' });
  }, [editor, title]);

  const handleOpenPreview = useCallback(() => {
    setIsPreviewOpen(true);
  }, []);

  const handleExportWord = useCallback(() => {
    if (!editor) return;
    exportToWord(title, editor.getHTML());
  }, [editor, title]);

  const handleExportHtml = useCallback(() => {
    if (!editor) return;
    exportToHtml(title, editor.getHTML());
  }, [editor, title]);

  const handleExportText = useCallback(() => {
    if (!editor) return;
    exportToText(title, editor.getText());
  }, [editor, title]);

  const handleEditorLocalFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    try {
      const parsed = await parseLocalFile(file);
      if (editor.getText().trim().length > 0) {
        const confirmLoad = window.confirm(`Vil du erstatte indholdet i dette dokument med indholdet fra "${parsed.filename}"?`);
        if (!confirmLoad) return;
      }
      editor.commands.setContent(parsed.content);
      setTitle(parsed.title);
      onTitleChange?.(parsed.title);
      const activeId = currentDocId || `doc-${Date.now()}`;
      if (!currentDocId) setCurrentDocId(activeId);
      await saveDocument(activeId, parsed.title, parsed.content, null, false, currentFolderId, ['Lokal'], null, false, null, true);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Fejl ved åbning af lokal fil i editor:', err);
      alert('Der opstod en fejl ved åbning af den lokale fil.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setSaveStatus('unsaved');
    onTitleChange?.(newTitle);

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave(newTitle, false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (autoSpellTimeoutRef.current) clearTimeout(autoSpellTimeoutRef.current);
      if (idleThumbnailTimerRef.current) clearTimeout(idleThumbnailTimerRef.current);
      if (spellAbortControllerRef.current) spellAbortControllerRef.current.abort();
    };
  }, []);

  const handleSaveBtn = useCallback(() => {
    handleSave(undefined, true);
  }, [handleSave]);

  if (!editor) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#111', color: '#ccc', gap: 14 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#4a90e2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Indlæser dokument...</span>
      </div>
    );
  }

  return (
    <div className={`${styles.windowContainer} ${isActive ? styles.active : ''} ${themeMode === 'light' ? styles.lightTheme : ''} ${isFocusMode ? styles.focusMode : ''}`}>
      {/* Skjult filvælger til åbning af lokale filer */}
      <input
        type="file"
        ref={editorLocalFileInputRef}
        style={{ display: 'none' }}
        accept=".docx,.doc,.html,.htm,.txt,.md,.json,.mew"
        onChange={handleEditorLocalFileSelected}
      />

      {/* Floating Focus Mode Exit Header */}
      {isFocusMode && (
        <div className={styles.focusModeExitBar}>
          <span>Fokustilstand aktiv · Tryk F11 eller Esc for at afslutte</span>
          <button 
            type="button" 
            onClick={handleToggleFocusMode} 
            className={styles.focusExitBtn}
          >
            Afslut fokus
          </button>
        </div>
      )}

      {/* Document Title Header Bar */}
      {!isFocusMode && (
        <div className={styles.docTitleBar}>
          <FileText size={16} color="#4a90e2" />
          <input 
            className={styles.docTitleInput} 
            value={title} 
            onChange={handleTitleChange}
            onBlur={() => handleSave(undefined, true)}
            title="Klik for at omdøbe dokument"
            placeholder="Navnløst dokument"
          />
          <button 
            type="button"
            className={styles.titleVersionHistoryBtn}
            onClick={() => setIsVersionHistoryOpen(true)}
            title="Se versionshistorik og tidligere snapshots"
          >
            <History size={13} />
            <span>Historik</span>
          </button>
        </div>
      )}

      {/* Ribbon (Toolbar) Header with right-corner collapse toggle */}
      {!isFocusMode && (
        isRibbonVisible ? (
          <div className={styles.ribbonContainer}>
            <div className={styles.ribbonWrapper}>
              <Ribbon 
                editor={editor} 
                onSave={handleSaveBtn} 
                onPrint={handlePrint}
                onOpenPreview={handleOpenPreview}
                onOpenLocalFile={() => editorLocalFileInputRef.current?.click()}
                onExportWord={handleExportWord}
                onExportHtml={handleExportHtml}
                onExportText={handleExportText}
                isFormatPainterActive={formatPainter.active}
                onToggleFormatPainter={handleToggleFormatPainter}
                themeMode={themeMode}
                onToggleTheme={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
                onOpenFindReplace={() => setIsFindReplaceOpen(true)}
                onToggleFocusMode={handleToggleFocusMode}
                onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
                onRunSpellCheck={handleRunSpellCheck}
                isSpellChecking={isSpellChecking}
              />
            </div>
            <button 
              className={styles.toggleRibbonBtn} 
              onClick={() => setIsRibbonVisible(false)}
              title="Skjul værktøjslinje (Ctrl + F1)"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        ) : (
          <button 
            className={styles.expandRibbonBtn} 
            onClick={() => setIsRibbonVisible(true)}
            title="Vis værktøjslinje (Ctrl + F1)"
          >
            <ChevronDown size={16} />
          </button>
        )
      )}

      {/* Main Workspace Body with Outline Sidebar & Canvas */}
      <div className={styles.workspaceBody}>
        {spellCheckToast && (
          <div className={`${styles.spellCheckToast} ${styles[spellCheckToast.type || 'info']}`}>
            <span>{spellCheckToast.message}</span>
            <button type="button" onClick={() => setSpellCheckToast(null)} title="Luk">✕</button>
          </div>
        )}
        {!isFocusMode && (
          <DocumentOutline 
            editor={editor} 
            isOpen={isOutlineOpen} 
            onToggle={() => setIsOutlineOpen(prev => !prev)} 
          />
        )}

        {/* Canvas Workspace (Continuous) */}
        <div 
          ref={canvasContainerRef}
          className={styles.canvasContainer}
          onMouseDown={handleCanvasContainerMouseDown}
        >
          <div className={styles.canvasLayoutWrapper}>
            <div 
              ref={canvasRef}
              className={`${styles.canvas} ${styles.continuousCanvas} ${formatPainter.active ? styles.formatPainterActive : ''}`} 
              style={{ 
                transform: `scale(${zoomLevel / 100})`, 
                transformOrigin: 'top center',
              }}
              spellCheck={false}
              onMouseUp={handleEditorMouseUp}
              onClick={handleEditorClick}
              onContextMenu={handleEditorContextMenu}
            >
              <EditorContent editor={editor} className={styles.editorContent} spellCheck={false} />
            </div>

          </div>
        </div>

        {/* Right Suggestions Sidebar (Alt + W) */}
        {!isFocusMode && (
          <SuggestionsMargin
            suggestions={suggestions}
            activeSuggestionId={activeSuggestionId}
            isOpen={isSuggestionsSidebarOpen}
            onToggle={() => setIsSuggestionsSidebarOpen(prev => !prev)}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
            onSelect={handleSelectSuggestion}
            onAcceptAll={handleAcceptAllSuggestions}
            onRejectAll={handleRejectAllSuggestions}
          />
        )}

        {/* LanguageTool Right-Click Spell Check Context Menu */}
        {spellCheckMenu && (
          <SpellCheckContextMenu
            data={spellCheckMenu}
            onSelectReplacement={handleSelectReplacement}
            onIgnore={handleIgnoreSpellCheck}
            onIgnoreAll={handleIgnoreAllSpellCheck}
            onAddToDictionary={handleAddToDictionary}
            onClose={() => setSpellCheckMenu(null)}
          />
        )}

        {/* Table Right-Click Context Menu */}
        {tableContextMenu && (
          <TableContextMenu
            x={tableContextMenu.x}
            y={tableContextMenu.y}
            editor={editor}
            onClose={() => setTableContextMenu(null)}
          />
        )}

        {/* Floating Suggestion Popover on Selection */}
        <FloatingSuggestionMenu
          editor={editor}
          canvasRef={canvasRef}
          onSubmitSuggestion={handleCreateSuggestion}
        />

        {/* Find & Replace Floating Card */}
        <FindReplaceDialog 
          isOpen={isFindReplaceOpen} 
          onClose={() => setIsFindReplaceOpen(false)} 
          editor={editor} 
        />
      </div>

      {/* Status Bar with Save Indicator & View / Theme Toggles */}
      {!isFocusMode && (
        <div className={styles.statusBarContainer}>
          <StatusBar 
            editor={editor} 
            zoomLevel={zoomLevel} 
            setZoomLevel={setZoomLevel} 
            saveStatus={saveStatus}
            onManualSave={handleSaveBtn}
            themeMode={themeMode}
            onToggleTheme={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
            onOpenStats={() => setIsStatsModalOpen(true)}
            isFocusMode={isFocusMode}
            onToggleFocusMode={handleToggleFocusMode}
          />
        </div>
      )}

      {/* Document Statistics Modal */}
      <DocumentStatsModal 
        isOpen={isStatsModalOpen} 
        onClose={() => setIsStatsModalOpen(false)} 
        editor={editor} 
      />

      {/* Visual Print & Page Preview Modal (only serialize HTML when modal is actively opened) */}
      {isPreviewOpen && (
        <PrintPreviewModal 
          isOpen={isPreviewOpen} 
          onClose={() => setIsPreviewOpen(false)} 
          title={title} 
          contentHtml={editor.getHTML()} 
        />
      )}

      {/* Version History Modal */}
      {isVersionHistoryOpen && (
        <VersionHistoryModal 
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          docId={currentDocId}
          currentTitle={title}
          currentContent={editor.getHTML()}
          onRestoreVersion={handleRestoreVersion}
          onCreateCopyFromVersion={handleCreateCopyFromVersion}
        />
      )}
    </div>
  );
};

export default WordApplication;
