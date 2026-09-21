import React, { useState, useRef, useEffect } from 'react';
import { getSettings, callAI, DEFAULT_PROMPTS, syncServerAIConfig } from '../../store/settingsStore';
import { getDocuments, createDocument } from '../../store/documentStore';
import { Sparkles, ArrowUp, X, Check, Loader2, FileText, CheckCheck, Wand2, BookOpen, AlertCircle } from 'lucide-react';
import './AIPill.css';

import { GEMINI_TOOL_SCHEMAS, OPENAI_TOOL_SCHEMAS, tiptapHtmlToMarkdown, textToTipTapHtml } from '../../DocumentEditor';
import { getImTState, subscribeImTState } from '../../apps/ImTApplication/imtStateStore';

const QUICK_PROMPTS_TOP = [
  {
    id: 'grammar',
    label: 'Ret grammatik',
    prompt: 'Ret det markerede tekst for grammatiske fejl',
    icon: <CheckCheck size={13} color="#38bdf8" />
  }
];

const QUICK_PROMPTS_BOTTOM = [
  {
    id: 'formal',
    label: 'Gør mere professionel',
    prompt: 'Gør denne tekst mere professionel og velformuleret',
    icon: <Wand2 size={13} color="#a78bfa" />
  },
  {
    id: 'summary',
    label: 'Opsummer dokumentet',
    prompt: 'Opsummer dokumentet og indsæt et kort resumé i dokumentet',
    icon: <BookOpen size={13} color="#f59e0b" />
  },
  {
    id: 'shorten',
    label: 'Forkort teksten',
    prompt: 'Forkort teksten så den bliver mere koncis og skarp',
    icon: <FileText size={13} color="#10b981" />
  }
];

