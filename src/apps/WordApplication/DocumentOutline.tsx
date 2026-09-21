import React, { useMemo, useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { PanelLeftClose, ListTree, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import styles from './WordApplication.module.css';

interface HeadingNode {
  id: string;
  text: string;
  level: number;
  pos: number;
  collapsed: boolean;
  hasFoldableContent: boolean;
  children: HeadingNode[];
}

interface DocumentOutlineProps {
  editor: Editor;
  isOpen: boolean;
  onToggle: () => void;
}

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
  editor,
  isOpen,
  onToggle,
}) => {
  const [docHash, setDocHash] = useState(0);

  useEffect(() => {
    if (!editor || !isOpen) return;
    setDocHash(Date.now());
    let timer: any;
    const update = ({ transaction }: any) => {
      if (!transaction || !transaction.docChanged) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDocHash(Date.now());
      }, 1500); // Debounce outline updates by 1.5s for snappy writing performance
    };
    editor.on('transaction', update);
    return () => {
      clearTimeout(timer);
      editor.off('transaction', update);
    };
  }, [editor, isOpen]);

  // Extract all headings from the editor document and build a hierarchical tree
  const headingTree = useMemo(() => {
    if (!isOpen || !editor || !editor.state || !editor.state.doc) return [];

    const flatHeadings: Array<{
      id: string;
      text: string;
      level: number;
      pos: number;
      collapsed: boolean;
      hasFoldableContent: boolean;
    }> = [];

    const doc = editor.state.doc;

    // Use a fast O(N) traversal instead of O(N^2) for finding foldable content
    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent.trim() || `Overskrift ${node.attrs.level}`;
        const collapsed = Boolean(node.attrs.collapsed);
        const level = node.attrs.level || 1;

        let hasFoldableContent = false;
        const $pos = doc.resolve(pos);
        const index = $pos.index();
        const parent = $pos.parent;

        if (index < parent.childCount - 1) {
          const next = parent.child(index + 1);
          if (next.type.name !== 'heading' || (next.attrs.level || 1) > level) {
            hasFoldableContent = true;
          }
        }

        flatHeadings.push({
          id: `heading-${pos}`,
          text,
          level,
          pos,
          collapsed,
          hasFoldableContent,
        });
      }
    });

    // Build hierarchical tree based on heading levels (H1 > H2 > H3 > H4 > H5)
    const root: HeadingNode[] = [];
    const stack: HeadingNode[] = [];

    flatHeadings.forEach((item) => {
      const node: HeadingNode = { ...item, children: [] };

      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return root;
  }, [editor, docHash]);

  // Jump to heading in editor when clicked
  const handleJump = (node: HeadingNode) => {
    if (!editor) return;

    // If the heading is collapsed, unfold it so the user can see and edit the content immediately
    if (node.collapsed) {
      editor.commands.setHeadingCollapse(node.pos, false);
    }

    // Set selection in editor
    editor.chain().focus().setTextSelection(node.pos + 1).run();

    // Scroll the heading smoothly into center view
    const domNode = editor.view.nodeDOM(node.pos);
    const targetElement = domNode instanceof HTMLElement ? domNode : domNode?.parentElement;
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleToggleHeading = (e: React.MouseEvent, pos: number) => {
    e.stopPropagation();
    e.preventDefault();
    editor.commands.toggleHeadingCollapse(pos);
  };

  // Render tree recursively with branch lines
  const renderTree = (nodes: HeadingNode[]) => {
    return (
      <ul className={styles.treeList}>
        {nodes.map((node) => {
          const canFold = node.hasFoldableContent || node.children.length > 0;
          return (
            <li key={node.id} className={styles.treeListItem}>
              <div
                className={`${styles.treeItem} ${node.collapsed ? styles.treeItemCollapsed : ''}`}
                onClick={() => handleJump(node)}
                title={`Gå til: ${node.text}${node.collapsed ? ' (Foldet sammen)' : ''}`}
              >
                {canFold ? (
                  <button
                    type="button"
                    className={styles.outlineCollapseBtn}
                    onClick={(e) => handleToggleHeading(e, node.pos)}
                    title={node.collapsed ? 'Fold sektion ud' : 'Fold sektion sammen'}
                    aria-label={node.collapsed ? 'Fold ud' : 'Fold sammen'}
                  >
                    {node.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className={styles.outlineCollapseSpacer} />
                )}
                <span className={styles.levelBadge}>H{node.level}</span>
                <span className={styles.treeItemText}>{node.text}</span>
              </div>
              {/* Hide child headings when parent heading is collapsed */}
              {node.children.length > 0 && !node.collapsed && renderTree(node.children)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (!isOpen) {
    return (
      <button
        className={styles.openOutlineBtn}
        onClick={onToggle}
        title="Åbn dokumentoversigt (Alt + A)"
      >
        <ListTree size={16} />
        <span className={styles.openOutlineLabel}>Oversigt</span>
      </button>
    );
  }

  return (
    <aside className={styles.outlineSidebar}>
      <div className={styles.outlineHeader}>
        <div className={styles.outlineHeaderTitle}>
          <ListTree size={16} className={styles.outlineIcon} />
          <h3>Oversigt</h3>
        </div>
        <div className={styles.outlineHeaderActions}>
          <button
            type="button"
            className={styles.outlineActionBtn}
            onClick={() => editor.commands.collapseAllHeadings()}
            title="Fold alle overskrifter sammen"
          >
            <ChevronsDownUp size={14} />
          </button>
          <button
            type="button"
            className={styles.outlineActionBtn}
            onClick={() => editor.commands.expandAllHeadings()}
            title="Udvid alle overskrifter"
          >
            <ChevronsUpDown size={14} />
          </button>
        </div>
        <button
          className={styles.closeOutlineBtn}
          onClick={onToggle}
          title="Luk oversigt (Alt + A)"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className={styles.outlineContent}>
        {headingTree.length === 0 ? (
          <div className={styles.emptyOutline}>
            Ingen overskrifter fundet.<br />
            Brug f.eks. <kbd className={styles.kbd}>Alt + 1</kbd> eller værktøjslinjen for at oprette en overskrift.
          </div>
        ) : (
          renderTree(headingTree)
        )}
      </div>
    </aside>
  );
};

export default DocumentOutline;
