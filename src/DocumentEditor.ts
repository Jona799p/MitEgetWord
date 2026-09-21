/**
 * DocumentEditor.ts
 *
 * Lightweight LLM-driven document editing system using an "Exact String Match" architecture.
 * Designed for both small local models (e.g., 8B parameters) and cloud APIs (e.g., Google Gemini, OpenAI).
 */

// ============================================================================
// 1. TypeScript Interfaces and Types
// ============================================================================

/**
 * Arguments expected for the 'replace_entire_document' tool.
 */
export interface ReplaceEntireDocumentArgs {
  /**
   * The complete updated content of the document.
   */
  new_content: string;
}

/**
 * Arguments expected for the 'replace_selected_text' tool.
 */
export interface ReplaceSelectedTextArgs {
  /**
   * The revised text that should replace the active selection.
   */
  new_text: string;
}

/**
 * Arguments expected for the 'clear_formatting' tool.
 */
export interface ClearFormattingArgs {}

/**
 * Arguments expected for the 'delete_selected_text' tool.
 */
export interface DeleteSelectedTextArgs {}

/**
 * Arguments expected for the 'replace_text' tool.
 */
export interface ReplaceTextArgs {
  /**
   * The exact substring in the document to search for and replace.
   */
  exact_text_to_replace: string;

  /**
   * The replacement text.
   */
  new_text: string;
}

/**
 * Arguments expected for the 'append_text' tool.
 */
export interface AppendTextArgs {
  /**
   * The text to append to the end of the document.
   */
  text_to_add: string;
}

/**
 * Structured result of an execution step (useful for logging, UI updates, and internal checks).
 */
export interface ToolResult {
  success: boolean;
  message: string;
  documentContent: string;
}

/**
 * Schema definition matching Gemini's FunctionDeclaration format.
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT' | 'object';
    properties: Record<
      string,
      {
        type: 'STRING' | 'string' | 'NUMBER' | 'number' | 'BOOLEAN' | 'boolean' | 'ARRAY' | 'array' | 'OBJECT' | 'object';
        description: string;
      }
    >;
    required: string[];
  };
}

/**
 * Standard OpenAI / Local Model (Ollama, LM Studio, vLLM) tool definition format.
 */
export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        {
          type: string;
          description: string;
        }
      >;
      required: string[];
    };
  };
}

// ============================================================================
// 2. Tool Schema Definitions
// ============================================================================

/**
 * Gemini API compatible Function Declarations.
 */
export const GEMINI_TOOL_SCHEMAS: GeminiFunctionDeclaration[] = [
  {
    name: 'replace_entire_document',
    description:
      'Replaces the entire document with revised content. Use this whenever the user asks for document-wide edits (e.g. "fjern alle * og - i hele dokumentet", "ret grammatik i hele teksten", "omskriv dokumentet", "oversæt dokumentet") or when no specific text is selected and the whole document should be updated. "new_content" MUST contain the complete revised document in structured markdown format (# for headings, blank lines between paragraphs, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        new_content: {
          type: 'STRING',
          description:
            'The complete updated content of the document. Use markdown for headings (#, ##) and paragraphs. MUST NOT be empty.',
        },
      },
      required: ['new_content'],
    },
  },
  {
    name: 'replace_selected_text',
    description:
      'Replaces the currently selected/marked text in the document with revised text. Use this whenever the user has selected text and asks to edit, clean, rephrase, remove specific characters (like * or -), fix typos, or rewrite the selection. The "new_text" parameter MUST contain the revised text and MUST NOT be empty.',
    parameters: {
      type: 'OBJECT',
      properties: {
        new_text: {
          type: 'STRING',
          description:
            'The full revised text that replaces the selection. MUST NOT be empty. If removing characters (like * or -) or reformatting, provide the complete revised text.',
        },
      },
      required: ['new_text'],
    },
  },
  {
    name: 'clear_formatting',
    description:
      'Clears all formatting (bold, italic, underline, strike, colors, highlights, headings, font sizes) from the currently selected text, reverting it to standard normal body text while keeping all text characters 100% intact. Use this whenever the user asks to remove, clear, or reset formatting.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'delete_selected_text',
    description:
      'Permanently deletes the currently selected text from the document. ONLY use this tool when the user explicitly and unambiguously asks to delete, erase, or discard the selected text entirely (e.g., "slet dette", "fjern markeringen", "delete selection").',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'replace_text',
    description:
      'Finds an exact string in the document and replaces it with new_text. Both exact_text_to_replace and new_text are required. To modify the active selection, use replace_selected_text instead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exact_text_to_replace: {
          type: 'STRING',
          description:
            'The exact string currently in the document to replace. Must match the text verbatim, including whitespace and punctuation.',
        },
        new_text: {
          type: 'STRING',
          description:
            'The updated text to replace the matched string with. MUST NOT be empty.',
        },
      },
      required: ['exact_text_to_replace', 'new_text'],
    },
  },
  {
    name: 'append_text',
    description: 'Appends text to the very end of the document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text_to_add: {
          type: 'STRING',
          description: 'The text content to append to the very end of the document.',
        },
      },
      required: ['text_to_add'],
    },
  },
  {
    name: 'insert_text',
    description: 'Inserts text at the current cursor position or in the active document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'The text content to insert.',
        },
      },
      required: ['text'],
    },
  },
];

