// Module: MAT. CRUDOS
// Contains: renderCrudosTable and placeholder recalcCrudoGroup

function renderCrudosTable() {
    document.getElementById('crudosHead').innerHTML = `<tr class="mat-header-top"><th colspan="4" class="py-2 text-center border-r border-emerald-800">Detalle Crudos</th><th colspan="${activeIndices.length + 1}" class="py-2 text-center">Cronograma Mensual (Kg)</th></tr><tr class="mat-header-sub"><th class="text-left py-2 px-3 w-24">Línea</th><th class="text-left py-2 px-3 w-32">Cliente</th><th class="text-left py-2 px-3 min-w-[200px]">Hilado</th><th class="text-center py-2 px-3 w-12">Mover</th>${generateCellsHTML(null, true, '')}<th class="text-right px-2 py-1 w-20">TOTAL</th></tr>`;
    const tbody = document.getElementById('crudosBody'); tbody.innerHTML = ''; 
    
    crudoGroups.forEach((group, groupIndex) => { 
        // Build a fast lookup of rowIndex present in GLOBAL_ITEMS (data.js produces the canonical list)
        const allowedRowIndices = new Set((GLOBAL_ITEMS || []).map(it => it.rowIndex).filter(i => i !== undefined));
        // Excluir filas de comentario/agrupación y también filas que NO están entre los items cargados por data.js
        const filteredRows = (group.rows || []).filter(r => {
            const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
            const isComment = (txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
            if (isComment) return false;
            if (typeof r.rowIndex !== 'undefined') return allowedRowIndices.has(r.rowIndex);
            // fallback: match by triple key (line|client|yarn) against GLOBAL_ITEMS
            return (GLOBAL_ITEMS || []).some(it => (it.line||'') === (r.line||'') && (it.client||'') === (r.client||'') && (it.yarn||'') === (r.yarn||''));
        });
        // totales por columna usando solo filas válidas
        const filteredTotals = activeIndices.map((_, pos) => filteredRows.reduce((s, r) => s + ((r.values && r.values[activeIndices[pos]]) || 0), 0));
        if (Math.abs(filteredTotals.reduce((a,b)=>a+b,0)) <= 0.01) return; 
        tbody.innerHTML += `<tr class="group-header"><td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${cleanMaterialTitle(group.title)}</td></tr>`; 
        
        filteredRows.forEach(row => { 
            const moveControls = renderMoveControls(row, 'CRUDO');
            const hasError = DISCREPANCY_ITEMS.includes(row.id);
            const rowClass = hasError ? 'error-row font-semibold' : 'hover:bg-emerald-50 transition-colors font-semibold';
            const errorBadge = hasError ? '<span class="error-badge">ERR</span>' : '';
            
            let cellsHTML = '';
            activeIndices.forEach(idx => { 
                cellsHTML += `<td class="text-right px-2 ${hasError ? 'error-cell' : ''}">${formatNumber(row.values[idx])}</td>`; 
            });
            
            const calculatedSum = (Array.isArray(row.values) ? row.values.reduce((a,b) => a+b, 0) : 0);
            const totalCellClass = hasError ? 'text-right px-2 font-bold bg-red-500 text-white border-2 border-red-700' : 'text-right px-2 font-bold';
            cellsHTML += `<td class="${totalCellClass}">${formatNumber(calculatedSum)}</td>`;
            
            tbody.innerHTML += `<tr class="${rowClass}"><td class="pl-4 text-xs border-r">${row.line}</td><td class="text-xs border-r">${row.client}</td><td class="text-xs border-r">${row.yarn} ${errorBadge}</td><td class="text-center border-r">${moveControls}</td>${cellsHTML}</tr>`; 
        }); 
        
        const groupTotalSum = filteredTotals.reduce((a,b) => a + (b || 0), 0);
        tbody.innerHTML += `<tr class="row-group-total"><td colspan="4" class="text-right pr-4 py-1">TOTAL MES:</td>${generateCellsHTML(filteredTotals)}<td class="text-right px-2 font-bold">${formatNumber(groupTotalSum)}</td></tr>`;
        const defaultMerma = isAlgodon(group.title) ? 40 : 85; 
        const defaultFactor = 1 - defaultMerma / 100; 
        let reqCells = activeIndices.map((idx, pos) => { 
            const rawVal = filteredTotals[pos]; 
            if (Math.abs(rawVal) < 0.01) return `<td class="text-right px-2 font-bold text-green-800 border-l border-green-200" id="req-c-${groupIndex}-${idx}">-</td>`; 
            return `<td class="text-right px-2 font-bold text-green-800 border-l border-green-200" id="req-c-${groupIndex}-${idx}">${formatNumber(rawVal / defaultFactor)}</td>`; 
        }).join(''); 
        let totalReq = 0; 
        filteredTotals.forEach(v => { totalReq += (v / defaultFactor); }); 
        reqCells += `<td id="req-total-c-${groupIndex}" class="text-right px-2 total-col font-bold text-green-900">${formatNumber(totalReq)}</td>`; 
        tbody.innerHTML += `<tr class="row-req bg-green-50"><td colspan="4" class="text-right pr-2 py-1 text-xs border-r border-green-200"><div class="flex items-center justify-end w-full"><span class="mr-1 text-green-900 font-bold">KG REQ (Merma</span><input type="number" id="merma-c-${groupIndex}" class="merma-input" value="${defaultMerma}" min="0" max="99" oninput="recalcCrudoGroup(${groupIndex})"><span class="text-green-900 font-bold">%):</span></div></td>${reqCells}</tr>`; 
        
        if (isAlgodon(group.title)) { 
            let qqCells = activeIndices.map((idx, pos) => { 
                const rawVal = filteredTotals[pos]; 
                if (Math.abs(rawVal) < 0.01) return `<td class="text-right px-2" id="qq-c-${groupIndex}-${idx}">-</td>`; 
                return `<td class="text-right px-2" id="qq-c-${groupIndex}-${idx}">${formatNumber((rawVal/defaultFactor)/46)}</td>`; 
            }).join(''); 
            qqCells += `<td id="qq-total-c-${groupIndex}" class="text-right px-2 total-col text-green-900">${formatNumber(totalReq/46)}</td>`; 
            tbody.innerHTML += `<tr class="row-qq"><td colspan="4" class="text-right pr-4 py-1">QQ REQ:</td>${qqCells}</tr>`; 
        } 
        
        tbody.innerHTML += `<tr><td colspan="${4+activeIndices.length+1}" class="h-4 border-none"></td></tr>`; 
    });
    
    const baseTotal = (window.globalCrudoBase || []).reduce((a,b)=>a+(b||0),0);
    const htrTotal = (window.globalCrudoHTR || []).reduce((a,b)=>a+(b||0),0);
    const combined = (window.globalCrudoBase || []).map((v,i) => (v||0) + (window.globalCrudoHTR||[])[i] || 0);
    const combinedTotal = combined.reduce((a,b)=>a+(b||0),0);
    document.getElementById('crudosFooter').innerHTML = `<tr class="bg-emerald-100 font-bold border-t-2 border-emerald-500"><td colspan="4" class="text-right pr-4 py-2 text-emerald-900">SUMA CRUDO (BASE):</td>${generateCellsHTML(window.globalCrudoBase)}<td class="text-right px-2 font-bold text-emerald-900">${formatNumber(baseTotal)}</td></tr><tr class="bg-emerald-100 font-bold"><td colspan="4" class="text-right pr-4 py-2 text-emerald-900">SUMA HTR:</td>${generateCellsHTML(window.globalCrudoHTR)}<td class="text-right px-2 font-bold text-emerald-900">${formatNumber(htrTotal)}</td></tr><tr class="grand-total-row"><td colspan="4" class="text-right pr-4 py-2">TOTAL CRUDOS (BASE + HTR):</td>${generateCellsHTML(combined)}<td class="text-right px-2 font-bold">${formatNumber(combinedTotal)}</td></tr>`;
}

function recalcCrudoGroup(groupIndex) {
    const mermaEl = document.getElementById(`merma-c-${groupIndex}`);
    let merma = mermaEl ? parseFloat(mermaEl.value) : NaN;
    if (isNaN(merma)) merma = 0;
    const factor = Math.max(0.0001, 1 - merma / 100);

    const group = (typeof crudoGroups !== 'undefined' && Array.isArray(crudoGroups)) ? crudoGroups[groupIndex] : null;
    if (!group) return;

    // Recompute filtered totals excluding comment rows and rows not present in GLOBAL_ITEMS
    const allowedRowIndices = new Set((GLOBAL_ITEMS || []).map(it => it.rowIndex).filter(i => i !== undefined));
    const filteredRows = (group.rows || []).filter(r => {
        const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
        const isComment = (txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
        if (isComment) return false;
        if (typeof r.rowIndex !== 'undefined') return allowedRowIndices.has(r.rowIndex);
        return (GLOBAL_ITEMS || []).some(it => (it.line||'') === (r.line||'') && (it.client||'') === (r.client||'') && (it.yarn||'') === (r.yarn||''));
    });
    const filteredTotals = activeIndices.map((_, pos) => filteredRows.reduce((s, r) => s + ((r.values && r.values[activeIndices[pos]]) || 0), 0));

    let totalReq = 0;
    activeIndices.forEach((idx, pos) => {
        const rawVal = filteredTotals[pos] || 0;
        if (Math.abs(rawVal) < 0.01) {
            const elReq = document.getElementById(`req-c-${groupIndex}-${idx}`);
            if (elReq) elReq.innerHTML = '-';
            const elQ = document.getElementById(`qq-c-${groupIndex}-${idx}`);
            if (elQ) elQ.innerHTML = '-';
            return;
        }
        const reqVal = rawVal / factor;
        totalReq += reqVal;
        const elReq = document.getElementById(`req-c-${groupIndex}-${idx}`);
        if (elReq) elReq.innerHTML = formatNumber(reqVal);
        const elQ = document.getElementById(`qq-c-${groupIndex}-${idx}`);
        if (elQ) elQ.innerHTML = formatNumber(reqVal / 46);
    });

    const elReqTotal = document.getElementById(`req-total-c-${groupIndex}`);
    if (elReqTotal) elReqTotal.innerHTML = formatNumber(totalReq);
    const elQTotal = document.getElementById(`qq-total-c-${groupIndex}`);
    if (elQTotal) elQTotal.innerHTML = formatNumber(totalReq / 46);
}
