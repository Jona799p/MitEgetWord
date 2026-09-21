import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import Heading, { HeadingOptions } from '@tiptap/extension-heading';

export interface CollapsibleHeadingOptions extends HeadingOptions {}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsibleHeading: {
      toggleHeadingCollapse: (pos: number) => ReturnType;
      setHeadingCollapse: (pos: number, collapsed: boolean) => ReturnType;
      collapseAllHeadings: () => ReturnType;
      expandAllHeadings: () => ReturnType;
    };
  }
}

export const collapsibleHeadingPluginKey = new PluginKey('collapsibleHeadingPlugin');

function toggleCollapseAt(view: EditorView, headingPos: number) {
  const { state, dispatch } = view;
  const node = state.doc.nodeAt(headingPos);
  if (!node || node.type.name !== 'heading') return;

  const isCurrentlyCollapsed = Boolean(node.attrs.collapsed);
  const newCollapsed = !isCurrentlyCollapsed;

  const tr = state.tr;
  tr.setNodeMarkup(headingPos, undefined, {
    ...node.attrs,
    collapsed: newCollapsed,
  });
  tr.setMeta('addToHistory', false);
  tr.setMeta(collapsibleHeadingPluginKey, { toggled: true });

  // If collapsing, ensure selection is not trapped inside the hidden section
  if (newCollapsed) {
    const headingLevel = node.attrs.level || 1;
    let collapseEnd = headingPos + node.nodeSize;

    state.doc.forEach((child, childOffset) => {
      if (childOffset >= headingPos + node.nodeSize) {
        if (child.type.name === 'heading' && (child.attrs.level || 1) <= headingLevel) {
          return false;
        }
        collapseEnd = childOffset + child.nodeSize;
      }
    });

    const { from, to } = state.selection;
    if (from >= headingPos + node.nodeSize && to <= collapseEnd + 1) {
      tr.setSelection(TextSelection.create(tr.doc, headingPos + 1));
    }
  }

  dispatch(tr);
}

function buildHeadingDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  let activeCollapseLevel: number | null = null;

  doc.forEach((node: any, offset: number, index: number) => {
    const isHeading = node.type.name === 'heading';
    const headingLevel = isHeading ? (node.attrs.level || 1) : 0;
    const isCollapsed = isHeading && Boolean(node.attrs.collapsed);

    // If a heading with level <= activeCollapseLevel is reached, the collapse section ends
    if (activeCollapseLevel !== null && isHeading && headingLevel <= activeCollapseLevel) {
      activeCollapseLevel = null;
    }

    // Hide nodes inside the collapsed section
    if (activeCollapseLevel !== null) {
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'collapsible-heading-hidden',
        })
      );
    } else if (isHeading && isCollapsed) {
      activeCollapseLevel = headingLevel;
    }

    // If it's a visible heading, add toggle controls if it has content below it
    if (isHeading) {
      let hasFoldableContent = false;
      if (index < doc.childCount - 1) {
        const nextNode = doc.child(index + 1);
        if (nextNode.type.name !== 'heading' || (nextNode.attrs.level || 1) > headingLevel) {
          hasFoldableContent = true;
        }
      }

      if (hasFoldableContent) {
        // Toggle button widget before the text
        decorations.push(
          Decoration.widget(
            offset + 1,
            (view) => {
              const span = document.createElement('span');
              span.className = `heading-collapse-toggle-wrapper ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`;
              span.contentEditable = 'false';

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = `heading-collapse-btn ${isCollapsed ? 'collapsed' : ''}`;
              btn.title = isCollapsed ? 'Fold sektion ud' : 'Fold sektion sammen';
              btn.setAttribute('aria-label', isCollapsed ? 'Fold ud' : 'Fold sammen');

              btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="heading-collapse-chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

              btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleCollapseAt(view, offset);
              });

              btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
              });

              span.appendChild(btn);
              return span;
            },
            { side: -1, stopEvent: () => true, key: `collapse-btn-${offset}` }
          )
        );

        // Subtle indicator pill when collapsed
        if (isCollapsed) {
          decorations.push(
            Decoration.widget(
              offset + node.nodeSize - 1,
              (view) => {
                const badge = document.createElement('span');
                badge.className = 'heading-collapsed-badge';
                badge.contentEditable = 'false';
                badge.textContent = '···';
                badge.title = 'Sektionen er foldet sammen. Klik for at folde ud.';

                badge.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCollapseAt(view, offset);
                });

                badge.addEventListener('mousedown', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                });

                return badge;
              },
              { side: 1, stopEvent: () => true, key: `collapse-badge-${offset}` }
            )
          );
        }
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const CollapsibleHeadingExtension = Heading.extend<CollapsibleHeadingOptions>({
  name: 'heading',

  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.collapsed) return {};
          return { 'data-collapsed': 'true' };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      toggleHeadingCollapse:
        (pos: number) =>
        ({ tr, state, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== 'heading') return false;
          const isCollapsed = Boolean(node.attrs.collapsed);
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            collapsed: !isCollapsed,
          });
          tr.setMeta('addToHistory', false);
          tr.setMeta(collapsibleHeadingPluginKey, true);
          if (dispatch) dispatch(tr);
          return true;
        },
      setHeadingCollapse:
        (pos: number, collapsed: boolean) =>
        ({ tr, state, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== 'heading') return false;
          if (Boolean(node.attrs.collapsed) === collapsed) return true;
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            collapsed,
          });
          tr.setMeta('addToHistory', false);
          tr.setMeta(collapsibleHeadingPluginKey, true);
          if (dispatch) dispatch(tr);
          return true;
        },
      collapseAllHeadings:
        () =>
        ({ tr, state, dispatch }) => {
          let changed = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && !node.attrs.collapsed) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                collapsed: true,
              });
              changed = true;
            }
          });
          if (changed) {
            tr.setMeta('addToHistory', false);
            tr.setMeta(collapsibleHeadingPluginKey, true);
            if (dispatch) dispatch(tr);
          }
          return changed;
        },
      expandAllHeadings:
        () =>
        ({ tr, state, dispatch }) => {
          let changed = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && node.attrs.collapsed) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                collapsed: false,
              });
              changed = true;
            }
          });
          if (changed) {
            tr.setMeta('addToHistory', false);
            tr.setMeta(collapsibleHeadingPluginKey, true);
            if (dispatch) dispatch(tr);
          }
          return changed;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: collapsibleHeadingPluginKey,
        state: {
          init(_, state) {
            return buildHeadingDecorations(state.doc);
          },
          apply(tr, oldSet, oldState, newState) {
            if (tr.getMeta(collapsibleHeadingPluginKey)) {
              return buildHeadingDecorations(newState.doc);
            }
            if (!tr.docChanged) {
              return oldSet;
            }

            // Check if any heading node was modified or inserted/deleted
            let needsRebuild = false;
            tr.steps.forEach((step: any) => {
              const stepMap = step.getMap();
              stepMap.forEach((oldStart: number, oldEnd: number) => {
                oldState.doc.nodesBetween(oldStart, oldEnd, (node: any) => {
                  if (node.type.name === 'heading') {
                    needsRebuild = true;
                    return false;
                  }
                });
              });
              if (step.slice) {
                step.slice.content.forEach((node: any) => {
                  if (node.type.name === 'heading') {
                    needsRebuild = true;
                  }
                });
              }
            });

            if (needsRebuild) {
              return buildHeadingDecorations(newState.doc);
            }

            // Normal typing in paragraphs: simply map existing decorations across the step!
            // Ultra-lightweight and eliminates DOM allocations during typing.
            return oldSet.map(tr.mapping, newState.doc);
          },
        },
        props: {
          decorations(state) {
            return collapsibleHeadingPluginKey.getState(state) || DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export default CollapsibleHeadingExtension;
