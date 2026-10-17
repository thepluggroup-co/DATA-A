/**
 * GENERATEUR SPSS 27 - EDM ELECTRIQUE CAMEROUN
 *
 * Source : Google Sheet contenant notamment :
 *   - DICTIONNAIRE
 *   - MASQUE_DEPOUILLEMENT
 *
 * Le script ne modifie pas le questionnaire Google Form.
 * Il crée/actualise une feuille SPSS_EXPORT et génère une syntaxe .SPS
 * compatible IBM SPSS Statistics 27.
 */

const CFG = {
  DICT_SHEET: 'DICTIONNAIRE',
  MASK_SHEET: 'MASQUE_DEPOUILLEMENT',
  EXPORT_SHEET: 'SPSS_EXPORT',
  DICT_HEADER_ROW: 1,
  MASK_HEADER_ROW: 2,
  MASK_DATA_START_ROW: 4,
  OUTPUT_PREFIX: 'EDM_ELECTRIQUE_CAMEROUN_SPSS27',
  DEFAULT_FILE_PLACEHOLDER: 'C:\\\\A_REMPLACER\\EDM_ELECTRIQUE_CAMEROUN_MASQUE_TEMPS_REEL.xlsx',
  SPSS_DATA_SHEET: 'SPSS_EXPORT'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SPSS 27')
    .addItem('1. Préparer SPSS_EXPORT', 'prepareSPSSExport')
    .addItem('2. Générer la syntaxe SPSS 27', 'generateSPSS27')
    .addItem('3. Préparer + générer tout', 'prepareAndGenerateSPSS27')
    .addToUi();
}

function prepareAndGenerateSPSS27() {
  prepareSPSSExport();
  generateSPSS27();
}

function prepareSPSSExport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mask = ss.getSheetByName(CFG.MASK_SHEET);
  if (!mask) throw new Error('Onglet introuvable : ' + CFG.MASK_SHEET);

  const dict = readDictionary_();
  const allowed = new Set(dict.map(d => d.variable));
  const maskHeaders = mask.getRange(CFG.MASK_HEADER_ROW, 1, 1, mask.getLastColumn()).getValues()[0];
  const columns = [];

  maskHeaders.forEach((h, i) => {
    const v = String(h || '').trim();
    if (v && allowed.has(v)) columns.push({ variable: v, sourceCol: i + 1 });
  });

  if (!columns.length) throw new Error('Aucune variable du DICTIONNAIRE ne correspond au MASQUE_DEPOUILLEMENT.');

  let out = ss.getSheetByName(CFG.EXPORT_SHEET);
  if (!out) out = ss.insertSheet(CFG.EXPORT_SHEET);
  out.clearContents();
  out.clearFormats();

  const nRows = Math.max(0, mask.getLastRow() - CFG.MASK_DATA_START_ROW + 1);
  const values = [];
  values.push(columns.map(c => c.variable));

  if (nRows > 0) {
    const raw = mask.getRange(CFG.MASK_DATA_START_ROW, 1, nRows, mask.getLastColumn()).getValues();
    raw.forEach(row => {
      const outRow = columns.map(c => normalizeExportCell_(row[c.sourceCol - 1]));
      if (outRow.some(x => x !== '' && x !== null)) values.push(outRow);
    });
  }

  out.getRange(1, 1, values.length, values[0].length).setValues(values);
  out.setFrozenRows(1);
  out.getRange(1, 1, 1, values[0].length).setFontWeight('bold');
  out.autoResizeColumns(1, values[0].length);

  SpreadsheetApp.getUi().alert(
    'SPSS_EXPORT préparée : ' + (values.length - 1) + ' fiches et ' + columns.length + ' variables.'
  );
}

function normalizeExportCell_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return value;
  }
  return value;
}

