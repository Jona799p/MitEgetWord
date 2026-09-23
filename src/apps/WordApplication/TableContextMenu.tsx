import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Table as TableIcon,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  MinusCircle,
  MinusSquare,
  Trash2,
  Combine,
  Split,
  Palette,
  RotateCcw,
  Heading,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import styles from './TableContextMenu.module.css';

interface TableContextMenuProps {
  x: number;
  y: number;
  editor: Editor;
  onClose: () => void;
}

const PRESET_COLORS = [
  { label: 'Hvid', value: '#ffffff' },
  { label: 'Lys grå', value: '#f3f4f6' },
  { label: 'Himmelblå', value: '#e0f2fe' },
  { label: 'Mintgrøn', value: '#dcfce7' },
  { label: 'Varm gul', value: '#fef3c7' },
  { label: 'Koral / rød', value: '#fee2e2' },
  { label: 'Lilla', value: '#f3e8ff' },
  { label: 'Mørk skifer', value: '#1e293b' },
];

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  x,
  y,
  editor,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Viewport clamping
  const menuWidth = 260;
  const menuEstimatedHeight = 440;
  const posX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 15);
  const posY = Math.min(Math.max(10, y), window.innerHeight - menuEstimatedHeight - 15);

  const canMerge = editor.can().mergeCells();
  const canSplit = editor.can().splitCell();

  const handleAction = (cb: () => void) => {
    cb();
    onClose();
  };

  const setCellColor = (color: string | null) => {
    editor.chain().focus().setCellAttribute('backgroundColor', color).run();
    onClose();
  };

  return (
    <>
      <div
        className={styles.contextMenuBackdrop}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        className={styles.menuContainer}
        style={{ left: `${posX}px`, top: `${posY}px` }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className={styles.menuHeader}>
          <TableIcon size={15} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Tabel indstillinger</span>
        </div>

        <div className={styles.divider} />

        {/* Rows section */}
        <div className={styles.sectionLabel}>Rækker</div>
        <div className={styles.compactGroup}>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().addRowBefore().run())}
            title="Indsæt række over"
          >
            <ArrowUpToLine size={15} />
            <span>Over</span>
          </button>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().addRowAfter().run())}
            title="Indsæt række under"
          >
            <ArrowDownToLine size={15} />
            <span>Under</span>
          </button>
          <button
            type="button"
            className={`${styles.compactBtn} ${styles.compactBtnDanger}`}
            onClick={() => handleAction(() => editor.chain().focus().deleteRow().run())}
            title="Slet aktuel række"
          >
            <MinusCircle size={15} />
            <span>Slet</span>
          </button>
        </div>

        {/* Columns section */}
        <div className={styles.sectionLabel}>Kolonner</div>
        <div className={styles.compactGroup}>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().addColumnBefore().run())}
            title="Indsæt kolonne til venstre"
          >
            <ArrowLeftToLine size={15} />
            <span>Venstre</span>
          </button>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().addColumnAfter().run())}
            title="Indsæt kolonne til højre"
          >
            <ArrowRightToLine size={15} />
            <span>Højre</span>
          </button>
          <button
            type="button"
            className={`${styles.compactBtn} ${styles.compactBtnDanger}`}
            onClick={() => handleAction(() => editor.chain().focus().deleteColumn().run())}
            title="Slet aktuel kolonne"
          >
            <MinusSquare size={15} />
            <span>Slet</span>
          </button>
        </div>

        <div className={styles.divider} />

        {/* Cells & Merging */}
        <div className={styles.sectionLabel}>Celler & Struktur</div>
        
        {canMerge && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleAction(() => editor.chain().focus().mergeCells().run())}
          >
            <Combine size={14} className={styles.menuItemIcon} />
            <span>Flet markerede celler</span>
          </button>
        )}

        {canSplit && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleAction(() => editor.chain().focus().splitCell().run())}
          >
            <Split size={14} className={styles.menuItemIcon} />
            <span>Opdel flettet celle</span>
          </button>
        )}

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => handleAction(() => editor.chain().focus().toggleHeaderRow().run())}
        >
          <Heading size={14} className={styles.menuItemIcon} />
          <span>Skift overskriftsrække</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => handleAction(() => editor.chain().focus().toggleHeaderColumn().run())}
        >
          <Heading size={14} className={styles.menuItemIcon} />
          <span>Skift overskriftskolonne</span>
        </button>

        <div className={styles.divider} />

        {/* Text Alignment in Cell */}
        <div className={styles.sectionLabel}>Tekstjustering i celle</div>
        <div className={styles.compactGroup}>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().setTextAlign('left').run())}
            title="Venstrejuster"
          >
            <AlignLeft size={15} />
            <span>Venstre</span>
          </button>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().setTextAlign('center').run())}
            title="Centrer"
          >
            <AlignCenter size={15} />
            <span>Centrer</span>
          </button>
          <button
            type="button"
            className={styles.compactBtn}
            onClick={() => handleAction(() => editor.chain().focus().setTextAlign('right').run())}
            title="Højrejuster"
          >
            <AlignRight size={15} />
            <span>Højre</span>
          </button>
        </div>

        <div className={styles.divider} />

        {/* Cell Background Color */}
        <div className={styles.sectionLabel}>Celle baggrundsfarve</div>
        <div className={styles.colorSection}>
          <div className={styles.swatchesRow}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={styles.colorSwatch}
                style={{ backgroundColor: c.value }}
                title={c.label}
                onClick={() => setCellColor(c.value)}
              />
            ))}
            <div className={styles.customColorBtn} title="Vælg brugerdefineret farve">
              <input
                type="color"
                onChange={(e) => setCellColor(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className={styles.resetColorBtn}
            onClick={() => setCellColor(null)}
          >
            <RotateCcw size={12} />
            <span>Fjern baggrundsfarve</span>
          </button>
        </div>

        <div className={styles.divider} />

        {/* Delete table */}
        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => handleAction(() => editor.chain().focus().deleteTable().run())}
        >
          <Trash2 size={14} className={styles.menuItemIcon} />
          <span>Slet hele tabellen</span>
        </button>
      </div>
    </>
  );
};

export default TableContextMenu;
