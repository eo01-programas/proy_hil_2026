// Module: DETALLE GRUPOS
// Contains: renderDetailTable, renderMoveControls, addManualRow, updateRowTotal

function renderMoveControls(item, currentModule) {
    const id = item.id;
    return `<button class="text-sm px-2 py-1 text-blue-600 hover:text-blue-800 font-bold" onclick="openMoveModal('${id}')">→</button>`;
}

function addManualRow(tableId, isAlgodon) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    const lastRow = rows[rows.length - 1];
    
    const newRow = document.createElement('tr');
    newRow.className = "bg-white border-b border-gray-200";
    
    let cellsHtml = `<td class="py-2 px-3"><input type="text" placeholder="Nueva Fibra..." class="w-full text-xs border border-gray-300 rounded px-1 py-1 editable-cell" /></td>`;
    
    activeIndices.forEach(idx => {
        cellsHtml += `<td class="text-right px-2 border-l border-gray-100"><input type="number" value="0" class="w-full text-right text-xs border border-gray-100 focus:border-blue-400 rounded px-1 py-0.5 editable-cell" onchange="updateRowTotal(this)" /></td>`;
    });
    
    // Nota: no añadimos columna TOT ni cálculos; mantenemos solo las celdas de meses.
    
    newRow.innerHTML = cellsHtml;
    tbody.insertBefore(newRow, lastRow);
}

function updateRowTotal(input) {
    // No realizar sumas ni mostrar totales. Esta función solo mantiene la edición
    // de valores en la fila; no hay columna de total vertical.
    return;
}

function renderDetailTable() {
    // Encabezado: solo columnas del Excel (meses), sin columna TOT
    document.getElementById('groupsHead').innerHTML = `<tr class="det-header-top"><th class="py-2 px-3 text-left">LINEA</th><th class="py-2 px-3 text-left">CLIENTE</th><th class="py-2 px-3 text-left">HILADO</th>${generateCellsHTML(null, true, '')}</tr>`;
    const tbody = document.getElementById('groupsBody'); tbody.innerHTML = '';
    
    // Renderizar exactamente las filas visibles (ya filtradas en ingestión)
    GLOBAL_ITEMS.forEach(row => {
        // Detectar bloques especiales y asignar color
        const txt = ((row.line||'') + '|' + (row.client||'') + '|' + (row.yarn||'')).toString().toUpperCase();
        let specialClass = '';
        if (txt.includes('REVERSA')) {
            specialClass = 'bg-amber-50 text-amber-900';
        } else if (txt.includes('CLIENTES VARIOS')) {
            specialClass = 'bg-emerald-50 text-emerald-900';
        } else if (txt.includes('PROYECCI') || txt.includes('PROYECCIÓN')) {
            specialClass = 'bg-indigo-50 text-indigo-900';
        }

        const baseClass = 'hover:bg-blue-50 transition-colors font-semibold border-b border-gray-100';
        const rowClass = (specialClass ? (specialClass + ' ') : '') + baseClass;

        let cellsHTML = '';
        activeIndices.forEach((idx, i) => {
            const val = row.values[idx];
            const cellClass = 'text-right px-2';
            const formatted = formatNumber(val);
            cellsHTML += `<td class="${cellClass}">${formatted}</td>`;
        });

        tbody.innerHTML += `<tr class="${rowClass}"><td class="pl-4 text-xs text-gray-600">${row.line}</td><td class="text-xs text-gray-600">${row.client}</td><td class="text-xs text-gray-600">${row.yarn}</td>${cellsHTML}</tr>`;
    });

    // Mantener el footer vacío (sin cálculos ni comparaciones)
    // Construir footer: mostrar Excel TOTAL (si existe) y TOTAL SUMA calculado
    const footer = document.getElementById('groupsFooter');
    // Calcular TOTAL SUMA (sumar por columna, excluyendo filas que contienen 'TOTAL')
    const totalSums = activeIndices.map(() => 0);
    GLOBAL_ITEMS.forEach(row => {
        const joined = ((row.line||'') + '|' + (row.client||'') + '|' + (row.yarn||'')).toString().toUpperCase();
        if (joined.includes('TOTAL')) return; // excluir fila TOTAL en la suma
        activeIndices.forEach((idx, pos) => {
            const v = row.values[idx] || 0;
            totalSums[pos] += (typeof v === 'number') ? v : (parseFloat(v) || 0);
        });
    });

    // HTML para Excel TOTAL (si disponible)
    let excelTotalRowHtml = '';
    if (typeof excelGroupTotals !== 'undefined' && Array.isArray(excelGroupTotals)) {
        const cells = activeIndices.map((idx, pos) => {
            const v = excelGroupTotals[idx] || 0;
            return `<td class="text-right px-2 border-l border-gray-100 font-semibold">${formatNumber(v)}</td>`;
        }).join('');
        excelTotalRowHtml = `<tr class="bg-slate-50 font-bold"><td class="pl-4 text-sm">TOTAL (Excel)</td><td></td><td></td>${cells}</tr>`;
    }

    // HTML para TOTAL SUMA y marcar diferencias en rojo respecto a Excel TOTAL
    const sumaCells = activeIndices.map((idx, pos) => {
        const sumVal = totalSums[pos] || 0;
        let cls = 'text-right px-2 border-l border-gray-100 font-semibold';
        let disp = formatNumber(sumVal);
        let clickable = '';
        // comparar con excelGroupTotals si existe
        if (typeof excelGroupTotals !== 'undefined' && Array.isArray(excelGroupTotals)) {
            const excelVal = excelGroupTotals[idx] || 0;
            const diff = Math.round(Math.abs((sumVal || 0) - (excelVal || 0)));
            if (diff > 0) {
                cls += ' bg-red-50 text-red-800';
                clickable = ` onclick="showDiscrepancyModal(${idx})" style="cursor:pointer" title="Ver diferencia"`;
            }
        }
        return `<td class="${cls}"${clickable}>${disp}</td>`;
    }).join('');

    const sumaRowHtml = `<tr class="bg-white font-bold"><td class="pl-4 text-sm">TOTAL SUMA</td><td></td><td></td>${sumaCells}</tr>`;

    footer.innerHTML = `${excelTotalRowHtml}${sumaRowHtml}`;
}