const AIPill = ({ isDashboard }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [dashboardResult, setDashboardResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contextText, setContextText] = useState('');
  const [currentSettings, setCurrentSettings] = useState(() => getSettings());
  const [imtState, setImtState] = useState(() => getImTState());
  const [imtAttached, setImtAttached] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const inputRef = useRef(null);
  const pillRef = useRef(null);

  useEffect(() => {
    // Hent altid den server-konfigurerede AI model ved opstart
    syncServerAIConfig();

    const handleSettingsUpdate = (e) => {
      if (e?.detail) {
        setCurrentSettings(e.detail);
      } else {
        setCurrentSettings(getSettings());
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  useEffect(() => {
    const handleSuggestionsUpdated = (e) => {
      if (Array.isArray(e.detail)) {
        setPendingSuggestions(e.detail);
      }
    };

    window.addEventListener('word:suggestions-updated', handleSuggestionsUpdated);
    window.dispatchEvent(new CustomEvent('word:query-suggestions'));

    return () => {
      window.removeEventListener('word:suggestions-updated', handleSuggestionsUpdated);
    };
  }, []);

  const handleAcceptAllSuggestions = (e) => {
    e?.stopPropagation?.();
    window.dispatchEvent(new CustomEvent('word:accept-all-suggestions'));
    setPendingSuggestions([]);
    setActionFeedback('Alle forslag godkendt');
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleRejectAllSuggestions = (e) => {
    e?.stopPropagation?.();
    window.dispatchEvent(new CustomEvent('word:reject-all-suggestions'));
    setPendingSuggestions([]);
    setActionFeedback('Alle forslag afvist');
    setTimeout(() => setActionFeedback(null), 3500);
  };

  useEffect(() => {
    const handleContextSelection = (e) => {
      setContextText(e.detail);
    };
    
    const handleClickOutside = (e) => {
      if (pillRef.current && !pillRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    const handleSettingsUpdated = (e) => {
      setCurrentSettings(e.detail || getSettings());
    };

    window.addEventListener('editorContextSelection', handleContextSelection);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    
    const unsubImT = subscribeImTState((state) => {
      setImtState(state);
      if (!state.isOpen) {
        setImtAttached(false);
      }
    });

    return () => {
      window.removeEventListener('editorContextSelection', handleContextSelection);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('settingsUpdated', handleSettingsUpdated);
      unsubImT();
    };
  }, []);

  const handleFocus = () => setIsExpanded(true);

  const closePill = () => {
    setIsExpanded(false);
  };

  // Direkte lynhurtig overførsel fra ImT til dokumentet (0s ventetid, 0 tokens)
  const handleDirectTransferFromImT = async () => {
    const imt = getImTState();
    if (!imt.isOpen) {
      setActionError('ImT-programmet er ikke åbent lige nu. Åbn ImT først.');
      setTimeout(() => setActionError(null), 4000);
      return;
    }

    const text = (imt.canvasText || '').trim();
    if (!text) {
      setActionError('ImT-kanvasset er tomt. Vælg eller udtræk tekst fra et billede i ImT først.');
      setTimeout(() => setActionError(null), 4000);
      return;
    }

    const activeEditor = window.__activeWordEditor;
    if (activeEditor) {
      window.dispatchEvent(new CustomEvent('executeEditorTool', {
        detail: {
          toolName: 'append_text',
          args: { text_to_add: '\n\n' + text },
          callback: (res) => {
            if (res.success) {
              setActionFeedback('Teksten fra ImT er overført til dokumentet');
              setTimeout(() => setActionFeedback(null), 3500);
            } else {
              setActionError(res.message || 'Kunne ikke overføre tekst');
              setTimeout(() => setActionError(null), 4000);
            }
          }
        }
      }));
    } else {
      try {
        const html = textToTipTapHtml(text);
        const newDoc = await createDocument('Noter fra ImT', html);
        if (newDoc && newDoc.id) {
          window.dispatchEvent(new CustomEvent('openDocumentGlobal', { detail: newDoc.id }));
          setActionFeedback('Nyt dokument oprettet med teksten fra ImT');
          setTimeout(() => setActionFeedback(null), 3500);
        }
      } catch (err) {
        setActionError(`Kunne ikke oprette dokument: ${err.message}`);
        setTimeout(() => setActionError(null), 4000);
      }
    }
  };

  const handleQuickPrompt = (promptText) => {
    const activeEditor = window.__activeWordEditor;
    const hasSelection = (activeEditor && !activeEditor.state.selection.empty) || !!contextText;
    
    if (promptText.includes('markerede') && !hasSelection) {
      setActionError('Marker venligst den tekst i dokumentet, som du ønsker at rette.');
      setTimeout(() => setActionError(null), 4000);
      return;
    }
    
    handleSend(promptText);
  };

  const handleSend = async (overridePrompt) => {
    const rawMessage = typeof overridePrompt === 'string' ? overridePrompt : input;
    if (!rawMessage || !rawMessage.trim()) return;

    const userMessage = rawMessage.trim();
    setInput('');
    setActionError(null);
    setActionFeedback(null);
    setDashboardResult(null);
    setIsLoading(true);

    const settings = getSettings();
    const activeEditor = window.__activeWordEditor;
    let fullDocMarkdown = '';
    let activeSelection = '';

    if (activeEditor) {
      try {
        const rawHtml = activeEditor.getHTML() || '';
        fullDocMarkdown = tiptapHtmlToMarkdown(rawHtml);
        if (!activeEditor.state.selection.empty) {
          activeSelection = activeEditor.state.doc.textBetween(
            activeEditor.state.selection.from,
            activeEditor.state.selection.to,
            '\n',
            '\n'
          );
        }
      } catch {}
    }
    
    if (!activeSelection && contextText) {
      activeSelection = contextText;
    }

    // Tjek om forespørgslen specifikt vedrører ImT
    const imt = getImTState();
    const mentionsImT = /imt|billede\s*til\s*tekst|image\s*to\s*text|kanvas|canvas|ocr/i.test(userMessage);
    const isImTContextNeeded = mentionsImT || imtAttached;

    // 1. Hvis forespørgslen kræver ImT, men ImT ikke er åbent
    if (isImTContextNeeded && !imt.isOpen) {
      setActionError('ImT-programmet er ikke åbent lige nu. Åbn ImT (f.eks. på Skrivebordet eller side-om-side) for at overføre tekst derfra.');
      setTimeout(() => setActionError(null), 4500);
      setIsLoading(false);
      return;
    }

    // 2. Hvis forespørgslen kræver ImT, men kanvasset er tomt
    if (isImTContextNeeded && (!imt.canvasText || !imt.canvasText.trim())) {
      setActionError('ImT er åbent, men der er ingen tekst på kanvasset endnu. Vælg eller udtræk tekst fra et billede i ImT først.');
      setTimeout(() => setActionError(null), 4500);
      setIsLoading(false);
      return;
    }

    // 3. Tjek for direkte 1:1 overførsel uden behov for AI omskrivning (0s ventetid, 0 tokens)
    const isDirectTransfer = isImTContextNeeded &&
      /(?:overfør|indsæt|kopier|flyt|put|send)\s+(?:al\s+|alt\s+)?(?:tekst(?:en)?\s+)?(?:fra\s+)?(?:imt|kanvas|canvas|billedet?)?(?:\s+til\s+(?:mit\s+)?dokument(?:et)?)?$/i.test(userMessage) &&
      !/(?:opsummer|forkort|omskriv|oversæt|ret|formuler|punktform|tabel|professionel|grammatik)/i.test(userMessage);

    if (isDirectTransfer) {
      await handleDirectTransferFromImT();
      setIsLoading(false);
      setImtAttached(false);
      return;
    }

    // Byg den rigtige prompt ud fra konfigurationen i Indstillinger
    let finalPrompt = userMessage;
    
    if (isDashboard) {
      const allDocs = await getDocuments();
      const docsContext = (Array.isArray(allDocs) ? allDocs : []).map(d => {
        const rawText = (d.content || '').replace(/<[^>]*>?/gm, ' ');
        return `ID: ${d.id} | Titel: ${d.title || 'Navnløst dokument'} | Uddrag: ${rawText.substring(0, 500)}...`;
      }).join('\n\n');

      const template = settings.dashboardPromptTemplate || DEFAULT_PROMPTS.dashboardPromptTemplate;
      finalPrompt = template
        .replace('{DOCS_LIST}', docsContext)
        .replace('{USER_QUERY}', userMessage);
    } else if (isImTContextNeeded) {
      // Slank kontekst: KUN ImT-teksten og nødvendigt dokumentoverblik (undgår at sende 50.000 tegn dokument unødigt)
      let contextInfo = `[AKTIV EKSTERN APP: IMT (BILLEDE TIL TEKST) ER ÅBENT PÅ SKÆRMEN]\nTeksten på ImT-kanvasset er:\n"""\n${imt.canvasText.trim()}\n"""\n\n`;

      if (activeSelection) {
        contextInfo += `Brugeren har markeret denne tekst i dokumentet, som skal erstattes eller arbejdes med:\n"${activeSelection}"\n\n`;
      } else if (fullDocMarkdown) {
        const docSnippet = fullDocMarkdown.length > 2000 ? fullDocMarkdown.substring(0, 2000) + '... [forkortet]' : fullDocMarkdown;
        contextInfo += `Kort dokumentoverblik:\n"""\n${docSnippet}\n"""\n\n`;
      }

      contextInfo += `INSTRUKTION FOR IMT:
Overfør, tilføj eller indsæt teksten i dokumentet ved hjælp af værktøjet 'append_text' eller 'insert_text'. Hvis brugeren har bedt om at opsummere, omskrive, oversætte eller formatere ImT-teksten, udfør opgaven på ImT-teksten og indsæt resultatet i dokumentet.\n\n`;

      finalPrompt = `${contextInfo}Brugerens opgave: ${userMessage}`;
      setImtAttached(false);
    } else {
      // Normal dokumentforespørgsel (100% fri for ImT-tekst!)
      let documentInfo = '';
      if (activeSelection) {
        documentInfo += `Brugeren har markeret denne tekst i dokumentet:\n"${activeSelection}"\n\n`;
      } else if (fullDocMarkdown) {
        const trimmedDoc = fullDocMarkdown.length > 30000 ? fullDocMarkdown.substring(0, 30000) + '...' : fullDocMarkdown;
        documentInfo += `Nuværende dokumentindhold (med overskrifter og formatering):\n"""\n${trimmedDoc}\n"""\n\n`;
      }
      finalPrompt = `${documentInfo}Brugerens forespørgsel: ${userMessage}`;
    }
    
    try {
      const toolEnabled = settings.enableToolInstructions !== false;
      let toolInstruction = '';
      if (toolEnabled && !isDashboard) {
        toolInstruction = `\n\n${settings.toolInstructions || DEFAULT_PROMPTS.toolInstructions}`;
      }

      // Server Central og alle udbydere (Gemini, Ollama, OpenAI mv.) anvender standardiseret OpenAI tools format
      const tools = OPENAI_TOOL_SCHEMAS;

      const aiResponse = await callAI({
        prompt: finalPrompt,
        systemInstruction: toolInstruction,
        tools: toolEnabled && !isDashboard ? tools : null
      });

      let processedText = (typeof aiResponse === 'string' ? aiResponse : (aiResponse.text || ''));

      // Hjælpefunktion til at rense tegn fra tekst (fx *, -, # osv.)
      const cleanCharactersFromText = (text, message) => {
        if (!text) return text;
        let cleaned = text;

        const punctuationMatches = message.match(/[\*\-_#~`'"+=^%$@!&|/\\<>()[\]{}]/g);
        if (punctuationMatches && punctuationMatches.length > 0) {
          const charsToStrip = punctuationMatches.filter(c => {
            if (c === '?' && message.endsWith('?') && !message.includes("'?'") && !message.includes('"?"')) return false;
            return true;
          });
          if (charsToStrip.length > 0) {
            const uniqueChars = Array.from(new Set(charsToStrip));
            const escaped = uniqueChars.map(c => '\\' + c).join('');
            const regex = new RegExp(`[${escaped}]`, 'g');
            cleaned = cleaned.replace(regex, '');
          }
        }

        if (/stjerne|asterisk/i.test(message)) {
          cleaned = cleaned.replace(/\*/g, '');
        }
        if (/bindestreg|tankestreg|dash|hyphen/i.test(message)) {
          cleaned = cleaned.replace(/-/g, '');
        }
        if (/haveslåge|hashtag|havelåge|nummertegn/i.test(message)) {
          cleaned = cleaned.replace(/#/g, '');
        }

        return cleaned;
      };

      // Hjælpefunktion til intelligent lokalisering af afsnit ud fra forespørgsel (fx "første afsnit om historie og tæmning")
      const findParagraphByQuery = (fullMarkdown, query) => {
        if (!fullMarkdown || !query) return null;

        // Split dokumentet i blokke (afsnit, overskrifter)
        const blocks = fullMarkdown.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
        if (blocks.length === 0) return null;

        const lowerQuery = query.toLowerCase();
        const isFirstParagraph = /(?:første|1\.|1ste)\s+(?:afsnit|paragraf|sektion|del)/i.test(lowerQuery);
        const isLastParagraph = /(?:sidste|sidst|sidste)\s+(?:afsnit|paragraf|sektion|del)/i.test(lowerQuery);
        const isSecondParagraph = /(?:andet|2\.|2det)\s+(?:afsnit|paragraf|sektion|del)/i.test(lowerQuery);

        // Filtrer ikke-overskrifts afsnit først (eller alle blokke)
        const contentBlocks = blocks.filter(b => !b.startsWith('#'));
        const candidateBlocks = contentBlocks.length > 0 ? contentBlocks : blocks;

        // Find søgeord fra forespørgslen (ekskluder stopord)
        const stopWords = new Set([
          'du', 'skal', 'kan', 'vil', 'gider', 'slet', 'slette', 'fjern', 'fjerne',
          'det', 'den', 'de', 'et', 'en', 'første', 'andet', 'sidste', 'afsnit',
          'der', 'som', 'handler', 'om', 'og', 'i', 'på', 'med', 'til', 'fra', 'for', 'af', 'så', 'at'
        ]);

        const queryWords = lowerQuery
          .replace(/[^\wæøå\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));

        // Hvis der er specifikke nøgleord (fx "historie", "tæmning")
        if (queryWords.length > 0) {
          let bestBlock = null;
          let bestScore = -1;

          for (let i = 0; i < candidateBlocks.length; i++) {
            const block = candidateBlocks[i];
            const lowerBlock = block.toLowerCase();
            let matches = 0;
            for (const word of queryWords) {
              if (lowerBlock.includes(word)) {
                matches++;
              }
            }

            if (matches > 0) {
              let score = matches * 10;
              if (isFirstParagraph) score += Math.max(0, 5 - i);
              if (isLastParagraph && i === candidateBlocks.length - 1) score += 5;
              if (score > bestScore) {
                bestScore = score;
                bestBlock = block;
              }
            }
          }

          if (bestBlock) return bestBlock;
        }

        // Positionsbaseret match hvis ingen specifikke ord matchede
        if (isFirstParagraph && candidateBlocks.length > 0) {
          return candidateBlocks[0];
        }
        if (isSecondParagraph && candidateBlocks.length > 1) {
          return candidateBlocks[1];
        }
        if (isLastParagraph && candidateBlocks.length > 0) {
          return candidateBlocks[candidateBlocks.length - 1];
        }

        return null;
      };

      // Vurder brugerens egentlige hensigt
      const trimmedUserMsg = userMessage.trim();

      // 1. Bedes der om at fjerne eller nulstille formatering (uden at slette teksten)?
      const isFormattingRequest =
        /(?:ryd|fjern|slet|nulstil|clear|strip|remove)\s+(?:al\s+|alt\s+)?(?:formatering|formatting|typografi|style)/i.test(trimmedUserMsg) ||
        /(?:formatering|formatting).*?(?:væk|fjern|slet|nulstil)/i.test(trimmedUserMsg) ||
        /(?:fjern|slet)\s+(?:al\s+)?(?:fed|kursiv|understregning)/i.test(trimmedUserMsg) ||
        /lad teksten blive/i.test(trimmedUserMsg) ||
        /behold teksten/i.test(trimmedUserMsg);

      // 2. Bedes der KUN om at rense specifikke tegn / symboler (fx *, -, #) uden at slette selve afsnittet/teksten?
      const isCharacterOnlyCleaning =
        !isFormattingRequest &&
        /(?:fjern|slet|strip|remove)\s+(?:alle\s+|alt\s+)?(?:[\*\-_#~`'"+=^%$@!&|/\\<>()[\]{}]|stjern(?:e|er)|bindestreg(?:er)?|tankestreg(?:er)?|hashtag(?:s)?|havelåge(?:r)?|specialtegn|symbol(?:er)?)/i.test(trimmedUserMsg) &&
        !/(?:afsnit|linje|sætning|kapitel|del|tekst(?:en)?|indhold|historie|introduktion|konklusion)/i.test(trimmedUserMsg);

      // 3. Bedes der om sletning af tekst, et afsnit, en sætning, markering eller dokument?
      const isDeleteContentIntent =
        !isFormattingRequest &&
        !isCharacterOnlyCleaning &&
        /(?:slet|slette|fjern|fjerne|delete|remove|drop|udryd)/i.test(trimmedUserMsg);

      // Sikker afvikling af værktøjskald med absolut beskyttelse mod utilsigtet sletning
      const executeToolSafely = (name, rawArgs) => {
        let toolName = name;
        let args = rawArgs ? { ...rawArgs } : {};

        // 0. Hvis brugeren bad om at fjerne formatering
        if (isFormattingRequest) {
          toolName = 'clear_formatting';
          args = {};
        }

        // 1. replace_entire_document
        if (toolName === 'replace_entire_document') {
          if (!args.new_content || typeof args.new_content !== 'string' || args.new_content.trim() === '') {
            setActionError('Dokumentindholdet må ikke overskrives med tomt indhold.');
            setTimeout(() => setActionError(null), 4000);
            return false;
          }
        }

        // 2. delete_selected_text
        if (toolName === 'delete_selected_text') {
          if (activeSelection) {
            if (isCharacterOnlyCleaning) {
              const cleaned = cleanCharactersFromText(activeSelection, userMessage);
              toolName = 'replace_selected_text';
              args = { new_text: cleaned, original_text: activeSelection };
            } else if (!isDeleteContentIntent) {
              setActionError('Dokumentteksten blev ikke slettet, da din besked ikke bad om at slette teksten.');
              setTimeout(() => setActionError(null), 4000);
              return false;
            }
          } else {
            if (isDeleteContentIntent && fullDocMarkdown) {
              const matched = findParagraphByQuery(fullDocMarkdown, userMessage);
              if (matched) {
                toolName = 'replace_text';
                args = { exact_text_to_replace: matched, new_text: '' };
              } else {
                setActionError('Ingen tekst er markeret. Marker venligst det afsnit, du ønsker at slette.');
                setTimeout(() => setActionError(null), 4000);
                return false;
              }
            } else {
              setActionError('Ingen aktiv markering at slette.');
              setTimeout(() => setActionError(null), 4000);
              return false;
            }
          }
        }

        // 3. replace_selected_text
        if (toolName === 'replace_selected_text') {
          if (!args.new_text || args.new_text.trim() === '') {
            if (isDeleteContentIntent && activeSelection) {
              toolName = 'delete_selected_text';
              args = {};
            } else if (isCharacterOnlyCleaning && activeSelection) {
              const cleaned = cleanCharactersFromText(activeSelection, userMessage);
              args = { new_text: cleaned, original_text: activeSelection };
            } else {
              setActionError('Teksten kan ikke erstattes med tomt indhold.');
              setTimeout(() => setActionError(null), 4000);
              return false;
            }
          } else {
            args = { ...args, original_text: activeSelection };
          }
        }

        // 4. replace_text
        if (toolName === 'replace_text') {
          if (!args.exact_text_to_replace || typeof args.exact_text_to_replace !== 'string' || args.exact_text_to_replace.trim() === '') {
            return false;
          }

          if (!args.new_text || args.new_text.trim() === '') {
            if (isDeleteContentIntent) {
              args.new_text = '';
            } else if (isCharacterOnlyCleaning) {
              const cleaned = cleanCharactersFromText(args.exact_text_to_replace, userMessage);
              args.new_text = cleaned;
            } else {
              return false;
            }
          }

          if (activeSelection && args.exact_text_to_replace) {
            if (args.exact_text_to_replace === activeSelection || args.exact_text_to_replace.trim() === activeSelection.trim() || args.exact_text_to_replace.length > 50) {
              toolName = 'replace_selected_text';
              args = { new_text: args.new_text, original_text: activeSelection };
            }
          }

          if (!activeSelection && (args.exact_text_to_replace === fullDocMarkdown || (fullDocMarkdown && args.exact_text_to_replace.length > 200 && fullDocMarkdown.includes(args.exact_text_to_replace)))) {
            if (args.new_text && args.new_text.trim() !== '') {
              toolName = 'replace_entire_document';
              args = { new_content: args.new_text };
            }
          }
        }

        // 5. insert_text
        if (toolName === 'insert_text' || toolName === 'insert_at_cursor') {
          if (!args.text && args.new_text) {
            args.text = args.new_text;
          }
        }

        // Tjek om der er et aktivt dokument; hvis ikke, opret et nyt dokument med indholdet
        if (!window.__activeWordEditor) {
          const textToInsert = args?.new_content || args?.text_to_add || args?.text || args?.new_text || '';
          if (textToInsert && typeof textToInsert === 'string') {
            createDocument('Dokument fra ImT', textToTipTapHtml(textToInsert)).then(newDoc => {
              if (newDoc && newDoc.id) {
                window.dispatchEvent(new CustomEvent('openDocumentGlobal', { detail: newDoc.id }));
                setActionFeedback('Nyt dokument oprettet');
                setTimeout(() => setActionFeedback(null), 3500);
              }
            }).catch(err => {
              setActionError('Kunne ikke oprette dokument: ' + err.message);
              setTimeout(() => setActionError(null), 4000);
            });
            return true;
          }
        }

        // Udsend hændelse til WordApplication
        window.dispatchEvent(new CustomEvent('executeEditorTool', {
          detail: {
            toolName,
            args,
            callback: (res) => {
              if (res.success) {
                setActionFeedback('AI-forslag oprettet i dokumentet');
                setTimeout(() => setActionFeedback(null), 3500);
              } else {
                setActionError(res.message || 'Handlingen kunne ikke udføres');
                setTimeout(() => setActionError(null), 4000);
              }
            }
          }
        }));

        return true;
      };

      let toolWasRun = false;

      // 1. Tjek om AI'en har returneret et native værktøjskald
      if (aiResponse.toolCall) {
        const { name, args } = aiResponse.toolCall;
        toolWasRun = executeToolSafely(name, args);
      } else {
        // 2. Tjek for JSON-værktøjskald i ren tekst (fra f.eks. lokale modeller)
        const jsonBlockMatch = processedText.match(/```(?:json)?\s*\n?(\{[\s\S]*?"(?:tool|name)"[\s\S]*?\})\s*\n?```/) ||
          processedText.match(/(\{[\s\S]*?"tool"[\s\S]*?"(?:exact_text_to_replace|new_text|new_content)"[\s\S]*?\})/);

        if (jsonBlockMatch) {
          try {
            const parsed = JSON.parse(jsonBlockMatch[1]);
            const toolName = parsed.tool || parsed.name;
            const args = parsed.args || parsed.arguments || parsed;
            toolWasRun = executeToolSafely(toolName, args);
          } catch {}
        } else {
          // 3. Tjek om AI'en har brugt legacy replace-værktøjet
          const replaceRegex = /```replace\s*\n([\s\S]*?)```/;
          const match = processedText.match(replaceRegex);

          if (match) {
            let replacementText = match[1].trim();
            replacementText = replacementText.replace(/font-family\s*:\s*[^;\"']+[;]?/gi, '');

            if (replacementText === '') {
              if (isDeleteContentIntent && activeSelection) {
                toolWasRun = executeToolSafely('delete_selected_text', {});
              } else if (isFormattingRequest) {
                toolWasRun = executeToolSafely('clear_formatting', {});
              } else if (isCharacterOnlyCleaning && activeSelection) {
                const cleaned = cleanCharactersFromText(activeSelection, userMessage);
                toolWasRun = executeToolSafely('replace_selected_text', { new_text: cleaned, original_text: activeSelection });
              } else if (isDeleteContentIntent) {
                toolWasRun = executeToolSafely('delete_selected_text', {});
              } else {
                setActionError('Handlingen blev standset: Teksten slettes ikke automatisk.');
                setTimeout(() => setActionError(null), 4000);
              }
            } else if (!activeSelection && fullDocMarkdown) {
              toolWasRun = executeToolSafely('replace_entire_document', { new_content: replacementText });
            } else {
              toolWasRun = executeToolSafely('replace_selected_text', { new_text: replacementText, original_text: activeSelection });
            }
          } else {
            // Hvis der ikke var et værktøjskald, men brugeren specifikt bad om at rense tegn, slette eller rydde formatering:
            if (isFormattingRequest) {
              toolWasRun = executeToolSafely('clear_formatting', {});
            } else if (activeSelection && isCharacterOnlyCleaning) {
              const cleaned = cleanCharactersFromText(activeSelection, userMessage);
              if (cleaned !== activeSelection) {
                toolWasRun = executeToolSafely('replace_selected_text', { new_text: cleaned, original_text: activeSelection });
              }
            } else if (!activeSelection && fullDocMarkdown && isCharacterOnlyCleaning) {
              const cleaned = cleanCharactersFromText(fullDocMarkdown, userMessage);
              if (cleaned !== fullDocMarkdown) {
                toolWasRun = executeToolSafely('replace_entire_document', { new_content: cleaned });
              }
            } else if (isDeleteContentIntent && !activeSelection && fullDocMarkdown) {
              const matched = findParagraphByQuery(fullDocMarkdown, userMessage);
              if (matched) {
                toolWasRun = executeToolSafely('replace_text', { exact_text_to_replace: matched, new_text: '' });
              }
            }
          }
        }
      }

      if (!toolWasRun) {
        // Sikkerhedsfilter: Rens eventuel uønsket robot-præambel
        processedText = processedText
          .replace(/^(?:På grund af dine instruktioner|Eftersom du ikke har bedt om|Da der ikke er markeret nogen tekst|Fordi dette er en ny tekstskrivningsopgave|Da du ikke udtrykkeligt har bedt om)[\s\S]*?(?:for dig:?|her er teksten:?|følgende tekst:?|:\s*|\n\n)\s*(?:```(?:markdown|text)?\s*\n?)?/i, '')
          .replace(/```\s*$/i, '')
          .replace(/^```(?:markdown|text)?\s*\n([\s\S]*?)\n```$/i, '$1')
          .trim();

        if (isDashboard) {
          if (processedText) {
            setDashboardResult(processedText);
          }
        } else if (processedText) {
          if (activeSelection) {
            executeToolSafely('replace_selected_text', { new_text: processedText, original_text: activeSelection });
          } else {
            executeToolSafely('append_text', { text_to_add: '\n\n' + processedText });
          }
        }
      }

    } catch (err) {
      setActionError(`Fejl: ${err.message}`);
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'; // Nulstil højde efter send
      }
    }
  };

  // Parser der omdanner [Titel](/doc/ID) til rigtige links
  const renderMessage = (text) => {
    if (!text) return null;
    if (latestResponse?.role === 'error') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>{text}</span>
          {text.includes('Indstillinger') && (
            <button 
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('openSettings'))}
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ⚙️ Åbn Indstillinger
            </button>
          )}
        </div>
      );
    }
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      parts.push(text.substring(lastIndex, match.index));
      const url = match[2];
      const docId = url.replace('/doc/', '');
      parts.push(
        <a 
          key={match.index} 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('openDocumentGlobal', { detail: docId }));
          }}
          style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {match[1]}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }
    parts.push(text.substring(lastIndex));
    return parts.length > 0 ? parts : text;
  };

  return (
    <div 
      ref={pillRef}
      className={`ai-pill-container ${isExpanded ? 'expanded' : ''}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        // Luk på hover-out hvis vi ikke har skrevet noget og der ikke er et aktivt svar
        if (document.activeElement !== inputRef.current && !latestResponse && !input) {
          setIsExpanded(false);
        }
      }}
    >
      {/* Google Docs forslagsbar (Accepter alt / Afvis alt) */}
      {pendingSuggestions.length > 0 && (
        <div className="ai-suggestions-bar" onClick={e => e.stopPropagation()}>
          <div className="ai-suggestions-info">
            <Sparkles size={14} className="ai-suggestions-icon" />
            <span className="ai-suggestions-count">
              {pendingSuggestions.length} {pendingSuggestions.length === 1 ? 'forslag fra AI' : 'forslag fra AI'}
            </span>
          </div>
          <div className="ai-suggestions-actions">
            <button
              type="button"
              className="ai-suggestion-btn accept-all"
              onClick={handleAcceptAllSuggestions}
              title="Godkend alle AI-forslag og bevar den nye tekst"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>Accepter alt</span>
            </button>
            <button
              type="button"
              className="ai-suggestion-btn reject-all"
              onClick={handleRejectAllSuggestions}
              title="Afvis alle AI-forslag og behold den oprindelige tekst"
            >
              <X size={13} strokeWidth={2.5} />
              <span>Afvis alt</span>
            </button>
          </div>
        </div>
      )}

      {/* Kontekst Indikator (vises kun når tekst er markeret) */}
      {isExpanded && contextText && (
        <div className="ai-context-badge">
          <div className="ai-context-icon">
            <FileText size={13} color="#38bdf8" />
          </div>
          <div className="ai-context-content">
            <span className="ai-context-label">Medsender markering:</span> 
            <span className="ai-context-text">{contextText}</span>
          </div>
        </div>
      )}

      {/* ImT Status Badge (vises hvis ImT er vedhæftet manuelt) */}
      {isExpanded && imtState.isOpen && imtAttached && (
        <div className="ai-context-badge imt-badge">
          <div className="ai-context-icon">
            <FileText size={13} color="#38bdf8" />
          </div>
          <div className="ai-context-content">
            <span className="ai-context-label">ImT vedhæftet:</span> 
            <span className="ai-context-text">
              {imtState.canvasText ? `${imtState.canvasText.substring(0, 40)}... (${imtState.wordCount} ord)` : '(tomt kanvas)'}
            </span>
          </div>
          <button type="button" className="ai-badge-close" onClick={() => setImtAttached(false)} title="Fjern ImT tekst">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Handling status badge (f.eks. ved dokumentredigering) */}
      {isExpanded && actionFeedback && (
        <div className="ai-action-badge">
          <Check size={13} color="#22c55e" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Fejlstatus badge hvis noget gik galt */}
      {isExpanded && actionError && (
        <div className="ai-error-badge">
          <AlertCircle size={13} color="#f87171" />
          <span>{actionError}</span>
          <button type="button" className="ai-badge-close" onClick={() => setActionError(null)} title="Luk">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Dashboard resultat (vises kun på forsiden/skrivebordet) */}
      {isExpanded && isDashboard && dashboardResult && (
        <div className="ai-dashboard-badge">
          <Sparkles size={13} color="#38bdf8" />
          <div className="ai-dashboard-content">{renderMessage(dashboardResult)}</div>
          <button type="button" className="ai-badge-close" onClick={() => setDashboardResult(null)} title="Luk">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Hurtige prompt-piller (svæver over AI-pillen ved hover - 1 foroven, 3 forneden) */}
      {isExpanded && !isLoading && !input.trim() && (
        <div className="ai-quick-prompts">
          {imtState.isOpen && imtState.canvasText.trim() && (
            <div className="ai-quick-row imt-row">
              <button
                type="button"
                className="ai-quick-chip imt-chip"
                onClick={handleDirectTransferFromImT}
                title="Overfør al tekst fra ImT direkte til dokumentet (0s ventetid, 0 tokens)"
              >
                <span className="ai-quick-chip-icon"><ArrowUp size={13} color="#60a5fa" style={{ transform: 'rotate(45deg)' }} /></span>
                <span className="ai-quick-chip-label">Overfør fra ImT (direkte)</span>
              </button>
              <button
                type="button"
                className="ai-quick-chip"
                onClick={() => handleSend('Opsummer teksten fra ImT og indsæt et kort resumé i dokumentet')}
                title="Få AI'en til at opsummere ImT-teksten og indsætte resuméet"
              >
                <span className="ai-quick-chip-icon"><Sparkles size={13} color="#a78bfa" /></span>
                <span className="ai-quick-chip-label">Opsummer ImT tekst</span>
              </button>
            </div>
          )}
          <div className="ai-quick-row top">
            {QUICK_PROMPTS_TOP.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ai-quick-chip"
                onClick={() => handleQuickPrompt(item.prompt)}
                title={item.prompt}
              >
                <span className="ai-quick-chip-icon">{item.icon}</span>
                <span className="ai-quick-chip-label">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="ai-quick-row bottom">
            {QUICK_PROMPTS_BOTTOM.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ai-quick-chip"
                onClick={() => handleQuickPrompt(item.prompt)}
                title={item.prompt}
              >
                <span className="ai-quick-chip-icon">{item.icon}</span>
                <span className="ai-quick-chip-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Pille */}
      <div className={`ai-pill ${isLoading ? 'working' : ''}`}>
        {isLoading && <div className="ai-working-bar" />}

        <button 
          type="button"
          className={`ai-icon-btn ${isLoading ? 'working' : ''}`}
          title={`Aktiv AI: ${
            currentSettings.aiProvider === 'local' 
              ? `Lokal AI (${currentSettings.localModelName || 'llama3'})` 
              : (currentSettings.aiProvider || 'Gemini')
          }. Klik for at åbne Indstillinger.`}
          onClick={() => window.dispatchEvent(new CustomEvent('openSettings'))}
        >
          <Sparkles size={17} className={`ai-icon-svg ${isLoading ? 'working' : ''}`} />
        </button>
        
        {isExpanded && (
          <>
            <textarea 
              ref={inputRef}
              className="ai-input" 
              placeholder={isLoading ? 'Arbejder på dokumentet...' : `Spørg ${
                currentSettings.aiProvider === 'local' 
                  ? `Lokal AI (${currentSettings.localModelName || 'qwen3.5:9b'})` 
                  : (currentSettings.aiProvider === 'gemini' 
                      ? `Gemini (${currentSettings.geminiModel || 'gemini-2.5-flash'})` 
                      : (currentSettings.aiProvider === 'openai' 
                          ? 'OpenAI' 
                          : (currentSettings.aiProvider === 'anthropic' 
                              ? 'Claude' 
                              : (currentSettings.aiProvider === 'server'
                                  ? `Server (${currentSettings.serverModelName || currentSettings.geminiModel || 'gemini-2.5-flash'})`
                                  : (currentSettings.aiProvider || 'Gemini')))))
              }`} 
              value={input}
              onChange={handleInput}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows="1"
            />

            {imtState.isOpen && (
              <button 
                type="button" 
                className={`ai-imt-tag ${imtAttached ? 'attached' : ''}`}
                onClick={() => setImtAttached(prev => !prev)}
                title={imtAttached 
                  ? `ImT tekst er vedhæftet (${imtState.wordCount} ord). Klik for at fjerne.` 
                  : `ImT er åbent (${imtState.wordCount} ord). Klik for at vedhæfte til næste AI-promt.`}
              >
                <span className={`ai-imt-dot ${imtAttached ? 'active' : ''}`} />
                <span className="ai-imt-name">{imtAttached ? 'ImT Aktiv' : '+ ImT'}</span>
              </button>
            )}

            <button 
              type="button" 
              className="ai-engine-tag"
              onClick={() => window.dispatchEvent(new CustomEvent('openSettings'))}
              title="Aktiv AI. Klik for at skifte model i Indstillinger"
            >
              <span className="ai-engine-dot" />
              <span className="ai-engine-name">
                {currentSettings.aiProvider === 'local' 
                  ? (currentSettings.localModelName || 'Lokal AI') 
                  : (currentSettings.aiProvider === 'gemini' 
                      ? (currentSettings.geminiModel || 'Gemini') 
                      : (currentSettings.aiProvider === 'server'
                          ? (currentSettings.serverModelName || currentSettings.geminiModel || 'Server AI')
                          : (currentSettings.aiProvider || 'Gemini')))}
              </span>
            </button>
            
            <button 
              type="button"
              className={`ai-send-btn ${input.trim() ? 'active' : ''} ${isLoading ? 'loading' : ''}`} 
              onClick={handleSend} 
              disabled={!input.trim() || isLoading}
              title={isLoading ? 'Arbejder...' : 'Send'}
            >
              {isLoading ? (
                <Loader2 size={16} className="ai-spin" />
              ) : (
                <ArrowUp size={16} strokeWidth={2.4} />
              )}
            </button>
            
            {input.trim() && (
              <button 
                type="button"
                className="ai-close-btn" 
                onClick={() => { setInput(''); if (inputRef.current) inputRef.current.style.height = 'auto'; }}
                title="Ryd tekst"
              >
                <X size={15} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AIPill;
