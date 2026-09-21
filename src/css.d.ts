declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*/store/documentStore' {
  export const saveDocument: any;
  export const createDocument: any;
  export const createVersionSnapshot: any;
  export const getVersions: any;
  export const restoreVersion: any;
  export const getDocumentVersions: any;
  export const deleteDocumentVersion: any;
  export const openDocumentInSystem: any;
  export const saveDocumentLocallyToDisk: any;
  export const listDiskDocuments: any;
  export const resolveLocalDocumentsDirAsync: any;
}

declare module '*/store/settingsStore' {
  export const getSettings: any;
  export const checkTextWithLanguageTool: any;
  export const isCamelCaseOrAcronym: any;
  export const isInCustomDictionary: any;
  export const addToCustomDictionary: any;
  export const filterValidEnglishWords: any;
  export const isLanguageToolAvailable: any;
}