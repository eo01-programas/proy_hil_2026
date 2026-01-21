// Module: MAT. MEZCLAS
// Contains: renderMezclasTable and placeholder recalcMezclaComponent

function renderMezclasTable() {
    document.getElementById('mezclasHead').innerHTML = `<tr class="mix-header-top"><th colspan="4" class="py-2 text-center border-r border-orange-800">Desglose Componentes</th><th colspan="${activeIndices.length + 1}" class="py-2 text-center">Kg Usados / Kg Requeridos</th></tr><tr class="mix-header-sub"><th class="text-left py-2 px-3 w-24">Línea</th><th class="text-left py-2 px-3 w-32">Cliente</th><th class="text-left py-2 px-3 min-w-[140px]">Hilado</th><th class="text-center py-2 px-3 w-12">Mover</th>${generateCellsHTML(null, true, '')}</tr>`;
    const tbody = document.getElementById('mezclasBody'); tbody.innerHTML = '';
    
    mezclaGroups.forEach((group, groupIndex) => { 
        if (Math.abs(group.groupRawTotals.reduce((a,b)=>a+b,0)) <= 0.01) return; 
        tbody.innerHTML += `<tr class="group-header"><td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${group.title}</td></tr>`; 
        
        GLOBAL_ITEMS.forEach(item => { 
            if (!group.uniqueYarns.has(item.id)) return; 
            const moveControls = renderMoveControls(item, 'MEZCLA');
            const hasError = DISCREPANCY_ITEMS.includes(item.id);
            const rowClass = hasError ? 'error-row' : 'hover:bg-orange-50 transition-colors';
            const errorBadge = hasError ? '<span class="error-badge">ERR</span>' : '';
            
            let cellsHTML = '';
            activeIndices.forEach(idx => { 
                cellsHTML += `<td class="text-right px-2 ${hasError ? 'error-cell' : ''}">${formatNumber(item.values[idx])}</td>`; 
            });
            
            const calculatedSum = item.values.reduce((a,b) => a+b, 0);
            const totalCellClass = hasError ? 'text-right px-2 font-bold bg-red-500 text-white border-2 border-red-700' : 'text-right px-2 font-bold';
            cellsHTML += `<td class="${totalCellClass}">${formatNumber(calculatedSum)}</td>`;
            
            tbody.innerHTML += `<tr class="${rowClass}"><td class="pl-4 text-xs">${item.line}</td><td class="text-xs">${item.client}</td><td class="text-xs cell-truncate" title="${escapeHtml(item.yarn)}">${escapeHtml(item.yarn)} ${errorBadge}</td><td class="text-center">${moveControls}</td>${cellsHTML}</tr>`; 
        }); 
        
        tbody.innerHTML += `<tr class="row-group-total"><td colspan="4" class="text-right pr-4 py-1">TOTAL MES:</td>${generateCellsHTML(group.groupRawTotals)}</tr>`; 
        
        if (!group.componentPercentages) { 
            group.componentPercentages = {}; 
            Object.keys(group.componentTotalsTotal || {}).forEach(compKey => { 
                const compTotal = (group.componentTotalsTotal[compKey] || []).reduce((a,b)=>a+b,0); 
                const groupTotal = group.groupRawTotals.reduce((a,b)=>a+b,0); 
                group.componentPercentages[compKey] = groupTotal > 0 ? compTotal / groupTotal : 0; 
            }); 
        } 
        
        let sortedKeys = Object.keys(group.componentTotalsTotal || {}).sort((a,b) => { 
            const pctA = group.componentPercentages[a] || 0; 
            const pctB = group.componentPercentages[b] || 0; 
            return pctB - pctA; 
        }); 
        
        sortedKeys.forEach((compKey, compIndex) => { 
            const compVector = group.componentTotalsTotal[compKey]; 
            const defaultMerma = compIndex === 0 ? 40 : 15; 
            if (isAlgodon(compKey)) { 
                let qqCells = activeIndices.map(idx => { 
                    const base = compVector[idx] || 0; 
                    if (Math.abs(base) < 0.01) return `<td class="text-right px-2">-</td>`; 
                    const req = base / (1 - defaultMerma/100); 
                    return `<td class="text-right px-2 font-bold text-orange-800" id="qq-m-${groupIndex}-${compIndex}-${idx}">${formatNumber(req/46)}</td>`; 
                }).join(''); 
                let totalReq = 0; 
                activeIndices.forEach(idx => { totalReq += (compVector[idx] / (1-defaultMerma/100)); }); 
                qqCells += `<td class="text-right px-2 total-col font-bold text-orange-900">${formatNumber(totalReq/46)}</td>`; 
                tbody.innerHTML += `<tr class="row-req bg-orange-50"><td colspan="4" class="text-right pr-2 py-1 text-xs"><div class="flex items-center justify-end w-full"><span class="mr-1 text-orange-900 font-bold">QQ REQ ${escapeHtml(compKey)} (Merma</span><input type="number" id="merma-m-${groupIndex}-${compIndex}" class="merma-input" value="${defaultMerma}" min="0" max="99" oninput="recalcMezclaComponent(${groupIndex}, ${compIndex})"><span class="text-orange-900 font-bold">%):</span></div></td>${qqCells}</tr>`; 
            } else { 
                let reqCells = activeIndices.map(idx => { 
                    const base = compVector[idx] || 0; 
                    if (Math.abs(base) < 0.01) return `<td class="text-right px-2">-</td>`; 
                    return `<td class="text-right px-2 font-bold text-orange-800" id="req-m-${groupIndex}-${compIndex}-${idx}">${formatNumber(base/(1-defaultMerma/100))}</td>`; 
                }).join(''); 
                let totalReq = 0; 
                activeIndices.forEach(idx => { totalReq += (compVector[idx] / (1-defaultMerma/100)); }); 
                reqCells += `<td class="text-right px-2 total-col font-bold text-orange-900">${formatNumber(totalReq)}</td>`; 
                tbody.innerHTML += `<tr class="row-req bg-orange-50"><td colspan="4" class="text-right pr-2 py-1 text-xs"><div class="flex items-center justify-end w-full"><span class="mr-1 text-orange-900 font-bold">KG REQ ${escapeHtml(compKey)} (Merma</span><input type="number" id="merma-m-${groupIndex}-${compIndex}" class="merma-input" value="${defaultMerma}" min="0" max="99" oninput="recalcMezclaComponent(${groupIndex}, ${compIndex})"><span class="text-orange-900 font-bold">%):</span></div></td>${reqCells}</tr>`; 
            } 
        }); 
        
        tbody.innerHTML += `<tr><td colspan="${4 + activeIndices.length + 1}" class="h-4"></td></tr>`; 
    });
    
    document.getElementById('mezclasFooter').innerHTML = `<tr class="bg-orange-100 font-bold border-t-2 border-orange-500"><td colspan="4" class="text-right pr-4 py-2 text-orange-900">SUMA MEZCLA (BASE):</td>${generateCellsHTML(globalMezclaBase)}</tr><tr class="bg-orange-100 font-bold"><td colspan="4" class="text-right pr-4 py-2 text-orange-900">SUMA HTR (MEZCLA):</td>${generateCellsHTML(globalMezclaHTR)}</tr><tr class="grand-total-row" style="background-color: #7c2d12;"><td colspan="4" class="text-right pr-4 py-2">TOTAL MEZCLAS (BASE + HTR):</td>${generateCellsHTML(globalMezclaBase.map((v, i) => v + globalMezclaHTR[i]))}</tr>`;
}

function recalcMezclaComponent(groupIndex, compIndex) {
    // Placeholder: detailed recalculation lives in original app logic.
    console.log('recalcMezclaComponent(', groupIndex, compIndex, ') called');
}