/**
 * OpenAI / Ollama compatible Tool Definitions.
 */
export const OPENAI_TOOL_SCHEMAS: OpenAIToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'replace_entire_document',
      description:
        'Replaces the entire document with revised content. Use this whenever the user asks for document-wide edits (e.g. "fjern alle * og - i hele dokumentet", "ret grammatik i hele teksten", "omskriv dokumentet", "oversæt dokumentet") or when no specific text is selected and the whole document should be updated. "new_content" MUST contain the complete revised document in structured markdown format (# for headings, blank lines between paragraphs, etc.).',
      parameters: {
        type: 'object',
        properties: {
          new_content: {
            type: 'string',
            description:
              'The complete updated content of the document. Use markdown for headings (#, ##) and paragraphs. MUST NOT be empty.',
          },
        },
        required: ['new_content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_selected_text',
      description:
        'Replaces the currently selected/marked text in the document with revised text. Use this whenever the user has selected text and asks to edit, clean, rephrase, remove specific characters (like * or -), fix typos, or rewrite the selection. The "new_text" parameter MUST contain the revised text and MUST NOT be empty.',
      parameters: {
        type: 'object',
        properties: {
          new_text: {
            type: 'string',
            description:
              'The full revised text that replaces the selection. MUST NOT be empty. If removing characters (like * or -) or reformatting, provide the complete revised text.',
          },
        },
        required: ['new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_formatting',
      description:
        'Clears all formatting (bold, italic, underline, strike, colors, highlights, headings, font sizes) from the currently selected text, reverting it to standard normal body text while keeping all text characters 100% intact. Use this whenever the user asks to remove, clear, or reset formatting.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_selected_text',
      description:
        'Permanently deletes the currently selected text from the document. ONLY use this tool when the user explicitly and unambiguously asks to delete, erase, or discard the selected text entirely (e.g., "slet dette", "fjern markeringen", "delete selection").',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_text',
      description:
        'Finds an exact string in the document and replaces it with new_text. Both exact_text_to_replace and new_text are required. To modify the active selection, use replace_selected_text instead.',
      parameters: {
        type: 'object',
        properties: {
          exact_text_to_replace: {
            type: 'string',
            description:
              'The exact string currently in the document to replace. Must match the text verbatim, including whitespace and punctuation.',
          },
          new_text: {
            type: 'string',
            description:
              'The updated text to replace the matched string with. MUST NOT be empty.',
          },
        },
        required: ['exact_text_to_replace', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_text',
      description: 'Appends text to the very end of the document.',
      parameters: {
        type: 'object',
        properties: {
          text_to_add: {
            type: 'string',
            description: 'The text content to append to the very end of the document.',
          },
        },
        required: ['text_to_add'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_text',
      description: 'Inserts text at the current cursor position or in the active document.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text content to insert.',
          },
        },
        required: ['text'],
      },
    },
  },
];

/**
 * Default exported tool schemas (Gemini format).
 */
export const TOOL_SCHEMAS = GEMINI_TOOL_SCHEMAS;

// ============================================================================
// 3. DocumentEditor Class
// ============================================================================

export class DocumentEditor {
  private document: string;

  /**
   * Initializes the DocumentEditor with optional starting text.
   * @param initialContent The initial content of the document (defaults to empty string).
   */
  constructor(initialContent: string = '') {
    this.document = initialContent;
  }

  /**
   * Retrieves the current document state as a string.
   */
  public getContent(): string {
    return this.document;
  }

  /**
   * Updates or overwrites the current document state.
   */
  public setContent(newContent: string): void {
    this.document = newContent ?? '';
  }

  /**
   * Replaces an exact substring within the document.
   *
   * Strict error handling:
   * - If exact_text_to_replace is not found, does not crash and returns a polite error for the LLM.
   * - If multiple occurrences are found, replaces the first occurrence and informs the LLM.
   * - If new_text is empty, safely deletes the matched text.
   */
  public replaceText(exactTextToReplace: string, newText: string): ToolResult {
    // 1. Validate argument presence
    if (typeof exactTextToReplace !== 'string' || exactTextToReplace.length === 0) {
      return {
        success: false,
        message: "Error: Missing or empty 'exact_text_to_replace'. Please provide the exact text you wish to replace.",
        documentContent: this.document,
      };
    }

    const replacement = typeof newText === 'string' ? newText : '';

    // 2. Strict exact match check
    const matchIndex = this.document.indexOf(exactTextToReplace);
    if (matchIndex === -1) {
      return {
        success: false,
        message: `Error: Could not find the exact text '${exactTextToReplace}' in the document. Please try again with the exact wording and punctuation.`,
        documentContent: this.document,
      };
    }

    // 3. Check for multiple occurrences to provide helpful feedback to small models
    const occurrences = this.countOccurrences(this.document, exactTextToReplace);

    // 4. Perform replacement on the first matching occurrence
    const before = this.document.slice(0, matchIndex);
    const after = this.document.slice(matchIndex + exactTextToReplace.length);
    this.document = before + replacement + after;

    const actionDescription =
      replacement.length === 0
        ? `Deleted '${exactTextToReplace}'`
        : `Replaced '${exactTextToReplace}' with '${replacement}'`;
    const occurrenceNote =
      occurrences > 1
        ? ` (Note: Found ${occurrences} total occurrences; replaced the first occurrence. Use more surrounding context if you intended to target a specific occurrence.)`
        : '';

    return {
      success: true,
      message: `Success: ${actionDescription} in the document.${occurrenceNote}`,
      documentContent: this.document,
    };
  }

  /**
   * Appends text to the very end of the document.
   */
  public appendText(textToAdd: string): ToolResult {
    if (typeof textToAdd !== 'string') {
      return {
        success: false,
        message: "Error: Missing or invalid 'text_to_add'. Expected a string.",
        documentContent: this.document,
      };
    }

    this.document += textToAdd;

    return {
      success: true,
      message: `Success: Appended ${textToAdd.length} character(s) to the end of the document.`,
      documentContent: this.document,
    };
  }

  /**
   * Main entry point for the LLM Tool Calling loop.
   *
   * Safely parses arguments (handles raw JSON strings commonly emitted by local 8B models),
   * executes the corresponding tool, and returns a polite message string intended to be fed
   * directly back into the LLM as the tool-call response.
   *
   * @param toolName The name of the tool called ('replace_text' | 'append_text')
   * @param args The arguments object or raw JSON string passed by the LLM
   * @returns A polite string response for the LLM (guaranteed not to throw)
   */
  public handleToolCall(toolName: string, args: any): string {
    const result = this.executeToolCall(toolName, args);
    return result.message;
  }

  /**
   * Executes a tool call and returns the full structured ToolResult object.
   * Useful when the host application needs both the LLM response message and boolean status flags.
   */
  public executeToolCall(toolName: string, args: any): ToolResult {
    // Gracefully handle stringified arguments from small local LLMs
    let normalizedArgs = args;
    if (typeof args === 'string') {
      try {
        normalizedArgs = JSON.parse(args);
      } catch {
        return {
          success: false,
          message: `Error: Failed to parse tool arguments. Expected a valid JSON object, but received: "${args}".`,
          documentContent: this.document,
        };
      }
    }

    if (!normalizedArgs || typeof normalizedArgs !== 'object') {
      return {
        success: false,
        message: 'Error: Invalid arguments. Expected an object with tool parameters.',
        documentContent: this.document,
      };
    }

    switch (toolName) {
      case 'replace_selected_text': {
        const { new_text } = normalizedArgs as ReplaceSelectedTextArgs;
        if (typeof new_text !== 'string' || new_text.length === 0) {
          return {
            success: false,
            message: "Error: Missing or empty 'new_text'.",
            documentContent: this.document,
          };
        }
        return {
          success: true,
          message: `Success: Replaced selection with '${new_text}'.`,
          documentContent: this.document,
        };
      }

      case 'clear_formatting': {
        return {
          success: true,
          message: 'Success: Cleared formatting from selection.',
          documentContent: this.document,
        };
      }

      case 'delete_selected_text': {
        return {
          success: true,
          message: 'Success: Deleted selection from document.',
          documentContent: this.document,
        };
      }

      case 'replace_entire_document': {
        const { new_content } = normalizedArgs as ReplaceEntireDocumentArgs;
        if (typeof new_content !== 'string' || new_content.length === 0) {
          return {
            success: false,
            message: "Error: Missing or empty 'new_content'.",
            documentContent: this.document,
          };
        }
        this.document = new_content;
        return {
          success: true,
          message: 'Success: Replaced entire document content.',
          documentContent: this.document,
        };
      }

      case 'replace_text': {
        const { exact_text_to_replace, new_text } = normalizedArgs as ReplaceTextArgs;
        return this.replaceText(exact_text_to_replace, new_text);
      }

      case 'append_text': {
        const { text_to_add } = normalizedArgs as AppendTextArgs;
        return this.appendText(text_to_add);
      }

      default:
        return {
          success: false,
          message: `Error: Unknown tool '${toolName}'. Supported tools are 'replace_entire_document', 'replace_selected_text', 'clear_formatting', 'delete_selected_text', 'replace_text', and 'append_text'.`,
          documentContent: this.document,
        };
    }
  }

  /**
   * Helper to count non-overlapping occurrences of a substring.
   */
  private countOccurrences(source: string, target: string): number {
    if (!target) return 0;
    let count = 0;
    let pos = 0;
    while ((pos = source.indexOf(target, pos)) !== -1) {
      count++;
      pos += target.length;
    }
    return count;
  }
}

// ============================================================================
// 4. Document Formatting Utilities (HTML <-> Markdown)
// ============================================================================

/**
 * Konverterer TipTap HTML til ren, velformet Markdown.
 * Bevarer overskrifter (#, ##, ###), afsnit med tomme linjer (\n\n),
 * fed (**tekst**), kursiv (*tekst*), understregning, lister og linjeskift.
 */
export function tiptapHtmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let md = html;

  // 1. Overskrifter h1-h6
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 2. Typografi
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  md = md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  md = md.replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');

  // 3. Lister
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  md = md.replace(/<\/(ul|ol)>/gi, '\n\n');

  // 4. Afsnit og linjeskift
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // 5. Fjern resterende HTML-tags
  md = md.replace(/<[^>]+>/g, '');

  // 6. Afkod basale HTML-entiteter
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');

  // 7. Ryd op i overskydende blanke linjer (maks 2 linjeskift i træk)
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Konverterer Markdown eller rå tekst til strukturerede TipTap HTML-blokke (<p>, <h1>, <h2> osv.).
 * Sikrer at linjeskift bliver til rigtige afsnit, og at tekst ikke utilsigtet arver overskrifts-styling.
 */
export function textToTipTapHtml(content: string): string {
  if (!content || typeof content !== 'string') return '';

  // Hvis indholdet allerede er HTML med blok-tags, returner direkte
  if (/<(p|h[1-6]|ul|ol|li|blockquote|table)[\s>]/i.test(content)) {
    return content;
  }

  const lines = content.split(/\r?\n/);
  const blocks: string[] = [];

  const formatInline = (text: string): string => {
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    return escaped;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const bulletMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push(`<p>• ${formatInline(bulletMatch[1])}</p>`);
      continue;
    }

    blocks.push(`<p>${formatInline(trimmed)}</p>`);
  }

  return blocks.length > 0 ? blocks.join('') : `<p>${formatInline(content)}</p>`;
}
