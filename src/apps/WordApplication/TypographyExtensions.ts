import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';

/**
 * CustomTextStyle: Extends Tiptap's TextStyle to support fontSize attribute
 */
export const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize?.replace(/['"]+/g, '') || null,
        renderHTML: attributes => {
          if (!attributes.fontSize) return {};
          return {
            style: `font-size: ${attributes.fontSize};`,
          };
        },
      },
    };
  },
});

/**
 * LineHeightExtension: Adds lineHeight and paragraphSpacing to block nodes (paragraph, heading)
 */
export const LineHeightExtension = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: null,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {};
              return {
                style: `line-height: ${attributes.lineHeight};`,
              };
            },
          },
          paragraphSpacing: {
            default: null,
            parseHTML: element => element.style.marginBottom || null,
            renderHTML: attributes => {
              if (!attributes.paragraphSpacing) return {};
              return {
                style: `margin-bottom: ${attributes.paragraphSpacing};`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          const { from, to } = selection;
          state.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                lineHeight,
              });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
      unsetLineHeight:
        () =>
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          const { from, to } = selection;
          state.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              const attrs = { ...node.attrs };
              delete attrs.lineHeight;
              tr = tr.setNodeMarkup(pos, undefined, attrs);
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
      setParagraphSpacing:
        (spacing: string | null) =>
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          const { from, to } = selection;
          state.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                paragraphSpacing: spacing,
              });
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

/**
 * Clear all formatting on current selection (Ctrl + Space)
 */
export const clearFormatting = (editor: any) => {
  if (!editor) return;
  // 1. Unset all inline marks (bold, italic, underline, color, fontSize, etc.)
  editor.chain().focus().unsetAllMarks().clearNodes().run();

  // 2. Unset block level typography attributes
  const { state, view } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (['paragraph', 'heading'].includes(node.type.name)) {
      const attrs = { ...node.attrs };
      let changed = false;
      if (attrs.lineHeight) {
        delete attrs.lineHeight;
        changed = true;
      }
      if (attrs.paragraphSpacing) {
        delete attrs.paragraphSpacing;
        changed = true;
      }
      if (attrs.textAlign && attrs.textAlign !== 'left') {
        delete attrs.textAlign;
        changed = true;
      }
      if (changed) {
        tr.setNodeMarkup(pos, undefined, attrs);
      }
    }
  });
  if (tr.docChanged) {
    view.dispatch(tr);
  }
};

/**
 * ClearFormattingExtension: Binds Ctrl+Space to clearFormatting
 */
export const ClearFormattingExtension = Extension.create({
  name: 'clearFormattingShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-Space': () => {
        clearFormatting(this.editor);
        return true;
      },
    };
  },
});

export type CaseType = 'upper' | 'lower' | 'title' | 'sentence';

/**
 * Transforms the selected text to uppercase, lowercase, title case, or sentence case
 * while preserving marks (bold, italic, color, etc.) on each text fragment.
 */
export const transformCase = (editor: any, caseType: CaseType) => {
  if (!editor) return;
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty) return;

  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.isText && node.text) {
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.text.length);
      const textSlice = node.text.slice(start - pos, end - pos);
      let newText = textSlice;

      if (caseType === 'upper') {
        newText = textSlice.toUpperCase();
      } else if (caseType === 'lower') {
        newText = textSlice.toLowerCase();
      } else if (caseType === 'title') {
        // Capitalize each word (Danish Unicode aware: æ, ø, å)
        newText = textSlice.replace(/(?:^|\s|\p{P})\p{L}/gu, (m: string) => m.toUpperCase());
      } else if (caseType === 'sentence') {
        // Sentence case: lowercase then capitalize first character after sentence boundary
        newText = textSlice.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s*\p{L})/gu, (m: string) => m.toUpperCase());
      }

      if (newText !== textSlice) {
        tr.replaceWith(start, end, state.schema.text(newText, node.marks));
      }
    }
  });

  if (tr.docChanged) {
    view.dispatch(tr);
  }
};
