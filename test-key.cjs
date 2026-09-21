const { Editor, Extension } = require('@tiptap/core');
const StarterKit = require('@tiptap/starter-kit').default;

const ClearFormattingExtension = Extension.create({
  name: 'clearFormattingShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-Space': () => {
        return true;
      },
    };
  },
});

try {
  const ed = new Editor({
    extensions: [StarterKit, ClearFormattingExtension],
    content: { type: 'doc', content: [{ type: 'paragraph' }] }
  });
  console.log('Mod-Space OK!');
} catch (e) {
  console.error('Mod-Space failed:', e);
}
