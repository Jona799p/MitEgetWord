import React, { useState, useEffect } from 'react';
import { getDocument, saveDocument } from '../../store/documentStore';

const PanelTitle = ({ docId }) => {
  const [doc, setDoc] = useState(null);
  const [inputValue, setInputValue] = useState('Henter...');

  useEffect(() => {
    const fetchDoc = async () => {
      const d = await getDocument(docId);
      if (d) {
        setDoc(d);
        setInputValue(d.title || 'Navnl�st dokument');
      } else {
        setInputValue('Nyt dokument'); // If 404 for new doc
      }
    };
    fetchDoc();
    
    const handleUpdate = () => fetchDoc();
    window.addEventListener('documentUpdated', handleUpdate);
    return () => window.removeEventListener('documentUpdated', handleUpdate);
  }, [docId]);

  return (
    <input 
      key={docId}
      style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', outline: 'none', width: '100%', fontFamily: 'inherit' }}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={async (e) => {
        // We can save even if 'doc' is null (for new docs before auto-save)
        await saveDocument(docId, e.target.value, undefined, undefined);
        window.dispatchEvent(new Event('documentUpdated'));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur();
      }}
    />
  );
};

export default PanelTitle;

