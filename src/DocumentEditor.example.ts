/**
 * DocumentEditor.example.ts
 *
 * Mock example demonstrating DocumentEditor initialization, tool execution,
 * and the LLM feedback loop (including graceful error recovery).
 */

import { DocumentEditor, GEMINI_TOOL_SCHEMAS, OPENAI_TOOL_SCHEMAS } from './DocumentEditor.ts';

console.log('=== 1. Exported Tool Schemas ===');
console.log('Gemini Tool Definitions Count:', GEMINI_TOOL_SCHEMAS.length);
console.log('Tools:', GEMINI_TOOL_SCHEMAS.map(t => t.name).join(', '));
console.log('OpenAI Tool Definitions Count:', OPENAI_TOOL_SCHEMAS.length);

console.log('\n=== 2. DocumentEditor Initialization ===');
const initialDocument = `
# Project Proposal

This is an early draft proposal for the new mobile application.
Status: Under Review.
Author: Alice
`.trim();

const editor = new DocumentEditor(initialDocument);
console.log('--- Initial Document Content ---');
console.log(editor.getContent());

console.log('\n=== 3. Simulated LLM Tool Calls ===');

// --- Simulation A: append_text tool ---
console.log('\n[Call 1: append_text]');
const appendCallArgs = {
  text_to_add: '\n\n## Timeline\nEstimated launch is Q4 2026.',
};
const appendResponse = editor.handleToolCall('append_text', appendCallArgs);
console.log('LLM Tool Response ->', appendResponse);

// --- Simulation B: replace_text tool (Successful) ---
console.log('\n[Call 2: replace_text (Success)]');
const replaceSuccessArgs = {
  exact_text_to_replace: 'Status: Under Review.',
  new_text: 'Status: Approved by Management.',
};
const replaceSuccessResponse = editor.handleToolCall('replace_text', replaceSuccessArgs);
console.log('LLM Tool Response ->', replaceSuccessResponse);

// --- Simulation C: replace_text tool (Text Not Found / Hallucination - Feedback loop) ---
console.log('\n[Call 3: replace_text (Error Handling / Feedback to LLM)]');
const replaceFailArgs = {
  // Notice the intentional typo: 'early draft note' instead of 'early draft proposal'
  exact_text_to_replace: 'This is an early draft note for the new mobile application.',
  new_text: 'This is the final proposal.',
};
const replaceFailResponse = editor.handleToolCall('replace_text', replaceFailArgs);
console.log('LLM Tool Response (Polite Error for LLM) ->');
console.log(replaceFailResponse);

// --- Simulation D: Local 8B Model sends args as raw JSON string ---
console.log('\n[Call 4: Small Local Model passing stringified JSON arguments]');
const rawJsonArgs = JSON.stringify({
  exact_text_to_replace: 'Author: Alice',
  new_text: 'Author: Alice & Bob',
});
const stringifiedResponse = editor.handleToolCall('replace_text', rawJsonArgs);
console.log('LLM Tool Response ->', stringifiedResponse);

// --- Simulation E: Deletion via empty string ---
console.log('\n[Call 5: Deleting text by setting new_text to empty string]');
const deleteArgs = {
  exact_text_to_replace: 'Author: Alice & Bob\n',
  new_text: '',
};
const deleteResponse = editor.handleToolCall('replace_text', deleteArgs);
console.log('LLM Tool Response ->', deleteResponse);

// --- Simulation F: Unknown Tool Call ---
console.log('\n[Call 6: Unknown Tool Call]');
const unknownToolResponse = editor.handleToolCall('format_bold', { text: 'test' });
console.log('LLM Tool Response ->', unknownToolResponse);

console.log('\n=== 4. Final Document Content ===');
console.log('--------------------------------------------------');
console.log(editor.getContent());
console.log('--------------------------------------------------');
