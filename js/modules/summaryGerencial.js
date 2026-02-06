// Module: RESUMEN GERENCIAL
// Contains: renderSummaryTables

function renderSummaryTables() {
    const tableClient = document.getElementById('summaryClientTable');
    const totalFromValues = (vals) => activeIndices.reduce((s, idx) => s + (parseFloat((vals || [])[idx] || 0) || 0), 0);
    const formatPercent = (part, total) => {
        if (!total || !isFinite(total)) return '0%';
        const pct = (part / total) * 100;
        const rounded = Math.round(pct * 10) / 10;
        return (String(rounded).replace('.', ',')) + '%';
    };

    let bodyHTML = '<tbody class="bg-white text-gray-700">';
    let grandTotalClientVec = new Array(12).fill(0);
    for (let k = 0; k < 12; k++) grandTotalClientVec[k] = statsLLL.values[k] + statsVariosTotal.values[k];
    const grandTotalClient = totalFromValues(grandTotalClientVec);

    const lllTotal = totalFromValues(statsLLL.values);
    const variosTotal = totalFromValues(statsVariosTotal.values);
    const sortByTotalDesc = (a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.label.localeCompare(b.label);
    };

    const topRows = [
        { key: 'LLL', label: 'LLL', total: lllTotal, values: statsLLL.values, kind: 'LLL' },
        { key: 'VARIOS', label: 'CLIENTES VARIOS (Total)', total: variosTotal, values: statsVariosTotal.values, kind: 'VARIOS' }
    ].sort(sortByTotalDesc);

    topRows.forEach(row => {
        if (row.kind === 'LLL') {
            bodyHTML += `<tr class="border-b"><td class="py-2 px-3 font-bold text-blue-800">LLL</td>${generateCellsHTML(statsLLL.values, false, '', true)}<td class="text-right px-2 border-l border-gray-100">${formatPercent(lllTotal, grandTotalClient)}</td></tr>`;
            return;
        }
        bodyHTML += `<tr class="bg-gray-50 border-b border-gray-300"><td class="py-2 px-3 font-bold text-gray-800">CLIENTES VARIOS (Total)</td>${generateCellsHTML(statsVariosTotal.values, false, '', true)}<td class="text-right px-2 border-l border-gray-100">${formatPercent(variosTotal, grandTotalClient)}</td></tr>`;

        // Subclientes ordenados por % (total) desc
        const subRows = Object.keys(statsVariosDetalle).map(c => ({
            label: c,
            total: totalFromValues(statsVariosDetalle[c].values),
            values: statsVariosDetalle[c].values
        })).sort(sortByTotalDesc);

        subRows.forEach(r => {
            bodyHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="py-1 px-3 pl-8 text-xs text-gray-500">${escapeHtml(r.label)}</td>${generateCellsHTML(r.values, false, '', true)}<td class="text-right px-2 border-l border-gray-100">${formatPercent(r.total, grandTotalClient)}</td></tr>`;
        });
    });
    bodyHTML += `<tr class="grand-total-row"><td class="py-2 px-3 text-right">TOTAL GENERAL:</td>${generateCellsHTML(grandTotalClientVec, false, '', true)}<td class="text-right px-2 border-l border-gray-100">100%</td></tr></tbody>`;
    tableClient.innerHTML = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">CLIENTE</th>${generateCellsHTML(null, true, '', true)}<th class="text-right px-2 py-1 w-12">%</th></tr></thead>` + bodyHTML;

    const tableLine = document.getElementById('summaryLineTable');
    let bodyLineHTML = '<tbody class="bg-white text-gray-700">';
    let totalLineVector = new Array(12).fill(0);
    const lineOrder = ['CRUDO', 'MEZCLA', 'HTR'];
    const lineKeys = Object.keys(lineSummary);
    const orderedLineKeys = [
        ...lineOrder.filter(k => lineKeys.includes(k)),
        ...lineKeys.filter(k => !lineOrder.includes(k)).sort()
    ];
    orderedLineKeys.forEach(l => { for (let k = 0; k < 12; k++) totalLineVector[k] += lineSummary[l].values[k]; });
    const grandTotalLine = totalFromValues(totalLineVector);
    orderedLineKeys.forEach(l => {
        const rowTotal = totalFromValues(lineSummary[l].values);
        bodyLineHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="py-1 px-3 font-semibold text-xs">${escapeHtml(l)}</td>${generateCellsHTML(lineSummary[l].values, false, '', true)}<td class="text-right px-2 border-l border-gray-100">${formatPercent(rowTotal, grandTotalLine)}</td></tr>`;
    });
    bodyLineHTML += `<tr class="grand-total-row"><td class="py-2 px-3 text-right">TOTAL GENERAL:</td>${generateCellsHTML(totalLineVector, false, '', true)}<td class="text-right px-2 border-l border-gray-100">100%</td></tr></tbody>`;
    tableLine.innerHTML = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">LÍNEA</th>${generateCellsHTML(null, true, '', true)}<th class="text-right px-2 py-1 w-12">%</th></tr></thead>` + bodyLineHTML;
}
