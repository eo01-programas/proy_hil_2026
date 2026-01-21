// Module: RESUMEN
// Contains: renderBalanceView, renderFiberTable, fiber modal functions

function renderBalanceView() {
    const table = document.getElementById('balanceTable');
    let html = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left w-64">CONCEPTO</th>${generateCellsHTML(null, true)}</tr></thead><tbody class="bg-white text-gray-700">`;
    let totalLineasVec = new Array(12).fill(0);
    Object.keys(lineSummary).sort().forEach(l => { for(let k=0; k<12; k++) totalLineasVec[k] += lineSummary[l].values[k]; });
    html += `<tr class="bg-blue-50 font-bold text-blue-900"><td class="py-2 px-3 text-right">A. TOTAL DEMANDA (DETALLE):</td>${generateCellsHTML(totalLineasVec)}</tr>`;
    const crudoRawVec = globalCrudoRaw.slice();
    const mezclaRawVec = globalMezclaRaw.slice();
    const totalRawVec = crudoRawVec.map((v,i) => v + mezclaRawVec[i]);
    html += `<tr class="bg-indigo-50 font-bold text-indigo-900 border-t border-indigo-200"><td class="py-2 px-3 text-right">B1. TOTAL PESO HILADOS - CRUDOS (BRUTO):</td>${generateCellsHTML(crudoRawVec)}</tr>`;
    html += `<tr class="bg-orange-50 font-bold text-orange-900"><td class="py-2 px-3 text-right">B2. TOTAL PESO HILADOS - MEZCLAS (BRUTO):</td>${generateCellsHTML(mezclaRawVec)}</tr>`;
    html += `<tr class="bg-indigo-100 font-bold text-indigo-900"><td class="py-2 px-3 text-right">B. TOTAL PESO HILADOS (CRUDOS+MEZCLAS BRUTO):</td>${generateCellsHTML(totalRawVec)}</tr>`;
    const checkVec = totalLineasVec.map((v, i) => v - totalRawVec[i]);
    const checkTotal = checkVec.reduce((a,b)=>a+b,0);
    const isPerfect = Math.abs(checkTotal) < 1;
    const checkClass = isPerfect ? "text-green-600" : "text-red-600";
    const checkText = isPerfect ? "✓ CUADRA" : "✕ REVISAR CARGA";
    html += `<tr class="${checkClass} text-xs font-bold bg-white border-b-2 border-gray-200"><td class="py-1 px-3 text-right">CONTROL (A - B): ${checkText}</td>${generateCellsHTML(checkVec)}</tr>`;
    
    if (DISCREPANCY_GROUP_TOTALS.hasError) {
        html += `<tr class="bg-yellow-100 border-l-4 border-red-500"><td colspan="${activeIndices.length + 2}" class="py-2 px-3 text-xs text-red-700 font-bold">
                    ⚠ ADVERTENCIA: Los totales verticales NO coinciden con Excel. Revisa filas ocultas o fórmulas erróneas en el archivo original.
                </td></tr>`;
    }
    
    html += `<tr><td colspan="${activeIndices.length + 2}" class="h-4"></td></tr>`;
    html += `</tbody>`;
    table.innerHTML = html;

    renderFiberTable('algodonTable', detailAlgodon, ORDERED_COTTON_KEYS, true);
    renderFiberTable('otrasTable', detailOtras, ORDERED_OTHER_KEYS, false);
}

function renderFiberTable(tableId, dataObj, orderedKeys, isAlgodon) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let html = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">FIBRA</th>${generateCellsHTML(null, true)}</tr></thead><tbody class="bg-white">`;
    
    let strictTotalVec = new Array(12).fill(0);

    orderedKeys.forEach((fiberName, idx) => {
        const fiberData = dataObj[fiberName] || { totalValues: new Array(12).fill(0), clients: {} };
        
        fiberData.totalValues.forEach((v, i) => strictTotalVec[i] += v);

        const fiberDisplay = escapeHtml(fiberName);
        const bgClass = isAlgodon ? 'bg-blue-100 hover:bg-blue-200 border-blue-300' : 'bg-amber-100 hover:bg-amber-200 border-amber-300';
        const textClass = isAlgodon ? 'text-blue-900' : 'text-amber-900';
        
        html += `<tr class="${bgClass} cursor-pointer border-b-2" data-fiber-name="${fiberDisplay}" data-is-algodon="${isAlgodon}" onclick="openFiberModalByName(this.getAttribute('data-fiber-name'), ${isAlgodon})">
                    <td class="py-2 px-3 font-bold ${textClass} pl-4">${fiberDisplay}</td>
                    ${generateCellsHTML(fiberData.totalValues).replace(/^/gm, '')}
                </tr>`;
    });
    
    html += `<tr class="grand-total-row"><td class="py-2 px-3 text-right font-bold">TOTAL:</td>${generateCellsHTML(strictTotalVec)}</tr>`;
    html += `</tbody>`;
    table.innerHTML = html;
}

function openFiberModalByName(fiberDisplay, isAlgodon) {
    const source = isAlgodon ? detailAlgodon : detailOtras;
    let fiberName = null;
    for (let key in source) { if (escapeHtml(key) === fiberDisplay) { fiberName = key; break; } }
    if (fiberName && source[fiberName]) { openFiberModal(fiberName, source[fiberName].clients, isAlgodon); }
}

function openFiberModal(fiberName, clients, isAlgodon) {
    document.getElementById('fiberModalTitle').textContent = escapeHtml(fiberName);
    let tbody = '';
    const clientKeys = Object.keys(clients).sort();
    let totals = new Array(12).fill(0);
    clientKeys.forEach(client => {
        const values = clients[client];
        let row = `<tr class="border-b hover:bg-gray-50"><td class="border px-3 py-2">${escapeHtml(client)}</td>`;
        for (let i = 0; i < 12; i++) { const val = values[i] || 0; totals[i] += val; row += `<td class="border px-3 py-2 text-right">${formatNumber(val)}</td>`; }
        const sum = values.reduce((a, b) => a + b, 0);
        row += `<td class="border px-3 py-2 text-right font-bold">${formatNumber(sum)}</td></tr>`;
        tbody += row;
    });
    let totalRow = `<tr class="bg-gray-200 font-bold border-top"><td class="border px-3 py-2">TOTAL</td>`;
    for (let i = 0; i < 12; i++) { totalRow += `<td class="border px-3 py-2 text-right">${formatNumber(totals[i])}</td>`; }
    const grandTotal = totals.reduce((a, b) => a + b, 0);
    totalRow += `<td class="border px-3 py-2 text-right">${formatNumber(grandTotal)}</td></tr>`;
    tbody += totalRow;
    document.getElementById('fiberDetailBody').innerHTML = tbody;
    document.getElementById('fiberDetailModal').classList.remove('hidden');
}

function closeFiberModal() { document.getElementById('fiberDetailModal').classList.add('hidden'); }
