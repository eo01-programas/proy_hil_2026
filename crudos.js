// Module: MAT. CRUDOS
// Contains: renderCrudosTable and placeholder recalcCrudoGroup

function renderCrudosTable() {
    document.getElementById('crudosHead').innerHTML = `<tr class="mat-header-top"><th colspan="4" class="py-2 text-center border-r border-emerald-800">Detalle Crudos</th><th colspan="${activeIndices.length + 1}" class="py-2 text-center">Cronograma Mensual (Kg)</th></tr><tr class="mat-header-sub"><th class="text-left py-2 px-3 w-24">Línea</th><th class="text-left py-2 px-3 w-32">Cliente</th><th class="text-left py-2 px-3 min-w-[200px]">Hilado</th><th class="text-center py-2 px-3 w-12">Mover</th>${generateCellsHTML(null, true, '')}</tr>`;
    const tbody = document.getElementById('crudosBody'); tbody.innerHTML = ''; 
    
    crudoGroups.forEach((group, groupIndex) => { 
        if (Math.abs(group.columnTotals.reduce((a,b)=>a+b,0)) <= 0.01) return; 
        tbody.innerHTML += `<tr class="group-header"><td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${group.title}</td></tr>`; 
        
        group.rows.forEach(row => { 
            const moveControls = renderMoveControls(row, 'CRUDO');
            const hasError = DISCREPANCY_ITEMS.includes(row.id);
            const rowClass = hasError ? 'error-row font-semibold' : 'hover:bg-emerald-50 transition-colors font-semibold';
            const errorBadge = hasError ? '<span class="error-badge">ERR</span>' : '';
            
            let cellsHTML = '';
            activeIndices.forEach(idx => { 
                cellsHTML += `<td class="text-right px-2 ${hasError ? 'error-cell' : ''}">${formatNumber(row.values[idx])}</td>`; 
            });
            
            const calculatedSum = row.values.reduce((a,b) => a+b, 0);
            const totalCellClass = hasError ? 'text-right px-2 font-bold bg-red-500 text-white border-2 border-red-700' : 'text-right px-2 font-bold';
            cellsHTML += `<td class="${totalCellClass}">${formatNumber(calculatedSum)}</td>`;
            
            tbody.innerHTML += `<tr class="${rowClass}"><td class="pl-4 text-xs border-r">${row.line}</td><td class="text-xs border-r">${row.client}</td><td class="text-xs border-r">${row.yarn} ${errorBadge}</td><td class="text-center border-r">${moveControls}</td>${cellsHTML}</tr>`; 
        }); 
        
        tbody.innerHTML += `<tr class="row-group-total"><td colspan="4" class="text-right pr-4 py-1">TOTAL MES:</td>${generateCellsHTML(group.columnTotals)}</tr>`; 
        const defaultMerma = isAlgodon(group.title) ? 40 : 85; 
        const defaultFactor = 1 - defaultMerma / 100; 
        let reqCells = activeIndices.map(idx => { 
            const rawVal = group.columnTotals[idx]; 
            if (Math.abs(rawVal) < 0.01) return `<td class="text-right px-2 font-bold text-green-800 border-l border-green-200" id="req-c-${groupIndex}-${idx}">-</td>`; 
            return `<td class="text-right px-2 font-bold text-green-800 border-l border-green-200" id="req-c-${groupIndex}-${idx}">${formatNumber(rawVal / defaultFactor)}</td>`; 
        }).join(''); 
        let totalReq = 0; 
        activeIndices.forEach(idx => { totalReq += (group.columnTotals[idx] / defaultFactor); }); 
        reqCells += `<td class="text-right px-2 total-col font-bold text-green-900">${formatNumber(totalReq)}</td>`; 
        tbody.innerHTML += `<tr class="row-req bg-green-50"><td colspan="4" class="text-right pr-2 py-1 text-xs border-r border-green-200"><div class="flex items-center justify-end w-full"><span class="mr-1 text-green-900 font-bold">KG REQ (Merma</span><input type="number" id="merma-c-${groupIndex}" class="merma-input" value="${defaultMerma}" min="0" max="99" oninput="recalcCrudoGroup(${groupIndex})"><span class="text-green-900 font-bold">%):</span></div></td>${reqCells}</tr>`; 
        
        if (isAlgodon(group.title)) { 
            let qqCells = activeIndices.map(idx => { 
                const rawVal = group.columnTotals[idx]; 
                if (Math.abs(rawVal) < 0.01) return `<td class="text-right px-2" id="qq-c-${groupIndex}-${idx}">-</td>`; 
                return `<td class="text-right px-2" id="qq-c-${groupIndex}-${idx}">${formatNumber((rawVal/defaultFactor)/46)}</td>`; 
            }).join(''); 
            qqCells += `<td class="text-right px-2 total-col text-green-900">${formatNumber(totalReq/46)}</td>`; 
            tbody.innerHTML += `<tr class="row-qq"><td colspan="4" class="text-right pr-4 py-1">QQ REQ:</td>${qqCells}</tr>`; 
        } 
        
        tbody.innerHTML += `<tr><td colspan="${4+activeIndices.length+1}" class="h-4 border-none"></td></tr>`; 
    });
    
    document.getElementById('crudosFooter').innerHTML = `<tr class="bg-emerald-100 font-bold border-t-2 border-emerald-500"><td colspan="4" class="text-right pr-4 py-2 text-emerald-900">SUMA CRUDO (BASE):</td>${generateCellsHTML(globalCrudoBase)}</tr><tr class="bg-emerald-100 font-bold"><td colspan="4" class="text-right pr-4 py-2 text-emerald-900">SUMA HTR:</td>${generateCellsHTML(globalCrudoHTR)}</tr><tr class="grand-total-row"><td colspan="4" class="text-right pr-4 py-2">TOTAL CRUDOS (BASE + HTR):</td>${generateCellsHTML(globalCrudoBase.map((v, i) => v + globalCrudoHTR[i]))}</tr>`;
}

function recalcCrudoGroup(groupIndex) {
    // Placeholder: detailed recalculation lives in original app logic.
    // This function is intentionally minimal here and can be expanded.
    console.log('recalcCrudoGroup(', groupIndex, ') called');
}
