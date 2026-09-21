// src/apps/ImTApplication/imtStateStore.ts

export interface ImTState {
  isOpen: boolean;
  canvasText: string;
  charCount: number;
  wordCount: number;
}

const STORAGE_TEXT_KEY = 'imt_canvas_text';

let currentState: ImTState = {
  isOpen: false,
  canvasText: '',
  charCount: 0,
  wordCount: 0,
};

// Initialiser fra localStorage hvis tilgængelig
try {
  const savedText = localStorage.getItem(STORAGE_TEXT_KEY) || '';
  const trimmed = savedText.trim();
  currentState.canvasText = savedText;
  currentState.charCount = savedText.length;
  currentState.wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
} catch (e) {
  console.warn('[ImT] Kunne ikke læse gemt tekst fra localStorage:', e);
}

// Synkroniser til window.__imtState til hurtig global adgang
if (typeof window !== 'undefined') {
  (window as any).__imtState = currentState;
}

type Listener = (state: ImTState) => void;
const listeners = new Set<Listener>();

const notify = () => {
  if (typeof window !== 'undefined') {
    (window as any).__imtState = { ...currentState };
    window.dispatchEvent(new CustomEvent('imt:state-changed', { detail: currentState }));
  }
  listeners.forEach(fn => {
    try {
      fn(currentState);
    } catch (err) {
      console.error('[ImT] Fejl i state lytter:', err);
    }
  });
};

export const getImTState = (): ImTState => {
  return { ...currentState };
};

export const isImTOpen = (): boolean => {
  return currentState.isOpen;
};

export const getImTCanvasText = (): string => {
  return currentState.canvasText;
};

export const setImTOpen = (isOpen: boolean): void => {
  if (currentState.isOpen === isOpen) return;
  currentState = {
    ...currentState,
    isOpen,
  };
  notify();
};

export const setImTCanvasText = (text: string): void => {
  const trimmed = (text || '').trim();
  const charCount = (text || '').length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  currentState = {
    ...currentState,
    canvasText: text || '',
    charCount,
    wordCount,
  };

  try {
    localStorage.setItem(STORAGE_TEXT_KEY, text || '');
  } catch (e) {
    console.warn('[ImT] Kunne ikke gemme tekst i localStorage:', e);
  }

  notify();
};

export const clearImTCanvas = (): void => {
  setImTCanvasText('');
};

export const subscribeImTState = (callback: Listener): (() => void) => {
  listeners.add(callback);
  callback(currentState);
  return () => {
    listeners.delete(callback);
  };
};

export default {
  getImTState,
  isImTOpen,
  getImTCanvasText,
  setImTOpen,
  setImTCanvasText,
  clearImTCanvas,
  subscribeImTState,
};
