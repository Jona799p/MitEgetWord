export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  badge?: string;
  iconName: 'FileText' | 'Users' | 'Briefcase' | 'Mail' | 'FileCheck';
  defaultTitle: string;
  tags: string[];
  color: string;
  content: string;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'blank',
    name: 'Tomt dokument',
    description: 'Start fra bunden med et rent, tomt lærred',
    iconName: 'FileText',
    defaultTitle: 'Nyt dokument',
    tags: [],
    color: '#4a90e2',
    content: '<p></p>',
  },
  {
    id: 'meeting-notes',
    name: 'Mødenotat',
    description: 'Dagsorden, deltagere, beslutninger og handlingspunkter',
    badge: 'Populær',
    iconName: 'Users',
    defaultTitle: 'Mødenotat - [Emne]',
    tags: ['Arbejde'],
    color: '#10b981',
    content: `
      <h1>Mødenotat</h1>
      <p><strong>Emne:</strong> [Mødeemne her]</p>
      <p><strong>Dato:</strong> ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; <strong>Tid:</strong> 10:00 - 11:00</p>
      <p><strong>Deltagere:</strong> [Navn 1], [Navn 2], [Navn 3]</p>
      <hr />
      <h2>1. Dagsorden</h2>
      <ul>
        <li>Gennemgang af projektets fremdrift</li>
        <li>Identificerede udfordringer og løsninger</li>
        <li>Næste skridt og tidsplan</li>
      </ul>
      <h2>2. Diskussion & Notater</h2>
      <p>Her noteres vigtige pointer fra mødets diskussioner...</p>
      <h2>3. Beslutninger</h2>
      <ul>
        <li>Beslutning A godkendt af alle deltagere.</li>
        <li>Budget og tidsramme fastholdes.</li>
      </ul>
      <h2>4. Handlingspunkter (Action Items)</h2>
      <table>
        <thead>
          <tr>
            <th>Opgave</th>
            <th>Ansvarlig</th>
            <th>Frist</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Udarbejdelse af udkast</td>
            <td>Jonas</td>
            <td>Fredag kl. 12:00</td>
          </tr>
          <tr>
            <td>Feedback og kvalitetssikring</td>
            <td>Teamet</td>
            <td>Mandag kl. 09:00</td>
          </tr>
        </tbody>
      </table>
      <p></p>
    `,
  },
  {
    id: 'project-plan',
    name: 'Projektplan',
    description: 'Projektmål, milepæle, opgaver og tidslinje',
    badge: 'Struktur',
    iconName: 'Briefcase',
    defaultTitle: 'Projektplan - [Projektnavn]',
    tags: ['Arbejde', 'Vigtigt'],
    color: '#8b5cf6',
    content: `
      <h1>Projektplan: [Projektets Navn]</h1>
      <p><strong>Projektleder:</strong> [Dit Navn] &nbsp;|&nbsp; <strong>Status:</strong> Aktiv</p>
      <hr />
      <h2>1. Formål og Omfang</h2>
      <p>Formålet med dette projekt er at etablere...</p>
      <h2>2. Nøglemål (Key Results)</h2>
      <ul>
        <li>Mål 1: Levering af kernemoduler inden for tidsrammen.</li>
        <li>Mål 2: Test og verifikation uden kritiske fejl.</li>
      </ul>
      <h2>3. Milepæle & Tidsplan</h2>
      <table>
        <thead>
          <tr>
            <th>Milepæl</th>
            <th>Beskrivelse</th>
            <th>Måldato</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Fase 1</td>
            <td>Kravspecifikation & arkitektur</td>
            <td>Uge 40</td>
          </tr>
          <tr>
            <td>Fase 2</td>
            <td>Implementering & integration</td>
            <td>Uge 44</td>
          </tr>
          <tr>
            <td>Fase 3</td>
            <td>Lancering & opfølgning</td>
            <td>Uge 48</td>
          </tr>
        </tbody>
      </table>
      <h2>4. Risici og håndtering</h2>
      <p>Identificerede risici overvåges løbende med følgende afbødende foranstaltninger...</p>
    `,
  },
  {
    id: 'formal-letter',
    name: 'Formelt brev',
    description: 'Afsender, modtager, dato og professionel opbygning',
    iconName: 'Mail',
    defaultTitle: 'Brev - [Modtager]',
    tags: ['Privat'],
    color: '#f59e0b',
    content: `
      <p><strong>[Dit Navn]</strong><br />[Din Adresse]<br />[Postnr. og By]<br />[E-mail / Tlf.]</p>
      <p style="text-align: right;"><strong>Dato:</strong> ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p><strong>[Modtagerens Navn / Virksomhed]</strong><br />[Modtagerens Adresse]<br />[Postnr. og By]</p>
      <hr />
      <h2>Vedrørende: [Emne for henvendelsen]</h2>
      <p>Kære [Modtagers Navn],</p>
      <p>Jeg henvender mig hermed vedrørende...</p>
      <p>Med venlig hilsen,</p>
      <p><br /><strong>[Dit Navn]</strong></p>
    `,
  },
  {
    id: 'report-note',
    name: 'Notat & Rapport',
    description: 'Resumé, analyser, konklusioner og anbefalinger',
    badge: 'Rapport',
    iconName: 'FileCheck',
    defaultTitle: 'Rapport - [Titel]',
    tags: ['Skole', 'Arbejde'],
    color: '#06b6d4',
    content: `
      <h1>Rapport: [Dokumentets Titel]</h1>
      <p><em>Udarbejdet af: [Dit Navn] &nbsp;|&nbsp; Dato: ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}</em></p>
      <hr />
      <h2>Sammenfatning (Resumé)</h2>
      <p>Dette dokument belyser de væsentligste resultater og anbefalinger fra...</p>
      <h2>Baggrund & Metode</h2>
      <p>Baggrunden for analysen udspringer af...</p>
      <h2>Hovedfund & Analyse</h2>
      <p>Gennemgangen viser klare tendenser inden for...</p>
      <h2>Konklusion & Anbefalinger</h2>
      <ul>
        <li>Anbefaling 1: Optimering af arbejdsgange.</li>
        <li>Anbefaling 2: Implementering af nye værktøjer.</li>
      </ul>
    `,
  },
];