function generateSPSS27() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dict = readDictionary_();
  if (!dict.length) throw new Error('Le DICTIONNAIRE ne contient aucune variable exploitable.');

  const groups = detectMultipleResponseGroups_(dict);
  const syntax = buildSPSSSyntax_(ss.getName(), dict, groups);

  const fileName = CFG.OUTPUT_PREFIX + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.sps';
  const file = DriveApp.createFile(fileName, syntax, MimeType.PLAIN_TEXT);

  const html = HtmlService.createHtmlOutput(
    '<p><b>Syntaxe SPSS 27 générée.</b></p>' +
    '<p>Fichier : ' + fileName + '</p>' +
    '<p><a href="' + file.getUrl() + '" target="_blank">Ouvrir le fichier .SPS dans Google Drive</a></p>'
  ).setWidth(520).setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(html, 'Générateur SPSS 27');
}

function readDictionary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CFG.DICT_SHEET);
  if (!sh) throw new Error('Onglet introuvable : ' + CFG.DICT_SHEET);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(x => String(x || '').trim().toUpperCase());
  const idx = {
    variable: header.indexOf('VARIABLE'),
    label: header.indexOf('QUESTION / LIBELLÉ'),
    format: header.indexOf('FORMAT SPSS'),
    measure: header.indexOf('MESURE'),
    code: header.indexOf('CODE'),
    modality: header.indexOf('MODALITÉ')
  };

  if (idx.variable < 0 || idx.label < 0 || idx.format < 0 || idx.code < 0 || idx.modality < 0) {
    throw new Error('Colonnes obligatoires manquantes dans DICTIONNAIRE. Attendu : VARIABLE, QUESTION / LIBELLÉ, FORMAT SPSS, MESURE, CODE, MODALITÉ.');
  }

  const result = [];
  let current = null;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const variable = String(row[idx.variable] || '').trim();

    if (variable) {
      current = {
        variable: variable,
        label: String(row[idx.label] || '').trim(),
        format: String(row[idx.format] || '').trim(),
        measure: String(row[idx.measure] || '').trim().toUpperCase(),
        values: []
      };
      result.push(current);
    }

    if (current && row[idx.code] !== '' && row[idx.code] !== null && row[idx.code] !== undefined) {
      const code = Number(row[idx.code]);
      if (!isNaN(code)) {
        current.values.push({ code: code, label: String(row[idx.modality] || '').trim() });
      }
    }
  }

  return result.filter(d => /^[A-Za-z_][A-Za-z0-9_]*$/.test(d.variable));
}

function detectMultipleResponseGroups_(dict) {
  const groups = [];
  const q9 = dict.filter(d => /^Q9\./i.test(d.label) && /^PRAC/.test(d.variable));
  const q41 = dict.filter(d => /^Q41\./i.test(d.label) && /^RFID/.test(d.variable));

  if (q9.length >= 2) {
    groups.push({
      name: '$PRODUITS_ACHETES',
      variables: q9.map(d => d.variable),
      value: 1,
      label: 'Produits achetés (réponses multiples)'
    });
  }
  if (q41.length >= 2) {
    groups.push({
      name: '$FIDELITE',
      variables: q41.map(d => d.variable),
      value: 1,
      label: 'Facteurs renforçant la fidélité (réponses multiples)'
    });
  }
  return groups;
}

