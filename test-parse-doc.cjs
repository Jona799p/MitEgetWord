const fs = require('fs');
const docs = JSON.parse(fs.readFileSync('./server/data/docs.json', 'utf8'));
const doc = docs.find(d => d.id === 'doc-1789553822546');

const { Editor, Extension } = require('@tiptap/core');
const StarterKit = require('@tiptap/starter-kit').default;
const TextAlign = require('@tiptap/extension-text-align').default;
const Underline = require('@tiptap/extension-underline').default;
const Color = require('@tiptap/extension-color').default;
const Highlight = require('@tiptap/extension-highlight').default;
const Subscript = require('@tiptap/extension-subscript').default;
const Superscript = require('@tiptap/extension-superscript').default;
const FontFamily = require('@tiptap/extension-font-family').default;
const { Table } = require('@tiptap/extension-table');
const TableRow = require('@tiptap/extension-table-row').default;
const TableCell = require('@tiptap/extension-table-cell').default;
const TableHeader = require('@tiptap/extension-table-header').default;
const Link = require('@tiptap/extension-link').default;
const Image = require('@tiptap/extension-image').default;
const { TextStyle } = require('@tiptap/extension-text-style');

const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
      },
    };
  },
});

const LineHeightExtension = Extension.create({
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
          },
          paragraphSpacing: {
            default: null,
          },
        },
      },
    ];
  },
});

const ResizableImage = Image.extend({
  name: 'image',
  inline: false,
  group: 'block',
  addOptions() {
    return {
      allowBase64: true,
    };
  },
});

try {
  console.log('Starting editor with doc content...');
  const ed = new Editor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      CustomTextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      FontFamily,
      LineHeightExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ResizableImage,
      Link.configure({ openOnClick: false }),
    ],
    content: doc.content
  });
  console.log('SUCCESS! Node count:', ed.state.doc.nodeSize);
} catch (err) {
  console.error('PARSE ERROR:', err);
}
