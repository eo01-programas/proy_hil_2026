async function extractHiddenRowsColsFromArrayBuffer(arrayBuffer) {
    const hiddenRows = new Set();
    const hiddenCols = new Set();
    try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const parser = new DOMParser();

        // Determinar ruta de la hoja activa: leer xl/workbook.xml -> <workbookView activeTab>
        let sheetPath = 'xl/worksheets/sheet1.xml';
        try {
            const wbxmlFile = zip.file('xl/workbook.xml');
            if (wbxmlFile) {
                const wbxml = await wbxmlFile.async('string');
                const wbDoc = parser.parseFromString(wbxml, 'application/xml');

                // Detectar índice de hoja activa (activeTab, 0-based)
                let activeTabIdx = 0;
                const wbViewEls = wbDoc.getElementsByTagName('workbookView');
                if (wbViewEls.length > 0) {
                    const at = wbViewEls[0].getAttribute('activeTab');
                    if (at != null) activeTabIdx = parseInt(at, 10) || 0;
                }

                // Obtener el elemento <sheet> correspondiente
                const sheetEls = wbDoc.getElementsByTagName('sheet');
                const sheetEl = sheetEls[activeTabIdx] || sheetEls[0];
                if (sheetEl) {
                    const rid = sheetEl.getAttribute('r:id') || sheetEl.getAttribute('id');
                    if (rid) {
                        const relsFile = zip.file('xl/_rels/workbook.xml.rels');
                        if (relsFile) {
                            const rels = await relsFile.async('string');
                            const relDoc = parser.parseFromString(rels, 'application/xml');
                            const relsEls = relDoc.getElementsByTagName('Relationship');
                            for (let i = 0; i < relsEls.length; i++) {
                                const r = relsEls[i];
                                const id = r.getAttribute('Id') || r.getAttribute('Id');
                                if (id === rid) {
                                    let target = r.getAttribute('Target');
                                    if (target) {
                                        if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\//, '');
                                        sheetPath = target;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) { console.debug('workbook.xml parse error', e); }

        const sheetFile = zip.file(sheetPath) || zip.file('xl/worksheets/sheet1.xml');
        if (!sheetFile) return { hiddenRows, hiddenCols };
        const sheetXml = await sheetFile.async('string');
        const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');

        // rows: <row r="6" hidden="1"> ...
        const rowEls = sheetDoc.getElementsByTagName('row');
        for (let i = 0; i < rowEls.length; i++) {
            const r = rowEls[i];
            const hidden = r.getAttribute('hidden');
            const rnum = r.getAttribute('r');
            if ((hidden === '1' || hidden === 'true') && rnum) {
                const idx = parseInt(rnum, 10) - 1;
                if (!isNaN(idx)) hiddenRows.add(idx);
            }
        }

        // cols: <col min="3" max="3" hidden="1"/>
        const colEls = sheetDoc.getElementsByTagName('col');
        for (let i = 0; i < colEls.length; i++) {
            const c = colEls[i];
            const hidden = c.getAttribute('hidden');
            if (hidden === '1' || hidden === 'true') {
                const min = parseInt(c.getAttribute('min') || '0', 10);
                const max = parseInt(c.getAttribute('max') || min || '0', 10);
                for (let col = min; col <= max; col++) {
                    if (!isNaN(col)) hiddenCols.add(col - 1);
                }
            }
        }

        // Colores de fondo por fila: leer styles.xml y luego barrer las celdas
        const rowColors = new Map(); // rowIndex (0-based) -> '#RRGGBB'
        try {
            // Cargar estilos
            const stylesFile = zip.file('xl/styles.xml');
            if (stylesFile) {
                const stylesXml = await stylesFile.async('string');
                const stylesDoc = parser.parseFromString(stylesXml, 'application/xml');

                // Construir array de fills: [{ rgb }]
                const fillEls = stylesDoc.getElementsByTagName('fills')[0];
                const fills = [];
                if (fillEls) {
                    const fillItems = fillEls.getElementsByTagName('fill');
                    for (let fi = 0; fi < fillItems.length; fi++) {
                        const pf = fillItems[fi].getElementsByTagName('patternFill')[0];
                        let rgb = null;
                        if (pf) {
                            const fgColor = pf.getElementsByTagName('fgColor')[0];
                            if (fgColor) {
                                const argb = fgColor.getAttribute('rgb');
                                const theme = fgColor.getAttribute('theme');
                                const tint = parseFloat(fgColor.getAttribute('tint') || '0');

                                if (argb && argb.length === 8) rgb = '#' + argb.substring(2);
                                else if (argb && argb.length === 6) rgb = '#' + argb;
                                else if (theme != null) {
                                    const EXCEL_THEMES = ['#FFFFFF', '#000000', '#EEECE1', '#1F497D', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646'];
                                    const themeIdx = parseInt(theme, 10);
                                    if (themeIdx >= 0 && themeIdx < EXCEL_THEMES.length) {
                                        rgb = EXCEL_THEMES[themeIdx];
                                        if (tint !== 0) {
                                            let r = parseInt(rgb.substring(1, 3), 16);
                                            let g = parseInt(rgb.substring(3, 5), 16);
                                            let b = parseInt(rgb.substring(5, 7), 16);
                                            if (tint > 0) {
                                                r = Math.round(r * (1 - tint) + 255 * tint);
                                                g = Math.round(g * (1 - tint) + 255 * tint);
                                                b = Math.round(b * (1 - tint) + 255 * tint);
                                            } else {
                                                r = Math.round(r * (1 + tint));
                                                g = Math.round(g * (1 + tint));
                                                b = Math.round(b * (1 + tint));
                                            }
                                            const toHex = c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
                                            rgb = '#' + toHex(r) + toHex(g) + toHex(b);
                                        }
                                    }
                                }
                            }
                        }
                        fills.push(rgb);
                    }
                }

                // Construir lookup xf -> fillId
                const cellXfsEl = stylesDoc.getElementsByTagName('cellXfs')[0];
                const xfFills = [];
                if (cellXfsEl) {
                    const xfEls = cellXfsEl.getElementsByTagName('xf');
                    for (let xi = 0; xi < xfEls.length; xi++) {
                        xfFills.push(parseInt(xfEls[xi].getAttribute('fillId') || '0', 10));
                    }
                }

                // Solo revisar columnas COD (B), CLIENTE (C) e HILADO (D)
                // Si alguna de esas celdas tiene color, se aplica a toda la fila
                const TARGET_COLS = new Set(['B', 'C', 'D']);
                const rowElsForColor = sheetDoc.getElementsByTagName('row');
                for (let ri = 0; ri < rowElsForColor.length; ri++) {
                    const rowEl = rowElsForColor[ri];
                    const rnum = parseInt(rowEl.getAttribute('r') || '0', 10);
                    if (!rnum) continue;
                    const rowIdx0 = rnum - 1;

                    const cellEls = rowEl.getElementsByTagName('c');
                    for (let ci = 0; ci < cellEls.length; ci++) {
                        const cellRef = cellEls[ci].getAttribute('r') || '';
                        // Extraer letra(s) de columna (antes del número de fila)
                        const colLetter = cellRef.replace(/[0-9]/g, '');
                        if (!TARGET_COLS.has(colLetter)) continue;

                        const sAttr = cellEls[ci].getAttribute('s');
                        if (sAttr == null) continue;
                        const xfIdx = parseInt(sAttr, 10);
                        const fillId = xfFills[xfIdx];
                        if (fillId != null && fillId > 1 && fills[fillId]) {
                            rowColors.set(rowIdx0, fills[fillId]);
                            break; // color encontrado en B/C/D; pasar a la siguiente fila
                        }
                    }
                }
            }
        } catch (colorErr) {
            console.debug('Row color extraction error:', colorErr);
        }

        return { hiddenRows, hiddenCols, rowColors };

    } catch (err) {
        console.debug('extractHiddenRowsColsFromArrayBuffer error', err);
    }
    return { hiddenRows, hiddenCols, rowColors: new Map() };
}
// Detectar la hoja activa del libro. SheetJS expone workbook.Workbook.Sheets[n] con
// el campo Selected=1 para la hoja que estaba visible, o el índice en WBProps.activeTab.
function getActiveSheetName(workbook) {
    try {
        const wb = workbook.Workbook;
        if (wb) {
            // Método 1: activeTab (índice 0-based de la hoja activa)
            const activeTab = (wb.WBProps && wb.WBProps.activeTab != null)
                ? wb.WBProps.activeTab
                : (wb.WBView && wb.WBView[0] && wb.WBView[0].activeTab != null
                    ? wb.WBView[0].activeTab
                    : null);
            if (activeTab != null) {
                const name = workbook.SheetNames[activeTab];
                if (name) {
                    console.log('[ACTIVE SHEET] activeTab=' + activeTab + ' -> "' + name + '"');
                    return name;
                }
            }
            // Método 2: buscar hoja con Selected=1 en workbook.Workbook.Sheets
            if (wb.Sheets && Array.isArray(wb.Sheets)) {
                const selIdx = wb.Sheets.findIndex(s => s && s.Selected);
                if (selIdx >= 0 && workbook.SheetNames[selIdx]) {
                    console.log('[ACTIVE SHEET] Selected flag at idx=' + selIdx + ' -> "' + workbook.SheetNames[selIdx] + '"');
                    return workbook.SheetNames[selIdx];
                }
            }
        }
    } catch (e) {
        console.debug('[ACTIVE SHEET] error detecting active sheet:', e);
    }
    // Fallback: primera hoja
    console.log('[ACTIVE SHEET] Fallback to first sheet: "' + workbook.SheetNames[0] + '"');
    return workbook.SheetNames[0];
}

function processFile() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) return alert("Selecciona un archivo.");
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const arrayBuffer = e.target.result;
            const data = new Uint8Array(arrayBuffer);
            // intentar extraer filas/columnas ocultas leyendo el XML interno del XLSX
            let xmlHidden = { hiddenRows: new Set(), hiddenCols: new Set() };
            try { xmlHidden = await extractHiddenRowsColsFromArrayBuffer(arrayBuffer); } catch (ex) { console.debug('No se pudo extraer hidden desde XML:', ex); }
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = getActiveSheetName(workbook);
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

            const hiddenRows = xmlHidden.hiddenRows || new Set();
            const hiddenCols = xmlHidden.hiddenCols || new Set();
            const rowColors = xmlHidden.rowColors || new Map();

            EXCEL_FORMULA_TOTALS = new Array(12).fill(0);
            HIDDEN_ROWS = hiddenRows;
            HIDDEN_ROWS_SAMPLES = Array.from(hiddenRows).sort((a, b) => a - b).slice(0, 50).map(idx => ({ row: idx + 1, sample: (jsonData[idx] ? (jsonData[idx].slice(0, 6).join(' | ')) : '') }));

            ingestData(jsonData, hiddenRows, hiddenCols, rowColors);
            console.log(`Loaded ${GLOBAL_ITEMS.length} items from Excel`);
            console.log('hiddenRows count:', HIDDEN_ROWS.size, 'examples:', HIDDEN_ROWS_SAMPLES.slice(0, 10));
            console.log('excelGroupTotals capturado:', excelGroupTotals);
            console.log('grandTotalVector calculado:', grandTotalVector);

            applySplitToAllItems();
            recalcAll();
            finalizeProcessing();

        } catch (err) {
            console.error(err);
            alert("Error al procesar el archivo.");
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// Procesar directamente un ArrayBuffer (útil para pruebas automatizadas)
async function processArrayBuffer(buffer) {
    try {
        const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer;
        let xmlHidden = { hiddenRows: new Set(), hiddenCols: new Set() };
        try { xmlHidden = await extractHiddenRowsColsFromArrayBuffer(arrayBuffer); } catch (ex) { console.debug('No se pudo extraer hidden desde XML (autotest):', ex); }
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = getActiveSheetName(workbook);
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        const hiddenRows = xmlHidden.hiddenRows || new Set();
        const hiddenCols = xmlHidden.hiddenCols || new Set();
        const rowColors = xmlHidden.rowColors || new Map();
        console.log('[DEBUG] Hidden rows from XML:', hiddenRows.size, Array.from(hiddenRows).slice(0, 20));
        console.log('[DEBUG] Row colors from XML:', rowColors.size);

        EXCEL_FORMULA_TOTALS = new Array(12).fill(0);
        HIDDEN_ROWS = hiddenRows;
        HIDDEN_ROWS_SAMPLES = Array.from(hiddenRows).sort((a, b) => a - b).slice(0, 50).map(idx => ({ row: idx + 1, sample: (jsonData[idx] ? (jsonData[idx].slice(0, 6).join(' | ')) : '') }));

        ingestData(jsonData, hiddenRows, hiddenCols, rowColors);
        console.log(`Loaded ${GLOBAL_ITEMS.length} items from Excel (autotest)`);
        console.log('hiddenRows count:', HIDDEN_ROWS.size, 'examples:', HIDDEN_ROWS_SAMPLES.slice(0, 10));
        console.log('excelGroupTotals capturado:', excelGroupTotals);
        console.log('grandTotalVector calculado:', grandTotalVector);

        applySplitToAllItems();
        recalcAll();
        finalizeProcessing();

    } catch (err) {
        console.error(err);
        alert("Error al procesar el ArrayBuffer.");
    }
}

function showMainUI() {
    const _tabContainer = document.getElementById('tabContainer');
    if (_tabContainer) _tabContainer.classList.remove('hidden');
    const _detailView = document.getElementById('detailView');
    if (_detailView) _detailView.classList.remove('hidden');
    const _btnExport = document.getElementById('btnExport');
    if (_btnExport) _btnExport.classList.remove('hidden');
    const _debugContainer = document.getElementById('debugContainer');
    if (_debugContainer) _debugContainer.classList.remove('hidden');
}

function updateDebugInfo() {
    const grandSum = grandTotalVector.reduce((a, b) => a + b, 0);
    const excelGroupSum = (excelGroupTotals && Array.isArray(excelGroupTotals)) ? excelGroupTotals.reduce((a, b) => a + b, 0) : 0;
    const itemsWithExcelTotal = GLOBAL_ITEMS.filter(it => (it.excelTotal || 0) > 0);

    let debugHtml = '';
    debugHtml += `<span class="font-medium">Items cargados: ${GLOBAL_ITEMS.length}</span> · `;
    debugHtml += `<span class="font-medium">Suma calculada total: ${formatNumber(grandSum)} Kg</span>`;
    if (excelGroupTotals) debugHtml += ` · <span class="font-medium">Excel DETALLE TOTAL GRUPOS: ${formatNumber(excelGroupSum)} Kg</span>`;
    debugHtml += `<br/><span class="text-xs text-slate-600">Filas con TOTAL en Excel: ${itemsWithExcelTotal.length}</span>`;

    // Nota: no mostramos la lista detallada de filas ocultas para mantener la UI limpia.
    const _debugInfo = document.getElementById('debugInfo');
    if (_debugInfo) _debugInfo.innerHTML = debugHtml;
}

function finalizeProcessing() {
    showMainUI();
    updateDebugInfo();
}

// Hacer accesible globalmente para pruebas de servidor local
window.processArrayBuffer = processArrayBuffer;

function ingestData(jsonData, hiddenRows = new Set(), hiddenCols = new Set(), rowColors = new Map()) {
    GLOBAL_ITEMS = [];
    grandTotalVector = new Array(12).fill(0);
    activeIndices = [];
    excelGroupTotals = null;

    let colStartIndex = -1;
    let rowYearIndex = -1;
    let yearFound = null;
    let headerRowIndex = -1;
    let lineColIndex = 0;
    let clientColIndex = 2;
    let yarnColIndex = 3;

    function normalizeHeaderText(v) {
        return stripDiacritics((v || '').toString().toUpperCase()).trim();
    }

    // Solo acepta celdas realmente numericas para evitar que textos
    // como "70 DIAS ANTES..." se interpreten como 70.
    function parseMonthCellValue(rawCell) {
        if (typeof rawCell === 'number') return rawCell;
        if (rawCell === null || rawCell === undefined || rawCell === '') return 0;
        const s = rawCell.toString().trim();
        if (!s) return 0;
        if (s.charAt(0) === '=') return 0;
        if (/[A-Za-z\u00C0-\u024F]/.test(s)) return 0;
        return parseLocaleNumber(s);
    }

    const MONTH_TOKEN_TO_INDEX = {
        'ENE': 0, 'ENERO': 0,
        'FEB': 1, 'FEBRERO': 1,
        'MAR': 2, 'MARZO': 2,
        'ABR': 3, 'ABRIL': 3,
        'MAY': 4, 'MAYO': 4,
        'JUN': 5, 'JUNIO': 5,
        'JUL': 6, 'JULIO': 6,
        'AGO': 7, 'AGOSTO': 7,
        'SEP': 8, 'SET': 8, 'SEPTIEMBRE': 8, 'SETIEMBRE': 8,
        'OCT': 9, 'OCTUBRE': 9,
        'NOV': 10, 'NOVIEMBRE': 10,
        'DIC': 11, 'DICIEMBRE': 11
    };

    function getMonthIndexFromCell(raw) {
        const txt = normalizeHeaderText(raw).replace(/\./g, '');
        if (!txt) return -1;
        if (Object.prototype.hasOwnProperty.call(MONTH_TOKEN_TO_INDEX, txt)) return MONTH_TOKEN_TO_INDEX[txt];
        return -1;
    }
    // Prioridad: buscar explícitamente 2026 (si existe en encabezados)
    for (let searchRow = 0; searchRow < Math.min(10, jsonData.length); searchRow++) {
        const yearRow = jsonData[searchRow];
        if (!yearRow) continue;
        for (let i = 0; i < yearRow.length; i++) {
            // ignorar columnas ocultas
            if (hiddenCols && hiddenCols.has(i)) continue;
            const raw = yearRow[i];
            const cellVal = raw ? yearRow[i].toString().toUpperCase() : '';
            if (/\b2026\b/.test(cellVal)) { colStartIndex = i; rowYearIndex = searchRow; yearFound = '2026'; break; }
        }
        if (colStartIndex !== -1) break;
    }
    // Primera estrategia: buscar una celda con un año razonable (1900-2099) o 'AÑO' seguido de año
    for (let searchRow = 0; searchRow < Math.min(10, jsonData.length); searchRow++) {
        const yearRow = jsonData[searchRow];
        if (!yearRow) continue;
        for (let i = 0; i < yearRow.length; i++) {
            const raw = yearRow[i];
            const cellVal = raw ? yearRow[i].toString().toUpperCase() : '';
            // buscar año de forma estricta: 19xx o 20xx
            const m = cellVal.match(/\b(19|20)\d{2}\b/);
            if (m) {
                colStartIndex = i; rowYearIndex = searchRow; yearFound = m[0];
                break;
            }
            if (cellVal.includes('AÑO')) {
                const m2 = cellVal.match(/\b(19|20)\d{2}\b/);
                if (m2) { colStartIndex = i; rowYearIndex = searchRow; yearFound = m2[0]; break; }
            }
        }
        if (colStartIndex !== -1) break;
    }
    // Segunda estrategia: si no encontramos año válido, buscar fila que contenga tokens de meses
    if (colStartIndex === -1) {
        for (let searchRow = 0; searchRow < Math.min(10, jsonData.length); searchRow++) {
            const yearRow = jsonData[searchRow];
            if (!yearRow) continue;
            let monthCount = 0; let firstMonthIndex = -1;
            for (let i = 0; i < yearRow.length; i++) {
                if (hiddenCols && hiddenCols.has(i)) continue;
                if (getMonthIndexFromCell(yearRow[i]) !== -1) {
                    monthCount++; if (firstMonthIndex === -1) firstMonthIndex = i;
                }
            }
            if (monthCount >= 3 && firstMonthIndex !== -1) {
                colStartIndex = firstMonthIndex; rowYearIndex = searchRow; break;
            }
        }
    }

    if (colStartIndex === -1) {
        for (let searchRow = 0; searchRow < Math.min(10, jsonData.length); searchRow++) {
            const yearRow = jsonData[searchRow];
            if (!yearRow) continue;
            for (let i = 0; i < yearRow.length; i++) {
                const cellVal = yearRow[i] ? yearRow[i].toString() : '';
                const match = cellVal.match(/\d{4}/);
                if (match) { colStartIndex = i; rowYearIndex = searchRow; yearFound = match[0]; break; }
            }
            if (colStartIndex !== -1) break;
        }
    }
    if (colStartIndex === -1) return alert("No se encontró año en el archivo. Verifica que el Excel tenga la estructura correcta.");

    // Detectar columnas reales de LINEA/CLIENTE/HILADO desde el encabezado.
    let bestHeaderScore = -1;
    const headerSearchStart = Math.max(0, rowYearIndex - 2);
    const headerSearchEnd = Math.min(jsonData.length - 1, rowYearIndex + 4);
    for (let r = headerSearchStart; r <= headerSearchEnd; r++) {
        const row = jsonData[r] || [];
        let lineIdx = -1;
        let clientIdx = -1;
        let yarnIdx = -1;
        for (let c = 0; c < row.length; c++) {
            if (hiddenCols && hiddenCols.has(c)) continue;
            const txt = normalizeHeaderText(row[c]);
            if (!txt) continue;
            if (lineIdx === -1 && txt.includes('LINEA')) lineIdx = c;
            if (clientIdx === -1 && txt.includes('CLIENTE')) clientIdx = c;
            if (yarnIdx === -1 && (txt.includes('HILADO') || txt.includes('HILO') || txt.includes('YARN'))) yarnIdx = c;
        }
        let score = 0;
        if (lineIdx !== -1) score++;
        if (clientIdx !== -1) score++;
        if (yarnIdx !== -1) score++;
        if (score > bestHeaderScore) {
            bestHeaderScore = score;
            headerRowIndex = r;
            lineColIndex = (lineIdx !== -1) ? lineIdx : 0;
            clientColIndex = (clientIdx !== -1) ? clientIdx : 2;
            yarnColIndex = (yarnIdx !== -1) ? yarnIdx : 3;
        }
        if (score === 3) break;
    }
    if (clientColIndex === -1 && yarnColIndex > 0) clientColIndex = yarnColIndex - 1;
    if (yarnColIndex === -1 && clientColIndex >= 0) yarnColIndex = clientColIndex + 1;
    if (lineColIndex === -1) lineColIndex = 0;
    if (clientColIndex < 0) clientColIndex = 2;
    if (yarnColIndex < 0) yarnColIndex = 3;
    console.log('[HEADER DETECT]', { headerRowIndex, lineColIndex, clientColIndex, yarnColIndex, yearFound, rowYearIndex, colStartIndex });

    // Detectar la fila de encabezado de meses.
    let monthHeaderRowIndex = -1;
    let bestMonthHeaderCount = -1;
    const monthSearchCenter = (headerRowIndex !== -1) ? headerRowIndex : rowYearIndex;
    const monthSearchStart = Math.max(0, monthSearchCenter - 2);
    const monthSearchEnd = Math.min(jsonData.length - 1, monthSearchCenter + 2);
    for (let r = monthSearchStart; r <= monthSearchEnd; r++) {
        const row = jsonData[r] || [];
        let monthCount = 0;
        for (let c = 0; c < row.length; c++) {
            if (hiddenCols && hiddenCols.has(c)) continue;
            if (getMonthIndexFromCell(row[c]) !== -1) monthCount++;
        }
        if (monthCount > bestMonthHeaderCount) {
            bestMonthHeaderCount = monthCount;
            monthHeaderRowIndex = r;
        }
    }

    // Mapear columnas por nombre de mes real (ENE..DIC). Si falta ENE, se mantiene en 0.
    let monthColumnIndexes = new Array(12).fill(-1);
    let mappedMonthsCount = 0;
    if (monthHeaderRowIndex !== -1) {
        const monthHeaderRow = jsonData[monthHeaderRowIndex] || [];
        const scanStart = Math.max(0, colStartIndex);
        for (let c = scanStart; c < monthHeaderRow.length; c++) {
            if (hiddenCols && hiddenCols.has(c)) continue;
            const monthIdx = getMonthIndexFromCell(monthHeaderRow[c]);
            if (monthIdx === -1) continue;
            if (monthColumnIndexes[monthIdx] === -1) {
                monthColumnIndexes[monthIdx] = c;
                mappedMonthsCount++;
            }
            if (mappedMonthsCount === 12) break;
        }
    }

    // Fallback antiguo: columnas consecutivas desde colStartIndex (para layouts sin encabezado de meses).
    if (mappedMonthsCount === 0) {
        monthColumnIndexes = new Array(12).fill(-1);
        let monthPos = 0;
        for (let c = colStartIndex; c < Math.min(colStartIndex + 80, (jsonData[rowYearIndex] || []).length); c++) {
            if (hiddenCols && hiddenCols.has(c)) continue;
            monthColumnIndexes[monthPos] = c;
            monthPos++;
            if (monthPos === 12) break;
        }
    }

    const lastMappedMonthColumn = (function () {
        for (let m = 11; m >= 0; m--) {
            const c = monthColumnIndexes[m];
            if (c !== undefined && c !== null && c >= 0) return c;
        }
        return colStartIndex + 11;
    })();

    console.log('[MONTH MAP]', {
        monthHeaderRowIndex,
        mappedMonthsCount,
        map: monthColumnIndexes
    });

    let dataStartRow = (headerRowIndex !== -1) ? (headerRowIndex + 1) : (rowYearIndex + 2);

    // Heurística: detectar dinámicamente la primera fila con datos significativos
    // (saltando filas que están todas vacías o solo contienen "-" / valores triviales)
    // Esto maneja automáticamente filas ocultas sin depender de la metadata de SheetJS
    for (let testRow = dataStartRow; testRow < Math.min(dataStartRow + 200, jsonData.length); testRow++) {
        const row = jsonData[testRow];
        if (!row || row.length < 4) continue;
        const lineVal = (row[lineColIndex] || "").toString().trim();
        const clientVal = (row[clientColIndex] || "").toString().trim();
        const yarnVal = (row[yarnColIndex] || "").toString().trim();

        // Contar valores numéricos significativos en las columnas de meses
        let significantValues = 0;
        for (let m = 0; m < Math.min(12, monthColumnIndexes.length); m++) {
            const colIdx = monthColumnIndexes[m];
            if (colIdx === undefined || colIdx === null || colIdx < 0) continue;
            const cellVal = row[colIdx];
            const numVal = parseMonthCellValue(cellVal);
            if (Math.abs(numVal) > 0.01) {
                significantValues++;
            }
        }

        // Si encontramos una fila con: línea no vacía, cliente no vacío, hilo no vacío, y al menos UN valor de mes significativo
        // Entonces esta es la primera fila de datos real
        if (lineVal && clientVal && yarnVal && significantValues > 0) {
            dataStartRow = testRow;
            console.log('[HEURISTIC] First significant data row detected at index:', testRow, '(line=' + lineVal + ', client=' + clientVal + ')');
            break;
        }
    }
    if (monthColumnIndexes.length === 12) {
        excelGroupTotals = new Array(12).fill(0);
        // Buscar la fila de TOTAL del Excel: buscar texto "TOTAL" en primeras columnas
        // debajo de los datos (fila real de totales). Si no se encuentra, fallback a
        // buscar arriba del encabezado (comportamiento anterior).
        let totalsRowIndex = -1;

        // Estrategia 1: buscar fila con "TOTAL" debajo de los datos
        for (let r = dataStartRow; r < jsonData.length; r++) {
            const trow = jsonData[r] || [];
            for (let c = 0; c < Math.min(5, trow.length); c++) {
                const txt = stripDiacritics((trow[c] || '').toString().toUpperCase()).trim();
                if (txt === 'TOTAL') {
                    totalsRowIndex = r;
                    console.log('[TOTAL ROW] Found "TOTAL" text at row', r, 'col', c);
                    break;
                }
            }
            if (totalsRowIndex !== -1) break;
        }

        // Estrategia 2 (fallback): buscar fila superior con más celdas numéricas
        if (totalsRowIndex === -1) {
            totalsRowIndex = Math.max(0, rowYearIndex - 1);
            const totalsSearchStart = Math.max(0, ((headerRowIndex !== -1) ? headerRowIndex : rowYearIndex) - 4);
            const totalsSearchEnd = Math.max(0, ((headerRowIndex !== -1) ? headerRowIndex : rowYearIndex) - 1);
            let bestNumericCells = -1;
            for (let r = totalsSearchStart; r <= totalsSearchEnd; r++) {
                const trow = jsonData[r] || [];
                let numericCells = 0;
                for (let m = 0; m < 12; m++) {
                    const c = monthColumnIndexes[m];
                    if (c === undefined || c === null || c < 0) continue;
                    const raw = trow[c];
                    if (typeof raw === 'number') {
                        numericCells++;
                        continue;
                    }
                    if (raw === null || raw === undefined || raw === '') continue;
                    const txt = raw.toString().trim();
                    if (!txt || txt.charAt(0) === '=' || /[A-Za-z\u00C0-\u024F]/.test(txt)) continue;
                    numericCells++;
                }
                if (numericCells > bestNumericCells) {
                    bestNumericCells = numericCells;
                    totalsRowIndex = r;
                }
            }
            console.log('[TOTAL ROW] Fallback: using row above header, totalsRowIndex=', totalsRowIndex);
        }

        const formulaRow = jsonData[totalsRowIndex] || [];
        for (let m = 0; m < 12; m++) {
            const colIdx = monthColumnIndexes[m];
            if (colIdx === undefined || colIdx === null || colIdx < 0) {
                excelGroupTotals[m] = 0;
                continue;
            }
            const cellValue = formulaRow[colIdx];
            excelGroupTotals[m] = parseMonthCellValue(cellValue);
        }
        console.log('excelGroupTotals extraído (columnas visibles):', excelGroupTotals, 'totalsRowIndex=', totalsRowIndex);
    } else {
        console.log('No se pudieron mapear 12 columnas de meses visibles desde colStartIndex');
    }

    // Exponer jsonData y monthColumnIndexes para diagnósticos y modal de discrepancias
    window.GLOBAL_JSONDATA = jsonData;
    window.MONTH_COLUMN_INDEXES = monthColumnIndexes;

    // Determinar si existe una fila de TOTAL que marca el final de la tabla
    let dataEndRow = jsonData.length - 1;
    for (let r = dataStartRow; r < jsonData.length; r++) {
        const prow = jsonData[r] || [];
        const joined = prow.map(c => (c || '').toString().toUpperCase()).join(' ');
        if (/\bTOTAL\b/.test(joined)) { dataEndRow = r; console.log('[DATA END] Detected TOTAL at row', r); break; }
    }

    let grandVectorTemp = new Array(12).fill(0);
    for (let i = dataStartRow; i <= dataEndRow; i++) {
        if (hiddenRows && hiddenRows.has(i)) continue;
        const row = jsonData[i];
        if (!row) continue;
        const lineVal = (row[lineColIndex] || "").toString().trim();
        const clientVal = (row[clientColIndex] || "").toString().trim();
        let yarnVal = (row[yarnColIndex] || "").toString();

        // Calcular valores mensuales primero (usar monthColumnIndexes si está mapeado)
        let rowSum = 0;
        let rowValues = [];
        for (let m = 0; m < 12; m++) {
            const colIdx = (monthColumnIndexes && monthColumnIndexes[m] !== undefined) ? monthColumnIndexes[m] : (colStartIndex + m);
            if (colIdx === undefined || colIdx === null || colIdx < 0) {
                rowValues.push(0);
                continue;
            }
            const rawCell = row[colIdx];
            const val = parseMonthCellValue(rawCell);
            rowValues.push(val);
            rowSum += val;
            grandVectorTemp[m] += val;
        }

        // Detectar celda Excel TOTAL (si existe justo después de la última columna de mes mapeada)
        const excelTotalCell = row[(monthColumnIndexes && monthColumnIndexes.length > 0) ? (lastMappedMonthColumn + 1) : (colStartIndex + 12)];
        const excelTotal = excelTotalCell ? parseMonthCellValue(excelTotalCell) : 0;

        // Determinar si la fila debe incluirse: si tiene suma significativa, si tiene excelTotal, o si contiene la palabra TOTAL
        const rowContainsTOTAL = row.some(c => (c || '').toString().toUpperCase().includes('TOTAL'));

        // Si la fila está completamente vacía y no tiene TOTAL ni suma, la ignoramos
        if (Math.abs(rowSum) <= 0.01 && Math.abs(excelTotal) <= 0.01 && !rowContainsTOTAL && !lineVal && !clientVal && !yarnVal) {
            continue;
        }

        // Normalizar nombre de hilo si existe
        yarnVal = cleanImportedName(yarnVal, clientVal);

        // Filtrar filas que contienen textos no deseados (RESERVA, REVERSA, CLIENTES VARIOS, PROYECCION, PROYECCIÓN)
        const joinedText = ((lineVal || '') + '|' + (clientVal || '') + '|' + (yarnVal || '')).toString().toUpperCase();
        const joinedNoAcc = stripDiacritics(joinedText);
        const forbidden = ['RESERVA', 'REVERSA', 'CLIENTES VARIOS', 'CLIENTESVARIOS', 'PROYECCION', 'PROYECCION'];
        const isForbidden = forbidden.some(tok => joinedNoAcc.includes(tok));
        if (isForbidden) continue;

        // Excluir filas que contienen la palabra TOTAL (evita fila redundante en la tabla)
        if (joinedNoAcc.includes('TOTAL')) continue;

        GLOBAL_ITEMS.push({
            id: generateId(),
            rowIndex: i,
            line: lineVal,
            client: clientVal,
            yarn: yarnVal,
            values: rowValues,
            originalValues: [...rowValues],
            excelTotal: excelTotal,
            calculatedSum: rowSum,
            kgSol: rowSum,
            excelColor: rowColors.get(i) || null,
            forcedGroup: null
        });
    }

    grandTotalVector = grandVectorTemp;

    // Eliminar explícitamente cualquier ítem que provenga de una fila marcada como oculta
    if (HIDDEN_ROWS && HIDDEN_ROWS.size > 0) {
        const before = GLOBAL_ITEMS.length;
        GLOBAL_ITEMS = GLOBAL_ITEMS.filter(it => !HIDDEN_ROWS.has(it.rowIndex));
        const after = GLOBAL_ITEMS.length;
        console.log('[HIDDEN FILTER] Removed', before - after, 'items coming from hidden rows');
    }

    // Calcular activeIndices: meses con datos > 0
    activeIndices = [];
    for (let idx = 0; idx < 12; idx++) {
        if (Math.abs(grandTotalVector[idx]) > 0.01) {
            activeIndices.push(idx);
        }
    }
    if (activeIndices.length === 0) {
        // Si no hay datos en ningún mes, mostrar todos los 12 meses por defecto
        activeIndices = Array.from({ length: 12 }, (_, i) => i);
    }

    // Filtrar meses anteriores al mes actual del calendario
    // (no tiene sentido mostrar ENE si ya estamos en FEB o posterior)
    const currentMonthIdx = new Date().getMonth(); // 0=ENE, 1=FEB, ..., 11=DIC
    const fromCurrentMonth = activeIndices.filter(idx => idx >= currentMonthIdx);
    // Solo aplicar el filtro si quedan meses visibles (para no dejar la tabla en blanco)
    if (fromCurrentMonth.length > 0) {
        activeIndices = fromCurrentMonth;
    }
}
