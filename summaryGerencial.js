// Module: RESUMEN GERENCIAL
// Contains: renderSummaryTables

function renderSummaryTables() {
    const tableClient = document.getElementById('summaryClientTable');
    let bodyHTML = '<tbody class="bg-white text-gray-700">';
    bodyHTML += `<tr class="border-b"><td class="py-2 px-3 font-bold text-blue-800">LLL</td>${generateCellsHTML(statsLLL.values)}</tr>`;
    bodyHTML += `<tr class="bg-gray-50 border-b border-gray-300"><td class="py-2 px-3 font-bold text-gray-800">CLIENTES VARIOS (Total)</td>${generateCellsHTML(statsVariosTotal.values)}</tr>`;
    Object.keys(statsVariosDetalle).sort().forEach(c => { bodyHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="py-1 px-3 pl-8 text-xs text-gray-500">${escapeHtml(c)}</td>${generateCellsHTML(statsVariosDetalle[c].values)}</tr>`; });
    let grandTotalClientVec = new Array(12).fill(0); for(let k=0; k<12; k++) grandTotalClientVec[k] = statsLLL.values[k] + statsVariosTotal.values[k];
    bodyHTML += `<tr class="grand-total-row"><td class="py-2 px-3 text-right">TOTAL GENERAL:</td>${generateCellsHTML(grandTotalClientVec)}</tr></tbody>`;
    tableClient.innerHTML = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">CLIENTE</th>${generateCellsHTML(null, true)}</tr></thead>` + bodyHTML;
    
    const tableLine = document.getElementById('summaryLineTable');
    let bodyLineHTML = '<tbody class="bg-white text-gray-700">'; let totalLineVector = new Array(12).fill(0);
    Object.keys(lineSummary).sort().forEach(l => { bodyLineHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="py-1 px-3 font-semibold text-xs">${escapeHtml(l)}</td>${generateCellsHTML(lineSummary[l].values)}</tr>`; for(let k=0; k<12; k++) totalLineVector[k] += lineSummary[l].values[k]; });
    bodyLineHTML += `<tr class="grand-total-row"><td class="py-2 px-3 text-right">TOTAL GENERAL:</td>${generateCellsHTML(totalLineVector)}</tr></tbody>`;
    tableLine.innerHTML = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">LÍNEA</th>${generateCellsHTML(null, true)}</tr></thead>` + bodyLineHTML;
}
