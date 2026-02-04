// Module: EXCEL EXPORTACION
// Contains: exportToExcel

function exportToExcel() {
    function getColRef(c) { return XLSX.utils.encode_col(c); }
    function isMonthHeaderToken(v) {
        const s = (v === null || v === undefined) ? '' : v.toString().trim().toUpperCase();
        return MONTH_NAMES.includes(s);
    }
    function isNumericCell(v) {
        return typeof v === 'number' && !isNaN(v);
    }
    function applyHorizontalTotalFormulas(rows) {
        if (!rows || !rows.length) return;
        for (let i = 0; i < rows.length; i++) {
            const header = rows[i] || [];
            const monthCols = [];
            for (let c = 0; c < header.length; c++) {
                if (isMonthHeaderToken(header[c])) monthCols.push(c);
            }
            if (monthCols.length < 3) continue;

            let totalCol = -1;
            for (let c = 0; c < header.length; c++) {
                const txt = (header[c] || '').toString().toUpperCase();
                if (txt.includes('TOTAL')) { totalCol = c; break; }
            }
            if (totalCol === -1) totalCol = Math.max.apply(null, monthCols) + 1;

            const minCol = Math.min.apply(null, monthCols);
            const maxCol = Math.max.apply(null, monthCols);
            for (let r = i + 1; r < rows.length; r++) {
                const row = rows[r] || [];
                const nonEmpty = row.filter(v => v !== '' && v !== null && typeof v !== 'undefined').length;
                if (nonEmpty === 0) break;

                let nextHeaderMonthCount = 0;
                for (let c = 0; c < row.length; c++) if (isMonthHeaderToken(row[c])) nextHeaderMonthCount++;
                if (nextHeaderMonthCount >= 3) break;

                if (nonEmpty <= 1) continue; // filas de título/separador
                let hasNumeric = false;
                for (let m = 0; m < monthCols.length; m++) {
                    if (isNumericCell(row[monthCols[m]])) { hasNumeric = true; break; }
                }
                if (!hasNumeric) continue;

                const excelRow = r + 1;
                row[totalCol] = {
                    t: 'n',
                    f: `SUM(${getColRef(minCol)}${excelRow}:${getColRef(maxCol)}${excelRow})`
                };
                rows[r] = row;
            }
        }
    }

    function getCellExportValue(cell) {
        if (!cell) return '';
        const ctrl = cell.querySelector('input, select, textarea');
        const raw = ctrl ? (ctrl.value || '') : (cell.textContent || '');
        const text = raw.toString().replace(/\s+/g, ' ').trim();
        if (!text) return '';

        // Convertir numeros con separador de miles (24,780) o decimal (12.5) a numerico.
        const numericCandidate = text.replace(/,/g, '');
        if (/^-?\d+(?:\.\d+)?$/.test(numericCandidate)) {
            const n = parseFloat(numericCandidate);
            if (!isNaN(n)) return n;
        }
        return text;
    }

    function extractTableAoa(tableId) {
        const tableEl = document.getElementById(tableId);
        if (!tableEl) return [];
        const rows = tableEl.querySelectorAll('tr');
        const aoa = [];
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('th,td');
            if (!cells || !cells.length) continue;
            const row = [];
            let hasContent = false;
            for (let j = 0; j < cells.length; j++) {
                const val = getCellExportValue(cells[j]);
                row.push(val);
                if (val !== '') hasContent = true;
            }
            if (hasContent) aoa.push(row);
        }
        return aoa;
    }

    function appendSection(targetRows, title, sectionRows) {
        if (!sectionRows || !sectionRows.length) return;
        if (targetRows.length > 0) targetRows.push([]);
        if (title) targetRows.push([title]);
        for (let i = 0; i < sectionRows.length; i++) targetRows.push(sectionRows[i]);
    }

    function ensureRows(rows, fallbackTitle) {
        if (rows && rows.length) return rows;
        return [[fallbackTitle || 'Sin datos']];
    }

    const monthIndices = Array.from({ length: 12 }, (_, i) => i);

    // =====================================================
    // 1) EXCEL COMPLETO (incluye hojas por mes: ENE..DIC)
    // =====================================================
    const wb = XLSX.utils.book_new();

    const ws_data1 = [];
    let row1 = ["LINEA", "CLIENTE", "HILADO"];
    monthIndices.forEach(idx => row1.push(MONTH_NAMES[idx]));
    row1.push("TOTAL");
    ws_data1.push(row1);

    GLOBAL_ITEMS.forEach(row => {
        const excelRow = ws_data1.length + 1;
        let r = [row.line, row.client, row.yarn];
        monthIndices.forEach(idx => {
            const v = (row.values && typeof row.values[idx] !== 'undefined') ? row.values[idx] : 0;
            r.push(v);
        });
        r.push({ t: 'n', f: `SUM(${getColRef(3)}${excelRow}:${getColRef(3 + monthIndices.length - 1)}${excelRow})` });
        ws_data1.push(r);
    });

    let totalRow1 = ["", "", "TOTAL DETALLE:"];
    monthIndices.forEach((idx, i) => {
        const colLetter = getColRef(3 + i);
        totalRow1.push({ t: 'n', f: `SUM(${colLetter}2:${colLetter}${ws_data1.length})` });
    });
    const lastCol = getColRef(3 + monthIndices.length);
    totalRow1.push({ t: 'n', f: `SUM(${lastCol}2:${lastCol}${ws_data1.length})` });
    ws_data1.push(totalRow1);

    ws_data1.push([]);
    ws_data1.push([]);
    ws_data1.push(["RESUMEN GERENCIAL"]);
    ws_data1.push(["CLIENTE", ...monthIndices.map(i => MONTH_NAMES[i]), "TOTAL"]);

    let rowLLL = ["LLL"];
    monthIndices.forEach((idx, i) => {
        const colLetter = getColRef(3 + i);
        rowLLL.push({ t: 'n', f: `SUMIF($B$2:$B$${1 + GLOBAL_ITEMS.length}, "LLL", ${colLetter}2:${colLetter}${1 + GLOBAL_ITEMS.length})` });
    });
    rowLLL.push({ t: 'n', f: `SUM(${getColRef(3)}${ws_data1.length + 1}:${getColRef(3 + monthIndices.length - 1)}${ws_data1.length + 1})` });
    ws_data1.push(rowLLL);

    let rowVarios = ["CLIENTES VARIOS (Total)"];
    monthIndices.forEach((idx, i) => {
        const colLetter = getColRef(3 + i);
        rowVarios.push({ t: 'n', f: `SUMIF($B$2:$B$${1 + GLOBAL_ITEMS.length}, "<>LLL", ${colLetter}2:${colLetter}${1 + GLOBAL_ITEMS.length})` });
    });
    rowVarios.push({ t: 'n', f: `SUM(${getColRef(3)}${ws_data1.length + 1}:${getColRef(3 + monthIndices.length - 1)}${ws_data1.length + 1})` });
    ws_data1.push(rowVarios);

    Object.keys(statsVariosDetalle || {}).sort().forEach((c) => {
        const r = [`   ${c}`];
        monthIndices.forEach((idx, i) => {
            const colLetter = getColRef(3 + i);
            const clientEsc = c.replace(/"/g, '""');
            r.push({ t: 'n', f: `SUMIF($B$2:$B$${1 + GLOBAL_ITEMS.length}, "${clientEsc}", ${colLetter}2:${colLetter}${1 + GLOBAL_ITEMS.length})` });
        });
        r.push({ t: 'n', f: `SUM(${getColRef(3)}${ws_data1.length + 1}:${getColRef(3 + monthIndices.length - 1)}${ws_data1.length + 1})` });
        ws_data1.push(r);
    });

    const sheet1 = XLSX.utils.aoa_to_sheet(ws_data1);
    sheet1['!cols'] = [{wch:12}, {wch:15}, {wch:30}, ...monthIndices.map(() => ({wch:12})), {wch:12}];
    XLSX.utils.book_append_sheet(wb, sheet1, "Detalle y Gerencial");

    const ws_data2 = [];
    const monthHeader = monthIndices.map(i => MONTH_NAMES[i]);
    ws_data2.push(["MAT. CRUDOS"]);
    crudoGroups.forEach((group) => {
        if (Math.abs(group.columnTotals.reduce((a, b) => a + b, 0)) <= 0.01) return;
        ws_data2.push([`MATERIAL: ${cleanMaterialTitle(group.title)}`]);
        ws_data2.push(["Linea", "Cliente", "Hilado", ...monthHeader, "TOTAL"]);
        const firstDataExcelRow = ws_data2.length + 1;
        let addedRows = 0;
        group.rows.forEach(row => {
            const excelRow = ws_data2.length + 1;
            const r = [row.line, row.client, row.yarn];
            monthIndices.forEach(idx => {
                const v = (row.values && typeof row.values[idx] !== 'undefined') ? row.values[idx] : 0;
                r.push(v);
            });
            r.push({ t: 'n', f: `SUM(${getColRef(3)}${excelRow}:${getColRef(3 + monthIndices.length - 1)}${excelRow})` });
            ws_data2.push(r);
            addedRows++;
        });
        if (addedRows > 0) {
            const lastDataExcelRow = ws_data2.length;
            const totals = ["", "", "TOTAL MES:"];
            monthIndices.forEach((idx, m) => {
                const col = getColRef(3 + m);
                totals.push({ t: 'n', f: `SUM(${col}${firstDataExcelRow}:${col}${lastDataExcelRow})` });
            });
            const totalCol = getColRef(3 + monthIndices.length);
            totals.push({ t: 'n', f: `SUM(${totalCol}${firstDataExcelRow}:${totalCol}${lastDataExcelRow})` });
            ws_data2.push(totals);
        }
        ws_data2.push([]);
    });

    ws_data2.push(["MAT. MEZCLAS"]);
    mezclaGroups.forEach(group => {
        if (Math.abs(group.groupRawTotals.reduce((a, b) => a + b, 0)) <= 0.01) return;
        ws_data2.push([`MATERIAL: ${cleanMaterialTitle(group.title)}`]);
        ws_data2.push(["Linea", "Cliente", "Hilado", ...monthHeader, "TOTAL"]);
        const firstDataExcelRow = ws_data2.length + 1;
        let addedRows = 0;
        (group.uniqueYarns ? Array.from(group.uniqueYarns) : []).forEach(id => {
            const it = GLOBAL_ITEMS.find(x => x.id === id);
            if (!it) return;
            const excelRow = ws_data2.length + 1;
            const r = [it.line, it.client, it.yarn];
            monthIndices.forEach(idx => {
                const v = (it.values && typeof it.values[idx] !== 'undefined') ? it.values[idx] : 0;
                r.push(v);
            });
            r.push({ t: 'n', f: `SUM(${getColRef(3)}${excelRow}:${getColRef(3 + monthIndices.length - 1)}${excelRow})` });
            ws_data2.push(r);
            addedRows++;
        });
        if (addedRows > 0) {
            const lastDataExcelRow = ws_data2.length;
            const totals = ["", "", "TOTAL MES:"];
            monthIndices.forEach((idx, m) => {
                const col = getColRef(3 + m);
                totals.push({ t: 'n', f: `SUM(${col}${firstDataExcelRow}:${col}${lastDataExcelRow})` });
            });
            const totalCol = getColRef(3 + monthIndices.length);
            totals.push({ t: 'n', f: `SUM(${totalCol}${firstDataExcelRow}:${totalCol}${lastDataExcelRow})` });
            ws_data2.push(totals);
        }
        ws_data2.push([]);
    });

    ws_data2.push([]);
    ws_data2.push(["RESUMEN DE MATERIALES"]);
    function addFiberTableToSheet(title, dataObj, orderedKeys) {
        ws_data2.push([title]);
        ws_data2.push(["FIBRA", ...monthHeader, "TOTAL"]);
        orderedKeys.forEach(fn => {
            const d = dataObj[fn] || { totalValues: new Array(12).fill(0) };
            const excelRow = ws_data2.length + 1;
            const row = [fn];
            monthIndices.forEach(idx => {
                const v = d.totalValues[idx] || 0;
                row.push(v);
            });
            row.push({ t: 'n', f: `SUM(${getColRef(1)}${excelRow}:${getColRef(monthIndices.length)}${excelRow})` });
            ws_data2.push(row);
        });
        ws_data2.push([]);
    }
    addFiberTableToSheet("ALGODON (QQ)", detailAlgodon, ORDERED_COTTON_KEYS);
    addFiberTableToSheet("OTRAS FIBRAS (KG REQ)", detailOtras, ORDERED_OTHER_KEYS);

    const sheet2 = XLSX.utils.aoa_to_sheet(ws_data2);
    sheet2['!cols'] = [{wch:12}, {wch:15}, {wch:30}, ...monthIndices.map(() => ({wch:12})), {wch:12}];
    XLSX.utils.book_append_sheet(wb, sheet2, "Materiales y Resumen");

    monthIndices.forEach(idx => {
        const ws = [];
        ws.push([`MATERIALES - ${MONTH_NAMES[idx]}`]);
        ws.push([]);
        ws.push(["MAT. CRUDOS"]);
        crudoGroups.forEach(group => {
            const monthVal = group.columnTotals[idx] || 0;
            if (Math.abs(monthVal) < 0.0001) return;
            ws.push([`MATERIAL: ${cleanMaterialTitle(group.title)}`]);
            ws.push(["Linea", "Cliente", "Hilado", MONTH_NAMES[idx]]);
            const firstDataExcelRow = ws.length + 1;
            let addedRows = 0;
            group.rows.forEach(r => {
                ws.push([r.line, r.client, r.yarn, (r.values && r.values[idx]) || 0]);
                addedRows++;
            });
            if (addedRows > 0) {
                const lastDataExcelRow = ws.length;
                ws.push(["", "", "TOTAL MES:", { t: 'n', f: `SUM(D${firstDataExcelRow}:D${lastDataExcelRow})` }]);
            }
            ws.push([]);
        });

        ws.push(["MAT. MEZCLAS"]);
        mezclaGroups.forEach(group => {
            const monthTotal = group.groupRawTotals[idx] || 0;
            if (Math.abs(monthTotal) < 0.0001) return;
            ws.push([`MATERIAL: ${cleanMaterialTitle(group.title)}`]);
            ws.push(["Linea", "Cliente", "Hilado", MONTH_NAMES[idx]]);
            const firstDataExcelRow = ws.length + 1;
            let addedRows = 0;
            (group.uniqueYarns ? Array.from(group.uniqueYarns) : []).forEach(id => {
                const it = GLOBAL_ITEMS.find(x => x.id === id);
                if (it) ws.push([it.line, it.client, it.yarn, (it.values && it.values[idx]) || 0]);
                if (it) addedRows++;
            });
            if (addedRows > 0) {
                const lastDataExcelRow = ws.length;
                ws.push(["", "", "TOTAL MES:", { t: 'n', f: `SUM(D${firstDataExcelRow}:D${lastDataExcelRow})` }]);
            }
            ws.push([]);
        });

        const sheet = XLSX.utils.aoa_to_sheet(ws);
        sheet['!cols'] = [{wch:30}, {wch:16}, {wch:48}, {wch:14}];
        XLSX.utils.book_append_sheet(wb, sheet, `MATERIALES_${MONTH_NAMES[idx]}`);
    });

    // =====================================================
    // 2) EXCEL RESUMEN (solo 4 hojas solicitadas)
    // =====================================================
    const wbResumen = XLSX.utils.book_new();

    const detalleRows = [];
    appendSection(detalleRows, "DETALLE GRUPOS", extractTableAoa('groupsTable'));
    appendSection(detalleRows, "RESUMEN GERENCIAL - CLIENTE", extractTableAoa('summaryClientTable'));
    appendSection(detalleRows, "RESUMEN GERENCIAL - LINEA", extractTableAoa('summaryLineTable'));
    const detalleRowsFinal = ensureRows(detalleRows, 'Detalle sin datos');
    applyHorizontalTotalFormulas(detalleRowsFinal);
    XLSX.utils.book_append_sheet(wbResumen, XLSX.utils.aoa_to_sheet(detalleRowsFinal), "Detalle");

    const crudosRows = ensureRows(extractTableAoa('crudosTable'), 'Mat. crudos sin datos');
    applyHorizontalTotalFormulas(crudosRows);
    XLSX.utils.book_append_sheet(wbResumen, XLSX.utils.aoa_to_sheet(crudosRows), "Mat_crudos");

    const mezclasRows = ensureRows(extractTableAoa('mezclasTable'), 'Mat. mezclas sin datos');
    applyHorizontalTotalFormulas(mezclasRows);
    XLSX.utils.book_append_sheet(wbResumen, XLSX.utils.aoa_to_sheet(mezclasRows), "Mat_mezclas");

    const resumenRows = [];
    appendSection(resumenRows, "RESUMEN", extractTableAoa('balanceTable'));
    appendSection(resumenRows, "ALGODON (QQ)", extractTableAoa('algodonTable'));
    appendSection(resumenRows, "OTRAS FIBRAS (KG REQ)", extractTableAoa('otrasTable'));
    const resumenRowsFinal = ensureRows(resumenRows, 'Resumen sin datos');
    applyHorizontalTotalFormulas(resumenRowsFinal);
    XLSX.utils.book_append_sheet(wbResumen, XLSX.utils.aoa_to_sheet(resumenRowsFinal), "Resumen");

    // Descargar ambos archivos
    XLSX.writeFile(wb, "PCP_Gestion_Total_2026_Meses.xlsx");
    XLSX.writeFile(wbResumen, "PCP_Gestion_Total_2026_Resumen.xlsx");
}
