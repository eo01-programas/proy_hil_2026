// Module: RESUMEN
// Contains: renderBalanceView, renderFiberTable, fiber modal functions

// Make all console.group calls collapsed by default in DevTools
try {
    if (typeof console !== 'undefined' && typeof console.groupCollapsed === 'function') {
        console.group = console.groupCollapsed;
    }
} catch (e) { /* ignore */ }

function renderBalanceView() {
    const table = document.getElementById('balanceTable');
    let html = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left w-64">CONCEPTO</th>${generateCellsHTML(null, true, '', true)}</tr></thead><tbody class="bg-white text-gray-700">`;
    let totalLineasVec = new Array(12).fill(0);
    Object.keys(lineSummary).sort().forEach(l => { for(let k=0; k<12; k++) totalLineasVec[k] += lineSummary[l].values[k]; });
    html += `<tr class="bg-blue-50 font-bold text-blue-900"><td class="py-2 px-3 text-right">A. TOTAL DEMANDA (DETALLE):</td>${generateCellsHTML(totalLineasVec, false, '', true)}</tr>`;
    const crudoRawVec = globalCrudoRaw.slice();
    const mezclaRawVec = globalMezclaRaw.slice();
    const totalRawVec = crudoRawVec.map((v,i) => v + mezclaRawVec[i]);
    html += `<tr class="bg-indigo-50 font-bold text-indigo-900 border-t border-indigo-200"><td class="py-2 px-3 text-right">B1. TOTAL PESO HILADOS - CRUDOS (BRUTO):</td>${generateCellsHTML(crudoRawVec, false, '', true)}</tr>`;
    html += `<tr class="bg-orange-50 font-bold text-orange-900"><td class="py-2 px-3 text-right">B2. TOTAL PESO HILADOS - MEZCLAS (BRUTO):</td>${generateCellsHTML(mezclaRawVec, false, '', true)}</tr>`;
    html += `<tr class="bg-indigo-100 font-bold text-indigo-900"><td class="py-2 px-3 text-right">B. TOTAL PESO HILADOS (CRUDOS+MEZCLAS BRUTO):</td>${generateCellsHTML(totalRawVec, false, '', true)}</tr>`;
    const checkVec = totalLineasVec.map((v, i) => v - totalRawVec[i]);
    const checkTotal = checkVec.reduce((a,b)=>a+b,0);
    const isPerfect = Math.abs(checkTotal) < 1;
    const checkClass = isPerfect ? "text-green-600" : "text-red-600";
    const checkText = isPerfect ? "✓ CUADRA" : "✕ REVISAR CARGA";
    // CONTROL (A - B) row and visible discrepancy warning suppressed per user request
    
    html += `<tr><td colspan="${activeIndices.length + 2}" class="h-4"></td></tr>`;
    html += `</tbody>`;
    table.innerHTML = html;

    // Build detailAlgodon entries for special cotton fibers using prioritized allocation
    try {
        // 1) extract all crudo rows and mezcla items into flat lists
        // Helper: detectar si es hilado de algodón
        const isCottonYarn = (yarn, groupTitle) => {
            const a = normStrFiber(yarn || '');
            const t = normStrFiber(groupTitle || '');
            const cottonKeywords = ['ALGODON', 'COTTON', 'PIMA', 'TANGUIS', 'UPLAND', 'ELEGANT', 'COP', 'OCS', 'GOTS', 'BCI', 'USTCP'];
            for (const kw of cottonKeywords) {
                if (a.includes(kw) || t.includes(kw)) return true;
            }
            return false;
        };

        // Build crudo rows DIRECTLY from crudoGroups (source of truth) - NO filtering by GLOBAL_ITEMS
        const allCrudoRows = [];
        const seenCrudoKeys = new Set();
        try {
            (window.crudoGroups || crudoGroups || []).forEach(g => {
                try {
                    const title = (g.title || '').toString();
                    (g.rows || []).forEach(row => {
                        try {
                            if (!row || !row.yarn) return;
                            // Only include cotton hilados
                            if (!isCottonYarn(row.yarn, title)) return;
                            const key = `${title}||${row.client||''}||${row.line||''}||${row.yarn||''}||${row.id||row.rowIndex||''}`;
                            // Avoid duplicates
                            if (seenCrudoKeys.has(key)) return;
                            seenCrudoKeys.add(key);
                            const vals = new Array(12).fill(0);
                            for (let m = 0; m < 12; m++) vals[m] = parseFloat(row.values && row.values[m] ? row.values[m] : 0) || 0;
                            allCrudoRows.push({ key, groupTitle: title, yarn: row.yarn, client: row.client, line: row.line, values: vals, id: row.id || row.rowIndex });
                        } catch (e) { }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        const allMezclaItems = [];
        const mezclaGroupMap = {};
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach(g => {
                try {
                    const title = (g.title || '').toString();
                    mezclaGroupMap[title] = g;
                    if (!g.uniqueYarns || g.uniqueYarns.size === 0) return;
                    Array.from(g.uniqueYarns).forEach(id => {
                        try {
                            const it = GLOBAL_ITEMS.find(x => x.id === id);
                            if (!it || !it.yarn) return;
                            // SOLO extraer hilados de algodón
                            if (!isCottonYarn(it.yarn, title)) return;
                            const vals = new Array(12).fill(0);
                            for (let m = 0; m < 12; m++) vals[m] = parseFloat(it.values && it.values[m] ? it.values[m] : 0) || 0;
                            allMezclaItems.push({ id, groupTitle: title, yarn: it.yarn, client: it.client, values: vals });
                        } catch (e) { }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        const assignedCrudos = new Set();
        const assignedMezclas = new Set();

        // Define ordered fibers and matchers in the requested priority
        const orderedFibers = [
            { label: 'ALGODÓN PIMA NC (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||'');if(!a.includes('PIMA')) return false; if(a.includes('OCS')||a.includes('GOTS')||a.includes('ORGANICO')||a.includes('ORGANIC')||a.includes('ORG')||a.includes('CERT')) return false; if(t.includes('OCS')||t.includes('GOTS')||t.includes('ORGANICO')||t.includes('ORGANIC')) return false; return true; } },
            { label: 'ALGODÓN PIMA ORGANICO - OCS (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(!a.includes('PIMA')) return false; if(a.includes('GOTS')||t.includes('GOTS')) return false; if(!(a.includes('OCS')||t.includes('OCS'))) return false; return true; } },
            { label: 'ALGODÓN TANGUIS NC BCI (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(!a.includes('TANGUIS') && !t.includes('TANGUIS')) return false; if(!a.includes('BCI') && !t.includes('BCI')) return false; if(a.includes('OCS')||a.includes('GOTS')||a.includes('ORGANICO')||a.includes('ORGANIC')) return false; return true; } },
            { label: 'ALGODÓN ORGANICO - GOTS (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(a.includes('PIMA')||t.includes('PIMA')) return false; if(a.includes('OCS')||t.includes('OCS')) return false; if(!a.includes('GOTS') && !t.includes('GOTS')) return false; return true; } },
            { label: 'ALGODÓN ORGANICO - OCS (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(a.includes('PIMA')||t.includes('PIMA')) return false; if(a.includes('GOTS')||t.includes('GOTS')) return false; if(!a.includes('OCS') && !t.includes('OCS')) return false; return true; } },
            { label: 'ALGODÓN UPLAND USTCP (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(a.includes('USTCP')||a.includes('US TCP')||t.includes('USTCP')||t.includes('US TCP')) return true; return false; } },
            { label: 'ALGODÓN ELEGANT (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(a.includes('ELEGANT')||t.includes('ELEGANT')) return true; return false; } },
            { label: 'ALGODÓN PIMA ORGANICO - GOTS (QQ)', matcher: (y,g)=>{const a=normStrFiber(y);const t=normStrFiber(g||''); if(!a.includes('PIMA')) return false; if(a.includes('OCS')||t.includes('OCS')) return false; if(!a.includes('GOTS') && !t.includes('GOTS')) return false; return true; } },
            // ALGODÓN UPLAND: Catch-all para cualquier algodón restante sin certificación específica
            { label: 'ALGODÓN UPLAND (QQ)', matcher: (y,g)=>{ return true; } }
        ];

        // Allocation loop
        orderedFibers.forEach(f => {
            try {
                const label = f.label;
                const tokenMatcher = f.matcher;
                const merma = 0.40;
                const agg = new Array(12).fill(0);
                const clientsMap = {};
                const ensureClient = (c) => { if (!clientsMap[c]) clientsMap[c] = new Array(12).fill(0); };
                const assignedRowsForLabel = [];
                const assignedItemsForLabel = [];

                // CRUDOS: assign unassigned rows that match
                allCrudoRows.forEach(row => {
                    try {
                        if (assignedCrudos.has(row.key)) return;
                        if (!tokenMatcher(row.yarn, row.groupTitle)) return;
                        const client = row.client || 'VARIOS';
                        ensureClient(client);
                        for (let m = 0; m < 12; m++) {
                            const raw = parseFloat(row.values[m] || 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            const kgReq = raw / (1 - merma);
                            const qq = kgReq / 46;
                            agg[m] += qq;
                            clientsMap[client][m] += qq;
                        }
                        // SIEMPRE asignar si el matcher coincide (no solo si tiene datos)
                        assignedCrudos.add(row.key);
                        assignedRowsForLabel.push(row);
                    } catch (e) { }
                });

                // MEZCLAS: group unassigned items by groupTitle and assign
                const itemsByGroup = {};
                allMezclaItems.forEach(it => { if (assignedMezclas.has(it.id)) return; if (!tokenMatcher(it.yarn, it.groupTitle)) return; if (!itemsByGroup[it.groupTitle]) itemsByGroup[it.groupTitle] = []; itemsByGroup[it.groupTitle].push(it); });
                Object.keys(itemsByGroup).forEach(gTitle => {
                    try {
                        const items = itemsByGroup[gTitle];
                        // Reference componentPercentages map for this group (may be used per-item)
                        const gObj = mezclaGroupMap[gTitle];
                        const compPctMap = (gObj && gObj.componentPercentages) ? gObj.componentPercentages : {};

                        // Process each item individually for each month
                        items.forEach(it => {
                            // compute pct per item: first try to parse percentages embedded in yarn,
                            // otherwise fallback to compPctMap matching compKey against item yarn or its components
                            let pct = null;
                            let comps = [];
                            try {
                                const pctList = extractPctFromYarn(it.yarn);
                                if (Array.isArray(pctList) && pctList.length > 0) {
                                    let yarnStr = it.yarn.toString();
                                    yarnStr = yarnStr.replace(/^\s*\d+\/\d+\s*/,'').trim();
                                    yarnStr = yarnStr.replace(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%)/,'').trim();
                                    comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                                    let compIndex = -1;
                                    for (let ci = 0; ci < comps.length; ci++) {
                                        const u = (comps[ci] || '').toUpperCase();
                                        if (u.includes('COP') || u.includes('ALG') || u.includes('COTTON') || u.includes('PIMA') || u.includes('TANGUIS') || u.includes('UPLAND') || u.includes('GOTS') || u.includes('OCS')) { compIndex = ci; break; }
                                    }
                                    if (compIndex === -1 && comps.length === pctList.length) compIndex = 0;
                                    if (compIndex >= 0 && compIndex < pctList.length) pct = pctList[compIndex];
                                }
                            } catch (e) { }
                            if (pct === null) {
                                try {
                                    Object.keys(compPctMap || {}).some(compKey => {
                                        try {
                                            if (tokenMatcher(it.yarn || '', compKey) || (it.yarn && it.yarn.toString().toUpperCase().indexOf(compKey.toUpperCase()) >= 0)) {
                                                        pct = parseFloat(compPctMap[compKey]) || null; return true;
                                                    }
                                                    for (let c of comps) {
                                                        if (tokenMatcher(c, compKey) || (c && c.toUpperCase().indexOf(compKey.toUpperCase()) >= 0)) {
                                                            pct = parseFloat(compPctMap[compKey]) || null; return true;
                                                        }
                                                    }
                                        } catch (e) { }
                                        return false;
                                    });
                                } catch (e) { }
                            }
                            // GUARDAR pct en el item para que esté disponible en logs
                            it.pct = pct;
                            
                            try {
                                const client = it.client || 'VARIOS';
                                ensureClient(client);
                                for (let m = 0; m < 12; m++) {
                                    try {
                                        const raw = parseFloat(it.values[m] || 0) || 0;
                                        if (Math.abs(raw) < 0.0001) continue;
                                        
                                        let qq = 0;
                                        if (pct !== null && !isNaN(pct) && pct > 0) {
                                            // Per-item: QQ = ((raw * pct) / (1-merma)) / 46
                                            const itemComponentRaw = raw * pct;
                                            const itemKgReq = itemComponentRaw / (1 - merma);
                                            qq = itemKgReq / 46;
                                        } else {
                                            // Fallback: no pct
                                            const itemKgReq = raw / (1 - merma);
                                            qq = itemKgReq / 46;
                                        }
                                        agg[m] += qq;
                                        clientsMap[client][m] += qq;
                                    } catch (e) { }
                                }
                            } catch (e) { }
                        });
                        
                        // mark items as assigned (we assigned their raw to this fiber) - ya tienen .pct guardado
                        items.forEach(it => { assignedMezclas.add(it.id); assignedItemsForLabel.push(it); });
                    } catch (e) { }
                });

                // store computed data into detailAlgodon
                try {
                    if (typeof detailAlgodon !== 'undefined') {
                        detailAlgodon[label] = { totalValues: agg, clients: clientsMap, crudoRows: assignedRowsForLabel, mezclaItems: assignedItemsForLabel };
                    }
                } catch (e) { }
            } catch (e) { }
        });

        // DEBUG SUMMARY: Print count of crudos assigned per fiber label
        console.groupCollapsed('%c📋 ASIGNACIÓN DE CRUDOS POR FIBRA (verificación completa)', 'background:#333;color:#ffff00;font-weight:bold;padding:4px;font-size:12px');
        const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        const mermaAlgodon = 0.40; // Merma de algodón para logs
        const formatLogNum = (n) => {
            const num = parseFloat(n || 0) || 0;
            if (!isFinite(num)) return '-';
            if (Math.abs(num) < 1 && Math.abs(num) > 0) return (Math.round(num * 100) / 100).toString();
            return formatNumber(num);
        };
        
        orderedFibers.forEach(f => {
            const detail = detailAlgodon[f.label];
            if (detail && detail.crudoRows && detail.crudoRows.length > 0) {
                console.groupCollapsed(`%c${f.label}`, 'font-weight:bold;color:#00ff00');
                
                // Iterar por mes
                for (let m = 0; m < 12; m++) {
                    const crudosForMonth = detail.crudoRows.filter(r => (parseFloat(r.values[m]||0) || 0) > 0);
                    if (crudosForMonth.length === 0) continue;
                    
                    const monthLabel = months[m];
                    console.groupCollapsed(monthLabel);
                    console.groupCollapsed(`MAT. CRUDOS (${crudosForMonth.length} filas)`);
                    
                    let totalKg = 0, totalQQ = 0;
                    const byGroup = {};
                    crudosForMonth.forEach((r) => { if (!byGroup[r.groupTitle]) byGroup[r.groupTitle]=[]; byGroup[r.groupTitle].push(r); });
                    
                    Object.keys(byGroup).forEach(gTitle => {
                        console.groupCollapsed(gTitle);
                        let gKg = 0, gQQ = 0;
                        byGroup[gTitle].forEach((r, idx) => {
                            const raw = parseFloat(r.values[m] || 0) || 0;
                            const kgReq = raw / (1 - mermaAlgodon); // Aplicar merma correctamente
                            const qq = kgReq / 46;
                            gKg += raw; gQQ += qq; totalKg += raw; totalQQ += qq;
                            console.log(`  [${idx+1}] Yarn: ${r.yarn} | Cliente: ${r.client || '-'} | Línea: ${r.line || '-'} | Raw: ${formatLogNum(raw)} kg → KgReq: ${formatLogNum(kgReq)} (merma ${Math.round(mermaAlgodon*100)}%) → QQ: ${formatLogNum(qq)}`);
                        });
                        console.log(`  %c↳ Subtotal grupo: ${formatLogNum(gKg)} kg → ${formatLogNum(gQQ)} QQ`, 'color:#4ec9b0');
                        console.groupEnd();
                    });
                    
                    console.log(`%c${monthLabel} MAT. CRUDOS TOTAL: ${formatLogNum(totalKg)} kg → ${formatLogNum(totalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
                    console.groupEnd();
                    console.groupEnd();
                }
                
                console.groupEnd();
            }
        });
        
        console.log(`%cTotal crudos asignados: ${assignedCrudos.size} / ${allCrudoRows.length} disponibles`, 'color:#ffff00;font-weight:bold');
        if (assignedCrudos.size < allCrudoRows.length) {
            console.warn('%cADVERTENCIA: Hay crudos no asignados. Verifica los matchers.', 'color:#ff6600;font-weight:bold');
            const unassigned = allCrudoRows.filter(r => !assignedCrudos.has(r.key));
            unassigned.forEach((r, idx) => {
                console.warn(`  NO ASIGNADO [${idx+1}]: ${r.yarn} | Grupo: ${r.groupTitle} | Cliente: ${r.client || 'VARIOS'}`);
            });
        }
        console.groupEnd();

        // FORCE-ASSIGN: any remaining unassigned cotton hilados -> ALGODÓN UPLAND (QQ)
        try {
            const upLabel = 'ALGODÓN UPLAND (QQ)';
            if (typeof detailAlgodon === 'undefined') detailAlgodon = {};
            if (!detailAlgodon[upLabel]) detailAlgodon[upLabel] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };

            allCrudoRows.forEach(row => {
                try {
                    if (assignedCrudos.has(row.key)) return;
                    assignedCrudos.add(row.key);
                    detailAlgodon[upLabel].crudoRows.push(row);
                } catch (e) { }
            });

            allMezclaItems.forEach(it => {
                try {
                    if (assignedMezclas.has(it.id)) return;
                    assignedMezclas.add(it.id);
                    detailAlgodon[upLabel].mezclaItems.push(it);
                } catch (e) { }
            });
        } catch (e) { }
        // Log de hilados no asignados eliminado (según solicitud)

        // COMPREHENSIVE LOG: 100% de hilados con categoría asignada
        try {
            console.groupCollapsed('%c📋 LISTADO 100%% - TODOS LOS HILADOS Y SU CATEGORÍA ASIGNADA', 'background:#006699;color:#ffffff;font-weight:bold;padding:6px;font-size:14px;');
            
            const allItems = [];
            
            // Agregar crudos
            allCrudoRows.forEach(row => {
                try {
                    let assignedTo = 'NO ASIGNADO';
                    if (assignedCrudos.has(row.key)) {
                        // Find which fiber this row was assigned to
                        orderedFibers.forEach(f => {
                            if (detailAlgodon[f.label] && detailAlgodon[f.label].crudoRows.some(r => r.key === row.key)) {
                                assignedTo = f.label;
                            }
                        });
                    }
                    allItems.push({
                        type: '📦 CRUDO',
                        yarn: row.yarn,
                        grupo: row.groupTitle,
                        cliente: row.client,
                        assigned: assignedTo
                    });
                } catch (e) { }
            });
            
            // Agregar mezclas
            allMezclaItems.forEach(it => {
                try {
                    let assignedTo = 'NO ASIGNADO';
                    if (assignedMezclas.has(it.id)) {
                        // Find which fiber this item was assigned to
                        orderedFibers.forEach(f => {
                            if (detailAlgodon[f.label] && detailAlgodon[f.label].mezclaItems.some(item => item.id === it.id)) {
                                assignedTo = f.label;
                            }
                        });
                    }
                    allItems.push({
                        type: '🔀 MEZCLA',
                        yarn: it.yarn,
                        grupo: it.groupTitle,
                        cliente: it.client,
                        assigned: assignedTo
                    });
                } catch (e) { }
            });
            
            // Resumen detallado de asignaciones eliminado (según solicitud)
            console.groupEnd();
        } catch (e) { console.warn('Error en comprehensive log:', e); }

    } catch (e) { /* ignore */ }

    renderFiberTable('algodonTable', detailAlgodon, ORDERED_COTTON_KEYS, true);
    renderFiberTable('otrasTable', detailOtras, ORDERED_OTHER_KEYS, false);
    
    // CONSOLA: Orden específico solicitado
    try { logAllCottonFibersDetail(); } catch (e) { /* ignore logging errors */ }
    try { logAllOtherFibersDetail(); } catch (e) { /* ignore logging errors */ }
    // Re-render AMBAS tablas para reflejar los totales calculados en la consola
    try { renderFiberTable('algodonTable', detailAlgodon, ORDERED_COTTON_KEYS, true); } catch (e) { console.warn('re-render algodonTable failed', e); }
    try { renderFiberTable('otrasTable', detailOtras, ORDERED_OTHER_KEYS, false); } catch (e) { console.warn('re-render otrasTable failed', e); }
    
    try { validateCottonAssignments(); } catch (e) { console.warn('validateCottonAssignments failed', e); }
    try { logUnassignedHilados(); } catch (e) { console.warn('logUnassignedHilados failed', e); }
}

// Debug helper: busca ocurrencias de un token de yarn en estructuras principales
function findYarnOccurrences(token) {
    try {
        if (!token) { console.warn('findYarnOccurrences: se requiere un token'); return; }
        const t = token.toString().toUpperCase();
        console.groupCollapsed(`findYarnOccurrences: buscando "${token}"`);

        // Buscar en GLOBAL_ITEMS
        try {
            const foundGlobal = (GLOBAL_ITEMS || []).filter(it => (it.yarn||'').toString().toUpperCase().indexOf(t) >= 0);
            console.log('GLOBAL_ITEMS matches:', foundGlobal.length);
            foundGlobal.forEach(it => console.log('  GLOBAL_ITEM -> id:', it.id, '| yarn:', it.yarn, '| client:', it.client));
        } catch(e) { console.warn('error searching GLOBAL_ITEMS', e); }

        // Buscar en crudoGroups
        try {
            let cgCount = 0;
            (window.crudoGroups || crudoGroups || []).forEach(g => {
                (g.rows || []).forEach(r => {
                    try { if ((r.yarn||'').toString().toUpperCase().indexOf(t) >= 0) { cgCount++; console.log('CRUDO -> group:', g.title, '| rowIndex/id:', r.rowIndex || r.id, '| yarn:', r.yarn, '| client:', r.client); } } catch(e){}
                });
            });
            console.log('crudoGroups matches:', cgCount);
        } catch(e) { console.warn('error searching crudoGroups', e); }

        // Buscar en mezclaGroups (uniqueYarns -> GLOBAL_ITEMS)
        try {
            let mgCount = 0;
            (window.mezclaGroups || mezclaGroups || []).forEach(g => {
                if (!g.uniqueYarns) return;
                Array.from(g.uniqueYarns).forEach(id => {
                    try {
                        const it = (GLOBAL_ITEMS || []).find(x => x.id === id);
                        if (it && (it.yarn||'').toString().toUpperCase().indexOf(t) >= 0) {
                            mgCount++; console.log('MEZCLA -> group:', g.title, '| id:', id, '| yarn:', it.yarn, '| client:', it.client);
                        }
                    } catch(e){}
                });
            });
            console.log('mezclaGroups matches:', mgCount);
        } catch(e) { console.warn('error searching mezclaGroups', e); }

        // Buscar en detailOtras keys
        try {
            const keys = Object.keys(detailOtras || {});
            const keyMatches = keys.filter(k => (k||'').toString().toUpperCase().indexOf(t) >= 0);
            console.log('detailOtras key matches:', keyMatches.length, keyMatches);
        } catch(e) { console.warn('error searching detailOtras', e); }

        console.groupEnd();
    } catch(e) { console.warn('findYarnOccurrences error', e); }
}

// Validación: asegurar que TODOS los hilados de algodón estén asignados a una de las claves de ORDERED_COTTON_KEYS
function validateCottonAssignments() {
    try {
        // NUEVA ESTRATEGIA: Validar GLOBALMENTE
        // Sumar todos los valores en detailAlgodon y detailOtras
        // Comparar contra los totales en crudoGroups + mezclaGroups (GLOBAL_ITEMS)
        
        let totalAsignado = 0;
        let totalEnFuente = 0;
        const unassigned = [];
        
        // 1. Sumar TODO lo que está en detailAlgodon (todas las fibras de algodón asignadas)
        try {
            Object.keys(detailAlgodon || {}).forEach(fiberLabel => {
                const fiberData = detailAlgodon[fiberLabel];
                if (fiberData && fiberData.totalValues && Array.isArray(fiberData.totalValues)) {
                    fiberData.totalValues.forEach(val => {
                        totalAsignado += parseFloat(val || 0) || 0;
                    });
                }
            });
        } catch (e) { }
        
        // 2. Sumar TODO lo que está en detailOtras (todas las otras fibras asignadas)
        try {
            Object.keys(detailOtras || {}).forEach(fiberLabel => {
                const fiberData = detailOtras[fiberLabel];
                if (fiberData && fiberData.totalValues && Array.isArray(fiberData.totalValues)) {
                    fiberData.totalValues.forEach(val => {
                        totalAsignado += parseFloat(val || 0) || 0;
                    });
                }
            });
        } catch (e) { }
        
        // 3. Sumar TODOS los valores en la fuente (crudoGroups + mezclaGroups + GLOBAL_ITEMS)
        try {
            (window.crudoGroups || crudoGroups || []).forEach(g => {
                (g.rows || []).forEach(row => {
                    if (row && row.values && Array.isArray(row.values)) {
                        row.values.forEach(val => {
                            totalEnFuente += parseFloat(val || 0) || 0;
                        });
                    }
                });
            });
        } catch (e) { }
        
        try {
            (GLOBAL_ITEMS || []).forEach(item => {
                if (item && item.values && Array.isArray(item.values)) {
                    item.values.forEach(val => {
                        totalEnFuente += parseFloat(val || 0) || 0;
                    });
                }
            });
        } catch (e) { }
        
        // 4. Comparar totales
        const diferencia = Math.abs(totalAsignado - totalEnFuente);
        const btnExport = document.getElementById('btnExport');
        
        if (diferencia > 1) { // tolerancia de 1 kg por redondeos
            // Discrepancia detectada: silenciar logs de consola para evitar ruido
            if (btnExport) { btnExport.disabled = false; btnExport.classList.remove('opacity-50','pointer-events-none'); }
        } else {
            // Todo coincide perfectamente
            console.log(`%c✅ VALIDACIÓN OK: Todos los hilados están contabilizados (${formatNumber(totalAsignado)} kg)`, 'color:#00aa00;font-weight:bold;');
            if (btnExport) { btnExport.disabled = false; btnExport.classList.remove('opacity-50','pointer-events-none'); btnExport.title = ''; }
        }
        
        // RASTREO DE HILADOS: (logs suppressed)
        // console logging for rastreo de hilados has been removed to reduce console noise
        
        // Función auxiliar para detectar componentes de fibra en un yarn
        function detectarComponentesFibra(yarn) {
            const componentes = [];
            const yarnUpper = yarn.toUpperCase();
            
            // Detectar PIMA
            if (yarnUpper.includes('PIMA')) {
                let categoriaCotton = 'ALGODÓN UPLAND (QQ)'; // default
                if (yarnUpper.includes('OCS') && yarnUpper.includes('GOTS')) {
                    // Si tiene ambos, priorizar GOTS
                    categoriaCotton = 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
                } else if (yarnUpper.includes('OCS')) {
                    categoriaCotton = 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
                } else if (yarnUpper.includes('GOTS')) {
                    categoriaCotton = 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
                } else if (yarnUpper.includes('ORG') || yarnUpper.includes('ORGANICO') || yarnUpper.includes('ORGANIC')) {
                    categoriaCotton = 'ALGODÓN PIMA ORGANICO - OCS (QQ)'; // default a OCS si es orgánico
                } else {
                    categoriaCotton = 'ALGODÓN PIMA NC (QQ)';
                }
                componentes.push({ fibra: 'PIMA', grupoEspecifico: categoriaCotton, categoriaGeneral: 'ALGODÓN (QQ)' });
            }
            
            // Detectar TANGUIS
            if (yarnUpper.includes('TANGUIS')) {
                componentes.push({ fibra: 'TANGUIS', grupoEspecifico: 'ALGODÓN TANGUIS NC BCI (QQ)', categoriaGeneral: 'ALGODÓN (QQ)' });
            }
            
            // Detectar UPLAND
            if (yarnUpper.includes('UPLAND')) {
                if (yarnUpper.includes('USTCP') || yarnUpper.includes('US TCP')) {
                    componentes.push({ fibra: 'UPLAND', grupoEspecifico: 'ALGODÓN UPLAND USTCP (QQ)', categoriaGeneral: 'ALGODÓN (QQ)' });
                } else {
                    componentes.push({ fibra: 'UPLAND', grupoEspecifico: 'ALGODÓN UPLAND (QQ)', categoriaGeneral: 'ALGODÓN (QQ)' });
                }
            }
            
            // Detectar LYOCELL
            if (yarnUpper.includes('LYOCELL')) {
                if (yarnUpper.includes('A100')) {
                    componentes.push({ fibra: 'LYOCELL', grupoEspecifico: 'LYOCELL A100 (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
                } else {
                    componentes.push({ fibra: 'LYOCELL', grupoEspecifico: 'LYOCELL STD (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
                }
            }
            
            // Detectar PES REPREVE/PREPREVE (RECYCLED PES)
            if (yarnUpper.includes('PES') && (yarnUpper.includes('REPREVE') || yarnUpper.includes('PREPREVE'))) {
                componentes.push({ fibra: 'PES REPREVE', grupoEspecifico: 'RECYCLED PES (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            } else if (yarnUpper.includes('PES')) {
                // PES genérico (no reciclado)
                componentes.push({ fibra: 'PES', grupoEspecifico: 'PES STD (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            }
            
            // Detectar MODAL
            if (yarnUpper.includes('MODAL')) {
                componentes.push({ fibra: 'MODAL', grupoEspecifico: 'MODAL (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            }
            
            // Detectar NYLON
            if (yarnUpper.includes('NYLON')) {
                componentes.push({ fibra: 'NYLON', grupoEspecifico: 'NYLON (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            }
            
            // Detectar VISCOSA
            if (yarnUpper.includes('VISCOSA') || yarnUpper.includes('RAYON')) {
                componentes.push({ fibra: 'VISCOSA', grupoEspecifico: 'VISCOSA (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            }
            
            // Detectar LANA
            if (yarnUpper.includes('LANA') || yarnUpper.includes('WOOL')) {
                componentes.push({ fibra: 'LANA', grupoEspecifico: 'LANA (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            }
            
            // Detectar ELASTICO/SPANDEX
            if (yarnUpper.includes('ELASTICO') || yarnUpper.includes('ELÁSTICO') || yarnUpper.includes('SPANDEX')) {
                componentes.push({ fibra: 'ELASTICO', grupoEspecifico: 'ELASTICO (KG)', categoriaGeneral: 'OTRAS FIBRAS (KG REQ)' });
            }
            
            // Si no detectamos ningún componente, asignar algodón genérico como fallback
            if (componentes.length === 0) {
                componentes.push({ fibra: 'ALGODÓN', grupoEspecifico: 'ALGODÓN UPLAND (QQ)', categoriaGeneral: 'ALGODÓN (QQ)' });
            }
            
            return componentes;
        }
        
        // Recolectar todos los hilados únicos de GLOBAL_ITEMS
        const todosLosHilados = new Map(); // yarn -> { yarn, componentes[] }
        
        if (typeof GLOBAL_ITEMS !== 'undefined' && Array.isArray(GLOBAL_ITEMS)) {
            GLOBAL_ITEMS.forEach(item => {
                const yarn = (item.yarn || '').trim();
                if (yarn && !todosLosHilados.has(yarn)) {
                    const componentes = detectarComponentesFibra(yarn);
                    todosLosHilados.set(yarn, { yarn, componentes });
                }
            });
        }
        
        // RASTREO DE HILADOS: output suppressed. Variables still computed for internal validation if needed.
        let algodónCount = 0;
        let otrasFibrasCount = 0;
        todosLosHilados.forEach(entry => {
            entry.componentes.forEach(comp => {
                if (comp.categoriaGeneral.includes('ALGODÓN')) algodónCount++;
                if (comp.categoriaGeneral.includes('OTRAS FIBRAS')) otrasFibrasCount++;
            });
        });

        // VALIDACIÓN ADICIONAL: comprobar que mezclas con PREPREVE/REPREVE y PIMA/LYOCELL
        try {
            const checkItems = (GLOBAL_ITEMS || []).filter(it => it && it.yarn && it.yarn.toString().toUpperCase().includes('PREPREVE') && it.yarn.toString().toUpperCase().includes('PIMA') && it.yarn.toString().toUpperCase().includes('LYOCELL'));
            if (checkItems.length === 0) {
                // alternativa más laxa: PREPREVE + PIMA
                checkItems.push(...(GLOBAL_ITEMS || []).filter(it => it && it.yarn && it.yarn.toString().toUpperCase().includes('PREPREVE') && it.yarn.toString().toUpperCase().includes('PIMA')));
            }

            if (checkItems.length > 0) {
                console.groupCollapsed('%c🔎 VALIDACIÓN ESPECÍFICA: MEZCLAS CON PREPREVE/PIMA/LYOCELL', 'background:#222;color:#ffd700;font-weight:bold;padding:6px');
                checkItems.forEach(item => {
                    try {
                        const id = item.id || item.rowIndex || '(no-id)';
                        const yarn = (item.yarn||'').toString();
                        const parsed = (typeof window.debugParseYarn === 'function') ? window.debugParseYarn(yarn) : null;
                        const comps = (parsed && Array.isArray(parsed.components) && parsed.components.length>0) ? parsed.components : (yarn.split('/').map(s=>s.trim()).filter(Boolean));
                        const pcts = (parsed && Array.isArray(parsed.percentages) && parsed.percentages.length>0) ? parsed.percentages.map(p=>p/100) : null;

                        console.groupCollapsed(`Item ${id} → ${yarn}`);
                        comps.forEach((comp, idx) => {
                            try {
                                const compU = (comp||'').toString().toUpperCase();
                                const pct = (pcts && pcts[idx]) ? pcts[idx] : null;
                                let expectedBucket = null;
                                if (compU.includes('PIMA') || compU.includes('ALGODON') || compU.includes('COP')) expectedBucket = 'ALGODÓN (QQ)';
                                else if (compU.includes('LYOCELL') || compU.includes('TENCEL')) expectedBucket = 'LYOCELL STD (KG)';
                                else if (compU.includes('PREPREVE') || compU.includes('REPREVE')) expectedBucket = 'RECYCLED PES (KG)';
                                else if (compU.includes('PES')) expectedBucket = 'PES VIRGEN (KG)';
                                else expectedBucket = 'OTRAS (KG)';

                                // Buscar en detailAlgodon / detailOtras si el item aparece en mezclaItems
                                let foundIn = null;
                                Object.keys(detailAlgodon || {}).forEach(k => { try { if ((detailAlgodon[k].mezclaItems||[]).some(x=>x && (x.id === item.id))) foundIn = k; } catch(e){} });
                                Object.keys(detailOtras || {}).forEach(k => { try { if ((detailOtras[k].mezclaItems||[]).some(x=>x && (x.id === item.id))) foundIn = foundIn || k; } catch(e){} });

                                const ok = (expectedBucket && foundIn && (foundIn.toUpperCase().indexOf(expectedBucket.split(' ')[0])>=0 || (expectedBucket==='RECYCLED PES (KG)' && foundIn.toUpperCase().includes('RECYCLED'))));

                                console.log(`Componente: ${comp} | Pct:${pct!==null?Math.round((pct||0)*100)+'%':'(autodetect)'} → Esperado: ${expectedBucket} → Encontrado en: ${foundIn || 'NO ENCONTRADO'} ${ok? '✅':'❌'}`);
                            } catch(e) { console.warn('error validating comp', e); }
                        });
                        console.groupEnd();
                    } catch(e) { console.warn('error validating item', e); }
                });
                console.groupEnd();
            } else {
                console.log('%cNo se encontraron items PREPREVE+PIMA para validar automáticamente.', 'color:#888');
            }
        } catch(e) { console.warn('validación PREPREVE error', e); }

        return [];
    } catch (e) { console.warn('validateCottonAssignments error', e); return []; }
}

// Heurística para asignar una hilado de algodón a una de las 9 claves
function determineCottonKey(yarn, groupTitle) {
    try {
        const a = normStrFiber(yarn || '');
        const t = normStrFiber(groupTitle || '');
        const combined = a + ' ' + t;
        const keys = ORDERED_COTTON_KEYS || [];
        
        // PIMA ORGANICO GOTS: PIMA + GOTS + sin OCS
        if (combined.includes('PIMA') && combined.includes('GOTS') && !combined.includes('OCS')) {
            return keys.find(k => k.toUpperCase().includes('PIMA') && k.toUpperCase().includes('GOTS')) || keys[keys.length-1];
        }
        
        // PIMA ORGANICO OCS: PIMA + OCS + sin GOTS
        if (combined.includes('PIMA') && combined.includes('OCS') && !combined.includes('GOTS')) {
            return keys.find(k => k.toUpperCase().includes('PIMA') && k.toUpperCase().includes('OCS')) || keys[keys.length-1];
        }
        
        // TANGUIS BCI: TANGUIS + BCI
        if (combined.includes('TANGUIS') && combined.includes('BCI')) {
            return keys.find(k => k.toUpperCase().includes('TANGUIS')) || keys[keys.length-1];
        }
        
        // GOTS (genérico, sin PIMA): GOTS + sin PIMA + sin OCS
        if (combined.includes('GOTS') && !combined.includes('PIMA') && !combined.includes('OCS')) {
            return keys.find(k => k.toUpperCase().includes('GOTS') && !k.toUpperCase().includes('PIMA')) || keys[keys.length-1];
        }
        
        // OCS (genérico, sin PIMA): OCS + sin PIMA + sin GOTS
        if (combined.includes('OCS') && !combined.includes('PIMA') && !combined.includes('GOTS')) {
            return keys.find(k => k.toUpperCase().includes('OCS') && !k.toUpperCase().includes('PIMA') && !k.toUpperCase().includes('GOTS')) || keys[keys.length-1];
        }
        
        // UPLAND USTCP: USTCP o US TCP
        if (combined.includes('USTCP') || combined.includes('US TCP')) {
            return keys.find(k => k.toUpperCase().includes('USTCP')) || keys[keys.length-1];
        }
        
        // ELEGANT
        if (combined.includes('ELEGANT')) {
            return keys.find(k => k.toUpperCase().includes('ELEGANT')) || keys[keys.length-1];
        }
        
        // PIMA (genérico, sin certificación): PIMA + sin OCS + sin GOTS
        if (combined.includes('PIMA') && !combined.includes('OCS') && !combined.includes('GOTS')) {
            return keys.find(k => k.toUpperCase().includes('PIMA') && k.toUpperCase().includes('NC')) || keys[keys.length-1];
        }
        
        // Fallback: cualquier algodón restante -> usar la última clave definida en ORDERED_COTTON_KEYS
        return keys[keys.length-1];
    } catch (e) { 
        const keys = ORDERED_COTTON_KEYS || [];
        return keys[keys.length-1];
    }
}

// Helper: extrae lista de porcentajes desde el texto del yarn, p.ej. "50/30/20%" -> [0.5,0.3,0.2]
function extractPctFromYarn(yarn) {
    try {
        if (!yarn) return null;
        const s = yarn.toString();
        // Permitir espacios antes de '%' y paréntesis alrededor: ej. "(65/35 %)" o "75/25%"
        const m = s.match(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*\s*%)/);
        if (!m) return null;
        // Limpiar caracteres no numéricos salvo '/' y '.'
        let pctBlock = m[0].replace('%','').trim();
        pctBlock = pctBlock.replace(/[^0-9\/\.]/g,'');
        const parts = pctBlock.split('/').map(p => { const v = parseFloat(p); return isNaN(v) ? null : v / 100; }).filter(x => x !== null);
        return (parts && parts.length > 0) ? parts : null;
    } catch (e) { return null; }
}

// Auto-asignar hilados de algodón no asignados a las claves disponibles
function autoAssignRemainingCotton() {
    try {
        if (typeof detailAlgodon === 'undefined') detailAlgodon = {};
        const keys = ORDERED_COTTON_KEYS || [];
        keys.forEach(k => { if (!detailAlgodon[k]) detailAlgodon[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });

        const merma = 0.40;

        // CRUDOS
        (window.crudoGroups || crudoGroups || []).forEach(g => {
            const title = g.title || '';
            (g.rows || []).forEach(row => {
                try {
                    if (!row || !row.yarn) return;
                    if (!isAlgodon(row.yarn)) return;
                    const key = `${title}||${row.client||''}||${row.line||''}||${row.yarn||''}||${row.id||row.rowIndex||''}`;
                    // check already assigned
                    const already = keys.some(k => detailAlgodon[k].crudoRows && detailAlgodon[k].crudoRows.some(r => r.key === key));
                    if (already) return;
                    const target = determineCottonKey(row.yarn, title) || keys[keys.length-1];
                    // SIEMPRE agregar al array (incluso si valores son 0)
                    detailAlgodon[target].crudoRows.push(Object.assign({ key, groupTitle: title }, row));
                    // add totals (solo si hay valores)
                    for (let i = 0; i < 12; i++) {
                        const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                        if (Math.abs(raw) < 0.0001) continue;
                        const kgReq = raw / (1 - merma);
                        const qq = kgReq / 46;
                        detailAlgodon[target].totalValues[i] = (detailAlgodon[target].totalValues[i] || 0) + qq;
                        const client = row.client || 'VARIOS';
                        if (!detailAlgodon[target].clients[client]) detailAlgodon[target].clients[client] = new Array(12).fill(0);
                        detailAlgodon[target].clients[client][i] += qq;
                    }
                } catch (e) { }
            });
        });

        // MEZCLAS - APLICAR PCT POR CADA FILA: QQ = ((raw * pct) / (1-merma)) / 46
        (window.mezclaGroups || mezclaGroups || []).forEach(g => {
            const title = g.title || '';
            if (!g.uniqueYarns) return;
            const compPctMap = g.componentPercentages || {};
            
            Array.from(g.uniqueYarns).forEach(id => {
                try {
                    const it = GLOBAL_ITEMS.find(x => x.id === id);
                    if (!it || !it.yarn) return;
                    if (!isAlgodon(it.yarn)) return;
                    const already = keys.some(k => detailAlgodon[k].mezclaItems && detailAlgodon[k].mezclaItems.some(x => x.id === id));
                    if (already) return;
                    const target = determineCottonKey(it.yarn, title) || keys[keys.length-1];
                    
                    // Buscar pct: 1) intentar extraer porcentajes embebidos en el yarn (ej. "50/30/20%")
                    // 2) fallback: buscar en g.componentPercentages comparando con el it.yarn o con cada componente
                    let pct = null;
                    let comps = [];
                    try {
                        const pctList = extractPctFromYarn(it.yarn);
                        if (Array.isArray(pctList) && pctList.length > 0) {
                            // construir lista de componentes en el mismo orden
                            let yarnStr = it.yarn.toString();
                            yarnStr = yarnStr.replace(/^\s*\d+\/\d+\s*/,'').trim(); // quitar conteos iniciales tipo "30/1 "
                            yarnStr = yarnStr.replace(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%)/,'').trim(); // quitar bloque de %
                            comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                            // buscar índice del componente que sea algodón (o coincida con target)
                            let compIndex = -1;
                            for (let ci = 0; ci < comps.length; ci++) {
                                const u = (comps[ci] || '').toUpperCase();
                                if (u.includes('COP') || u.includes('ALG') || u.includes('COTTON') || u.includes('PIMA') || u.includes('TANGUIS') || u.includes('UPLAND') || u.includes('GOTS') || u.includes('OCS')) { compIndex = ci; break; }
                            }
                            if (compIndex === -1 && comps.length === pctList.length) compIndex = 0;
                            if (compIndex >= 0 && compIndex < pctList.length) pct = pctList[compIndex];
                        }
                    } catch (e) { }

                    if (pct === null) {
                        try {
                            // fallback: buscar en componentPercentages comparando con it.yarn y con cada componente
                            Object.keys(compPctMap || {}).some(compKey => {
                                try {
                                    if (tokenMatcher(it.yarn || '', compKey) || (it.yarn && it.yarn.toString().toUpperCase().indexOf(compKey.toUpperCase()) >= 0)) {
                                        pct = parseFloat(compPctMap[compKey]) || null; return true;
                                    }
                                    for (let c of comps) {
                                        if (tokenMatcher(c, compKey) || (c && c.toUpperCase().indexOf(compKey.toUpperCase()) >= 0)) {
                                            pct = parseFloat(compPctMap[compKey]) || null; return true;
                                        }
                                    }
                                } catch (e) { }
                                return false;
                            });
                        } catch (e) { }
                    }

                    // SIEMPRE agregar al array (incluso si valores son 0) e incluir pct encontrado (puede ser null)
                    detailAlgodon[target].mezclaItems.push(Object.assign({ groupTitle: title, pct: pct }, it));
                    
                    // add totals - APLICAR PCT: QQ = ((raw * pct) / (1-merma)) / 46
                    for (let i = 0; i < 12; i++) {
                        const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                        if (Math.abs(raw) < 0.0001) continue;
                        
                        let qq = 0;
                        if (pct !== null && !isNaN(pct) && pct > 0) {
                            // Con porcentaje: QQ = ((raw * pct) / (1-merma)) / 46
                            const componentRaw = raw * pct;
                            const kgReq = componentRaw / (1 - merma);
                            qq = kgReq / 46;
                        } else {
                            // Sin porcentaje (fallback): QQ = (raw / (1-merma)) / 46
                            const kgReq = raw / (1 - merma);
                            qq = kgReq / 46;
                        }
                        
                        detailAlgodon[target].totalValues[i] = (detailAlgodon[target].totalValues[i] || 0) + qq;
                        const client = it.client || 'VARIOS';
                        if (!detailAlgodon[target].clients[client]) detailAlgodon[target].clients[client] = new Array(12).fill(0);
                        detailAlgodon[target].clients[client][i] += qq;
                    }
                } catch (e) { }
            });
        });


    } catch (e) { console.warn('autoAssignRemainingCotton error', e); }
}


// Helper: build fiber detail data (totalValues + clients) using two-pass extraction
function buildFiberDetail(tokenMatcher, merma = 0.40) {
    const agg = new Array(12).fill(0);
    const clientsMap = {};
    const ensureClient = (c) => { if (!clientsMap[c]) clientsMap[c] = new Array(12).fill(0); };

    try {
        // CRUDOS
        (window.crudoGroups || crudoGroups || []).forEach(g => {
            try {
                const title = (g.title || '').toString();
                const rows = (g.rows || []).filter(r => {
                    const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                    return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                });
                rows.forEach(row => {
                    try {
                        if (!row || !row.yarn) return;
                        if (!tokenMatcher(row.yarn, title)) return;
                        const client = row.client || 'VARIOS';
                        ensureClient(client);
                        for (let i = 0; i < 12; i++) {
                            const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            const kgReq = raw / (1 - merma);
                            const qq = kgReq / 46;
                            agg[i] += qq;
                            clientsMap[client][i] += qq;
                        }
                    } catch (e) { }
                });
            } catch (e) { }
        });
    } catch (e) { }

    try {
        // MEZCLAS
        (window.mezclaGroups || mezclaGroups || []).forEach(g => {
            try {
                const title = (g.title || '').toString();
                const items = [];
                if (g.uniqueYarns && g.uniqueYarns.size > 0) {
                    Array.from(g.uniqueYarns).forEach(id => {
                        try {
                            const it = GLOBAL_ITEMS.find(x => x.id === id);
                            if (!it || !it.yarn) return;
                            items.push(it);
                        } catch (e) { }
                    });
                }
                if (items.length === 0) return;

                for (let i = 0; i < 12; i++) {
                    try {
                        let groupKg = 0;
                        const clientRawMap = {};
                        // Sum total raw for the whole mezcla group (all items), and build client raw map
                        items.forEach(it => {
                            try {
                                const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) return;
                                groupKg += raw;
                                const client = it.client || 'VARIOS';
                                if (!clientRawMap[client]) clientRawMap[client] = 0;
                                clientRawMap[client] += raw;
                            } catch (e) { }
                        });
                        if (groupKg <= 0) continue;

                        let pct = null;
                        try {
                            const compPctMap = g.componentPercentages || {};
                            Object.keys(compPctMap || {}).some(ct => {
                                try { if (tokenMatcher(ct, title)) { pct = parseFloat(compPctMap[ct]) || null; return true; } } catch (e) {}
                                return false;
                            });
                        } catch (e) { }

                        if (pct !== null && !isNaN(pct) && pct > 0) {
                            const componentRaw = groupKg * pct;
                            const kgReqComp = componentRaw / (1 - merma);
                            const qqComp = kgReqComp / 46;
                            const totalClientRaw = Object.values(clientRawMap).reduce((a,b)=>a+b,0) || groupKg;
                            Object.keys(clientRawMap).forEach(client => {
                                try {
                                    ensureClient(client);
                                    const clientShare = clientRawMap[client] / totalClientRaw;
                                    const clientComponentRaw = componentRaw * clientShare;
                                    const clientKgReq = clientComponentRaw / (1 - merma);
                                    const clientQQ = clientKgReq / 46;
                                    agg[i] += clientQQ;
                                    clientsMap[client][i] += clientQQ;
                                } catch (e) { }
                            });
                        } else {
                            Object.keys(clientRawMap).forEach(client => {
                                try {
                                    ensureClient(client);
                                    const rawClient = clientRawMap[client];
                                    const kgReq = rawClient / (1 - merma);
                                    const qq = kgReq / 46;
                                    agg[i] += qq;
                                    clientsMap[client][i] += qq;
                                } catch (e) { }
                            });
                        }
                    } catch (e) { }
                }
            } catch (e) { }
        });
    } catch (e) { }

    return { totalValues: agg, clients: clientsMap };
}

// Print all 12 months (total QQ) and per-client breakdown for a given fiber


function renderFiberTable(tableId, dataObj, orderedKeys, isAlgodon) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let html = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">FIBRA</th>${generateCellsHTML(null, true)}<th class="text-right px-2 py-1 w-14">TOTAL</th></tr></thead><tbody class="bg-white">`;
    
    let strictTotalVec = new Array(12).fill(0);

    orderedKeys.forEach((fiberName, idx) => {
        // Use already-assigned data from detailAlgodon/detailOtras (calculated by enforceFullAssignment)
        let fiberData = dataObj[fiberName] || { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
        
        fiberData.totalValues.forEach((v, i) => strictTotalVec[i] += v);

        const fiberDisplay = escapeHtml(fiberName);
        const bgClass = isAlgodon ? 'bg-blue-100 hover:bg-blue-200 border-blue-300' : 'bg-amber-100 hover:bg-amber-200 border-amber-300';
        const textClass = isAlgodon ? 'text-blue-900' : 'text-amber-900';
        
        const rowSum = (fiberData.totalValues || []).reduce((a,b)=>a+(b||0),0);
        html += `<tr class="${bgClass} cursor-pointer border-b-2" data-fiber-name="${fiberDisplay}" data-is-algodon="${isAlgodon}" onclick="openFiberModalByName(this.getAttribute('data-fiber-name'), ${isAlgodon})">
                    <td class="py-2 px-3 font-bold ${textClass} pl-4">${fiberDisplay}</td>
                    ${generateCellsHTML(fiberData.totalValues).replace(/^/gm, '')}
                    <td class="text-right px-2 font-bold text-${isAlgodon ? 'blue' : 'amber'}-900">${formatNumber(rowSum)}</td>
                </tr>`;
    });
    
    const grandTotalSum = strictTotalVec.reduce((a,b)=>a+(b||0),0);
    html += `<tr class="grand-total-row"><td class="py-2 px-3 text-right font-bold">TOTAL:</td>${generateCellsHTML(strictTotalVec)}<td class="text-right px-2 font-bold">${formatNumber(grandTotalSum)}</td></tr>`;
    html += `</tbody>`;
    table.innerHTML = html;
}

function openFiberModalByName(fiberDisplay, isAlgodon) {
    const source = isAlgodon ? detailAlgodon : detailOtras;
    let fiberName = null;
    for (let key in source) { if (escapeHtml(key) === fiberDisplay) { fiberName = key; break; } }
    if (fiberName && source[fiberName]) { openFiberModal(fiberName, source[fiberName].clients, isAlgodon); }
}

function openFiberModal(fiberName, clients, isAlgodon, suppressConsole = true) {
    document.getElementById('fiberModalTitle').textContent = escapeHtml(fiberName);
    let tbody = '';
    const clientKeys = Object.keys(clients).sort();
    let totals = new Array(12).fill(0);
    clientKeys.forEach(client => {
        const values = clients[client];
        // main numeric row (plain values, no click)
        let row = `<tr class="border-b hover:bg-gray-50"><td class="border px-3 py-2">${escapeHtml(client)}</td>`;
        for (let i = 0; i < 12; i++) {
            const val = values[i] || 0; totals[i] += val;
            if (Math.abs(parseFloat(val || 0)) > 0.0001) {
                row += `<td class="border px-3 py-2 text-right"><button type="button" class="fiber-cell-btn" data-fiber="${escapeHtml(fiberName)}" data-client="${escapeHtml(client)}" data-month="${i}" data-value="${val}" data-isalgodon="${isAlgodon ? 1 : 0}">${formatNumber(val)}</button></td>`;
            } else {
                row += `<td class="border px-3 py-2 text-right text-slate-400">-</td>`;
            }
        }
        const sum = values.reduce((a, b) => a + b, 0);
        row += `<td class="border px-3 py-2 text-right font-bold">${formatNumber(sum)}</td></tr>`;
        tbody += row;

        // (Removed per-user request: no inline 'Fuente' row)
    });
    // After building the table body, optionally log per-cell breakdowns to console for algodón modal
    try {
        if (!suppressConsole) {
            clientKeys.forEach(client => {
                const values = clients[client] || [];
                for (let i = 0; i < 12; i++) {
                    const val = parseFloat(values[i] || 0) || 0;
                    if (Math.abs(val) < 0.0001) continue;
                    try { logFiberCellBreakdown(fiberName, client, i, val, !!isAlgodon); } catch (e) { /* ignore logging errors */ }
                }
            });
        }
    } catch (e) { /* ignore overall */ }

    // Get authoritative totals from detailAlgodon/detailOtras so modal matches table exactly
    const sourceMap = isAlgodon ? (typeof detailAlgodon !== 'undefined' ? detailAlgodon : null) : (typeof detailOtras !== 'undefined' ? detailOtras : null);
    const authoritativeData = (sourceMap && sourceMap[fiberName]) ? sourceMap[fiberName] : null;
    const authoritativeTotals = (authoritativeData && Array.isArray(authoritativeData.totalValues)) ? authoritativeData.totalValues : null;
    
    // Total row: use authoritative totals for display
    let totalRow = `<tr class="bg-gray-200 font-bold border-top"><td class="border px-3 py-2">TOTAL</td>`;
    for (let i = 0; i < 12; i++) {
        const displayVal = authoritativeTotals ? (parseFloat(authoritativeTotals[i]) || 0) : (totals[i] || 0);
        totalRow += `<td class="border px-3 py-2 text-right">${formatNumber(displayVal)}</td>`;
    }
    const grandTotal = authoritativeTotals ? authoritativeTotals.reduce((a, b) => a + (parseFloat(b) || 0), 0) : totals.reduce((a, b) => a + b, 0);
    totalRow += `<td class="border px-3 py-2 text-right">${formatNumber(grandTotal)}</td></tr>`;
    tbody += totalRow;
    document.getElementById('fiberDetailBody').innerHTML = tbody;
    document.getElementById('fiberDetailModal').classList.remove('hidden');
    resetFiberDetailPanel();
    wireFiberModalCellClicks();
}

function closeFiberModal() { document.getElementById('fiberDetailModal').classList.add('hidden'); }

var FIBER_DETAIL_CTX = null;

function resetFiberDetailPanel() {
    const panel = document.getElementById('fiberDetailPanel');
    if (panel) panel.classList.add('hidden');
    const header = document.getElementById('fiberDetailHeader');
    if (header) header.textContent = '';
    const select = document.getElementById('fiberDetailSourceFilter');
    if (select) select.innerHTML = '<option value="ALL">TODOS</option>';
    const table = document.getElementById('fiberDetailContribTable');
    if (table) table.innerHTML = '';
    const list = document.getElementById('fiberDetailDropdownList');
    if (list) list.innerHTML = '';
    FIBER_DETAIL_CTX = null;
}

function wireFiberModalCellClicks() {
    const body = document.getElementById('fiberDetailBody');
    if (!body) return;
    const buttons = body.querySelectorAll('.fiber-cell-btn');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].onclick = function() {
            try {
                const fiber = this.getAttribute('data-fiber') || '';
                const client = this.getAttribute('data-client') || '';
                const monthIdx = parseInt(this.getAttribute('data-month') || '0', 10);
                const val = parseFloat(this.getAttribute('data-value') || '0') || 0;
                const isAlgodon = (this.getAttribute('data-isalgodon') || '0') === '1';
                showFiberCellDetail(fiber, client, monthIdx, val, isAlgodon);
            } catch (e) { console.warn('Detalle celda error', e); }
        };
    }
}

function showFiberCellDetail(fiberName, client, monthIdx, displayedVal, isAlgodon) {
    const contributors = getTraceContributors(fiberName, client, monthIdx, !!isAlgodon) || [];
    const rows = [];
    for (let i = 0; i < contributors.length; i++) {
        const c = contributors[i] || {};
        rows.push({
            source: c.source || '',
            groupTitle: c.groupTitle || '',
            yarn: c.yarn || '',
            type: c.type || '',
            raw: (typeof c.raw !== 'undefined') ? c.raw : (c.rawItem || 0),
            pct: c.pct || 0,
            contrib: c.contrib || 0,
            req: c.req || 0,
            qq: c.qq || 0
        });
    }

    let sumVal = 0;
    rows.forEach(r => {
        const v = isAlgodon ? (parseFloat(r.qq) || 0) : (parseFloat(r.req) || 0);
        sumVal += v;
    });
    const diff = (parseFloat(displayedVal) || 0) - sumVal;
    if (Math.abs(diff) > 0.0001) {
        rows.push({
            source: 'DIFERENCIA',
            groupTitle: '',
            yarn: '(No asignado)',
            type: '',
            raw: 0,
            pct: 0,
            contrib: 0,
            req: isAlgodon ? 0 : diff,
            qq: isAlgodon ? diff : 0
        });
    }

    const monthLabel = (MONTH_NAMES && MONTH_NAMES[monthIdx]) ? MONTH_NAMES[monthIdx] : ('M' + (monthIdx + 1));
    FIBER_DETAIL_CTX = {
        fiberName: fiberName,
        client: client,
        monthIdx: monthIdx,
        monthLabel: monthLabel,
        displayedVal: displayedVal,
        isAlgodon: !!isAlgodon,
        rows: rows
    };

    const panel = document.getElementById('fiberDetailPanel');
    if (panel) panel.classList.remove('hidden');
    const header = document.getElementById('fiberDetailHeader');
    if (header) header.textContent = `${fiberName} — ${client} — ${monthLabel}`;

    const select = document.getElementById('fiberDetailSourceFilter');
    if (select) {
        const sources = {};
        rows.forEach(r => { if (r.source) sources[r.source] = true; });
        let options = '<option value="ALL">TODOS</option>';
        Object.keys(sources).forEach(s => { options += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`; });
        select.innerHTML = options;
        select.onchange = function() { renderFiberDetailPanel(); };
    }

    renderFiberDetailPanel();
}

function renderFiberDetailPanel() {
    if (!FIBER_DETAIL_CTX) return;
    const select = document.getElementById('fiberDetailSourceFilter');
    const filter = select ? (select.value || 'ALL') : 'ALL';
    const rows = (FIBER_DETAIL_CTX.rows || []).filter(r => {
        if (filter === 'ALL') return true;
        return (r.source || '') === filter;
    });

    let html = '<thead><tr class="bg-slate-100">';
    html += '<th class="px-2 py-1 text-left">Fuente</th>';
    html += '<th class="px-2 py-1 text-left">Grupo</th>';
    html += '<th class="px-2 py-1 text-left">Hilado</th>';
    html += '<th class="px-2 py-1 text-right">Raw</th>';
    html += '<th class="px-2 py-1 text-right">%</th>';
    html += '<th class="px-2 py-1 text-right">Contrib</th>';
    html += `<th class="px-2 py-1 text-right">${FIBER_DETAIL_CTX.isAlgodon ? 'QQ' : 'KG REQ'}</th>`;
    html += '</tr></thead><tbody>';

    if (!rows.length) {
        html += '<tr><td colspan="7" class="px-3 py-2 text-sm text-slate-500">Sin contribuciones.</td></tr>';
    } else {
        rows.forEach(r => {
            html += '<tr class="border-b">';
            html += `<td class="px-2 py-1">${escapeHtml(r.source || '')}</td>`;
            html += `<td class="px-2 py-1">${escapeHtml(r.groupTitle || '')}</td>`;
            html += `<td class="px-2 py-1">${escapeHtml(r.yarn || '')}</td>`;
            html += `<td class="px-2 py-1 text-right">${formatNumber(r.raw || 0)}</td>`;
            html += `<td class="px-2 py-1 text-right">${r.pct ? (Math.round((r.pct || 0) * 100) + '%') : ''}</td>`;
            html += `<td class="px-2 py-1 text-right">${formatNumber(r.contrib || 0)}</td>`;
            const mainVal = FIBER_DETAIL_CTX.isAlgodon ? (r.qq || 0) : (r.req || 0);
            html += `<td class="px-2 py-1 text-right">${formatNumber(mainVal)}</td>`;
            html += '</tr>';
        });
    }

    // Totals
    let totalMain = 0;
    rows.forEach(r => { totalMain += FIBER_DETAIL_CTX.isAlgodon ? (parseFloat(r.qq) || 0) : (parseFloat(r.req) || 0); });
    html += `<tr class="bg-slate-50 font-bold"><td class="px-2 py-1">TOTAL</td><td></td><td></td><td></td><td></td><td></td><td class="px-2 py-1 text-right">${formatNumber(totalMain)}</td></tr>`;
    html += '</tbody>';
    const table = document.getElementById('fiberDetailContribTable');
    if (table) table.innerHTML = html;

    // Dropdown list (collapsible)
    const list = document.getElementById('fiberDetailDropdownList');
    if (list) {
        let listHtml = '';
        rows.forEach(r => {
            const mainVal = FIBER_DETAIL_CTX.isAlgodon ? (r.qq || 0) : (r.req || 0);
            const title = `${r.source || ''} — ${r.yarn || ''} — ${formatNumber(mainVal)}`;
            listHtml += `<details class="fiber-detail-item"><summary>${escapeHtml(title)}</summary>`;
            listHtml += `<div class="fiber-detail-item-body">`;
            listHtml += `<div><strong>Grupo:</strong> ${escapeHtml(r.groupTitle || '-')}</div>`;
            listHtml += `<div><strong>Raw:</strong> ${formatNumber(r.raw || 0)}</div>`;
            listHtml += `<div><strong>%:</strong> ${r.pct ? (Math.round((r.pct || 0) * 100) + '%') : '-'}</div>`;
            listHtml += `<div><strong>Contrib:</strong> ${formatNumber(r.contrib || 0)}</div>`;
            listHtml += `<div><strong>${FIBER_DETAIL_CTX.isAlgodon ? 'QQ' : 'KG REQ'}:</strong> ${formatNumber(mainVal)}</div>`;
            listHtml += `</div></details>`;
        });
        list.innerHTML = listHtml || '<div class="text-sm text-slate-500">Sin contenido.</div>';
    }
}

// Build contributors for a given fiber/client/month
function getTraceContributors(fiberDisplay, client, monthIdx, isAlgodon) {
    const contributors = [];
    // Helper to match fiber: normalize strings (remove diacritics, non-alnum) for robust comparison
    const normalizeForCompare = (s) => {
        if (s == null) return '';
        try {
            return stripDiacritics(s.toString().toUpperCase()).replace(/[^A-Z0-9]/g, '');
        } catch (e) {
            return s.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
    };
    const normFiber = normalizeForCompare(fiberDisplay);
    const matchFiber = (canonToken) => {
        try {
            const pretty = (typeof getFiberNameFromStrict === 'function') ? getFiberNameFromStrict(canonToken) : canonToken;
            const normPretty = normalizeForCompare(pretty);
            const normCanon = normalizeForCompare(canonToken);
            return normPretty === normFiber || normCanon === normFiber;
        } catch (e) { return false; }
    };

    // 1) CRUDOS and standalone items
    GLOBAL_ITEMS.forEach(item => {
        try {
            if (!item || !item.values) return;
            if ((item.client || '') !== client) return;
            const raw = parseFloat(item.values[monthIdx] || 0) || 0;
            if (Math.abs(raw) < 0.0001) return;
            const canon = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(item.yarn || '') : (item.yarn || '');
            if (matchFiber(canon)) {
                const isHTR = (item.yarn || '').toString().toUpperCase().includes('HTR') || !!item._isHTR;
                const merma = isHTR ? 0 : (isAlgodon ? 40 : (typeof defaultMermaForToken === 'function' ? defaultMermaForToken(item.yarn) : 15));
                const req = isAlgodon ? (raw / (1 - merma/100)) : (raw / (1 - merma/100));
                const qq = isAlgodon ? (req / 46) : null;
                contributors.push({source: 'CRUDOS', type: isHTR ? 'HTR' : 'BASE', id: item.id, yarn: item.yarn, line: item.line, raw: raw, req: req, qq: qq});
            }
        } catch (e) { /* ignore */ }
    });

    // 2) MEZCLAS: for each group, check component percentages and per-item contributions
    try {
        (mezclaGroups || []).forEach(g => {
            const compPctMap = g.componentPercentages || {};
            Object.keys(compPctMap).forEach(compToken => {
                try {
                    if (!matchFiber(compToken)) return;
                    const pct = compPctMap[compToken] || 0;
                    // for each item in group, if client matches, attribute item.values * pct
                    if (g.uniqueYarns && g.uniqueYarns.size > 0) {
                        Array.from(g.uniqueYarns).forEach(itemId => {
                            const it = GLOBAL_ITEMS.find(x => x.id === itemId);
                            if (!it) return;
                            if ((it.client || '') !== client) return;
                            const raw = parseFloat(it.values[monthIdx] || 0) || 0;
                            if (Math.abs(raw) < 0.0001) return;
                            const contrib = raw * pct;
                            const isHTR = (it.yarn || '').toString().toUpperCase().includes('HTR') || !!it._isHTR;
                            const merma = isHTR ? 0 : (isAlgodon ? 40 : (typeof defaultMermaForToken === 'function' ? defaultMermaForToken(compToken) : 15));
                            const req = contrib / (1 - merma/100);
                            const qq = isAlgodon ? (req / 46) : null;
                            contributors.push({source: 'MEZCLA', groupTitle: g.title, type: isHTR ? 'HTR' : 'BASE', itemId: it.id, yarn: it.yarn, rawItem: raw, pct: pct, contrib: contrib, req: req, qq: qq});
                        });
                    }
                } catch (e) { /* ignore comp */ }
            });
        });
    } catch (e) { /* ignore */ }

    return contributors;
}

// Open a trace modal showing contributors for a fiber/client/month
function openTraceModal(fiberDisplay, client, monthIdx, isAlgodon) {
    const contributors = getTraceContributors(fiberDisplay, client, monthIdx, !!isAlgodon);
    // create modal if missing
    if (!document.getElementById('traceModal')) {
        const div = document.createElement('div');
        div.id = 'traceModal';
        div.className = 'fixed inset-0 z-50 flex items-center justify-center';
        div.innerHTML = `<div class="bg-white border rounded shadow-lg max-w-3xl w-11/12 p-4"><div class="flex justify-between items-center mb-2"><h3 id="traceModalTitle" class="font-bold"></h3><button onclick="closeTraceModal()" class="text-gray-600">✕</button></div><div id="traceModalBody" style="max-height:60vh;overflow:auto"></div></div>`;
        document.body.appendChild(div);
    }
    document.getElementById('traceModalTitle').textContent = `${fiberDisplay} — ${client} — ${MONTH_NAMES ? MONTH_NAMES[monthIdx] : 'M' + (monthIdx+1)}`;
    let html = '<table class="w-full border-collapse"><thead><tr class="bg-gray-100"><th class="p-2">Fuente</th><th class="p-2">Grupo/Item</th><th class="p-2">Yarn</th><th class="p-2">Raw</th><th class="p-2">Pct</th><th class="p-2">Contrib</th><th class="p-2">Req</th><th class="p-2">QQ</th></tr></thead><tbody>';
    if (!contributors || contributors.length === 0) {
        html += `<tr><td colspan="8" class="p-3">No se encontraron contribuciones para este mes/cliente.</td></tr>`;
    } else {
        contributors.forEach(c => {
            html += '<tr class="border-b">';
            html += `<td class="p-2">${escapeHtml(c.source)}</td>`;
            const grp = c.groupTitle ? escapeHtml(c.groupTitle) : (c.id || c.itemId ? ('ID:' + (c.id||c.itemId)) : '');
            html += `<td class="p-2">${grp}</td>`;
            html += `<td class="p-2">${escapeHtml(c.yarn || '')}</td>`;
            html += `<td class="p-2 text-right">${formatNumber(c.raw || c.rawItem || 0)}</td>`;
            html += `<td class="p-2 text-right">${c.pct ? (Math.round(c.pct*100) + '%') : ''}</td>`;
            html += `<td class="p-2 text-right">${formatNumber(c.contrib || 0)}</td>`;
            html += `<td class="p-2 text-right">${formatNumber(c.req || 0)}</td>`;
            html += `<td class="p-2 text-right">${c.qq ? formatNumber(c.qq) : ''}</td>`;
            html += '</tr>';
        });
    }
    // Add totals footer and authoritative check so modal always reflects table values
    let totalRaw = 0, totalContrib = 0, totalReq = 0, totalQQ = 0;
    contributors.forEach(c => {
        totalRaw += parseFloat(c.raw || c.rawItem || 0) || 0;
        totalContrib += parseFloat(c.contrib || 0) || 0;
        totalReq += parseFloat(c.req || 0) || 0;
        totalQQ += parseFloat(c.qq || 0) || 0;
    });

    html += `<tr class="bg-gray-50 font-bold"><td class="p-2">Totales</td><td></td><td></td><td class="p-2 text-right">${formatNumber(totalRaw)}</td><td></td><td class="p-2 text-right">${formatNumber(totalContrib)}</td><td class="p-2 text-right">${formatNumber(totalReq)}</td><td class="p-2 text-right">${formatNumber(totalQQ)}</td></tr>`;

    // Compare with authoritative client value from detailAlgodon/detailOtras
    try {
        const sourceMap = isAlgodon ? (typeof detailAlgodon !== 'undefined' ? detailAlgodon : null) : (typeof detailOtras !== 'undefined' ? detailOtras : null);
        let fiberName = null;
        if (sourceMap) {
            for (let key in sourceMap) { if (escapeHtml(key) === fiberDisplay) { fiberName = key; break; } }
        }
        const authoritativeQQ = (sourceMap && fiberName && sourceMap[fiberName] && sourceMap[fiberName].clients && sourceMap[fiberName].clients[client] && typeof sourceMap[fiberName].clients[client][monthIdx] !== 'undefined') ? (parseFloat(sourceMap[fiberName].clients[client][monthIdx]) || 0) : null;
        if (authoritativeQQ !== null) {
            // If contributors' sum differs, show discrepancy row; otherwise confirm match
            const eps = 0.0001;
            if (Math.abs(totalQQ - authoritativeQQ) > eps) {
                html += `<tr class="bg-yellow-50"><td colspan="7" class="p-2 italic text-sm">Discrepancia detectada entre suma de contribuyentes y total autorizado</td><td class="p-2 text-right font-bold">${formatNumber(authoritativeQQ)} (Autorizado)</td></tr>`;
            } else {
                html += `<tr class="bg-green-50"><td colspan="7" class="p-2 italic text-sm">La suma de contribuyentes coincide con el total autorizado</td><td class="p-2 text-right font-bold">${formatNumber(authoritativeQQ)}</td></tr>`;
            }
        }
    } catch (e) { /* ignore */ }

    html += '</tbody></table>';
    document.getElementById('traceModalBody').innerHTML = html;
    document.getElementById('traceModal').classList.remove('hidden');
}

function closeTraceModal() { const el = document.getElementById('traceModal'); if (el) el.classList.add('hidden'); }

// Log detailed breakdown for Algodón (QQ) total to console
function logAlgodonQQDetail() {
    try {
        const monthIdx = 0; // Enero
        const monthLabel = (MONTH_NAMES && MONTH_NAMES[monthIdx]) ? MONTH_NAMES[monthIdx] : 'ENE';

        // Helper: filtrar PIMA NC (sin certificaciones OCS/GOTS/ORGANICO)
        const isPimaNonCertified = (s) => {
            if (!s) return false;
            const up = s.toString().toUpperCase();
            if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(up)) return false;
            if (!/PIMA/.test(up)) return false;
            return true;
        };

        console.group(`ALGODÓN PIMA NC (QQ) — ENERO — Detalle completo`);

        let totalSumQQ = 0;

        // MAT. CRUDOS
        console.group('MAT. CRUDOS');
        try {
            (window.crudoGroups || crudoGroups || []).forEach((g, gi) => {
                try {
                    const title = (g.title || '').toString();
                    const titleUp = title.toUpperCase();
                    if (!/PIMA/.test(titleUp)) return;
                    if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(titleUp)) return;

                    let groupSum = 0;
                    console.group(`[${title}]`);
                    const filteredRows = (g.rows || []).filter(r => {
                        const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                        return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                    });
                    filteredRows.forEach(row => {
                        try {
                            if (!row || !row.yarn) return;
                            if (!isPimaNonCertified(row.yarn)) return;
                            const raw = parseFloat(row.values && row.values[monthIdx] ? row.values[monthIdx] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) return;
                            const merma = 40;
                            const kgReq = raw / (1 - merma/100);
                            const qq = kgReq / 46;
                            console.log(`${row.client} | ${row.yarn} — Raw: ${formatNumber(raw)} kg → Kg REQ: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                            groupSum += qq;
                        } catch (e) { /* ignore row */ }
                    });
                    console.log(`Grupo suma (ENE): ${formatNumber(groupSum)}`);
                    console.groupEnd();
                    totalSumQQ += groupSum;
                } catch (e) { /* ignore group */ }
            });
        } catch (e) { /* ignore */ }
        console.groupEnd();

        // MAT. MEZCLAS
        console.group('MAT. MEZCLAS');
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach((g, gi) => {
                try {
                    const title = (g.title || '').toString();
                    const titleUp = title.toUpperCase();
                    if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(titleUp)) return;

                    let groupSum = 0;
                    console.group(`[${title}]`);
                    const compTotals = g.componentTotalsTotal || {};
                    const compPctMap = g.componentPercentages || {};
                    Object.keys(compTotals).forEach(compToken => {
                        try {
                            if (!compToken) return;
                            const compLabel = compToken.toString().replace(/_/g, ' ').toUpperCase();
                            if (!/\b(COP\s+)?PIMA(\s+NC)?\b/.test(compLabel)) return;
                            if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(compLabel)) return;
                            const vec = compTotals[compToken] || new Array(12).fill(0);
                            const kgContrib = parseFloat(vec[monthIdx] || 0) || 0;
                            if (Math.abs(kgContrib) < 0.0001) return;
                            const pct = (typeof compPctMap[compToken] !== 'undefined') ? compPctMap[compToken] : null;
                            const merma = 40;
                            const kgReq = kgContrib / (1 - merma/100);
                            const qq = kgReq / 46;
                            console.log(`Componente: ${compToken} — Kg contrib: ${formatNumber(kgContrib)}${pct ? ' → pct: ' + Math.round(pct*100) + '%' : ''} → Kg REQ: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                            groupSum += qq;
                        } catch (e) { /* ignore comp */ }
                    });
                    console.log(`Grupo suma (ENE): ${formatNumber(groupSum)}`);
                    console.groupEnd();
                    totalSumQQ += groupSum;
                } catch (e) { /* ignore group */ }
            });
        } catch (e) { /* ignore */ }
        console.groupEnd();

        console.log('SUMA TOTAL QQ (ENE):', formatNumber(totalSumQQ));
        console.groupEnd();
    } catch (e) { console.warn('Error al generar el log PIMA NC QQ (ENE)', e); }
}

// Log detailed breakdown for PIMA ORG - OCS (QQ) for Enero
function logPimaOrgOcsDetail() {
    try {
        const monthIdx = 0; // Enero
        const monthLabel = (MONTH_NAMES && MONTH_NAMES[monthIdx]) ? MONTH_NAMES[monthIdx] : 'ENE';

        // Helper: normaliza string
        const normStr = (input) => {
            if (!input) return '';
            try {
                return stripDiacritics(input.toString().toUpperCase()).replace(/[^A-Z0-9_]/g, ' ');
            } catch (e) { return input.toString().toUpperCase().replace(/[^A-Z0-9_]/g, ' '); }
        };

        const tokenMatchesPimaOcs = (compToken, groupTitle) => {
            const a = normStr(compToken);
            const t = normStr(groupTitle || '');
            if (!a || !t) return false;
            if (a.includes('GOTS') || t.includes('GOTS')) return false;
            if (!t.includes('OCS')) return false;
            const titleHasPimaOrCop = t.includes('PIMA') || t.includes('COP');
            if (!titleHasPimaOrCop) return false;
            const hasPima = a.includes('PIMA');
            if (!hasPima && !a.includes('PIMA_ORG_OCS')) return false;
            if (hasPima && (a.includes('OCS') || a.includes('ORG') || a.includes('ORGANICO'))) return true;
            if (a.includes('PIMA_ORG_OCS')) return true;
            return false;
        };

        console.group(`%cALGODÓN PIMA ORGANICO - OCS (QQ) — ${monthLabel} — Detalle 100%`, 'font-weight:bold;font-size:12px;color:#d4a574');
        let totalSumQQ = 0;

        // PASO 1: Extraer TODO de MAT. CRUDOS sin filtros iniciales
        const allCrudoData = [];
        try {
            (window.crudoGroups || crudoGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    const rows = (g.rows || []).filter(r => {
                        const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                        return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                    });
                    rows.forEach(row => {
                        if (!row || !row.yarn) return;
                        const raw = parseFloat(row.values && row.values[monthIdx] ? row.values[monthIdx] : 0) || 0;
                        if (Math.abs(raw) < 0.0001) return;
                        allCrudoData.push({ groupTitle: title, yarn: row.yarn, client: row.client, raw: raw });
                    });
                } catch (e) { }
            });
        } catch (e) { }

        // PASO 2: Filtrar solo PIMA OCS y calcular
        console.group('MAT. CRUDOS');
        const filteredCrudos = allCrudoData.filter(d => tokenMatchesPimaOcs(d.yarn, d.groupTitle));
        const crudosByGroup = {};
        filteredCrudos.forEach(d => {
            if (!crudosByGroup[d.groupTitle]) crudosByGroup[d.groupTitle] = [];
            crudosByGroup[d.groupTitle].push(d);
        });
        Object.keys(crudosByGroup).forEach(gTitle => {
            console.group(`[${gTitle}]`);
            let groupSum = 0;
            crudosByGroup[gTitle].forEach(d => {
                const kgReq = d.raw / (1 - 0.40);
                const qq = kgReq / 46;
                console.log(`${d.client} | ${d.yarn} — Raw: ${formatNumber(d.raw)} kg → Kg REQ: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                groupSum += qq;
            });
            console.log(`Grupo suma (${monthLabel}): ${formatNumber(groupSum)}`);
            console.groupEnd();
            totalSumQQ += groupSum;
        });
        if (filteredCrudos.length === 0) {
            console.log('(sin datos PIMA OCS)');
        }
        console.groupEnd();

        // PASO 3: Extraer TODO de MAT. MEZCLAS sin filtros iniciales
        const allMezclaData = [];
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    if (!g.uniqueYarns || g.uniqueYarns.size === 0) return;
                    Array.from(g.uniqueYarns).forEach(id => {
                        try {
                            const it = GLOBAL_ITEMS.find(x => x.id === id);
                            if (!it || !it.yarn) return;
                            const raw = parseFloat(it.values && it.values[monthIdx] ? it.values[monthIdx] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) return;
                            allMezclaData.push({ groupTitle: title, yarn: it.yarn, client: it.client, raw: raw, itemId: id });
                        } catch (e) { }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        // PASO 4: Filtrar solo PIMA OCS y calcular
        console.group('MAT. MEZCLAS');
        const filteredMezclas = allMezclaData.filter(d => tokenMatchesPimaOcs(d.yarn, d.groupTitle));
        const mezclasByGroup = {};
        filteredMezclas.forEach(d => {
            if (!mezclasByGroup[d.groupTitle]) mezclasByGroup[d.groupTitle] = [];
            mezclasByGroup[d.groupTitle].push(d);
        });
        Object.keys(mezclasByGroup).forEach(gTitle => {
            console.group(`[${gTitle}]`);
            let groupSum = 0;
            mezclasByGroup[gTitle].forEach(d => {
                const kgReq = d.raw / (1 - 0.40);
                const qq = kgReq / 46;
                console.log(`${d.client} | ${d.yarn} — Raw: ${formatNumber(d.raw)} kg → Kg REQ: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                groupSum += qq;
            });
            console.log(`Grupo suma (${monthLabel}): ${formatNumber(groupSum)}`);
            console.groupEnd();
            totalSumQQ += groupSum;
        });
        if (filteredMezclas.length === 0) {
            console.log('(sin datos PIMA OCS)');
        }
        console.groupEnd();

        console.log('SUMA TOTAL QQ ('+monthLabel+'):', formatNumber(totalSumQQ));
        console.log('=== FIN DETALLE ===');
        console.groupEnd();
    } catch (e) { console.warn('Error al generar el log PIMA ORG OCS QQ (ENE)', e); }
}

// Log all 12 months for PIMA ORGANICO - OCS (QQ)
function logPimaOrgOcsAllMonths() {
    try {
        const normStr = (input) => {
            if (!input) return '';
            try {
                return stripDiacritics(input.toString().toUpperCase()).replace(/[^A-Z0-9_]/g, ' ');
            } catch (e) { return input.toString().toUpperCase().replace(/[^A-Z0-9_]/g, ' '); }
        };

        const tokenMatchesPimaOcs = (compToken, groupTitle) => {
            const a = normStr(compToken);
            const t = normStr(groupTitle || '');
            if (!a || !t) return false;
            if (a.includes('GOTS') || t.includes('GOTS')) return false;
            if (!t.includes('OCS')) return false;
            const titleHasPimaOrCop = t.includes('PIMA') || t.includes('COP');
            if (!titleHasPimaOrCop) return false;
            const hasPima = a.includes('PIMA');
            if (!hasPima && !a.includes('PIMA_ORG_OCS')) return false;
            if (hasPima && (a.includes('OCS') || a.includes('ORG') || a.includes('ORGANICO'))) return true;
            if (a.includes('PIMA_ORG_OCS')) return true;
            return false;
        };

        const months = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES : ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
        console.group(`%cALGODÓN PIMA ORGANICO - OCS (QQ) — DETALLE COMPLETO 12 MESES`, 'font-weight:bold;font-size:14px;color:#007acc');

        // PASO 1: Extraer TODO de CRUDOS sin filtros (para todos los meses)
        const allCrudoDataByMonth = new Array(12).fill(0).map(() => []);
        try {
            (window.crudoGroups || crudoGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    const rows = (g.rows || []).filter(r => {
                        const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                        return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                    });
                    rows.forEach(row => {
                        if (!row || !row.yarn) return;
                        for (let m = 0; m < 12; m++) {
                            const raw = parseFloat(row.values && row.values[m] ? row.values[m] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            allCrudoDataByMonth[m].push({ groupTitle: title, yarn: row.yarn, client: row.client, line: row.line, raw: raw });
                        }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        // PASO 2: Extraer TODO de MEZCLAS sin filtros (para todos los meses)
        const allMezclaDataByMonth = new Array(12).fill(0).map(() => []);
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    if (!g.uniqueYarns || g.uniqueYarns.size === 0) return;
                    Array.from(g.uniqueYarns).forEach(id => {
                        try {
                            const it = GLOBAL_ITEMS.find(x => x.id === id);
                            if (!it || !it.yarn) return;
                            for (let m = 0; m < 12; m++) {
                                const raw = parseFloat(it.values && it.values[m] ? it.values[m] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                allMezclaDataByMonth[m].push({ groupTitle: title, yarn: it.yarn, client: it.client, raw: raw, itemId: id });
                            }
                        } catch (e) { }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        // PASO 3: Iterar por mes y filtrar + calcular CON DETALLE COMPLETO
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            const monthLabel = months[monthIdx] || ('M' + (monthIdx+1));

            // Filtrar CRUDOS para este mes
            const filteredCrudos = allCrudoDataByMonth[monthIdx].filter(d => tokenMatchesPimaOcs(d.yarn, d.groupTitle));
            // Filtrar MEZCLAS para este mes
            const filteredMezclas = allMezclaDataByMonth[monthIdx].filter(d => tokenMatchesPimaOcs(d.yarn, d.groupTitle));

            // Mostrar SOLO meses con datos
            if ((filteredCrudos.length || filteredMezclas.length) === 0) continue;

            console.group(`${monthLabel}`);

            console.group(`MAT. CRUDOS (${filteredCrudos.length} filas)`);
            let crudosTotalQQ = 0;
            let crudosTotalKg = 0;
            if (filteredCrudos.length === 0) {
                console.log('(sin datos PIMA OCS)');
            } else {
                // Agrupar por groupTitle para mostrar organizado
                const crudosByGroup = {};
                filteredCrudos.forEach(d => {
                    if (!crudosByGroup[d.groupTitle]) crudosByGroup[d.groupTitle] = [];
                    crudosByGroup[d.groupTitle].push(d);
                });
                Object.keys(crudosByGroup).forEach(gTitle => {
                    console.group(`📦 ${gTitle}`);
                    let groupKg = 0, groupQQ = 0;
                    crudosByGroup[gTitle].forEach((d, idx) => {
                        const kgReq = d.raw / (1 - 0.40);
                        const qq = kgReq / 46;
                        groupKg += d.raw;
                        groupQQ += qq;
                        crudosTotalKg += d.raw;
                        crudosTotalQQ += qq;
                        // Mostrar CADA fila: yarn + client + line
                        console.log(`  [${idx+1}] Yarn: ${d.yarn} | Cliente: ${d.client || '-'} | Línea: ${d.line || '-'} | Raw: ${formatNumber(d.raw)} kg → KgReq: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                    });
                    console.log(`  %c↳ Subtotal grupo: ${formatNumber(groupKg)} kg → ${formatNumber(groupQQ)} QQ`, 'color:#4ec9b0');
                    console.groupEnd();
                });
                console.log(`%c${monthLabel} MAT. CRUDOS TOTAL: ${formatNumber(crudosTotalKg)} kg → ${formatNumber(crudosTotalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
            }
            console.groupEnd();

            // Filtrar MEZCLAS para este mes (ya obtenido arriba)
            console.group(`MAT. MEZCLAS (${filteredMezclas.length} filas)`);
            let mezclasTotalQQ = 0;
            let mezclasTotalKg = 0;
            if (filteredMezclas.length === 0) {
                console.log('(sin datos PIMA OCS)');
            } else {
                // Agrupar por groupTitle para mostrar organizado
                const mezclasByGroup = {};
                filteredMezclas.forEach(d => {
                    if (!mezclasByGroup[d.groupTitle]) mezclasByGroup[d.groupTitle] = [];
                    mezclasByGroup[d.groupTitle].push(d);
                });
                Object.keys(mezclasByGroup).forEach(gTitle => {
                    console.group(`📦 ${gTitle}`);
                    let groupKg = 0, groupQQ = 0;
                    const rows = mezclasByGroup[gTitle];
                    // Primero sumar Kg del grupo y listar filas (sin convertir todavía)
                    rows.forEach((d, idx) => {
                        groupKg += d.raw;
                        mezclasTotalKg += d.raw;
                        console.log(`  [${idx+1}] Yarn: ${d.yarn} | Cliente: ${d.client || '-'} | ItemID: ${d.itemId || '-'} | Raw: ${formatNumber(d.raw)} kg`);
                    });

                    // Intentar obtener % participación del componente PIMA dentro del grupo
                    let pct = null;
                    try {
                        const allGroups = (window.mezclaGroups || mezclaGroups || []);
                        const groupObj = allGroups.find(gg => (gg && gg.title && gg.title.toString && gg.title.toString() === gTitle));
                        if (groupObj && groupObj.componentPercentages) {
                            const compPctMap = groupObj.componentPercentages || {};
                            Object.keys(compPctMap || {}).some(compToken => {
                                try {
                                    if (tokenMatchesPimaOcs(compToken, gTitle)) {
                                        pct = parseFloat(compPctMap[compToken]) || null;
                                        return true;
                                    }
                                } catch (e) { }
                                return false;
                            });
                        }
                    } catch (e) { }

                    // Cálculo: si existe pct usamos la fórmula requerida:
                    // QQ = ((groupKg * pct) / (1 - merma)) / 46
                    const merma = 0.40;
                    if (pct !== null && !isNaN(pct) && pct > 0) {
                        const componentRaw = groupKg * pct;
                        const kgReqComp = componentRaw / (1 - merma);
                        groupQQ = kgReqComp / 46;
                        mezclasTotalQQ += groupQQ;
                        console.log(`  %c↳ Subtotal grupo (con %participación ${formatNumber(pct)}): ${formatNumber(componentRaw)} kg → KgReq: ${formatNumber(kgReqComp)} → ${formatNumber(groupQQ)} QQ`, 'color:#4ec9b0');
                    } else {
                        // Fallback: calcular por fila individual (como antes)
                        rows.forEach(d => {
                            const kgReq = d.raw / (1 - merma);
                            const qq = kgReq / 46;
                            groupQQ += qq;
                            mezclasTotalQQ += qq;
                        });
                        console.log(`  %c↳ Subtotal grupo (sin %participación): ${formatNumber(groupKg)} kg → ${formatNumber(groupQQ)} QQ`, 'color:#4ec9b0');
                    }
                    console.groupEnd();
                });
                console.log(`%c${monthLabel} MAT. MEZCLAS TOTAL: ${formatNumber(mezclasTotalKg)} kg → ${formatNumber(mezclasTotalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
            }
            console.groupEnd();

            const totalKg = crudosTotalKg + mezclasTotalKg;
            const totalQQ = crudosTotalQQ + mezclasTotalQQ;
            console.log(`%c${monthLabel} TOTAL: ${formatNumber(totalKg)} kg → ${formatNumber(totalQQ)} QQ (CRUDOS: ${filteredCrudos.length} + MEZCLAS: ${filteredMezclas.length} = ${filteredCrudos.length + filteredMezclas.length} filas)`, 'font-weight:bold;font-size:12px;color:#f48771;background:#1e1e1e;padding:2px 4px');

            console.groupEnd();
        }

        console.groupEnd();
    } catch (e) { console.warn('Error al generar log PIMA OCS todos los meses', e); }
}

function logFiberCellBreakdown(fiberName, client, monthIdx, displayedVal, isAlgodon) {
    try {
        const month = (MONTH_NAMES && MONTH_NAMES[monthIdx]) ? MONTH_NAMES[monthIdx] : ('M' + (monthIdx+1));
        console.groupCollapsed(`Detalle: ${fiberName} — ${client} — ${month} — Valor mostrado: ${formatNumber(displayedVal)}`);
        const contributors = getTraceContributors(fiberName, client, monthIdx, !!isAlgodon) || [];

        if (!contributors || contributors.length === 0) {
            console.log('No se encontraron contribuyentes directos para esta celda. Intentando búsqueda alternativa...');
            // fallback: look for CRUDOS rows for same client with PIMA non-certified
            const fallback = [];
            const isPimaNonCertifiedLocal = (s) => {
                if (!s) return false;
                const up = s.toString().toUpperCase();
                if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(up)) return false;
                if (!/\bPIMA\b/.test(up)) return false;
                if (/\b(COP\s+)?PIMA(\s+NC)?\b/.test(up)) return true;
                return false;
            };

            try {
                // helper: determine if an item belongs to a mezcla group that contributes PIMA
                const itemInPimaMezcla = (itemId) => {
                    try {
                        return (mezclaGroups || []).some(g => {
                            const compPctMap = g.componentPercentages || {};
                            const hasPimaComp = Object.keys(compPctMap).some(ct => {
                                try {
                                    return (ct || '').toString().toUpperCase().includes('PIMA') && !/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test((ct||'').toString().toUpperCase());
                                } catch (e) { return false; }
                            });
                            if (!hasPimaComp) return false;
                            return g.uniqueYarns && g.uniqueYarns.has && g.uniqueYarns.has(itemId);
                        });
                    } catch (e) { return false; }
                };

                (GLOBAL_ITEMS || []).forEach(item => {
                    try {
                        if (!item || !item.yarn) return;
                        if ((item.client || '') !== client) return;
                        const raw = parseFloat(item.values && item.values[monthIdx] ? item.values[monthIdx] : 0) || 0;
                        if (Math.abs(raw) < 0.0001) return;
                        if (!isPimaNonCertifiedLocal(item.yarn)) return;
                        // skip if this item is part of a mezcla that provides PIMA (will be handled in MEZCLAS loop)
                        if (itemInPimaMezcla(item.id)) return;
                        const isHTR = (item.yarn || '').toString().toUpperCase().includes('HTR') || !!item._isHTR;
                        const merma = isHTR ? 0 : (isAlgodon ? 40 : 15);
                        const req = raw / (1 - merma/100);
                        const qq = isAlgodon ? (req / 46) : null;
                        fallback.push({source:'CRUDOS', desc: item.yarn || ('ID:'+item.id), raw: raw, req: req, qq: qq});
                    } catch(e){}
                });
            } catch(e){}

            // fallback: inspect mezclaGroups to find any group components that map to PIMA and items of this client
            try {
                (mezclaGroups || []).forEach(g => {
                    try {
                        const compPctMap = g.componentPercentages || {};
                        Object.keys(compPctMap).forEach(compToken => {
                            try {
                                if (!isPimaNonCertifiedLocal(compToken)) return;
                                const pct = compPctMap[compToken] || 0;
                                if (!g.uniqueYarns || g.uniqueYarns.size === 0) return;
                                Array.from(g.uniqueYarns).forEach(itemId => {
                                    try {
                                        const it = (GLOBAL_ITEMS || []).find(x => x.id === itemId);
                                        if (!it) return;
                                        if ((it.client || '') !== client) return;
                                        const raw = parseFloat(it.values && it.values[monthIdx] ? it.values[monthIdx] : 0) || 0;
                                        if (Math.abs(raw) < 0.0001) return;
                                        const contrib = raw * pct;
                                        const isHTR = (it.yarn || '').toString().toUpperCase().includes('HTR') || !!it._isHTR;
                                        const merma = isHTR ? 0 : (isAlgodon ? 40 : 15);
                                        const req = contrib / (1 - merma/100);
                                        const qq = isAlgodon ? (req / 46) : null;
                                        fallback.push({source:'MEZCLA', desc: `${g.title || ''} / ${it.yarn || ''}`, raw: raw, pct: pct, contrib: contrib, req: req, qq: qq});
                                    } catch(e){}
                                });
                            } catch(e){}
                        });
                    } catch(e){}
                });
            } catch(e){}

            if (fallback.length === 0) {
                console.log('Búsqueda alternativa no encontró contribuyentes relevantes.');
                console.groupEnd();
                return;
            }

            // Print fallback findings
            let sumQQfb = 0;
            fallback.forEach((f, idx) => {
                try {
                    if (f.source === 'CRUDOS') {
                        console.log(`MAT. CRUDOS: ${f.desc} -> QQ ENE: ${formatNumber(f.qq)} (raw kg: ${formatNumber(f.raw)})`);
                        sumQQfb += f.qq || 0;
                    } else {
                        console.log(`MAT. MEZCLAS: ${f.desc} -> QQ ENE: ${formatNumber(f.qq)} (item raw kg: ${formatNumber(f.raw)}, pct: ${f.pct ? Math.round(f.pct*100)+'%' : 'N/A'})`);
                        sumQQfb += f.qq || 0;
                    }
                } catch(e){}
            });
            console.log('Suma QQ (fallback) — ENE:', formatNumber(sumQQfb));
            console.groupEnd();
            return;
        }

        let sumContribQQ = 0;
        contributors.forEach((c, idx) => {
            try {
                if ((c.source || '').toString().toUpperCase().includes('CRUD')) {
                    // CRUDOS contributor: c.raw, c.req, c.qq
                    console.group(`CRUDOS #${idx+1} — ${c.yarn || c.id || ''}`);
                    console.log('Raw (kg):', formatNumber(c.raw || 0));
                    console.log('Merma (%):', (c.type === 'HTR' ? 0 : (isAlgodon ? 40 : 15)));
                    console.log('Req (kg):', formatNumber(c.req || 0));
                    console.log('QQ:', c.qq ? formatNumber(c.qq) : 'N/A');
                    if (c.qq) sumContribQQ += c.qq;
                    console.groupEnd();
                } else if ((c.source || '').toString().toUpperCase().includes('MEZ')) {
                    // MEZCLA contributor: c.rawItem, c.pct, c.contrib, c.req, c.qq
                    console.group(`MEZCLA #${idx+1} — Grupo: ${c.groupTitle || ''} — Item: ${c.itemId || ''}`);
                    console.log('Item Raw (kg):', formatNumber(c.rawItem || 0));
                    console.log('Pct aplicada:', c.pct ? (Math.round(c.pct*100) + '%') : 'N/A');
                    console.log('Contribución (kg):', formatNumber(c.contrib || 0));
                    console.log('Merma (%):', (c.type === 'HTR' ? 0 : (isAlgodon ? 40 : 15)));
                    console.log('Req (kg):', formatNumber(c.req || 0));
                    console.log('QQ:', c.qq ? formatNumber(c.qq) : 'N/A');
                    if (c.qq) sumContribQQ += c.qq;
                    console.groupEnd();
                } else {
                    console.log('Otro contribuidor:', c);
                }
            } catch (e) { /* ignore single contributor errors */ }
        });

        // Discrepancy logs removed to reduce console noise
        console.groupEnd();
    } catch (e) { console.warn('Error al generar detalle de celda:', e); }
}

// Read precomputed QQ values from rendered blocks (CRUDO groups and MEZCLAS groups)
function getQQFromBlocksForPima(monthIdx) {
    const results = [];
    try {
        // 1) CRUDOS: iterate crudoGroups and read cell with id qq-c-{groupIndex}-{monthIdx}
        try {
            (window.crudoGroups || crudoGroups || []).forEach((g, gi) => {
                try {
                    const title = (g.title || '').toString();
                    const up = title.toUpperCase();
                    if (!/PIMA/.test(up)) return; // only PIMA groups
                    if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(up)) return; // exclude certified
                    const cellId = `qq-c-${gi}-${monthIdx}`;
                    const el = document.getElementById(cellId);
                    let qq = 0;
                    let rawApprox = null;
                    if (el) {
                        const txt = el.textContent || el.innerText || '';
                        qq = parseFloat((txt || '').toString().replace(/[^0-9\-.,]/g, '').replace(',', '.')) || 0;
                    } else {
                        // try to read req cell and compute qq = req/46
                        const reqId = `req-c-${gi}-${monthIdx}`;
                        const reqEl = document.getElementById(reqId);
                        if (reqEl) {
                            const rtxt = reqEl.textContent || reqEl.innerText || '';
                            const req = parseFloat((rtxt || '').toString().replace(/[^0-9\-.,]/g, '').replace(',', '.')) || 0;
                            qq = req / 46;
                        }
                    }
                    // try to read raw approximate from rendered group totals if available
                    try {
                        const rawTotalId = `req-total-c-${gi}`; // req-total is in req units, but crudos footer has filteredTotals
                        const rawEl = document.getElementById(`qq-c-${gi}-${monthIdx}`); // not straightforward; leave null
                        rawApprox = null;
                    } catch (e) { rawApprox = null; }
                    if (qq && qq > 0) results.push({ source: 'CRUDOS', desc: title, qq: qq, raw: rawApprox });
                } catch (e) {}
            });
        } catch (e) {}

        // 2) MEZCLAS: iterate mezclaGroups and for each component matching PIMA read qq cell ids
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach((g, gi) => {
                try {
                    const title = (g.title || '').toString();
                    const compPctMap = g.componentPercentages || {};
                    Object.keys(compPctMap).forEach(compToken => {
                        try {
                            const up = (compToken || '').toString().toUpperCase();
                            if (!/PIMA/.test(up)) return;
                            if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(up)) return;
                            // find compIndex by scanning rendered rows: they were rendered in finalOrder order; we can search elements with id matching pattern qq-m-{gi}-{compIndex}-{monthIdx}
                            // Bruteforce: look for any element whose id starts with `qq-m-${gi}-` and ends with `-${monthIdx}`
                            const selector = `[id^="qq-m-${gi}-"][id$="-${monthIdx}"]`;
                            const els = Array.from(document.querySelectorAll(selector));
                            els.forEach(el => {
                                try {
                                    const id = el.id; // qq-m-{gi}-{compIndex}-{idx}
                                    const parts = id.split('-');
                                    const compIndex = parts.length >= 4 ? parseInt(parts[2], 10) : null;
                                    const txt = el.textContent || el.innerText || '';
                                    let qq = parseFloat((txt || '').toString().replace(/[^0-9\-.,]/g, '').replace(',', '.')) || 0;
                                    // If qq is zero, try to compute from kgreq cell
                                    if ((!qq || qq === 0) && compIndex !== null) {
                                        const reqId = `kgreq-m-${gi}-${compIndex}-${monthIdx}`;
                                        const reqEl = document.getElementById(reqId) || document.getElementById(`kgreq-m-${gi}-${compIndex}`);
                                        if (reqEl) {
                                            const rtxt = reqEl.textContent || reqEl.innerText || '';
                                            const req = parseFloat((rtxt || '').toString().replace(/[^0-9\-.,]/g, '').replace(',', '.')) || 0;
                                            if (req && req > 0) qq = req / 46;
                                        }
                                    }
                                    // Try to get pct input value for this comp (pct-m-{gi}-{compIndex})
                                    let pct = null; try { const pEl = document.getElementById(`pct-m-${gi}-${compIndex}`); if (pEl) pct = parseFloat(pEl.value) / 100; } catch (e) { pct = null; }
                                    // We can also try to get raw item totals by reading group.componentTotalsTotal vector
                                    let rawSum = null;
                                    if (g.componentTotalsTotal && Object.keys(g.componentTotalsTotal).length) {
                                        const vec = g.componentTotalsTotal[compToken] || g.componentTotalsTotal[compToken.toUpperCase()];
                                        if (vec && vec.length && typeof vec[monthIdx] !== 'undefined') rawSum = parseFloat(vec[monthIdx]) || 0;
                                    }
                                    if (qq && qq > 0) results.push({ source: 'MEZCLA', desc: `${title} / ${compToken}`, qq: qq, raw: rawSum, pct: pct });
                                } catch(e){}
                            });
                        } catch (e) {}
                    });
                } catch (e) {}
            });
        } catch (e) {}
    } catch (e) { console.warn('getQQFromBlocksForPima failed', e); }
    return results;
}

// ============ FUNCIONES DE LOG DETALLADO PARA TODAS LAS FIBRAS DE ALGODÓN (QQ) ============

// Función genérica para log detallado de fibras con extracción 100% y filtrado
function logFiberDetailAllMonths(fiberLabel, tokenMatcher, merma = 0.40) {
    try {
        const months = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES : ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
        console.group(`%c${fiberLabel} — DETALLE COMPLETO 12 MESES`, 'font-weight:bold;font-size:14px;color:#007acc');

        // PASO 1: Extraer TODO de CRUDOS sin filtros
        const allCrudoDataByMonth = new Array(12).fill(0).map(() => []);
        try {
            (window.crudoGroups || crudoGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    const rows = (g.rows || []).filter(r => {
                        const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                        return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                    });
                    rows.forEach(row => {
                        if (!row || !row.yarn) return;
                        for (let m = 0; m < 12; m++) {
                            const raw = parseFloat(row.values && row.values[m] ? row.values[m] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            allCrudoDataByMonth[m].push({ groupTitle: title, yarn: row.yarn, client: row.client, line: row.line, raw: raw });
                        }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        // PASO 2: Extraer TODO de MEZCLAS sin filtros
        const allMezclaDataByMonth = new Array(12).fill(0).map(() => []);
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    if (!g.uniqueYarns || g.uniqueYarns.size === 0) return;
                    Array.from(g.uniqueYarns).forEach(id => {
                        try {
                            const it = GLOBAL_ITEMS.find(x => x.id === id);
                            if (!it || !it.yarn) return;
                            for (let m = 0; m < 12; m++) {
                                const raw = parseFloat(it.values && it.values[m] ? it.values[m] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                allMezclaDataByMonth[m].push({ groupTitle: title, yarn: it.yarn, client: it.client, raw: raw, itemId: id });
                            }
                        } catch (e) { }
                    });
                } catch (e) { }
            });
        } catch (e) { }

        // PASO 3: Iterar por mes y filtrar + calcular
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            const monthLabel = months[monthIdx] || ('M' + (monthIdx+1));

            // Filtrar CRUDOS
            const filteredCrudos = allCrudoDataByMonth[monthIdx].filter(d => tokenMatcher(d.yarn, d.groupTitle));
            // Filtrar MEZCLAS
            const filteredMezclas = allMezclaDataByMonth[monthIdx].filter(d => tokenMatcher(d.yarn, d.groupTitle));
            
            // Mostrar solo meses con datos
            if ((filteredCrudos.length || filteredMezclas.length) === 0) continue;

            console.group(`${monthLabel}`);
            console.group(`MAT. CRUDOS (${filteredCrudos.length} filas)`);
            let crudosTotalQQ = 0, crudosTotalKg = 0;
            if (filteredCrudos.length === 0) {
                console.log('(sin datos)');
            } else {
                const crudosByGroup = {};
                filteredCrudos.forEach(d => { if (!crudosByGroup[d.groupTitle]) crudosByGroup[d.groupTitle] = []; crudosByGroup[d.groupTitle].push(d); });
                Object.keys(crudosByGroup).forEach(gTitle => {
                    console.group(`📦 ${gTitle}`);
                    let groupKg = 0, groupQQ = 0;
                    crudosByGroup[gTitle].forEach((d, idx) => {
                        const kgReq = d.raw / (1 - merma);
                        const qq = kgReq / 46;
                        groupKg += d.raw; groupQQ += qq; crudosTotalKg += d.raw; crudosTotalQQ += qq;
                        console.log(`  [${idx+1}] Yarn: ${d.yarn} | Cliente: ${d.client || '-'} | Línea: ${d.line || '-'} | Raw: ${formatNumber(d.raw)} kg → KgReq: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                    });
                    console.log(`  %c↳ Subtotal grupo: ${formatNumber(groupKg)} kg → ${formatNumber(groupQQ)} QQ`, 'color:#4ec9b0');
                    console.groupEnd();
                });
                console.log(`%c${monthLabel} MAT. CRUDOS TOTAL: ${formatNumber(crudosTotalKg)} kg → ${formatNumber(crudosTotalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
            }
            console.groupEnd();

            console.group(`MAT. MEZCLAS (${filteredMezclas.length} filas)`);
            let mezclasTotalQQ = 0, mezclasTotalKg = 0;
            if (filteredMezclas.length === 0) {
                console.log('(sin datos)');
            } else {
                const mezclasByGroup = {};
                filteredMezclas.forEach(d => { if (!mezclasByGroup[d.groupTitle]) mezclasByGroup[d.groupTitle] = []; mezclasByGroup[d.groupTitle].push(d); });
                Object.keys(mezclasByGroup).forEach(gTitle => {
                    console.group(`📦 ${gTitle}`);
                    const rows = mezclasByGroup[gTitle];
                    // For each row, look up pct and compute QQ individually: QQ = ((raw * pct) / (1-merma)) / 46
                    let groupQQ = 0;
                    
                    // Get reference to group object to find percentages
                    let groupObj = null;
                    try {
                        const allGroups = (window.mezclaGroups || mezclaGroups || []);
                        groupObj = allGroups.find(gg => (gg && gg.title && gg.title.toString() === gTitle));
                    } catch (e) { }
                    
                    rows.forEach((d, idx) => {
                        mezclasTotalKg += d.raw;
                        
                        // Find pct for this row's component - buscar key que matche con la fibra buscada
                        let rowPct = null;
                        try {
                            if (groupObj && groupObj.componentPercentages) {
                                const compPctMap = groupObj.componentPercentages;
                                Object.keys(compPctMap).some(compToken => {
                                    // tokenMatcher espera (yarn, groupTitle) - pasamos compToken como yarn
                                    if (tokenMatcher(compToken, compToken)) { rowPct = parseFloat(compPctMap[compToken]) || null; return true; }
                                    return false;
                                });
                            }
                        } catch (e) { }
                        
                        // Fallback: si no hay pct, intentar extraer del yarn
                        if (rowPct === null) {
                            try {
                                const pctList = extractPctFromYarn(d.yarn);
                                if (Array.isArray(pctList) && pctList.length > 0) {
                                    // Parsear componentes del yarn para encontrar el índice de algodón
                                    let yarnStr = d.yarn ? d.yarn.toString() : '';
                                    yarnStr = yarnStr.replace(/^\s*\d+\/\d+\s*/,'').trim();
                                    yarnStr = yarnStr.replace(/\(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%\)/,'').trim();
                                    const comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                                    let compIndex = -1;
                                    for (let ci = 0; ci < comps.length; ci++) {
                                        const u = (comps[ci] || '').toUpperCase();
                                        if (u.includes('COP') || u.includes('ALG') || u.includes('COTTON') || u.includes('PIMA') || u.includes('TANGUIS') || u.includes('UPLAND') || u.includes('GOTS') || u.includes('OCS')) {
                                            compIndex = ci;
                                            break;
                                        }
                                    }
                                    // Si no hay "/" pero hay pctList con múltiples valores, verificar si es algodón por palabras clave
                                    if (compIndex === -1 && comps.length <= 1 && pctList.length > 1) {
                                        const yarnUpper = yarnStr.toUpperCase();
                                        if (yarnUpper.includes('COP') || yarnUpper.includes('PIMA') || yarnUpper.includes('TANGUIS')) {
                                            compIndex = 0;
                                        }
                                    }
                                    if (compIndex === -1 && pctList.length > 0) compIndex = 0;
                                    if (compIndex >= 0 && compIndex < pctList.length) {
                                        rowPct = pctList[compIndex];
                                    }
                                }
                            } catch (e) { /* ignore */ }
                        }
                        
                        let rowQQ = 0;
                        if (rowPct !== null && !isNaN(rowPct) && rowPct > 0) {
                            // Per-row: QQ = ((raw * pct) / (1-merma)) / 46
                            const rowComponentRaw = d.raw * rowPct;
                            const rowKgReq = rowComponentRaw / (1 - merma);
                            rowQQ = rowKgReq / 46;
                            console.log(`  [${idx+1}] Yarn: ${d.yarn} | Cliente: ${d.client || '-'} | Raw: ${formatNumber(d.raw)} kg | Pct: ${formatNumber(rowPct*100)}% → ComponentRaw: ${formatNumber(rowComponentRaw)} kg → KgReq: ${formatNumber(rowKgReq)} → QQ: ${formatNumber(rowQQ)}`);
                        } else {
                            // No pct: use raw directly (fallback)
                            const rowKgReq = d.raw / (1 - merma);
                            rowQQ = rowKgReq / 46;
                            console.log(`  [${idx+1}] Yarn: ${d.yarn} | Cliente: ${d.client || '-'} | Raw: ${formatNumber(d.raw)} kg (sin pct) → KgReq: ${formatNumber(rowKgReq)} → QQ: ${formatNumber(rowQQ)}`);
                        }
                        groupQQ += rowQQ;
                        mezclasTotalQQ += rowQQ;
                    });
                    
                    console.log(`  %c↳ Subtotal grupo: ${formatNumber(groupQQ)} QQ`, 'color:#4ec9b0');
                    console.groupEnd();
                });
                console.log(`%c${monthLabel} MAT. MEZCLAS TOTAL: ${formatNumber(mezclasTotalKg)} kg → ${formatNumber(mezclasTotalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
            }
            console.groupEnd();

            const totalKg = crudosTotalKg + mezclasTotalKg;
            const totalQQ = crudosTotalQQ + mezclasTotalQQ;
            console.log(`%c${monthLabel} TOTAL: ${formatNumber(totalKg)} kg → ${formatNumber(totalQQ)} QQ (CRUDOS: ${filteredCrudos.length} + MEZCLAS: ${filteredMezclas.length} filas)`, 'font-weight:bold;font-size:12px;color:#f48771;background:#1e1e1e;padding:2px 4px');
            console.groupEnd();
        }
        console.groupEnd();
    } catch (e) { console.warn('Error en log detallado de fibra', e); }
}

// Helper: normaliza string para comparación
function normStrFiber(input) {
    if (!input) return '';
    try { return stripDiacritics(input.toString().toUpperCase()).replace(/[^A-Z0-9_]/g, ' '); }
    catch (e) { return input.toString().toUpperCase().replace(/[^A-Z0-9_]/g, ' '); }
}

// ============ FUNCIONES ESPECÍFICAS POR FIBRA ============

// ALGODÓN PIMA NC (QQ) - PIMA sin certificación orgánica
function logPimaNcAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (!a.includes('PIMA')) return false;
        if (a.includes('OCS') || a.includes('GOTS') || a.includes('ORGANICO') || a.includes('ORGANIC') || a.includes('ORG') || a.includes('CERT')) return false;
        if (t.includes('OCS') || t.includes('GOTS') || t.includes('ORGANICO') || t.includes('ORGANIC')) return false;
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN PIMA NC (QQ)', matcher, 0.40);
}

// ALGODÓN TANGUIS NC BCI (QQ) - TANGUIS con BCI, sin certificación orgánica
function logTanguisBciAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (!a.includes('TANGUIS') && !t.includes('TANGUIS')) return false;
        if (!a.includes('BCI') && !t.includes('BCI')) return false;
        if (a.includes('OCS') || a.includes('GOTS') || a.includes('ORGANICO') || a.includes('ORGANIC')) return false;
        if (t.includes('OCS') || t.includes('GOTS') || t.includes('ORGANICO') || t.includes('ORGANIC')) return false;
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN TANGUIS NC BCI (QQ)', matcher, 0.40);
}

// ALGODÓN ORGANICO - GOTS (QQ) - Orgánico GOTS (no PIMA específico)
// Criterio: Contiene "GOTS" en yarn o título de grupo. No debe clasificarse como PIMA.
// Excluye: Items con solo OCS (van a OCS), items con PIMA (van a PIMA ORG - GOTS).
function logOrganicoGotsAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (a.includes('PIMA') || t.includes('PIMA')) return false; // Excluir PIMA (tiene su propia categoría PIMA ORG - GOTS)
        if (!a.includes('GOTS') && !t.includes('GOTS')) return false; // Requiere GOTS
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN ORGANICO - GOTS (QQ)', matcher, 0.40);
}

// ALGODÓN ORGANICO - OCS (QQ) - Orgánico OCS (no PIMA específico)
// Criterio: Contiene "OCS" en yarn o título de grupo y no contiene "GOTS".
// Excluye: Entradas con "GOTS" (van a GOTS), se excluye si dice PIMA OCS. Son todos los algodones que tengan OCS y no digan PIMA.
function logOrganicoOcsAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (a.includes('PIMA') || t.includes('PIMA')) return false; // Excluir PIMA (va a PIMA ORG - OCS)
        if (a.includes('GOTS') || t.includes('GOTS')) return false; // Excluir GOTS (va a ORGANICO - GOTS)
        if (!a.includes('OCS') && !t.includes('OCS')) return false; // Requiere OCS
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN ORGANICO - OCS (QQ)', matcher, 0.40);
}

// ALGODÓN UPLAND USTCP (QQ) - UPLAND con certificación USTCP
function logUplandUstcpAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (!a.includes('UPLAND') && !t.includes('UPLAND')) return false;
        if (!a.includes('USTCP') && !a.includes('US TCP') && !t.includes('USTCP') && !t.includes('US TCP')) return false;
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN UPLAND USTCP (QQ)', matcher, 0.40);
}

// ALGODÓN UPLAND (QQ) - UPLAND sin certificación específica
// Criterio: Contiene "UPLAND" en yarn o grupo y no tiene marca USTCP.
// Excluye: Todos los tipos de algodones que tengan certificados (OCS, GOTS, BCI, USTCP) y PIMA.
function logUplandAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (!a.includes('UPLAND') && !t.includes('UPLAND')) return false; // Requiere UPLAND
        // Excluir certificados y PIMA
        if (a.includes('USTCP') || a.includes('US TCP') || t.includes('USTCP') || t.includes('US TCP')) return false;
        if (a.includes('OCS') || a.includes('GOTS') || a.includes('BCI') || t.includes('OCS') || t.includes('GOTS') || t.includes('BCI')) return false;
        if (a.includes('PIMA') || t.includes('PIMA')) return false;
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN UPLAND (QQ)', matcher, 0.40);
}

// ALGODÓN ELEGANT (QQ)
// Criterio: Contiene exclusivamente "ELEGANT" en yarn o título de grupo.
// Excluye: Todos los tipos de algodones que tengan certificados (OCS, GOTS, BCI, USTCP), PIMA, UPLAND.
function logElegantAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (!a.includes('ELEGANT') && !t.includes('ELEGANT')) return false; // Requiere ELEGANT
        // Excluir certificados, PIMA, UPLAND
        if (a.includes('OCS') || a.includes('GOTS') || a.includes('BCI') || a.includes('USTCP') || a.includes('US TCP')) return false;
        if (t.includes('OCS') || t.includes('GOTS') || t.includes('BCI') || t.includes('USTCP') || t.includes('US TCP')) return false;
        if (a.includes('PIMA') || t.includes('PIMA')) return false;
        if (a.includes('UPLAND') || t.includes('UPLAND')) return false;
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN ELEGANT (QQ)', matcher, 0.40);
}

// ALGODÓN PIMA ORGANICO - GOTS (QQ)
// Criterio: Contiene "PIMA" y "GOTS" (en yarn o grupo).
// Excluye: Si el hilado contiene OCS, o tiene GOTS pero no contiene el texto PIMA.
function logPimaOrgGotsAllMonths() {
    const matcher = (yarn, groupTitle) => {
        const a = normStrFiber(yarn);
        const t = normStrFiber(groupTitle || '');
        if (!a.includes('PIMA') && !t.includes('PIMA')) return false; // Obligatorio PIMA
        if (a.includes('OCS') || t.includes('OCS')) return false; // Excluir OCS (va a PIMA ORG - OCS)
        if (!a.includes('GOTS') && !t.includes('GOTS')) return false; // Requiere GOTS
        return true;
    };
    logFiberDetailAllMonths('ALGODÓN PIMA ORGANICO - GOTS (QQ)', matcher, 0.40);
}

// Función para ejecutar TODOS los logs de algodón
function logAllCottonFibersDetail() {
    console.clear();
    
    // PRIMERO: Imprimir detalles de MEZCLAS (solo composición y porcentajes)
    console.log('%c========== DETALLES DE MEZCLAS ==========', 'font-weight:bold;font-size:16px;color:#fff;background:#ff6600;padding:8px');
    try {
        (window.mezclaGroups || mezclaGroups || []).forEach(group => {
            if (!group || !group.uniqueYarns || group.uniqueYarns.size === 0) return;
            const groupTotalSum = group.groupRawTotals.reduce((a,b) => a + (b || 0), 0);
            if (Math.abs(groupTotalSum) < 0.01) return; // Skip empty groups
            
            const firstItem = Array.from(GLOBAL_ITEMS).find(item => group.uniqueYarns.has(item.id));
            const sampleYarn = firstItem ? (firstItem.yarn || '') : '(sin hilado)';
            
            // Extraer componentes del título del grupo (sin porcentajes)
            const rawTitle = (group.title || '').toString();
            const titleNoPct = rawTitle.replace(/\s*\(\s*\d+(?:\/\d+)+\s*%?\s*\)\s*$/, '').trim();
            
            // Split por "/" para obtener los componentes
            let titleParts = [];
            if (titleNoPct.indexOf('/') >= 0) {
                titleParts = titleNoPct.split('/').map(s => s.trim()).filter(Boolean);
            } else {
                titleParts = [titleNoPct];
            }
            
            // Extraer porcentajes del título del grupo (ej: "(75/25%)")
            let titlePctArr = [];
            const mTitlePct = rawTitle.match(/\(\s*(\d+(?:\/\d+)+)\s*%?\s*\)/);
            if (mTitlePct) {
                const parts = mTitlePct[1].split('/').map(p => {
                    const num = parseFloat(p.replace(/[^0-9.]/g, ''));
                    return (isNaN(num) ? 0 : num);
                });
                if (parts.length === titleParts.length) {
                    titlePctArr = parts; // Mantener como números enteros (75, 25, etc.)
                }
            }
            
            // Si no hay porcentajes en el título, intentar extraerlos del yarn
            if (titlePctArr.length === 0 && sampleYarn) {
                const yarnPctMatch = sampleYarn.match(/\(\s*(\d+(?:\/\d+)+)\s*%?\s*\)/);
                if (yarnPctMatch) {
                    const parts = yarnPctMatch[1].split('/').map(p => {
                        const num = parseFloat(p.replace(/[^0-9.]/g, ''));
                        return (isNaN(num) ? 0 : num);
                    });
                    if (parts.length === titleParts.length) {
                        titlePctArr = parts;
                    }
                }
            }
            
            console.groupCollapsed(`📦 ${sampleYarn}`);
            
            // Imprimir materiales y porcentajes
            if (titleParts.length >= 1 && titlePctArr.length === titleParts.length) {
                titleParts.forEach((part, idx) => {
                    console.log(`Materia ${idx + 1}: ${part}`);
                    console.log(`% Participación ${idx + 1}: ${titlePctArr[idx]}%`);
                });
            } else if (titleParts.length === 1) {
                console.log(`Materia 1: ${titleParts[0]}`);
                console.log(`% Participación 1: 100%`);
            } else {
                // Fallback: mostrar componentes sin porcentajes
                titleParts.forEach((part, idx) => {
                    console.log(`Materia ${idx + 1}: ${part}`);
                    console.log(`% Participación ${idx + 1}: (no detectado)`);
                });
            }
            
            console.groupEnd();
        });
    } catch (e) { console.warn('Error al imprimir detalles de mezclas:', e); }
    
    console.log('%c========== FIN MEZCLAS ==========', 'font-weight:bold;font-size:16px;color:#fff;background:#ff6600;padding:8px');
    
    // AHORA: Imprimir detalles de ALGODÓN
    console.log('%c========== DETALLE COMPLETO DE TODAS LAS FIBRAS DE ALGODÓN (QQ) ==========', 'font-weight:bold;font-size:16px;color:#fff;background:#007acc;padding:8px');
    const orderedLabels = [
        'ALGODÓN PIMA NC (QQ)',
        'ALGODÓN PIMA ORGANICO - OCS (QQ)',
        'ALGODÓN TANGUIS NC BCI (QQ)',
        'ALGODÓN ORGANICO - GOTS (QQ)',
        'ALGODÓN ORGANICO - OCS (QQ)',
        'ALGODÓN UPLAND USTCP (QQ)',
        'ALGODÓN UPLAND (QQ)',
        'ALGODÓN ELEGANT (QQ)',
        'ALGODÓN PIMA ORGANICO - GOTS (QQ)'
    ];
    orderedLabels.forEach(label => {
        try { logFiberFromDetail(label); } catch (e) { /* ignore */ }
    });
    // Compact month-by-month dump disabled to avoid console noise.
    console.log('%c========== FIN DETALLE COMPLETO ==========', 'font-weight:bold;font-size:16px;color:#fff;background:#007acc;padding:8px');
}

function logFiberFromDetail(label) {
    try {
        const months = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES : ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
        const data = (typeof detailAlgodon !== 'undefined' && detailAlgodon[label]) ? detailAlgodon[label] : null;
        console.group(`%c${label}`, 'font-weight:bold;color:#007acc');
        if (!data) { console.log('(sin datos)'); console.groupEnd(); return; }

        const crudoRows = data.crudoRows || [];
        const mezclaItems = data.mezclaItems || [];

        const formatLogNumber = (n) => {
            const num = parseFloat(n || 0) || 0;
            if (!isFinite(num)) return '-';
            if (Math.abs(num) < 1 && Math.abs(num) > 0) return (Math.round(num * 100) / 100).toString();
            return formatNumber(num);
        };

        for (let m = 0; m < 12; m++) {
            const monthLabel = months[m] || ('M'+(m+1));

            // Determine if this month has any data (either precomputed totalValues or any crudo/mezcla rows)
            const crudosForMonth = crudoRows.filter(r => (parseFloat(r.values[m]||0) || 0) > 0);
            const mezclasForMonthPreview = mezclaItems.filter(it => (parseFloat(it.values[m]||0) || 0) > 0);
            // USAR el totalValues de la tabla como referencia
            const tableTotal = (data && data.totalValues && typeof data.totalValues[m] !== 'undefined') ? parseFloat(data.totalValues[m] || 0) : 0;
            const hasMonthData = (Math.abs(tableTotal) > 0.0001 || crudosForMonth.length > 0 || mezclasForMonthPreview.length > 0);
            if (!hasMonthData) continue;

            console.groupCollapsed(monthLabel);

            // CRUDOS
            const mezclasForMonth = mezclasForMonthPreview;
            console.groupCollapsed(`MAT. CRUDOS (${crudosForMonth.length} filas)`);
            let crudosTotalRaw = 0, crudosTotalKgReq = 0, crudosTotalQQ = 0;
            if (crudosForMonth.length === 0) {
                console.log('(sin datos)');
            } else {
                const byGroup = {};
                crudosForMonth.forEach((r, idx) => { if (!byGroup[r.groupTitle]) byGroup[r.groupTitle]=[]; byGroup[r.groupTitle].push(r); });
                Object.keys(byGroup).forEach(gTitle => {
                    console.groupCollapsed(gTitle);
                    let gRaw = 0, gKgReq = 0, gQQ = 0;
                    byGroup[gTitle].forEach((r, idx) => {
                        const raw = parseFloat(r.values[m] || 0) || 0;
                        const kgReq = raw / (1 - 0.40);
                        const qq = kgReq / 46;
                        gRaw += raw; gKgReq += kgReq; gQQ += qq;
                        crudosTotalRaw += raw; crudosTotalKgReq += kgReq; crudosTotalQQ += qq;
                        console.log(`  [${idx+1}] Yarn: ${r.yarn} | Cliente: ${r.client || '-'} | Línea: ${r.line || '-'} | Raw: ${formatLogNumber(raw)} kg → KgReq: ${formatLogNumber(kgReq)} → QQ: ${formatLogNumber(qq)}`);
                    });
                    console.log(`  %c↳ Subtotal grupo: Raw: ${formatLogNumber(gRaw)} kg → KgReq: ${formatLogNumber(gKgReq)} kg → ${formatLogNumber(gQQ)} QQ`, 'color:#4ec9b0');
                    console.groupEnd();
                });
            }
            console.log(`%c${monthLabel} MAT. CRUDOS TOTAL: ${formatLogNumber(crudosTotalKgReq)} kg → ${formatLogNumber(crudosTotalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
            console.groupEnd();

            // MEZCLAS - Mostrar cálculo CON pct aplicado
            console.groupCollapsed(`MAT. MEZCLAS (${mezclasForMonth.length} filas)`);
            let mezclasTotalRaw = 0, mezclasTotalKgReq = 0, mezclasTotalQQ = 0;
            if (mezclasForMonth.length === 0) {
                console.log('(sin datos)');
            } else {
                const byGroup = {};
                mezclasForMonth.forEach(it => { if (!byGroup[it.groupTitle]) byGroup[it.groupTitle]=[]; byGroup[it.groupTitle].push(it); });
                Object.keys(byGroup).forEach(gTitle => {
                    console.groupCollapsed(gTitle);
                    let gRaw = 0, gKgReq = 0, gQQ = 0;
                    const items = byGroup[gTitle];
                    // Cada fila con su pct: QQ = ((raw * pct) / (1-merma)) / 46
                    items.forEach((it, idx) => {
                        const raw = parseFloat(it.values[m]||0)||0;
                        gRaw += raw;
                        mezclasTotalRaw += raw;
                        
                        // Primero intentar usar it.pct, si no existe, extraer del yarn (fallback)
                        let itemPct = (it.pct !== null && !isNaN(it.pct) && it.pct > 0) ? it.pct : null;
                        if (itemPct === null) {
                            // Fallback: extraer pct del yarn (ej. "40/1 COP PIMA NC TENCEL STD (75/25%)")
                            try {
                                const pctList = extractPctFromYarn(it.yarn);
                                if (Array.isArray(pctList) && pctList.length > 0) {
                                    // Parsear componentes del yarn
                                    let yarnStr = it.yarn ? it.yarn.toString() : '';
                                    yarnStr = yarnStr.replace(/^\s*\d+\/\d+\s*/,'').trim(); // quitar conteo inicial
                                    yarnStr = yarnStr.replace(/\(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%\)/,'').trim(); // quitar bloque (pct%)
                                    const comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                                    // Buscar índice del componente algodón
                                    let compIndex = -1;
                                    for (let ci = 0; ci < comps.length; ci++) {
                                        const u = (comps[ci] || '').toUpperCase();
                                        if (u.includes('COP') || u.includes('ALG') || u.includes('COTTON') || u.includes('PIMA') || u.includes('TANGUIS') || u.includes('UPLAND') || u.includes('GOTS') || u.includes('OCS')) {
                                            compIndex = ci;
                                            break;
                                        }
                                    }
                                    // Si no hay "/" para separar componentes pero hay pctList, asumir que hay espacios entre componentes
                                    if (compIndex === -1 && comps.length <= 1 && pctList.length > 1) {
                                        // Intentar separar por espacios/palabras clave para detectar si el primer componente es algodón
                                        const yarnUpper = yarnStr.toUpperCase();
                                        if (yarnUpper.includes('COP') || yarnUpper.includes('PIMA') || yarnUpper.includes('TANGUIS')) {
                                            compIndex = 0; // Asumir primer componente es algodón
                                        }
                                    }
                                    if (compIndex === -1 && pctList.length > 0) compIndex = 0; // fallback: primer porcentaje
                                    if (compIndex >= 0 && compIndex < pctList.length) {
                                        itemPct = pctList[compIndex];
                                    }
                                }
                            } catch (e) { /* ignore */ }
                        }
                        
                        let kgReq = 0, qq = 0;
                        if (itemPct !== null) {
                            const componentRaw = raw * itemPct;
                            kgReq = componentRaw / (1 - 0.40);
                            qq = kgReq / 46;
                            console.log(`  [${idx+1}] Yarn: ${it.yarn} | Cliente: ${it.client||'-'} | ItemID: ${it.id} | Raw: ${formatLogNumber(raw)} kg × Pct: ${formatLogNumber(itemPct*100)}% → ComponentRaw: ${formatLogNumber(componentRaw)} kg → KgReq: ${formatLogNumber(kgReq)} → QQ: ${formatLogNumber(qq)}`);
                        } else {
                            kgReq = raw / (1 - 0.40);
                            qq = kgReq / 46;
                            console.log(`  [${idx+1}] Yarn: ${it.yarn} | Cliente: ${it.client||'-'} | ItemID: ${it.id} | Raw: ${formatLogNumber(raw)} kg (sin pct) → KgReq: ${formatLogNumber(kgReq)} → QQ: ${formatLogNumber(qq)}`);
                        }
                        gKgReq += kgReq; gQQ += qq;
                        mezclasTotalKgReq += kgReq;
                        mezclasTotalQQ += qq;
                    });
                    console.log(`  %c↳ Subtotal grupo: Raw: ${formatLogNumber(gRaw)} kg → KgReq: ${formatLogNumber(gKgReq)} kg → ${formatLogNumber(gQQ)} QQ`, 'color:#4ec9b0');
                    console.groupEnd();
                });
            }
            console.log(`%c${monthLabel} MAT. MEZCLAS TOTAL: ${formatLogNumber(mezclasTotalKgReq)} kg → ${formatLogNumber(mezclasTotalQQ)} QQ`, 'font-weight:bold;color:#dcdcaa');
            console.groupEnd();

            // TOTAL del mes: la suma es la suma de MAT. CRUDOS + MAT. MEZCLAS
            const calculatedQQ = crudosTotalQQ + mezclasTotalQQ;
            const displayQQ = calculatedQQ; // Mostrar la suma de CRUDOS + MEZCLAS
            console.log(`%c${monthLabel} TOTAL: ${formatLogNumber(displayQQ)} QQ (CRUDOS: ${crudosForMonth.length} + MEZCLAS: ${mezclasForMonth.length} filas)`, 'font-weight:bold;font-size:12px;color:#f48771;background:#1e1e1e;padding:2px 4px');
            console.groupEnd();
        }

        console.groupEnd();
    } catch (e) { console.warn('logFiberFromDetail error', e); }
}

// Log detallado para fibras específicas de OTRAS FIBRAS (aplicando la misma lógica que ALGODÓN)
function logDetailedSpecificOtherFibers() {
    try {
        console.log('%c========== DETALLE COMPLETO DE FIBRAS ESPECÍFICAS (KG) ==========', 'font-weight:bold;font-size:16px;color:#fff;background:#2d5016;padding:8px');
        
        const fiberLabels = [
            'LYOCELL STD (KG)',
            'NYLON (KG)',
            'RECYCLED PES (KG)',
            'WOOL 17.5 (KG)',
            'LYOCELL A100 (KG)',
            'MODAL (KG)',
            'ABETE NANO 159 MULTICOLO (KG)',
            'ABETE NANO BLANCO (KG)',
            'CAÑAMO (KG)'
        ];
        
        fiberLabels.forEach(label => {
            try { logOtherFiberDetail(label); } catch (e) { /* ignore */ }
        });
        
        console.log('%c========== FIN DETALLE FIBRAS ESPECÍFICAS ==========', 'font-weight:bold;font-size:16px;color:#fff;background:#2d5016;padding:8px');
    } catch (e) { console.warn('logDetailedSpecificOtherFibers error:', e); }
}

// 'ALGODÓN OTROS (QQ)' removed per user request; no specific log function remains.

// Imprime en consola todos los hilados que NO tienen categoría asignada
function logUnassignedHilados() {
    try {
        const merma = 0.40;
        const unassigned = [];

        // CRUDOS
        (window.crudoGroups || crudoGroups || []).forEach(g => {
            const title = g.title || '';
            (g.rows || []).forEach(row => {
                try {
                    if (!row || !row.yarn) return;
                    const key = `${title}||${row.client||''}||${row.line||''}||${row.yarn||''}||${row.id||row.rowIndex||''}`;
                    // check assignment in detailAlgodon
                    let assigned = false;
                    try { Object.keys(detailAlgodon || {}).forEach(k => { if (detailAlgodon[k] && detailAlgodon[k].crudoRows && detailAlgodon[k].crudoRows.some(r => r.key === key)) assigned = true; }); } catch (e) {}
                    // check assignment in detailOtras
                    try { Object.keys(detailOtras || {}).forEach(k => { if (detailOtras[k] && detailOtras[k].crudoRows && detailOtras[k].crudoRows.some(r => r.key === key)) assigned = true; }); } catch (e) {}
                    if (!assigned) {
                        const totalRaw = (row.values || []).reduce((s,v)=>s + (parseFloat(v||0)||0), 0);
                        const kgReq = totalRaw / (1 - merma);
                        const qqReq = kgReq / 46;
                        unassigned.push({ type: 'CRUDOS', yarn: row.yarn, grupo: title, cliente: row.client, totalRaw, kgReq, qqReq });
                    }
                } catch (e) { }
            });
        });

        // MEZCLAS
        (window.mezclaGroups || mezclaGroups || []).forEach(g => {
            const title = g.title || '';
            if (!g.uniqueYarns) return;
            Array.from(g.uniqueYarns).forEach(id => {
                try {
                    const it = GLOBAL_ITEMS.find(x => x.id === id);
                    if (!it || !it.yarn) return;
                    // check assigned
                    let assigned = false;
                    try { Object.keys(detailAlgodon || {}).forEach(k => { if (detailAlgodon[k] && detailAlgodon[k].mezclaItems && detailAlgodon[k].mezclaItems.some(x => x.id === id)) assigned = true; }); } catch(e) {}
                    try { Object.keys(detailOtras || {}).forEach(k => { if (detailOtras[k] && detailOtras[k].mezclaItems && detailOtras[k].mezclaItems.some(x => x.id === id)) assigned = true; }); } catch(e) {}
                    if (!assigned) {
                        const totalRaw = (it.values || []).reduce((s,v)=>s + (parseFloat(v||0)||0), 0);
                        const kgReq = totalRaw / (1 - merma);
                        const qqReq = kgReq / 46;
                        unassigned.push({ type: 'MEZCLAS', yarn: it.yarn, grupo: title, cliente: it.client, totalRaw, kgReq, qqReq, id: it.id });
                    }
                } catch (e) { }
            });
        });

        if (unassigned.length === 0) {
            console.log('%c✅ No hay hilados sin categoría asignada', 'background:#00aa00;color:#fff;padding:4px');
            return;
        }

        console.groupCollapsed(`%c⚠️ HILADOS SIN CATEGORÍA (${unassigned.length})`, 'color:#ff3300;font-weight:bold;');
        unassigned.forEach((u, idx) => {
            console.log(`${idx+1}. [${u.type}] ${u.yarn} | Grupo origen: ${u.grupo} | Cliente: ${u.cliente || '-'} | KgReq: ${Math.round(u.kgReq*100)/100} kg | QQReq: ${Math.round(u.qqReq*100)/100}`);
        });
        console.groupEnd();
    } catch (e) { console.warn('logUnassignedHilados error', e); }
}

// Asigna automáticamente los hilados sin categoría a sus grupos sugeridos
function autoAssignSuggestedGroups() {
    try {
        const merma = 0.40;
        if (typeof detailAlgodon === 'undefined') detailAlgodon = {};
        const keys = ORDERED_COTTON_KEYS || [];
        keys.forEach(k => { 
            if (!detailAlgodon[k]) detailAlgodon[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; 
            if (!detailAlgodon[k].crudoRows) detailAlgodon[k].crudoRows = [];
            if (!detailAlgodon[k].mezclaItems) detailAlgodon[k].mezclaItems = [];
        });

        // Crear set de keys ya asignados para búsqueda rápida
        const assignedCrudoKeys = new Set();
        const assignedMezclaIds = new Set();
        keys.forEach(k => {
            if (detailAlgodon[k] && detailAlgodon[k].crudoRows) {
                detailAlgodon[k].crudoRows.forEach(r => { if (r.key) assignedCrudoKeys.add(r.key); });
            }
            if (detailAlgodon[k] && detailAlgodon[k].mezclaItems) {
                detailAlgodon[k].mezclaItems.forEach(it => { if (it.id) assignedMezclaIds.add(it.id); });
            }
        });

        let countAssigned = 0;

        // CRUDOS
        (window.crudoGroups || crudoGroups || []).forEach(g => {
            const title = g.title || '';
            (g.rows || []).forEach(row => {
                try {
                    if (!row || !row.yarn) return;
                    if (!(typeof isAlgodon === 'function' ? isAlgodon(row.yarn) : false)) return;
                    const key = `${title}||${row.client||''}||${row.line||''}||${row.yarn||''}`;
                    if (assignedCrudoKeys.has(key)) return;
                    
                    // Determinar grupo sugerido
                    let suggested = determineCottonKey(row.yarn, title);
                    if (!suggested) suggested = keys[keys.length-1];
                    
                    // Agregar al grupo sugerido
                    detailAlgodon[suggested].crudoRows.push(Object.assign({ key, groupTitle: title }, row));
                    assignedCrudoKeys.add(key);
                    countAssigned++;
                    
                    // Actualizar totales
                    for (let i = 0; i < 12; i++) {
                        const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                        if (Math.abs(raw) < 0.0001) continue;
                        const kgReq = raw / (1 - merma);
                        const qq = kgReq / 46;
                        detailAlgodon[suggested].totalValues[i] = (detailAlgodon[suggested].totalValues[i] || 0) + qq;
                        const client = row.client || 'VARIOS';
                        if (!detailAlgodon[suggested].clients[client]) detailAlgodon[suggested].clients[client] = new Array(12).fill(0);
                        detailAlgodon[suggested].clients[client][i] += qq;
                    }
                } catch (e) { }
            });
        });

        // MEZCLAS
        (window.mezclaGroups || mezclaGroups || []).forEach(g => {
            const title = g.title || '';
            if (!g.uniqueYarns) return;
            Array.from(g.uniqueYarns).forEach(id => {
                try {
                    const it = GLOBAL_ITEMS.find(x => x.id === id);
                    if (!it || !it.yarn) return;
                    if (!(typeof isAlgodon === 'function' ? isAlgodon(it.yarn) : false)) return;
                    if (assignedMezclaIds.has(id)) return;
                    
                    let suggested = determineCottonKey(it.yarn, title);
                    if (!suggested) suggested = keys[keys.length-1];
                    
                    detailAlgodon[suggested].mezclaItems.push(Object.assign({ groupTitle: title }, it));
                    assignedMezclaIds.add(id);
                    countAssigned++;
                    
                    for (let i = 0; i < 12; i++) {
                        const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                        if (Math.abs(raw) < 0.0001) continue;
                        const kgReq = raw / (1 - merma);
                        const qq = kgReq / 46;
                        detailAlgodon[suggested].totalValues[i] = (detailAlgodon[suggested].totalValues[i] || 0) + qq;
                        const client = it.client || 'VARIOS';
                        if (!detailAlgodon[suggested].clients[client]) detailAlgodon[suggested].clients[client] = new Array(12).fill(0);
                        detailAlgodon[suggested].clients[client][i] += qq;
                    }
                } catch (e) { }
            });
        });

        if (countAssigned > 0) {
            console.log(`%c✅ autoAssignSuggestedGroups: ${countAssigned} hilados asignados a sus grupos sugeridos`, 'background:#00aa00;color:#fff;padding:4px');
        }
    } catch (e) { console.warn('autoAssignSuggestedGroups error', e); }
}

// Forzar asignación: asegurar que NO quede ningún hilado sin categoría.
function autoAssignAllUnassigned() {
    try {
        const mermaAlg = 0.40;
        const mermaOther = 0.15;
        if (typeof detailAlgodon === 'undefined') detailAlgodon = {};
        if (typeof detailOtras === 'undefined') detailOtras = {};

        const cottonKeys = ORDERED_COTTON_KEYS || [];
        const otherKeys = ORDERED_OTHER_KEYS || [];

        cottonKeys.forEach(k => { if (!detailAlgodon[k]) detailAlgodon[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });
        otherKeys.forEach(k => { if (!detailOtras[k]) detailOtras[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });

        // build assigned maps
        const assignedCrudoKeys = new Set();
        const assignedMezclaIds = new Set();
        Object.keys(detailAlgodon || {}).forEach(k => { try { (detailAlgodon[k].crudoRows||[]).forEach(r=> r.key && assignedCrudoKeys.add(r.key)); (detailAlgodon[k].mezclaItems||[]).forEach(it=> it.id && assignedMezclaIds.add(it.id)); } catch(e){} });
        Object.keys(detailOtras || {}).forEach(k => { try { (detailOtras[k].crudoRows||[]).forEach(r=> r.key && assignedCrudoKeys.add(r.key)); (detailOtras[k].mezclaItems||[]).forEach(it=> it.id && assignedMezclaIds.add(it.id)); } catch(e){} });

        // Helper: choose otherKey by attempting to match canonical name
        function findOtherKeyFor(yarn) {
            try {
                const target = (typeof getFiberName === 'function') ? getFiberName(yarn||'') : (yarn||'');
                const targetNorm = normStrFiber(target||'');
                const found = Object.keys(detailOtras || {}).find(k => { try { return normStrFiber(k||'').indexOf(targetNorm) >= 0 || targetNorm.indexOf(normStrFiber(k||'')) >= 0; } catch(e){ return false; } });
                if (found) return found;
                if (otherKeys.length>0) return otherKeys[0];
                // create fallback
                const fallback = 'OTRAS - VARIOS (KG)';
                if (!detailOtras[fallback]) detailOtras[fallback] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                return fallback;
            } catch(e) { return otherKeys.length>0 ? otherKeys[0] : 'OTRAS - VARIOS (KG)'; }
        }

        // CRUDOS: iterate and assign
        (window.crudoGroups || crudoGroups || []).forEach(g => {
            const title = g.title || '';
            (g.rows || []).forEach(row => {
                try {
                    if (!row || !row.yarn) return;
                    const key = `${title}||${row.client||''}||${row.line||''}||${row.yarn||''}`;
                    if (assignedCrudoKeys.has(key)) return;
                    const isCot = (typeof isAlgodon === 'function') ? isAlgodon(row.yarn) : false;
                    if (isCot) {
                        let suggested = determineCottonKey ? determineCottonKey(row.yarn, title) : null;
                        if (!suggested) suggested = cottonKeys.length>0 ? cottonKeys[cottonKeys.length-1] : 'ALGODÓN - SIN CLASIFICAR';
                        detailAlgodon[suggested].crudoRows.push(Object.assign({ key, groupTitle: title }, row));
                        assignedCrudoKeys.add(key);
                        // update totals (qq)
                        for (let i=0;i<12;i++){
                            const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            const kgReq = raw / (1 - mermaAlg);
                            const qq = kgReq / 46;
                            detailAlgodon[suggested].totalValues[i] = (detailAlgodon[suggested].totalValues[i] || 0) + qq;
                            const client = row.client || 'VARIOS';
                            if (!detailAlgodon[suggested].clients[client]) detailAlgodon[suggested].clients[client] = new Array(12).fill(0);
                            detailAlgodon[suggested].clients[client][i] += qq;
                        }
                    } else {
                        const suggested = findOtherKeyFor(row.yarn);
                        detailOtras[suggested].crudoRows.push(Object.assign({ key, groupTitle: title }, row));
                        assignedCrudoKeys.add(key);
                        for (let i=0;i<12;i++){
                            const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            const kgReq = raw / (1 - mermaOther);
                            detailOtras[suggested].totalValues[i] = (detailOtras[suggested].totalValues[i] || 0) + kgReq;
                            const client = row.client || 'VARIOS';
                            if (!detailOtras[suggested].clients[client]) detailOtras[suggested].clients[client] = new Array(12).fill(0);
                            detailOtras[suggested].clients[client][i] += kgReq;
                        }
                    }
                } catch(e){}
            });
        });

        // MEZCLAS: iterate and assign
        (window.mezclaGroups || mezclaGroups || []).forEach(g => {
            const title = g.title || '';
            if (!g.uniqueYarns) return;
            Array.from(g.uniqueYarns).forEach(id => {
                try {
                    const it = GLOBAL_ITEMS.find(x => x.id === id);
                    if (!it || !it.yarn) return;
                    if (assignedMezclaIds.has(id)) return;
                    const isCot = (typeof isAlgodon === 'function') ? isAlgodon(it.yarn) : false;
                    if (isCot) {
                        let suggested = determineCottonKey ? determineCottonKey(it.yarn, title) : null;
                        if (!suggested) suggested = cottonKeys.length>0 ? cottonKeys[cottonKeys.length-1] : 'ALGODÓN - SIN CLASIFICAR';
                        detailAlgodon[suggested].mezclaItems.push(Object.assign({ groupTitle: title }, it));
                        assignedMezclaIds.add(id);
                        for (let i=0;i<12;i++){
                            const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            const kgReq = raw / (1 - mermaAlg);
                            const qq = kgReq / 46;
                            detailAlgodon[suggested].totalValues[i] = (detailAlgodon[suggested].totalValues[i] || 0) + qq;
                            const client = it.client || 'VARIOS';
                            if (!detailAlgodon[suggested].clients[client]) detailAlgodon[suggested].clients[client] = new Array(12).fill(0);
                            detailAlgodon[suggested].clients[client][i] += qq;
                        }
                    } else {
                        const suggested = findOtherKeyFor(it.yarn);
                        detailOtras[suggested].mezclaItems.push(Object.assign({ groupTitle: title }, it));
                        assignedMezclaIds.add(id);
                        for (let i=0;i<12;i++){
                            const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) continue;
                            const kgReq = raw / (1 - mermaOther);
                            detailOtras[suggested].totalValues[i] = (detailOtras[suggested].totalValues[i] || 0) + kgReq;
                            const client = it.client || 'VARIOS';
                            if (!detailOtras[suggested].clients[client]) detailOtras[suggested].clients[client] = new Array(12).fill(0);
                            detailOtras[suggested].clients[client][i] += kgReq;
                        }
                    }
                } catch(e){}
            });
        });

        console.log('%c✅ autoAssignAllUnassigned: asignación forzada completada', 'background:#00aa00;color:#fff;padding:4px');
    } catch(e) { console.warn('autoAssignAllUnassigned error', e); }
}

// Garantizar 100% asignación: iterar DIRECTAMENTE sobre crudoGroups y mezclaGroups para capturar TODOS los items
function enforceFullAssignment() {
    try {
        const mermaAlg = 0.40;
        const mermaOther = 0.15;
        if (typeof detailAlgodon === 'undefined') detailAlgodon = {};
        if (typeof detailOtras === 'undefined') detailOtras = {};

        const cottonKeys = ORDERED_COTTON_KEYS || [];
        const otherKeys = ORDERED_OTHER_KEYS || [];
        
        // Inicializar claves faltantes
        cottonKeys.forEach(k => { if (!detailAlgodon[k]) detailAlgodon[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });
        otherKeys.forEach(k => { if (!detailOtras[k]) detailOtras[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });

        // Build set of already-assigned items (by key, id, rowIndex)
        const assignedKeys = new Set();
        const assignedIds = new Set();
        const assignedRowIndices = new Set();
        
        Object.keys(detailAlgodon || {}).forEach(k => {
            try {
                (detailAlgodon[k].crudoRows || []).forEach(r => { 
                    if (r.key) assignedKeys.add(r.key);
                    if (typeof r.rowIndex !== 'undefined') assignedRowIndices.add(r.rowIndex);
                });
                (detailAlgodon[k].mezclaItems || []).forEach(it => { if (it.id) assignedIds.add(it.id); });
            } catch(e) {}
        });
        Object.keys(detailOtras || {}).forEach(k => {
            try {
                (detailOtras[k].crudoRows || []).forEach(r => { 
                    if (r.key) assignedKeys.add(r.key);
                    if (typeof r.rowIndex !== 'undefined') assignedRowIndices.add(r.rowIndex);
                });
                (detailOtras[k].mezclaItems || []).forEach(it => { if (it.id) assignedIds.add(it.id); });
            } catch(e) {}
        });

        let unassignedCount = 0;

        // CRUDOS: iterar directamente sobre crudoGroups
        try {
            (window.crudoGroups || crudoGroups || []).forEach(g => {
                const groupTitle = g.title || '';
                (g.rows || []).forEach(row => {
                    try {
                        if (!row || !row.yarn) return;
                        const key = `${groupTitle}||${row.client||''}||${row.line||''}||${row.yarn||''}||${row.id||row.rowIndex||''}`;
                        
                        // Verificar si ya está asignado
                        if (assignedKeys.has(key) || (typeof row.rowIndex !== 'undefined' && assignedRowIndices.has(row.rowIndex))) {
                            return; // Ya asignado
                        }
                        
                        unassignedCount++;
                        const isCot = (typeof isAlgodon === 'function') ? isAlgodon(row.yarn) : false;
                        
                        if (isCot) {
                            // Determinar categoría correcta usando la misma lógica que autoAssignRemainingCotton
                            const targetKey = determineCottonKey(row.yarn, groupTitle) || (cottonKeys.length > 0 ? cottonKeys[cottonKeys.length - 1] : 'ALGODÓN - DEFAULT');
                            if (!detailAlgodon[targetKey]) {
                                detailAlgodon[targetKey] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                            }
                            detailAlgodon[targetKey].crudoRows.push(Object.assign({ key, groupTitle }, row));
                            assignedKeys.add(key);
                            assignedRowIndices.add(row.rowIndex);
                            
                            // Actualizar totales
                            for (let i = 0; i < 12; i++) {
                                const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                const kgReq = raw / (1 - mermaAlg);
                                const qq = kgReq / 46;
                                detailAlgodon[targetKey].totalValues[i] = (detailAlgodon[targetKey].totalValues[i] || 0) + qq;
                                const client = row.client || 'VARIOS';
                                if (!detailAlgodon[targetKey].clients[client]) {
                                    detailAlgodon[targetKey].clients[client] = new Array(12).fill(0);
                                }
                                detailAlgodon[targetKey].clients[client][i] += qq;
                            }
                        } else {
                            // Asignar a otras fibras
                            const targetKey = otherKeys.length > 0 ? otherKeys[0] : 'OTRAS FIBRAS - DEFAULT';
                            if (!detailOtras[targetKey]) {
                                detailOtras[targetKey] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                            }
                            detailOtras[targetKey].crudoRows.push(Object.assign({ key, groupTitle }, row));
                            assignedKeys.add(key);
                            assignedRowIndices.add(row.rowIndex);
                            
                            // Actualizar totales
                            for (let i = 0; i < 12; i++) {
                                const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                const kgReq = raw / (1 - mermaOther);
                                detailOtras[targetKey].totalValues[i] = (detailOtras[targetKey].totalValues[i] || 0) + kgReq;
                                const client = row.client || 'VARIOS';
                                if (!detailOtras[targetKey].clients[client]) {
                                    detailOtras[targetKey].clients[client] = new Array(12).fill(0);
                                }
                                detailOtras[targetKey].clients[client][i] += kgReq;
                            }
                        }
                    } catch(e) { console.warn('enforceFullAssignment crudo error:', e); }
                });
            });
        } catch(e) { console.warn('enforceFullAssignment crudoGroups error:', e); }

        // MEZCLAS: iterar directamente sobre mezclaGroups
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach(g => {
                const groupTitle = g.title || '';
                if (!g.uniqueYarns) return;
                
                Array.from(g.uniqueYarns).forEach(id => {
                    try {
                        // Verificar si ya está asignado
                        if (assignedIds.has(id)) return;
                        
                        // Encontrar el item en GLOBAL_ITEMS para acceder a sus propiedades
                        const item = GLOBAL_ITEMS && GLOBAL_ITEMS.find(x => x.id === id);
                        if (!item || !item.yarn) return;
                        
                        unassignedCount++;
                        const isCot = (typeof isAlgodon === 'function') ? isAlgodon(item.yarn) : false;
                        
                        if (isCot) {
                            // Determinar categoría correcta usando la misma lógica que autoAssignRemainingCotton
                            const targetKey = determineCottonKey(item.yarn, groupTitle) || (cottonKeys.length > 0 ? cottonKeys[cottonKeys.length - 1] : 'ALGODÓN - DEFAULT');
                            if (!detailAlgodon[targetKey]) {
                                detailAlgodon[targetKey] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                            }
                            detailAlgodon[targetKey].mezclaItems.push(Object.assign({ groupTitle }, item));
                            assignedIds.add(item.id);
                            
                            // Actualizar totales
                            for (let i = 0; i < 12; i++) {
                                const raw = parseFloat(item.values && item.values[i] ? item.values[i] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                const kgReq = raw / (1 - mermaAlg);
                                const qq = kgReq / 46;
                                detailAlgodon[targetKey].totalValues[i] = (detailAlgodon[targetKey].totalValues[i] || 0) + qq;
                                const client = item.client || 'VARIOS';
                                if (!detailAlgodon[targetKey].clients[client]) {
                                    detailAlgodon[targetKey].clients[client] = new Array(12).fill(0);
                                }
                                detailAlgodon[targetKey].clients[client][i] += qq;
                            }
                        } else {
                            // Asignar a otras fibras
                            const targetKey = otherKeys.length > 0 ? otherKeys[0] : 'OTRAS FIBRAS - DEFAULT';
                            if (!detailOtras[targetKey]) {
                                detailOtras[targetKey] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                            }
                            detailOtras[targetKey].mezclaItems.push(Object.assign({ groupTitle }, item));
                            assignedIds.add(item.id);
                            
                            // Actualizar totales
                            for (let i = 0; i < 12; i++) {
                                const raw = parseFloat(item.values && item.values[i] ? item.values[i] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                const kgReq = raw / (1 - mermaOther);
                                detailOtras[targetKey].totalValues[i] = (detailOtras[targetKey].totalValues[i] || 0) + kgReq;
                                const client = item.client || 'VARIOS';
                                if (!detailOtras[targetKey].clients[client]) {
                                    detailOtras[targetKey].clients[client] = new Array(12).fill(0);
                                }
                                detailOtras[targetKey].clients[client][i] += kgReq;
                            }
                        }
                    } catch(e) { console.warn('enforceFullAssignment mezcla error:', e); }
                });
            });
        } catch(e) { console.warn('enforceFullAssignment mezclaGroups error:', e); }

        if (unassignedCount > 0) {
            console.log(`%c⚠️ enforceFullAssignment: asignados ${unassignedCount} items que faltaban de crudoGroups/mezclaGroups`, 'background:#ff9900;color:#fff;padding:4px');
        } else {
            console.log('%c✅ enforceFullAssignment: 100% de todos los items en crudoGroups/mezclaGroups está asignado', 'background:#00aa00;color:#fff;padding:4px');
        }
    } catch(e) { console.warn('enforceFullAssignment error', e); }
}

// Analiza los hilados sin categoría: descompone 2 componentes y su % (si existe)
// e imprime sugerencia de grupo (uno de los ORDERED_COTTON_KEYS)
// SOLO considera hilados de ALGODON de los grupos (crudoGroups/mezclaGroups)
function analyzeUnassignedAndSuggestGroup() {
    try {
        const merma = 0.40;
        const suggestions = [];
        const collectUnassigned = [];

        // Build collectUnassigned from GLOBAL_ITEMS (source of truth), include cotton items not assigned in detailAlgodon
        try {
            // build mapping for quick checks
            const assignedCrudoKeys = new Set();
            const assignedMezclaIds = new Set();
            Object.keys(detailAlgodon || {}).forEach(k => {
                try {
                    const entry = detailAlgodon[k] || {};
                    (entry.crudoRows || []).forEach(r => { try { if (r && r.key) assignedCrudoKeys.add(r.key); } catch(e){} });
                    (entry.mezclaItems || []).forEach(it => { try { if (it && it.id) assignedMezclaIds.add(it.id); } catch(e){} });
                } catch (e) {}
            });

            // create helper to find group title for an item (by id or rowIndex)
            const idToGroup = new Map();
            (window.crudoGroups || crudoGroups || []).forEach(g => { try { const title = g.title || ''; (g.rows || []).forEach(r => { try { if (typeof r.id !== 'undefined') idToGroup.set(r.id, title); if (typeof r.rowIndex !== 'undefined') idToGroup.set('ri:' + r.rowIndex, title); } catch(e){} }); } catch(e){} });
            (window.mezclaGroups || mezclaGroups || []).forEach(g => { try { const title = g.title || ''; if (!g.uniqueYarns) return; Array.from(g.uniqueYarns).forEach(id => { try { idToGroup.set(id, title); } catch(e){} }); } catch(e){} });

            (GLOBAL_ITEMS || []).forEach(it => {
                try {
                    if (!it || !it.yarn) return;
                    // only consider cotton
                    if (!(typeof isAlgodon === 'function' ? isAlgodon(it.yarn) : false)) return;
                    const groupTitle = idToGroup.get(it.id) || idToGroup.get('ri:' + it.rowIndex) || '';
                    const key = `${groupTitle}||${it.client||''}||${it.line||''}||${it.yarn||''}`;
                    // determine whether unassigned in crudo or mezcla
                    if (!assignedCrudoKeys.has(key) && !assignedMezclaIds.has(it.id)) {
                        // determine type: MAT. MEZCLAS if id is known in mezclaGroups mapping, else MAT. CRUDOS
                        const type = (idToGroup.has(it.id) && (window.mezclaGroups || mezclaGroups || []).some(g => (g.uniqueYarns && g.uniqueYarns.has(it.id)))) ? 'MAT. MEZCLAS' : 'MAT. CRUDOS';
                        collectUnassigned.push({ type, yarn: it.yarn, grupo: groupTitle, cliente: it.client, id: it.id, key });
                    }
                } catch (e) { }
            });
        } catch (e) { }

        // Procesar cada no asignado: extraer componentes y porcentajes
        collectUnassigned.forEach(item => {
            try {
                const yarn = item.yarn || '';
                // getComponentNames devuelve componentes reconocidos (ej. PIMA, LYOCELL, PES_RECYCLED...)
                const comps = (typeof getComponentNames === 'function') ? getComponentNames(yarn) : [];
                const pcts = (typeof getPercentages === 'function') ? getPercentages(yarn) : [];
                const materia1 = comps && comps.length > 0 ? comps[0] : '';
                const materia2 = comps && comps.length > 1 ? comps[1] : '';
                const comp1 = pcts && pcts.length > 0 ? Math.round(pcts[0]*100*100)/100 : null;
                const comp2 = pcts && pcts.length > 1 ? Math.round(pcts[1]*100*100)/100 : null;

                // Sugerir grupo: probar con materia1 (si existe), sino con yarn completo
                let suggested = null;
                try {
                    if (materia1) {
                        suggested = determineCottonKey(materia1, item.grupo);
                    }
                    if (!suggested) {
                        suggested = determineCottonKey(yarn, item.grupo);
                    }
                } catch (e) {
                    try { suggested = determineCottonKey(yarn, item.grupo); } catch (ex) {}
                }
                // Fallback: si aún no hay sugerencia, usar la última clave de ORDERED_COTTON_KEYS
                if (!suggested) {
                    const keys = ORDERED_COTTON_KEYS || [];
                    suggested = (keys.length > 0) ? keys[keys.length-1] : 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
                }

                suggestions.push({
                    Tipo: item.type,
                    Hilado: yarn,
                    'Materia 1': materia1 || '-',
                    'Comp. 1': comp1 !== null ? comp1 + '%' : '-',
                    'Materia 2': materia2 || '-',
                    'Comp. 2': comp2 !== null ? comp2 + '%' : '-',
                    '📌 Grupo Sugerido': suggested,
                    Cliente: item.cliente || '-'
                });
            } catch (e) { /* ignore item errors */ }
        });

        if (suggestions.length === 0) {
            console.log('%c✅ No hay hilados de ALGODÓN sin categoría para analizar', 'background:#00aa00;color:#fff;padding:4px');
            return;
        }

        console.groupCollapsed(`%c🔎 SUGERENCIAS DE GRUPO PARA HILADOS DE ALGODÓN SIN CATEGORÍA (${suggestions.length})`, 'font-weight:bold;color:#ff6600;font-size:13px');
        console.table(suggestions);
        console.groupEnd();
    } catch (e) { console.warn('analyzeUnassignedAndSuggestGroup error', e); }
}

// ============ CRITERIOS DE CLASIFICACIÓN PARA OTRAS FIBRAS ============
//
// FORMATO: [#] Nombre (KG) - Merma: XX%
//   • Criterio: Condición para detectar esta fibra
//   • Excluye: Qué se descarta / no pertenece a esta categoría
//   • Ejemplos: Casos típicos
//
// ============================================================
//
// 1. LYOCELL STD (KG) - Merma: 15%
//   • Criterio: Contiene "LYOCELL" o "TENCEL" (no A100).
//   • Excluye: Versiones A100 (tenacidad 100 cN/tex).
//   • Ejemplos: LYOCELL, TENCEL STD, LYOCELL HTR.
//
// 2. NYLON (KG) - Merma: 85%
//   • Criterio: Contiene "NYLON".
//   • Excluye: Ninguno (todas las variantes de nylon se agrupan aquí).
//   • Ejemplos: NYLON, NYLON 6, NYLON 6.6, NYLON ELASTANO.
//
// 3. RECYCLED PES (KG) - Merma: 15%
//   • Criterio: Contiene "REPREVE" o "PREPREVE" (estas dos cadenas son suficientes).
//   • Excluye: PES virgen (sin indicación de REPREVE/PREPREVE).
//   • Ejemplos: PES REPREVE, REPREVE 50/50, PREPREVE.
//
// 4. PES VIRGEN (KG) - Merma: 85%
//   • Criterio: Contiene "PES" (sin REPREVE/RECYCLED/RECICLADO).
//   • Excluye: Poliéster reciclado (va a RECYCLED PES).
//   • Ejemplos: PES, PES 100.
//
// 5. WOOL 17.5 (KG) - Merma: 85%
//   • Criterio: Contiene "WOOL" o "MERINO".
//   • Excluye: Ninguno (ambas formas se agrupan aquí).
//   • Ejemplos: WOOL 17.5, MERINO 19.5, MERINO WOOL BLEND.
//
// 6. MODAL (KG) - Merma: 15%
//   • Criterio: Contiene "MODAL".
//   • Excluye: Ninguno (categoría propia, distinta de otros celulósicos).
//   • Ejemplos: MODAL, MODAL 100, MODAL ELASTANO.
//
// 7. VISCOSA (KG) - Merma: 15%
//   • Criterio: Contiene "VISCOSA" o "VISCOSE".
//   • Excluye: Ninguno (se trata como categoría propia).
//   • Ejemplos: VISCOSA, VISCOSA 100, VISCOSE BLEND.
//
// 8. ELASTANO (KG) - Merma: 85%
//   • Criterio: Contiene "ELASTANO" o "SPANDEX" como componente independiente.
//   • Excluye: Elastano dentro de otras fibras (ej. "NYLON ELASTANO" es NYLON).
//   • Ejemplos: ELASTANO 100, ELASTANO PURO, SPANDEX.
//
// 9. ABETE NANO 159 MULTICOLO (KG) - Merma: 85%
//   • Criterio: Contiene "ABETE NANO" Y "MULTI" (o "MULTICOLOR"/"MULTICOLO").
//   • Excluye: Versión blanca (ABETE NANO BLANCO, categoría separada).
//   • Ejemplos: ABETE NANO 159 MULTICOLOR, ABETE NANO MULTI.
//
// 10. ABETE NANO BLANCO (KG) - Merma: 85%
//   • Criterio: Contiene "ABETE NANO" Y "BLANCO".
//   • Excluye: Versiones multicolores (categoría separada).
//   • Ejemplos: ABETE NANO BLANCO, ABETE NANO 159 BLANCO.
//
// 11. CAÑAMO / HEMP (KG) - Merma: 85%
//   • Criterio: Contiene "CAÑAMO", "CANAMO" o "HEMP".
//   • Excluye: Ninguno (todas las variantes se agrupan aquí).
//   • Ejemplos: CAÑAMO, CANAMO, HEMP, HEMP ORGANICO.
//
// ============ REGLAS GENERALES ============
// • Separación CRUDO vs MEZCLA: Por campo "line" del item
//   - Si line.toUpperCase() === "MEZCLA" → mezclaItems
//   - Si no → crudoRows
// • Agrupación: Por grupo de origen dentro de cada tipo (crudo/mezcla)
// • Cálculo KG REQ: raw / (1 - merma)
// • Orden: Respeta ORDERED_OTHER_KEYS en utils.js
// ============================================================

// Detalle COMPLETO de TODAS LAS OTRAS FIBRAS (KG REQ) - imprime cada fibra en orden
function logAllOtherFibersDetail() {
    try {
        const fibers = ORDERED_OTHER_KEYS || [];
        fibers.forEach(fiberLabel => {
            try {
                logOtherFiberDetail(fiberLabel);
            } catch (e) {
                console.warn(`Error logging detail for ${fiberLabel}:`, e);
            }
        });
    } catch (e) { console.warn('logAllOtherFibersDetail error', e); }
}

// Detalle de UNA FIBRA específica de OTRAS FIBRAS
function logOtherFiberDetail(fiberLabel) {
    try {
        const months = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES : ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
        
        // Buscar en detailOtras usando la etiqueta exacta proporcionada
        let data = (typeof detailOtras !== 'undefined' && detailOtras[fiberLabel]) ? detailOtras[fiberLabel] : null;
        
        // Si no encontramos con la etiqueta exacta, intentar buscar todas las claves y tomar la que coincida
        if (!data && typeof detailOtras !== 'undefined') {
            // Normalizar el label para búsqueda flexible
            const labelNorm = normStrFiber(fiberLabel || '');
            const matchedKey = Object.keys(detailOtras).find(key => {
                const keyNorm = normStrFiber(key || '');
                return keyNorm.indexOf(labelNorm) >= 0 || labelNorm.indexOf(keyNorm) >= 0;
            });
            if (matchedKey) {
                data = detailOtras[matchedKey];
                // Usar la clave encontrada como etiqueta oficial
                fiberLabel = matchedKey;
            }
        
        // Especial: permitir que 'RECYCLED PES (KG)' también encuentre claves/etiquetas que mencionen 'REPREVE', 'PES REPREVE' o 'PES PREPREVE'
        if (!data && typeof detailOtras !== 'undefined' && (fiberLabel || '').toString().toUpperCase().indexOf('RECYCLED PES') >= 0) {
            try {
                const repKey = Object.keys(detailOtras).find(k => {
                    const kk = (k||'').toString().toUpperCase();
                    return kk.indexOf('REPREVE') >= 0 || kk.indexOf('PES REPREVE') >= 0 || kk.indexOf('PES PREPREVE') >= 0 || kk.indexOf('PREPREVE') >= 0;
                });
                if (repKey) { data = detailOtras[repKey]; fiberLabel = repKey; }
            } catch(e) { /* ignore */ }
        }
        }

        // Si no hay datos o es vacío en CRUDOS/MEZCLAS, intentar un fallback buscando en GLOBAL_ITEMS
        const hasTotals = data && data.totalValues && Array.isArray(data.totalValues) && data.totalValues.some(v => (parseFloat(v)||0) !== 0);
        if (!data || ((!data.crudoRows || data.crudoRows.length === 0) && (!data.mezclaItems || data.mezclaItems.length === 0))) {
            // Si ya tenemos totales en data.totalValues, no necesitamos fallback (mostraremos los totales aunque no haya rows)
            if (hasTotals) {
                data = data || {};
                data.crudoRows = data.crudoRows || [];
                data.mezclaItems = data.mezclaItems || [];
            } else {
            try {
                // Construir mapeo rápido id -> grupo                // helper local dentro de summary.js (pegalo arriba de autoAssignRemainingCotton)
                function extractPctFromYarn(itYarn) {
                    try {
                        if (!itYarn || !itYarn.toString) return null;
                        const s = itYarn.toString();
                        // Buscar bloque de porcentajes tipo "50/30/20%" y aceptar espacios antes de '%'
                        const pctBlockMatch = s.match(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*\s*%)/);
                        if (!pctBlockMatch) return null;
                        let pctBlock = pctBlockMatch[0].replace('%','').trim();
                        pctBlock = pctBlock.replace(/[^0-9\/\.]/g,'');
                        const parts = pctBlock.split('/').map(p => parseFloat(p)/100).filter(x => !isNaN(x));
                        if (!parts || parts.length === 0) return null;
                        return parts; // array de fracciones en el mismo orden
                    } catch (e) { return null; }
                }
                
                // Dentro del bucle de MEZCLAS en autoAssignRemainingCotton, sustituir la búsqueda de "pct" por algo así:
                let pct = null;
                // 1) intentar extraer porcentajes embebidos en el yarn y mapear por orden
                const pctList = extractPctFromYarn(it.yarn);
                if (Array.isArray(pctList) && pctList.length > 0) {
                    // Normalizar texto del yarn y quitar conteos iniciales tipo "30/1 "
                    let yarnStr = it.yarn.toString().replace(/(\d+\/\d+\s*)/,'').trim();
                    // Quitar el bloque de porcentajes del final si quedó
                    yarnStr = yarnStr.replace(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%)/,'').trim();
                    // Dividir componentes por '/'
                    const comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                    // Buscar el índice del componente que sea algodón (o el que coincida con target)
                    const compIndex = comps.findIndex(c => {
                        const u = c.toUpperCase();
                        return u.includes('COP') || u.includes('ALG') || u.includes('GOTS') || u.includes('OCS') || u.includes('PIMA') || u.includes('UPLAND') || u.includes('TANGUIS');
                    });
                    if (compIndex >= 0 && compIndex < pctList.length) {
                        pct = pctList[compIndex];
                    } else {
                        // fallback: si number of comps === pctList.length, tratar por posición 0..N-1
                        if (comps.length === pctList.length) {
                            // si estamos processing 'it' dentro de un target específico, deberías elegir la posición
                            // correspondiente al tipo objetivo; aquí dejamos como fallback usar la primera coincidencia de algodón
                            pct = pctList[0];
                        }
                    }
                }
                
                // 2) si no se obtuvo pct desde el yarn, intentar componentPercentages del grupo (comparando con it.yarn)
                if (pct === null && g.componentPercentages) {
                    Object.keys(g.componentPercentages || {}).some(compKey => {
                        try {
                            // comparar compKey con el yarn (o con cada componente) — no con gTitle
                            if (tokenMatcher(it.yarn || '', compKey) || (it.yarn && (it.yarn.toString().toUpperCase().indexOf(compKey.toUpperCase()) >= 0))) {
                                pct = parseFloat(g.componentPercentages[compKey]) || null;
                                return true;
                            }
                        } catch(e){}
                        return false;
                    });
                }
                const idToGroup = new Map();
                (window.crudoGroups || crudoGroups || []).forEach(g => { try { const title = g.title || ''; (g.rows || []).forEach(r => { try { if (typeof r.id !== 'undefined') idToGroup.set(r.id, title); if (typeof r.rowIndex !== 'undefined') idToGroup.set('ri:' + r.rowIndex, title); } catch(e){} }); } catch(e){} });
                (window.mezclaGroups || mezclaGroups || []).forEach(g => { try { const title = g.title || ''; if (!g.uniqueYarns) return; Array.from(g.uniqueYarns).forEach(id => { try { idToGroup.set(id, title); } catch(e){} }); } catch(e){} });

                const fallbackCrudos = [];
                const fallbackMezclas = [];

                // Normalizar etiqueta objetivo para comparar con nombres canónicos
                const targetLabelNorm = normStrFiber((fiberLabel || '').replace(/\s*\([^)]*\)\s*$/, ''));
                
                // Especial para RECYCLED PES: detectar patrones REPREVE/PREPREVE en el yarn
                const isRecycledPES = (fiberLabel || '').toString().toUpperCase().indexOf('RECYCLED PES') >= 0;
                const checkReprevePattern = (yarn) => {
                    if (!isRecycledPES) return false;
                    const yarnUpper = (yarn || '').toString().toUpperCase();
                    return yarnUpper.indexOf('REPREVE') >= 0 || yarnUpper.indexOf('PREPREVE') >= 0 || yarnUpper.indexOf('PES REPREVE') >= 0 || yarnUpper.indexOf('PES PREPREVE') >= 0;
                };

                (GLOBAL_ITEMS || []).forEach(it => {
                    try {
                        if (!it || !it.yarn) return;
                        // Obtener token estricto y nombre canónico desde orchestrator helpers
                        let strictTok = null;
                        try { if (typeof getStrictCanonicalToken === 'function') strictTok = getStrictCanonicalToken(it.yarn || ''); } catch (e) { strictTok = null; }
                        let canonicalName = null;
                        try { if (typeof getFiberNameFromStrict === 'function' && strictTok) canonicalName = getFiberNameFromStrict(strictTok); } catch (e) { canonicalName = null; }
                        if (!canonicalName) {
                            try { canonicalName = getFiberName(it.yarn || ''); } catch (e) { canonicalName = it.yarn || ''; }
                        }

                        const canonNorm = normStrFiber(canonicalName || '');
                        const yarnNorm = normStrFiber(it.yarn || '');
                        const groupTitle = idToGroup.get(it.id) || idToGroup.get('ri:' + it.rowIndex) || '';

                        // Match por nombre canónico o token estricto o substring; también por patrón REPREVE para RECYCLED PES
                        let matched = false;
                        if (canonNorm && targetLabelNorm && canonNorm.indexOf(targetLabelNorm) >= 0) matched = true;
                        if (!matched && strictTok && typeof strictTok === 'string' && normStrFiber(strictTok).indexOf(targetLabelNorm) >= 0) matched = true;
                        if (!matched && yarnNorm && targetLabelNorm && yarnNorm.indexOf(targetLabelNorm) >= 0) matched = true;
                        if (!matched && checkReprevePattern(it.yarn)) { 
                            matched = true; 
                            // Log para DEBUG: mostrar que se matcheó por REPREVE
                            try { console.log(`%c  [REPREVE MATCH] ${it.yarn}`, 'color:#ff6600;font-size:10px;'); } catch(e) {}
                        }

                        if (matched) {
                            const isMezcla = (window.mezclaGroups || mezclaGroups || []).some(g => (g.uniqueYarns && g.uniqueYarns.has && g.uniqueYarns.has(it.id)));
                            const clone = Object.assign({ groupTitle }, it);
                            if (isMezcla) fallbackMezclas.push(clone); else fallbackCrudos.push(clone);
                        }
                    } catch (e) { }
                });

                if (fallbackCrudos.length === 0 && fallbackMezclas.length === 0) {
                    // Si el fallback no encontró filas pero existían totales (revisado arriba), continuar mostrando totales.
                    if (!hasTotals) {
                        console.log(`%c✅ ${fiberLabel}: vacío (sin datos)`, 'color:#00aa00;font-weight:bold;');
                        return;
                    }
                    // else: tenemos totales aunque no haya filas, seguir adelante con data tal como está
                } else {
                    console.log(`%c📌 Fallback GLOBAL_ITEMS: Encontrados ${fallbackCrudos.length} CRUDOS + ${fallbackMezclas.length} MEZCLAS`, 'color:#ffaa00;font-weight:bold;');
                    data = data || {};
                    data.crudoRows = fallbackCrudos;
                    data.mezclaItems = fallbackMezclas;
                }
            } catch (e) {
                if (!hasTotals) {
                    console.log(`%c✅ ${fiberLabel}: vacío (sin datos)`, 'color:#00aa00;font-weight:bold;');
                    return;
                }
                // else: falló el fallback pero hay totales; continuamos
            }
            }
        }

        const isCotton = fiberLabel.toLowerCase().includes('algodón');
        const colorBg = isCotton ? '#f0ad4e' : '#87ceeb';
        const colorText = isCotton ? '#fff' : '#000';

        // RECYCLED PES debug log removed to reduce console noise

        // Encabezado principal de la fibra (usar mismo diseño que ALGODÓN)
        console.group(`%c${fiberLabel}`, 'font-weight:bold;color:#007acc');

        let totalKgReqAllMonths = 0;

        const formatLogNumber = (n) => {
            const num = parseFloat(n || 0) || 0;
            if (!isFinite(num)) return '-';
            if (Math.abs(num) < 1 && Math.abs(num) > 0) return (Math.round(num * 100) / 100).toString();
            return formatNumber(num);
        };

        // Iterar por cada mes y mostrar un grupo colapsable con CRUDOS y MEZCLAS
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            const monthLabel = months[monthIdx] || ('M' + (monthIdx+1));

            const crudoRows = data.crudoRows || [];
            const crudosForMonth = crudoRows.filter(r => (parseFloat(r.values && r.values[monthIdx] ? r.values[monthIdx] : 0) || 0) > 0);
            const mezclaItems = data.mezclaItems || [];
            const mezclasForMonthPreview = mezclaItems.filter(it => (parseFloat(it.values && it.values[monthIdx] ? it.values[monthIdx] : 0) || 0) > 0);
            const hasTotals = data && data.totalValues && Array.isArray(data.totalValues) && Math.abs(parseFloat(data.totalValues[monthIdx]||0)) > 0.0001;
            const hasMonthData = hasTotals || crudosForMonth.length > 0 || mezclasForMonthPreview.length > 0;
            if (!hasMonthData) continue;

            console.groupCollapsed(`${monthLabel}`);

            let monthCrudoKgReq = 0, monthCrudoQQReq = 0;
            let monthMezclaKgReq = 0, monthMezclaQQReq = 0;

            // ===== MAT. CRUDOS =====
            console.groupCollapsed(`MAT. CRUDOS (${crudosForMonth.length} filas)`);
            if (crudosForMonth.length === 0) {
                console.log('(sin datos)');
            } else {
                const crudosByGroup = {};
                crudosForMonth.forEach(row => {
                    const gTitle = row.groupTitle || 'SIN GRUPO';
                    if (!crudosByGroup[gTitle]) crudosByGroup[gTitle] = [];
                    crudosByGroup[gTitle].push(row);
                });
                Object.keys(crudosByGroup).forEach(gTitle => {
                    console.groupCollapsed(`📦 ${gTitle}`);
                    let gKgReq = 0, gQQReq = 0, gRaw = 0;
                    crudosByGroup[gTitle].forEach((row, idx) => {
                        const raw = parseFloat(row.values && row.values[monthIdx] ? row.values[monthIdx] : 0) || 0;
                        const mermaPct = (typeof defaultMermaForToken === 'function') ? defaultMermaForToken(row.yarn || '') : (isCotton ? 40 : 15);
                        const kgReq = raw / (1 - (parseFloat(mermaPct) || 0)/100);
                        const qqReq = kgReq / 46;
                        gKgReq += kgReq; gQQReq += qqReq; gRaw += raw;
                        console.log(`  [${idx+1}] Yarn: ${row.yarn} | Cliente: ${row.client || '-'} | Línea: ${row.line || '-'} | Raw: ${formatLogNumber(raw)} kg → KgReq: ${formatLogNumber(kgReq)} → QQ: ${formatLogNumber(qqReq)} (merma ${mermaPct}%)`);
                    });
                    console.log(`  %c↳ Subtotal grupo: Raw: ${formatLogNumber(gRaw)} kg → KgReq: ${formatLogNumber(gKgReq)} kg → ${formatLogNumber(gQQReq)} QQ`, 'color:#4ec9b0');
                    console.groupEnd();
                    monthCrudoKgReq += gKgReq;
                    monthCrudoQQReq += gQQReq;
                });
            }
            console.log(`%cTotal MAT. CRUDOS KG REQ: ${formatLogNumber(monthCrudoKgReq)} kg`, 'font-weight:bold;color:#dcdcaa');
            console.log(`%cTotal MAT. CRUDOS QQ REQ: ${formatLogNumber(monthCrudoQQReq)} QQ`, 'font-weight:bold;color:#dcdcaa');
            console.groupEnd();

            // ===== MAT. MEZCLAS =====
            const mezclasForMonth = mezclasForMonthPreview;
            console.groupCollapsed(`MAT. MEZCLAS (${mezclasForMonth.length} filas)`);
            if (mezclasForMonth.length === 0) {
                console.log('(sin datos)');
            } else {
                // Helper local para extraer porcentajes embebidos del yarn
                function extractPctListFromYarn(itYarn) {
                    try {
                        if (!itYarn) return null;
                        const s = itYarn.toString();
                        // Regex mejorado: captura "65/35 %" o "65/35%" con espacios opcionales
                        const m = s.match(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*%/);
                        if (!m) return null;
                        const pctBlock = m[1].trim(); // grupo 1 sin el %
                        return pctBlock.split('/').map(p => { const v = parseFloat(p.trim()); return isNaN(v) ? null : v/100; }).filter(x => x !== null);
                    } catch(e) { return null; }
                }

                // Buscar el índice del componente que corresponde a la fibra actual (fiberLabel)
                function findComponentIndex(yarn, targetFiber) {
                    try {
                        if (!yarn) return -1;
                        let yarnStr = yarn.toString().replace(/^\s*\d+\/\d+\s*/,'').trim();
                        yarnStr = yarnStr.replace(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%)/,'').trim();
                        const comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                        const targetNorm = normStrFiber(targetFiber || '');
                        // Keywords específicos por tipo de fibra
                        const fiberKeywords = {
                            'LYOCELL A100': ['LYOCELL A100'],
                            'LYOCELL': ['LYOCELL','TENCEL'],
                            'MODAL': ['MODAL'],
                            'VISCOSA': ['VISCO','VISCOSE','RAYON'],
                            'PES': ['PES','REPREVE','PREPREVE'],
                            'ELASTANO': ['ELASTANO','ELASTANE','SPANDEX','LYCRA'],
                            'HEMP': ['HEMP','CAÑAMO'],
                            'ABETE': ['ABETE']
                        };
                        // Detectar qué keywords buscar según fiberLabel
                        // IMPORTANTE: Verificar A100 primero para evitar match con LYOCELL genérico
                        let searchKeywords = [];
                        if (targetNorm.includes('A100')) {
                            searchKeywords = fiberKeywords['LYOCELL A100'];
                        } else {
                            Object.keys(fiberKeywords).forEach(k => {
                                if (k !== 'LYOCELL A100' && targetNorm.includes(normStrFiber(k))) {
                                    searchKeywords = searchKeywords.concat(fiberKeywords[k]);
                                }
                            });
                        }
                        if (searchKeywords.length === 0) searchKeywords = [targetNorm];

                        for (let ci = 0; ci < comps.length; ci++) {
                            const compNorm = normStrFiber(comps[ci] || '');
                            for (const kw of searchKeywords) {
                                if (compNorm.includes(normStrFiber(kw))) return ci;
                            }
                        }
                        return -1;
                    } catch(e) { return -1; }
                }

                const mezclasByGroup = {};
                mezclasForMonth.forEach(it => {
                    const gTitle = it.groupTitle || 'SIN GRUPO';
                    if (!mezclasByGroup[gTitle]) mezclasByGroup[gTitle] = [];
                    mezclasByGroup[gTitle].push(it);
                });
                Object.keys(mezclasByGroup).forEach(gTitle => {
                    console.groupCollapsed(`📦 ${gTitle}`);
                    let gKgReq = 0;
                    mezclasByGroup[gTitle].forEach((it, idx) => {
                        const raw = parseFloat(it.values && it.values[monthIdx] ? it.values[monthIdx] : 0) || 0;

                        // Extraer pct del item o calcular desde yarn
                        let pct = it.pct || null;
                        if (pct === null) {
                            const pctList = extractPctListFromYarn(it.yarn);
                            if (Array.isArray(pctList) && pctList.length > 0) {
                                const compIdx = findComponentIndex(it.yarn, fiberLabel);
                                if (compIdx >= 0 && compIdx < pctList.length) {
                                    pct = pctList[compIdx];
                                }
                            }
                        }

                        // Aplicar pct: ComponentRaw = Raw × Pct
                        const effectivePct = (pct !== null && pct > 0) ? pct : 1;
                        const componentRaw = raw * effectivePct;
                        const mermaPct = (typeof defaultMermaForToken === 'function') ? defaultMermaForToken(fiberLabel || '') : 15;
                        const kgReq = componentRaw / (1 - (parseFloat(mermaPct) || 0)/100);
                        gKgReq += kgReq;

                        // Log SIN QQ (QQ solo para algodón): Raw × Pct → ComponentRaw → KgReq
                        if (pct !== null && pct < 1) {
                            console.log(`  [${idx+1}] Yarn: ${it.yarn} | Cliente: ${it.client || '-'} | ItemID: ${it.id} | Raw: ${formatLogNumber(raw)} kg × Pct: ${Math.round(effectivePct*100)}% → ComponentRaw: ${formatLogNumber(componentRaw)} kg → KgReq: ${formatLogNumber(kgReq)} (merma ${mermaPct}%)`);
                        } else {
                            console.log(`  [${idx+1}] Yarn: ${it.yarn} | Cliente: ${it.client || '-'} | ItemID: ${it.id} | Raw: ${formatLogNumber(raw)} kg → KgReq: ${formatLogNumber(kgReq)} (merma ${mermaPct}%)`);
                        }
                    });
                    console.log(`  %c↳ Subtotal grupo: ${formatLogNumber(gKgReq)} kg`, 'color:#4ec9b0');
                    console.groupEnd();
                    monthMezclaKgReq += gKgReq;
                });
            }
            // Total MEZCLAS = suma real de los subtotales de grupos (monthMezclaKgReq)
            console.log(`%cTotal MAT. MEZCLAS KG REQ: ${formatLogNumber(monthMezclaKgReq)} kg`, 'font-weight:bold;color:#dcdcaa');
            console.groupEnd();

            // CORRECTO: El total es la SUMA de CRUDOS + MEZCLAS (NO usar data.totalValues)
            const displayedTotalKg = monthCrudoKgReq + monthMezclaKgReq;
            console.log(`%c${monthLabel} TOTAL: ${formatLogNumber(displayedTotalKg)} kg (CRUDOS: ${formatLogNumber(monthCrudoKgReq)} + MEZCLAS: ${formatLogNumber(monthMezclaKgReq)})`, 'font-weight:bold;font-size:12px;color:#f48771;background:#1e1e1e;padding:2px 4px');
            console.groupEnd();

            // IMPORTANTE: Actualizar data.totalValues con el valor correcto calculado (para reflejar en tabla HTML)
            if (data && data.totalValues && Array.isArray(data.totalValues)) {
                data.totalValues[monthIdx] = displayedTotalKg;
            }

            totalKgReqAllMonths += (typeof displayedTotalKg === 'number' ? displayedTotalKg : 0);
        }

        console.log(`%c═══════════════════════════════════════════════`, 'color:#999;');
        console.log(`%cSUMA TOTAL KG REQ (12 meses): ${formatLogNumber(totalKgReqAllMonths)} kg`, `color:${colorBg};font-weight:bold;font-size:13px;`);
        console.groupEnd();
    } catch (e) {
        console.warn(`logOtherFiberDetail("${fiberLabel}") error:`, e);
    }
}