function buildSPSSSyntax_(workbookName, dict, groups) {
  const lines = [];
  lines.push('* ================================================================.');
  lines.push('* EDM ELECTRIQUE CAMEROUN - GENERATEUR SPSS 27.');
  lines.push('* Syntaxe générée automatiquement depuis le Google Sheet.');
  lines.push('* Source dictionnaire : DICTIONNAIRE.');
  lines.push('* Données : SPSS_EXPORT.');
  lines.push('* ================================================================.');
  lines.push('SET UNICODE=ON.');
  lines.push('SET DECIMAL DOT.');
  lines.push('');

  lines.push('* --- IMPORTATION DU FICHIER EXCEL --- .');
  lines.push("* REMPLACER LE CHEMIN CI-DESSOUS PAR LE CHEMIN LOCAL DU FICHIER XLSX.");
  lines.push('GET DATA');
  lines.push(' /TYPE=XLSX');
  lines.push(" /FILE='" + CFG.DEFAULT_FILE_PLACEHOLDER + "'");
  lines.push(" /SHEET=NAME '" + CFG.SPSS_DATA_SHEET + "'");
  lines.push(' /READNAMES=ON.');
  lines.push('DATASET NAME EDM_ELECTRIQUE WINDOW=FRONT.');
  lines.push('EXECUTE.');
  lines.push('');

  lines.push('* --- ETIQUETTES DES VARIABLES --- .');
  const labelLines = [];
  dict.forEach(d => {
    if (d.label) labelLines.push(' ' + d.variable + " '" + spssQuote_(d.label) + "'");
  });
  if (labelLines.length) {
    lines.push('VARIABLE LABELS');
    lines.push(labelLines.join('\n') + '.');
  }
  lines.push('');

  lines.push('* --- ETIQUETTES DES MODALITES --- .');
  dict.filter(d => d.values.length).forEach(d => {
    lines.push('VALUE LABELS ' + d.variable);
    d.values.forEach(v => {
      lines.push(' ' + formatCode_(v.code) + " '" + spssQuote_(v.label) + "'");
    });
    lines.push('.');
  });
  lines.push('');

  lines.push('* --- VALEURS MANQUANTES 98 / 99 LORSQU ELLES SONT DECLAREES --- .');
  dict.forEach(d => {
    const miss = d.values.filter(v => v.code === 98 || v.code === 99).map(v => formatCode_(v.code));
    if (miss.length) lines.push('MISSING VALUES ' + d.variable + ' (' + miss.join(' ') + ').');
  });
  lines.push('');

  lines.push('* --- NIVEAUX DE MESURE --- .');
  dict.forEach(d => {
    if (['NOMINAL', 'ORDINAL', 'SCALE'].indexOf(d.measure) >= 0) {
      lines.push('VARIABLE LEVEL ' + d.variable + ' (' + d.measure + ').');
    }
  });
  lines.push('');

  lines.push('* --- FORMATS SPSS --- .');
  dict.forEach(d => {
    const f = normalizeFormat_(d.format);
    if (f) lines.push('FORMATS ' + d.variable + ' (' + f + ').');
  });
  lines.push('');

  lines.push('* --- MULTIPLE RESPONSE SETS --- .');
  groups.forEach(g => {
    lines.push('MRSETS');
    lines.push(' /MDGROUP NAME=' + g.name);
    lines.push(' VARIABLES=' + g.variables.join(' '));
    lines.push(' VALUE=' + g.value);
    lines.push(" LABEL='" + spssQuote_(g.label) + "'.");
  });
  if (!groups.length) lines.push('* Aucun groupe de réponses multiples détecté automatiquement.');
  lines.push('');

  lines.push('* --- CONTROLES DE STRUCTURE --- .');
  lines.push('FREQUENCIES VARIABLES=CODEZONE ACCRECON VOUSETES SEXMAFEM AGEREPON VILLEREG');
  lines.push(' FREQACHA LIEACHPR MONMOYAC PAIEPRIV IMPOMARQ MAACPLSO PRCRICHO ORIGPRIV');
  lines.push(' /ORDER=ANALYSIS.');
  lines.push('');
  lines.push('SAVE OUTFILE="C:\\\\A_REMPLACER\\EDM_ELECTRIQUE_CAMEROUN_SPSS27.sav"');
  lines.push(' /COMPRESSED.');
  lines.push('');
  lines.push('EXECUTE.');
  return lines.join('\n');
}

function normalizeFormat_(format) {
  if (!format) return '';
  const f = String(format).trim().toUpperCase();
  // Formats texte Axx et numériques SPSS sont acceptés tels quels.
  // On ignore les formats non standard pour éviter une syntaxe invalide.
  if (/^(A|F|N|COMMA|DOT|DATE|ADATE|EDATE|SDATE|JDATE|DATETIME|TIME|DTIME|WKDAY|MONTH|MOYR|QYR|YR|DOLLAR|CCA|CCB|CCC|CCD|CCE|PCT|E|Ew|RB|RBW)/.test(f)) return f;
  return '';
}

function formatCode_(code) {
  const n = Number(code);
  return Number.isInteger(n) ? String(n) : String(n);
}

function spssQuote_(text) {
  return String(text || '').replace(/'/g, "''").replace(/\r?\n/g, ' ');
}
