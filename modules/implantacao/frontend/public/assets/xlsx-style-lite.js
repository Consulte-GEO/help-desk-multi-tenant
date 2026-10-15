/**
 * xlsxStyleLite · Consulte GEO · v1.0.0
 *
 * Gravador XLSX mínimo, sem dependências de runtime, para o subconjunto usado
 * pelos relatórios da implantação:
 * - AOA -> worksheet;
 * - múltiplas abas;
 * - fontes, preenchimentos, bordas, alinhamento e formatos numéricos;
 * - larguras/alturas, mesclas, autofiltro e painéis congelados;
 * - saída Uint8Array e download no navegador.
 *
 * O ZIP é escrito com método STORE. Isso deixa o arquivo um pouco maior, mas
 * mantém a geração síncrona e independente de CDN/registry.
 */
const textEncoder = new TextEncoder();
const CELL_REF_RE = /^([A-Z]+)([1-9][0-9]*)$/;
const INVALID_SHEET_CHARS = /[\\/*?:\[\]]/g;
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function encodeXml(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '\uFFFD')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function normalizeRgb(value) {
    if (typeof value !== 'string')
        return null;
    const clean = value.replace(/^#/, '').trim().toUpperCase();
    if (/^[0-9A-F]{6}$/.test(clean))
        return `FF${clean}`;
    if (/^[0-9A-F]{8}$/.test(clean))
        return clean;
    return null;
}
function stableValue(value) {
    if (Array.isArray(value))
        return value.map(stableValue);
    if (!value || typeof value !== 'object')
        return value;
    const source = value;
    return Object.fromEntries(Object.keys(source).sort().map((key) => [key, stableValue(source[key])]));
}
function stableKey(value) {
    return JSON.stringify(stableValue(value));
}
function toFiniteNumber(value, fallback) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function normalizeFont(style) {
    const font = asRecord(style.font);
    const color = asRecord(font.color);
    return {
        name: typeof font.name === 'string' && font.name.trim() ? font.name.trim() : 'Calibri',
        sz: toFiniteNumber(font.sz, 11),
        bold: font.bold === true,
        italic: font.italic === true,
        underline: font.underline === true || font.underline === 'single',
        color: normalizeRgb(color.rgb),
    };
}
function normalizeFill(style) {
    const fill = asRecord(style.fill);
    const fgColor = asRecord(fill.fgColor);
    const rgb = normalizeRgb(fgColor.rgb);
    return rgb
        ? { patternType: 'solid', fgColor: rgb }
        : { patternType: 'none', fgColor: null };
}
function normalizeBorderSide(value) {
    const side = asRecord(value);
    const color = asRecord(side.color);
    return {
        style: typeof side.style === 'string' && side.style ? side.style : null,
        color: normalizeRgb(color.rgb),
    };
}
function normalizeBorder(style) {
    const border = asRecord(style.border);
    return {
        left: normalizeBorderSide(border.left),
        right: normalizeBorderSide(border.right),
        top: normalizeBorderSide(border.top),
        bottom: normalizeBorderSide(border.bottom),
    };
}
function normalizeAlignment(style) {
    const alignment = asRecord(style.alignment);
    const normalized = {
        horizontal: typeof alignment.horizontal === 'string' ? alignment.horizontal : null,
        vertical: typeof alignment.vertical === 'string' ? alignment.vertical : null,
        wrapText: alignment.wrapText === true,
        indent: alignment.indent == null ? null : Math.max(0, Math.trunc(toFiniteNumber(alignment.indent, 0))),
    };
    return normalized.horizontal || normalized.vertical || normalized.wrapText || normalized.indent != null
        ? normalized
        : null;
}
class StyleRegistry {
    constructor() {
        this.fonts = [{
                name: 'Calibri', sz: 11, bold: false, italic: false, underline: false, color: null,
            }];
        this.fills = [
            { patternType: 'none', fgColor: null },
            { patternType: 'gray125', fgColor: null },
        ];
        this.borders = [{
                left: { style: null, color: null },
                right: { style: null, color: null },
                top: { style: null, color: null },
                bottom: { style: null, color: null },
            }];
        this.numFmts = [];
        this.xfs = [{
                fontId: 0,
                fillId: 0,
                borderId: 0,
                numFmtId: 0,
                alignment: null,
            }];
        this.fontIds = new Map([[stableKey(this.fonts[0]), 0]]);
        this.fillIds = new Map([
            [stableKey(this.fills[0]), 0],
            [stableKey(this.fills[1]), 1],
        ]);
        this.borderIds = new Map([[stableKey(this.borders[0]), 0]]);
        this.numFmtIds = new Map();
        this.xfIds = new Map([[stableKey(this.xfs[0]), 0]]);
    }
    componentId(value, values, ids) {
        const key = stableKey(value);
        const existing = ids.get(key);
        if (existing != null)
            return existing;
        const id = values.length;
        values.push(value);
        ids.set(key, id);
        return id;
    }
    styleId(styleValue, explicitNumFmt) {
        const style = asRecord(styleValue);
        if (Object.keys(style).length === 0 && !explicitNumFmt)
            return 0;
        const font = normalizeFont(style);
        const fill = normalizeFill(style);
        const border = normalizeBorder(style);
        const alignment = normalizeAlignment(style);
        const styleNumFmt = typeof style.numFmt === 'string' ? style.numFmt : undefined;
        const numFmt = explicitNumFmt || styleNumFmt || '';
        const fontId = this.componentId(font, this.fonts, this.fontIds);
        const fillId = this.componentId(fill, this.fills, this.fillIds);
        const borderId = this.componentId(border, this.borders, this.borderIds);
        let numFmtId = 0;
        if (numFmt) {
            const existing = this.numFmtIds.get(numFmt);
            if (existing != null) {
                numFmtId = existing;
            }
            else {
                numFmtId = 164 + this.numFmts.length;
                this.numFmts.push(numFmt);
                this.numFmtIds.set(numFmt, numFmtId);
            }
        }
        const xf = { fontId, fillId, borderId, numFmtId, alignment };
        return this.componentId(xf, this.xfs, this.xfIds);
    }
    fontXml(font) {
        return [
            '<font>',
            font.bold ? '<b/>' : '',
            font.italic ? '<i/>' : '',
            font.underline ? '<u/>' : '',
            font.color ? `<color rgb="${font.color}"/>` : '<color theme="1"/>',
            `<sz val="${font.sz}"/>`,
            `<name val="${encodeXml(font.name)}"/>`,
            '<family val="2"/>',
            font.name === 'Calibri' ? '<scheme val="minor"/>' : '',
            '</font>',
        ].join('');
    }
    fillXml(fill) {
        if (fill.patternType === 'solid' && fill.fgColor) {
            return `<fill><patternFill patternType="solid"><fgColor rgb="${fill.fgColor}"/><bgColor indexed="64"/></patternFill></fill>`;
        }
        return `<fill><patternFill patternType="${fill.patternType}"/></fill>`;
    }
    borderSideXml(name, side) {
        if (!side.style)
            return `<${name}/>`;
        const color = side.color ? `<color rgb="${side.color}"/>` : '<color auto="1"/>';
        return `<${name} style="${encodeXml(side.style)}">${color}</${name}>`;
    }
    borderXml(border) {
        return [
            '<border>',
            this.borderSideXml('left', border.left),
            this.borderSideXml('right', border.right),
            this.borderSideXml('top', border.top),
            this.borderSideXml('bottom', border.bottom),
            '<diagonal/>',
            '</border>',
        ].join('');
    }
    alignmentXml(alignment) {
        const attrs = [];
        if (alignment.horizontal)
            attrs.push(`horizontal="${encodeXml(alignment.horizontal)}"`);
        if (alignment.vertical)
            attrs.push(`vertical="${encodeXml(alignment.vertical)}"`);
        if (alignment.wrapText)
            attrs.push('wrapText="1"');
        if (alignment.indent != null)
            attrs.push(`indent="${alignment.indent}"`);
        return `<alignment ${attrs.join(' ')}/>`;
    }
    toXml() {
        const numFmtXml = this.numFmts.length
            ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((format, index) => (`<numFmt numFmtId="${164 + index}" formatCode="${encodeXml(format)}"/>`)).join('')}</numFmts>`
            : '';
        const xfXml = this.xfs.map((xf) => {
            const attrs = [
                `numFmtId="${xf.numFmtId}"`,
                `fontId="${xf.fontId}"`,
                `fillId="${xf.fillId}"`,
                `borderId="${xf.borderId}"`,
                'xfId="0"',
            ];
            if (xf.numFmtId)
                attrs.push('applyNumberFormat="1"');
            if (xf.fontId)
                attrs.push('applyFont="1"');
            if (xf.fillId)
                attrs.push('applyFill="1"');
            if (xf.borderId)
                attrs.push('applyBorder="1"');
            if (xf.alignment)
                attrs.push('applyAlignment="1"');
            return `<xf ${attrs.join(' ')}>${xf.alignment ? this.alignmentXml(xf.alignment) : ''}</xf>`;
        }).join('');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
            `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
            numFmtXml +
            `<fonts count="${this.fonts.length}">${this.fonts.map((font) => this.fontXml(font)).join('')}</fonts>` +
            `<fills count="${this.fills.length}">${this.fills.map((fill) => this.fillXml(fill)).join('')}</fills>` +
            `<borders count="${this.borders.length}">${this.borders.map((border) => this.borderXml(border)).join('')}</borders>` +
            `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
            `<cellXfs count="${this.xfs.length}">${xfXml}</cellXfs>` +
            `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
            `<dxfs count="0"/>` +
            `<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>` +
            `</styleSheet>`;
    }
}
export function encode_col(column) {
    if (!Number.isInteger(column) || column < 0)
        throw new Error(`invalid_column:${column}`);
    let value = column + 1;
    let output = '';
    while (value > 0) {
        const remainder = (value - 1) % 26;
        output = String.fromCharCode(65 + remainder) + output;
        value = Math.floor((value - 1) / 26);
    }
    return output;
}
function encodeCell(row, column) {
    return `${encode_col(column)}${row + 1}`;
}
function decodeCol(value) {
    let result = 0;
    for (const char of value)
        result = result * 26 + char.charCodeAt(0) - 64;
    return result - 1;
}
function decodeCell(value) {
    const match = CELL_REF_RE.exec(value);
    if (!match)
        return null;
    return { c: decodeCol(match[1]), r: Number(match[2]) - 1 };
}
function inferCell(raw) {
    if (raw === undefined || raw === null)
        return null;
    if (typeof raw === 'object' && !Array.isArray(raw) && 'v' in raw) {
        const cell = { ...raw };
        if (!cell.t) {
            cell.t = typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's';
        }
        return cell;
    }
    if (typeof raw === 'number')
        return { v: raw, t: 'n' };
    if (typeof raw === 'boolean')
        return { v: raw, t: 'b' };
    return { v: String(raw), t: 's' };
}
export function aoa_to_sheet(rows) {
    const ws = {};
    let maxColumn = -1;
    const maxRow = rows.length - 1;
    rows.forEach((row, rowIndex) => {
        maxColumn = Math.max(maxColumn, row.length - 1);
        row.forEach((raw, columnIndex) => {
            const cell = inferCell(raw);
            if (cell)
                ws[encodeCell(rowIndex, columnIndex)] = cell;
        });
    });
    ws['!ref'] = maxRow >= 0 && maxColumn >= 0
        ? `A1:${encodeCell(maxRow, maxColumn)}`
        : 'A1:A1';
    return ws;
}
export function book_new() {
    return { SheetNames: [], Sheets: {} };
}
function safeSheetName(value) {
    const cleaned = value.replace(INVALID_SHEET_CHARS, ' ').trim().slice(0, 31);
    return cleaned || 'Planilha';
}
export function book_append_sheet(workbook, worksheet, requestedName) {
    const base = safeSheetName(requestedName);
    let name = base;
    let suffix = 2;
    // v5.22.46: o Excel compara nomes de aba sem diferenciar maiúsculas —
    // 'Resumo' e 'RESUMO' colidem e geram arquivo que pede reparo.
    const taken = new Set(workbook.SheetNames.map((n) => n.toLowerCase()));
    while (taken.has(name.toLowerCase())) {
        const ending = ` (${suffix++})`;
        name = `${base.slice(0, 31 - ending.length)}${ending}`;
    }
    workbook.SheetNames.push(name);
    workbook.Sheets[name] = worksheet;
}
export const utils = {
    aoa_to_sheet,
    book_new,
    book_append_sheet,
    encode_col,
};
function cellXml(reference, cell, registry) {
    const styleId = registry.styleId(cell.s, cell.z);
    const styleAttr = styleId ? ` s="${styleId}"` : '';
    const type = cell.t || (typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's');
    if (type === 'n') {
        const number = Number(cell.v);
        // v5.22.46: NaN/Infinity NÃO viram 0 (isso corrigiria o dado
        // silenciosamente). A célula é gravada como texto, preservando o sintoma.
        if (!Number.isFinite(number)) {
            const label = Number.isNaN(number) ? '#N/D' : (number > 0 ? '#INF' : '-#INF');
            return `<c r="${reference}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${encodeXml(label)}</t></is></c>`;
        }
        return `<c r="${reference}"${styleAttr}><v>${String(number)}</v></c>`;
    }
    if (type === 'b') {
        return `<c r="${reference}"${styleAttr} t="b"><v>${cell.v ? 1 : 0}</v></c>`;
    }
    // v5.22.46: limite físico do Excel — truncar aqui evita gerar arquivo que
    // o Excel recusa. O corte é explícito e visível, nunca silencioso.
    const MAX_CELL_CHARS = 32767;
    const raw = String(cell.v ?? '');
    const text = raw.length > MAX_CELL_CHARS
        ? `${raw.slice(0, MAX_CELL_CHARS - 20)}…[TRUNCADO]`
        : raw;
    return `<c r="${reference}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${encodeXml(text)}</t></is></c>`;
}
function worksheetXml(worksheet, registry, sheetIndex, activeTab) {
    const rowCells = new Map();
    let maxRow = 0;
    let maxColumn = 0;
    for (const [key, raw] of Object.entries(worksheet)) {
        const address = decodeCell(key);
        if (!address)
            continue;
        const cell = inferCell(raw);
        if (!cell)
            continue;
        maxRow = Math.max(maxRow, address.r);
        maxColumn = Math.max(maxColumn, address.c);
        const list = rowCells.get(address.r) || [];
        list.push({ column: address.c, reference: key, cell });
        rowCells.set(address.r, list);
    }
    const rowsMeta = worksheet['!rows'] || [];
    if (rowsMeta.length)
        maxRow = Math.max(maxRow, rowsMeta.length - 1);
    const ref = worksheet['!ref'] || `A1:${encodeCell(maxRow, maxColumn)}`;
    const view = (worksheet['!views'] || [])[0];
    const freeze = worksheet['!freeze'];
    const ySplit = toFiniteNumber(view?.ySplit ?? freeze?.ySplit, 0);
    const xSplit = toFiniteNumber(view?.xSplit ?? freeze?.xSplit, 0);
    const topLeftCell = view?.topLeftCell || encodeCell(Math.max(0, ySplit), Math.max(0, xSplit));
    const pane = ySplit > 0 || xSplit > 0
        ? `<pane${xSplit > 0 ? ` xSplit="${xSplit}"` : ''}${ySplit > 0 ? ` ySplit="${ySplit}"` : ''} topLeftCell="${encodeXml(topLeftCell)}" activePane="${xSplit > 0 && ySplit > 0 ? 'bottomRight' : ySplit > 0 ? 'bottomLeft' : 'topRight'}" state="frozen"/>` +
            `<selection pane="${xSplit > 0 && ySplit > 0 ? 'bottomRight' : ySplit > 0 ? 'bottomLeft' : 'topRight'}"/>`
        : '<selection activeCell="A1" sqref="A1"/>';
    const sheetView = `<sheetViews><sheetView${sheetIndex === activeTab ? ' tabSelected="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews>`;
    const cols = worksheet['!cols'] || [];
    const colsXml = cols.length
        ? `<cols>${cols.map((column, index) => {
            const width = Math.max(0.1, toFiniteNumber(column.wch, 10));
            return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        }).join('')}</cols>`
        : '';
    const rowXml = [];
    for (let row = 0; row <= maxRow; row += 1) {
        const cells = (rowCells.get(row) || []).sort((a, b) => a.column - b.column);
        const rowMeta = rowsMeta[row];
        if (!cells.length && !rowMeta?.hpt)
            continue;
        const attrs = [`r="${row + 1}"`];
        if (rowMeta?.hpt != null) {
            attrs.push(`ht="${Math.max(0, toFiniteNumber(rowMeta.hpt, 15))}"`, 'customHeight="1"');
        }
        rowXml.push(`<row ${attrs.join(' ')}>${cells.map(({ reference, cell }) => cellXml(reference, cell, registry)).join('')}</row>`);
    }
    const autofilter = worksheet['!autofilter']?.ref
        ? `<autoFilter ref="${encodeXml(worksheet['!autofilter'].ref)}"/>`
        : '';
    const merges = worksheet['!merges'] || [];
    const mergesXml = merges.length
        ? `<mergeCells count="${merges.length}">${merges.map((range) => (`<mergeCell ref="${encodeCell(range.s.r, range.s.c)}:${encodeCell(range.e.r, range.e.c)}"/>`)).join('')}</mergeCells>`
        : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<dimension ref="${encodeXml(ref)}"/>` +
        sheetView +
        `<sheetFormatPr defaultRowHeight="15"/>` +
        colsXml +
        `<sheetData>${rowXml.join('')}</sheetData>` +
        autofilter +
        mergesXml +
        `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
        `</worksheet>`;
}
function workbookXml(workbook, activeTab) {
    const sheets = workbook.SheetNames.map((name, index) => (`<sheet name="${encodeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="19129"/>` +
        `<workbookPr defaultThemeVersion="164011"/>` +
        `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000" activeTab="${activeTab}"/></bookViews>` +
        `<sheets>${sheets}</sheets>` +
        `<calcPr calcId="191029" fullCalcOnLoad="1"/>` +
        `</workbook>`;
}
function workbookRelsXml(sheetCount) {
    const sheets = Array.from({ length: sheetCount }, (_, index) => (`<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets +
        `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`;
}
function contentTypesXml(sheetCount) {
    const sheets = Array.from({ length: sheetCount }, (_, index) => (`<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets +
        `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
        `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
        `</Types>`;
}
function rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
        `</Relationships>`;
}
function coreXml(workbook) {
    const now = new Date().toISOString();
    const title = typeof workbook.Props?.Title === 'string' ? workbook.Props.Title : 'Implantação Consulte GEO';
    const creator = typeof workbook.Props?.Author === 'string' ? workbook.Props.Author : 'Consulte GEO';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:title>${encodeXml(title)}</dc:title>` +
        `<dc:creator>${encodeXml(creator)}</dc:creator>` +
        `<cp:lastModifiedBy>${encodeXml(creator)}</cp:lastModifiedBy>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
        `</cp:coreProperties>`;
}
function appXml(workbook) {
    const names = workbook.SheetNames.map((name) => `<vt:lpstr>${encodeXml(name)}</vt:lpstr>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
        `<Application>Consulte GEO</Application>` +
        `<DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>` +
        `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Planilhas</vt:lpstr></vt:variant><vt:variant><vt:i4>${workbook.SheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
        `<TitlesOfParts><vt:vector size="${workbook.SheetNames.length}" baseType="lpstr">${names}</vt:vector></TitlesOfParts>` +
        `<Company>Consulte GEO</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion>` +
        `</Properties>`;
}
let crcTable = null;
function getCrcTable() {
    if (crcTable)
        return crcTable;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1)
            c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    crcTable = table;
    return table;
}
function crc32(data) {
    const table = getCrcTable();
    let crc = 0xFFFFFFFF;
    for (const byte of data)
        crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
function uint16(value) {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value & 0xFFFF, true);
    return out;
}
function uint32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0, true);
    return out;
}
function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}
function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    };
}
function zipStore(entries) {
    const localParts = [];
    const centralParts = [];
    const stamp = dosDateTime(new Date());
    let localOffset = 0;
    for (const entry of entries) {
        const name = textEncoder.encode(entry.name);
        const crc = crc32(entry.data);
        const localHeader = concatBytes([
            uint32(0x04034B50),
            uint16(20),
            uint16(0x0800),
            uint16(0),
            uint16(stamp.time),
            uint16(stamp.date),
            uint32(crc),
            uint32(entry.data.length),
            uint32(entry.data.length),
            uint16(name.length),
            uint16(0),
            name,
        ]);
        localParts.push(localHeader, entry.data);
        const centralHeader = concatBytes([
            uint32(0x02014B50),
            uint16(20),
            uint16(20),
            uint16(0x0800),
            uint16(0),
            uint16(stamp.time),
            uint16(stamp.date),
            uint32(crc),
            uint32(entry.data.length),
            uint32(entry.data.length),
            uint16(name.length),
            uint16(0),
            uint16(0),
            uint16(0),
            uint16(0),
            uint32(0),
            uint32(localOffset),
            name,
        ]);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + entry.data.length;
    }
    const central = concatBytes(centralParts);
    const end = concatBytes([
        uint32(0x06054B50),
        uint16(0),
        uint16(0),
        uint16(entries.length),
        uint16(entries.length),
        uint32(central.length),
        uint32(localOffset),
        uint16(0),
    ]);
    return concatBytes([...localParts, central, end]);
}
function xmlEntry(name, xml) {
    return { name, data: textEncoder.encode(xml) };
}
export function write(workbook, options = {}) {
    if (options.type && options.type !== 'array')
        throw new Error(`unsupported_write_type:${options.type}`);
    if (options.bookType && options.bookType !== 'xlsx')
        throw new Error(`unsupported_book_type:${options.bookType}`);
    if (!workbook.SheetNames.length)
        throw new Error('workbook_requires_sheet');
    const requestedActive = workbook.Workbook?.Views?.[0]?.activeTab ?? 0;
    const activeTab = Math.min(workbook.SheetNames.length - 1, Math.max(0, Math.trunc(requestedActive)));
    const registry = new StyleRegistry();
    const sheetEntries = workbook.SheetNames.map((name, index) => {
        const worksheet = workbook.Sheets[name];
        if (!worksheet)
            throw new Error(`missing_sheet:${name}`);
        return xmlEntry(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(worksheet, registry, index, activeTab));
    });
    const entries = [
        xmlEntry('[Content_Types].xml', contentTypesXml(workbook.SheetNames.length)),
        xmlEntry('_rels/.rels', rootRelsXml()),
        xmlEntry('docProps/core.xml', coreXml(workbook)),
        xmlEntry('docProps/app.xml', appXml(workbook)),
        xmlEntry('xl/workbook.xml', workbookXml(workbook, activeTab)),
        xmlEntry('xl/_rels/workbook.xml.rels', workbookRelsXml(workbook.SheetNames.length)),
        xmlEntry('xl/styles.xml', registry.toXml()),
        ...sheetEntries,
    ];
    return zipStore(entries);
}
export function writeFile(workbook, filename) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
        throw new Error('writeFile_requires_browser');
    }
    const bytes = write(workbook, { type: 'array', bookType: 'xlsx' });
    const buffer = new Uint8Array(bytes).buffer;
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(url);
    }, 0);
}
