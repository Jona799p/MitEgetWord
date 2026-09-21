import { Mark, mergeAttributes } from '@tiptap/core';

export interface SuggestionMarkAttributes {
  suggestionId: string;
  suggestionType?: 'deletion' | 'addition' | 'replacement';
  originalText?: string;
  suggestedText?: string;
  comment?: string;
  createdAt?: string;
  author?: string;
}

export const SuggestionExtension = Mark.create({
  name: 'suggestion',
  inclusive: false,
  keepOnSplit: false,

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-suggestion-id'),
        renderHTML: attributes => {
          if (!attributes.suggestionId) return {};
          const type = attributes.suggestionType || 'addition';
          return {
            'data-suggestion-id': attributes.suggestionId,
            'data-suggestion-type': type,
            class: `document-suggestion-mark suggestion-${type}`,
          };
        },
      },
      suggestionType: {
        default: 'addition',
        parseHTML: element => element.getAttribute('data-suggestion-type') || 'addition',
        renderHTML: attributes => {
          if (!attributes.suggestionType) return {};
          return { 'data-suggestion-type': attributes.suggestionType };
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
      suggestedText: {
        default: '',
        parseHTML: element => element.getAttribute('data-suggested-text') || '',
        renderHTML: attributes => {
          if (!attributes.suggestedText) return {};
          return { 'data-suggested-text': attributes.suggestedText };
        },
      },
      comment: {
        default: '',
        parseHTML: element => element.getAttribute('data-comment') || '',
        renderHTML: attributes => {
          if (!attributes.comment) return {};
          return { 'data-comment': attributes.comment };
        },
      },
      createdAt: {
        default: '',
        parseHTML: element => element.getAttribute('data-created-at') || '',
        renderHTML: attributes => {
          if (!attributes.createdAt) return {};
          return { 'data-created-at': attributes.createdAt };
        },
      },
      author: {
        default: '',
        parseHTML: element => element.getAttribute('data-author') || '',
        renderHTML: attributes => {
          if (!attributes.author) return {};
          return { 'data-author': attributes.author };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggestion-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

export default SuggestionExtension;
