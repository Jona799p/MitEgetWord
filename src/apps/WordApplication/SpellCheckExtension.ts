import { Mark, mergeAttributes } from '@tiptap/core';

export interface SpellCheckMarkAttributes {
  errorId: string;
  originalText?: string;
  replacements?: string[];
  message?: string;
  ruleId?: string;
}

export const SpellCheckExtension = Mark.create({
  name: 'spellCheck',
  inclusive: false,
  keepOnSplit: false,

  addAttributes() {
    return {
      errorId: {
        default: null,
        parseHTML: element => element.getAttribute('data-error-id'),
        renderHTML: attributes => {
          if (!attributes.errorId) return {};
          return {
            'data-error-id': attributes.errorId,
            class: 'spellcheck-error-mark',
          };
        },
      },
      originalText: {
        default: '',
        parseHTML: element => element.getAttribute('data-original-text') || '',
        renderHTML: attributes => {
          if (!attributes.originalText) return {};
          return { 'data-original-text': attributes.originalText };
        },
      },
      replacements: {
        default: [],
        parseHTML: element => {
          const raw = element.getAttribute('data-replacements');
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: attributes => {
          if (!attributes.replacements || !attributes.replacements.length) return {};
          return { 'data-replacements': JSON.stringify(attributes.replacements) };
        },
      },
      message: {
        default: '',
        parseHTML: element => element.getAttribute('data-message') || '',
        renderHTML: attributes => {
          if (!attributes.message) return {};
          return { 'data-message': attributes.message };
        },
      },
      ruleId: {
        default: '',
        parseHTML: element => element.getAttribute('data-rule-id') || '',
        renderHTML: attributes => {
          if (!attributes.ruleId) return {};
          return { 'data-rule-id': attributes.ruleId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-error-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

export default SpellCheckExtension;
