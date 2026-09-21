import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as PMNode } from '@tiptap/pm/model';

export interface SearchResult {
  from: number;
  to: number;
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  currentIndex: number;
  results: SearchResult[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const searchPluginKey = new PluginKey('searchAndReplacePlugin');

function findMatches(doc: PMNode, searchTerm: string, caseSensitive: boolean): SearchResult[] {
  if (!searchTerm || searchTerm.trim() === '') return [];

  const results: SearchResult[] = [];
  const query = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = caseSensitive ? node.text : node.text.toLowerCase();
      let index = text.indexOf(query);
      while (index !== -1) {
        results.push({
          from: pos + index,
          to: pos + index + query.length,
        });
        index = text.indexOf(query, index + query.length);
      }
    }
  });

  return results;
}

export const SearchAndReplaceExtension = Extension.create<any, SearchAndReplaceStorage>({
  name: 'searchAndReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      currentIndex: 0,
      results: [],
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor, tr, dispatch }) => {
          this.storage.searchTerm = searchTerm;
          this.storage.results = findMatches(
            tr.doc,
            searchTerm,
            this.storage.caseSensitive
          );
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1;

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
          }
          return true;
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        () => {
          this.storage.replaceTerm = replaceTerm;
          return true;
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor, tr, dispatch }) => {
          this.storage.caseSensitive = caseSensitive;
          this.storage.results = findMatches(
            tr.doc,
            this.storage.searchTerm,
            caseSensitive
          );
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1;

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
          }
          return true;
        },

      findNext:
        () =>
        ({ editor, tr, dispatch }) => {
          const count = this.storage.results.length;
          if (count === 0) return false;

          this.storage.currentIndex = (this.storage.currentIndex + 1) % count;

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
            const match = this.storage.results[this.storage.currentIndex];
            if (match) {
              tr.scrollIntoView();
            }
          }
          return true;
        },

      findPrevious:
        () =>
        ({ editor, tr, dispatch }) => {
          const count = this.storage.results.length;
          if (count === 0) return false;

          this.storage.currentIndex = (this.storage.currentIndex - 1 + count) % count;

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
            const match = this.storage.results[this.storage.currentIndex];
            if (match) {
              tr.scrollIntoView();
            }
          }
          return true;
        },

      replaceCurrent:
        () =>
        ({ editor, state, dispatch }) => {
          const { results, currentIndex, replaceTerm, searchTerm, caseSensitive } = this.storage;
          if (results.length === 0 || currentIndex < 0 || currentIndex >= results.length) {
            return false;
          }

          const match = results[currentIndex];
          const tr = state.tr.insertText(replaceTerm, match.from, match.to);

          this.storage.results = findMatches(tr.doc, searchTerm, caseSensitive);
          if (this.storage.results.length > 0) {
            this.storage.currentIndex = Math.min(currentIndex, this.storage.results.length - 1);
          } else {
            this.storage.currentIndex = -1;
          }

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
            dispatch(tr);
          }
          return true;
        },

      replaceAll:
        () =>
        ({ editor, state, dispatch }) => {
          const { results, replaceTerm, searchTerm, caseSensitive } = this.storage;
          if (results.length === 0) return false;

          let tr = state.tr;
          // Replace from bottom to top so that offsets aren't invalidated
          for (let i = results.length - 1; i >= 0; i--) {
            const { from, to } = results[i];
            tr = tr.insertText(replaceTerm, from, to);
          }

          this.storage.results = findMatches(tr.doc, searchTerm, caseSensitive);
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1;

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
            dispatch(tr);
          }
          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          this.storage.searchTerm = '';
          this.storage.replaceTerm = '';
          this.storage.results = [];
          this.storage.currentIndex = -1;

          if (dispatch) {
            tr.setMeta(searchPluginKey, { refresh: true });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: searchPluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldSet, oldState, newState) {
            // Document changed or search criteria changed
            if (tr.docChanged || tr.getMeta(searchPluginKey)) {
              const { searchTerm, caseSensitive, currentIndex } = extension.storage;
              const matches = findMatches(newState.doc, searchTerm, caseSensitive);
              extension.storage.results = matches;

              if (matches.length === 0) {
                extension.storage.currentIndex = -1;
                return DecorationSet.empty;
              }

              const validIndex = Math.max(0, Math.min(currentIndex, matches.length - 1));
              extension.storage.currentIndex = validIndex;

              const decorations = matches.map((match, index) => {
                const isActive = index === validIndex;
                return Decoration.inline(match.from, match.to, {
                  class: isActive ? 'search-match search-match-active' : 'search-match',
                  'data-search-index': String(index),
                });
              });

              return DecorationSet.create(newState.doc, decorations);
            }

            return oldSet.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return searchPluginKey.getState(state) || DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export default SearchAndReplaceExtension;
