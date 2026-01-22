// Module: MAT. MEZCLAS
// Contains: renderMezclasTable and placeholder recalcMezclaComponent

function renderMezclasTable() {
    document.getElementById('mezclasHead').innerHTML = `<tr class="mix-header-top"><th colspan="4" class="py-2 text-center border-r border-orange-800">Desglose Componentes</th><th colspan="${activeIndices.length + 1}" class="py-2 text-center">Kg Usados / Kg Requeridos</th></tr><tr class="mix-header-sub"><th class="text-left py-2 px-3 w-24">Línea</th><th class="text-left py-2 px-3 w-32">Cliente</th><th class="text-left py-2 px-3 min-w-[140px]">Hilado</th><th class="text-center py-2 px-3 w-12">Mover</th>${generateCellsHTML(null, true, '')}<th class="text-right px-2 py-1 w-20">TOTAL</th></tr>`;
    const tbody = document.getElementById('mezclasBody'); tbody.innerHTML = '';
    
    mezclaGroups.forEach((group, groupIndex) => { 
        if (Math.abs(group.groupRawTotals.reduce((a,b)=>a+b,0)) <= 0.01) return; 
        tbody.innerHTML += `<tr id="group-header-${groupIndex}" class="group-header"><td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${group.title}</td></tr>`; 
        
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
        
        const groupTotalSum = group.groupRawTotals.reduce((a,b) => a + (b || 0), 0);
        tbody.innerHTML += `<tr class="row-group-total"><td colspan="4" class="text-right pr-4 py-1">TOTAL MES:</td>${generateCellsHTML(group.groupRawTotals)}<td class="text-right px-2 font-bold">${formatNumber(groupTotalSum)}</td></tr>`; 
        
        // Extract exact material components from group.title (keep parentheses for matching)
        const rawTitle = (group.title || '').toString();
        // find a sample item in this group early (used by splitting heuristics)
        const firstItemWithYarn = Array.from(GLOBAL_ITEMS).find(item => group.uniqueYarns.has(item.id));
        // Remove trailing percentage parenthesis like "(75/25%)" for splitting purposes
        const titleNoPct = rawTitle.replace(/\s*\(\s*\d+(?:\/\d+)+\s*%?\s*\)\s*$/,'').trim();
        let titleParts = [];
        if (titleNoPct.indexOf('/') >= 0) {
            titleParts = titleNoPct.split('/').map(s => s.trim()).filter(Boolean);
        } else {
            // If no slash, try to split by keyword heuristics using detected percentage count
            const firstYarn = firstItemWithYarn;
            let pctArr = [];
            try { pctArr = getPercentages(firstYarn ? (firstYarn.yarn || '') : rawTitle) || []; } catch (e) { pctArr = []; }
            if (pctArr && pctArr.length >= 2) {
                // use helper to split into expected number of components
                try {
                    titleParts = splitComponentsByKeywords(titleNoPct, pctArr.length) || [titleNoPct];
                } catch (e) { titleParts = [titleNoPct]; }
            } else {
                // fallback: try to extract components by known fiber keywords
                try {
                    const comps = getComponentNames(titleNoPct) || [];
                    titleParts = comps.length ? comps : [titleNoPct];
                } catch (e) { titleParts = [titleNoPct]; }
            }
        }
        let titlePartsUpper = titleParts.map(s => s.toUpperCase());

        // If the raw title includes explicit percentages like (65/35%), prefer them
        // and build a title-based percentage array mapped by titleParts order.
        // *** CRITICAL: This mapping must use ORIGINAL titleParts order (before render reordering) ***
        let titlePctArr = [];
        try {
            const mTitlePct = rawTitle.match(/\(\s*(\d+(?:\/\d+)+)\s*%?\s*\)/);
            if (mTitlePct) {
                const parts = mTitlePct[1].split('/').map(p => {
                    const num = parseFloat(p.replace(/[^0-9.]/g, ''));
                    return (isNaN(num) ? 0 : num);
                });
                // Only use if count matches titleParts count EXACTLY
                if (parts.length === titleParts.length) {
                    titlePctArr = parts.map(n => (n > 1 ? n / 100 : n));
                }
            }
        } catch (e) { titlePctArr = []; }

        // Build explicit map materialName -> pct using ORIGINAL titleParts order (MANDATORY)
        // *** This map defines the binding: titleParts[i] <-> titlePctArr[i] ***
        // NO reordering allowed before this mapping is created
        const materialPctMap = {};
        if (titlePctArr && titlePctArr.length === titleParts.length) {
            for (let idx = 0; idx < titleParts.length; idx++) {
                const matName = titleParts[idx];
                const pct = titlePctArr[idx];
                materialPctMap[matName] = pct;
                try {
                    const canon = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(matName) : null;
                    if (canon) materialPctMap[canon] = pct;
                } catch (e) { /* ignore */ }
            }
        }

        // DEBUG: Log the mapping for PES/COTTON case
        if (rawTitle && /PES\s+RECICLADO\s*\/?\s*COTTON/i.test(rawTitle)) {
            console.log('=== MAPPING DEBUG ===');
            console.log('rawTitle:', rawTitle);
            console.log('titleNoPct:', titleNoPct);
            console.log('titleParts:', titleParts);
            console.log('titleParts (stringified):', titleParts.map((p, i) => `[${i}] "${p}"`));
            console.log('titlePctArr:', titlePctArr);
            console.log('materialPctMap:', materialPctMap);
            console.log('materialPctMap keys:', Object.keys(materialPctMap));
        }
        
        // Normalize component keys and map each to its material component name
        const rawCompTotals = group.componentTotalsTotal || {};
        const componentsByMaterial = {}; // materialComponentName -> { totalVector, rawKeys }
        const rawKeyToMaterialMap = {}; // rawKey -> materialComponentName
        
        // Initialize each material component
        titleParts.forEach(tp => {
            componentsByMaterial[tp] = { totalVector: new Array(12).fill(0), rawKeys: [] };
        });
        
        // Map each raw key to its material component (semantic matching)
        Object.keys(rawCompTotals).forEach(rawKey => {
            const rawKeyUpper = rawKey.toString().toUpperCase();
            let bestMatch = null;
            
            for (let tp of titleParts) {
                const tpUpper = tp.toUpperCase();
                const tpHasAlgodonTerms = /ALGODON|COTTON|ALG\b/.test(tpUpper);
                const rawHasAlgodonTerms = /ALGODON|COTTON|ALG\b/.test(rawKeyUpper);
                const tpHasPesTerms = /PES|REPREVE|RECYCL|RECICLADO/.test(tpUpper);
                const rawHasPesTerms = /PES|REPREVE|RECYCL|RECICLADO/.test(rawKeyUpper);
                const tpHasLyocellTerms = /LYOCELL|TENCEL/.test(tpUpper);
                const rawHasLyocellTerms = /LYOCELL|TENCEL/.test(rawKeyUpper);
                const tpHasModalTerms = /MODAL/.test(tpUpper);
                const rawHasModalTerms = /MODAL/.test(rawKeyUpper);
                const tpHasWoolTerms = /WOOL|MERINO/.test(tpUpper);
                const rawHasWoolTerms = /WOOL|MERINO/.test(rawKeyUpper);

                if ((tpHasAlgodonTerms && rawHasAlgodonTerms) ||
                    (tpHasPesTerms && rawHasPesTerms) ||
                    (tpHasLyocellTerms && rawHasLyocellTerms) ||
                    (tpHasModalTerms && rawHasModalTerms) ||
                    (tpHasWoolTerms && rawHasWoolTerms) ||
                    rawKeyUpper.includes(tpUpper.replace(/[^A-Z0-9]/g, ''))) {
                    bestMatch = tp;
                    break;
                }
            }
            
            if (bestMatch) {
                rawKeyToMaterialMap[rawKey] = bestMatch;
                componentsByMaterial[bestMatch].rawKeys.push(rawKey);
                rawCompTotals[rawKey].forEach((v, i) => {
                    componentsByMaterial[bestMatch].totalVector[i] += (v || 0);
                });
            }
        });
        
        // Build fullTitle with percentages from title extraction
        let percentagesStr = '';
        if (titlePctArr && titlePctArr.length > 0) {
            const pctDisplay = titlePctArr.map(p => Math.round(p * 100)).join('/');
            percentagesStr = ` (${pctDisplay}%)`;
        } else if (firstItemWithYarn) {
            const yarnStr = firstItemWithYarn.yarn || '';
            const match = yarnStr.match(/\((\d+\/\d+.*?)\)/);
            if (match) percentagesStr = ` (${match[1]})`;
        }
        const fullTitle = group.title + percentagesStr;
        
        // Update group title for display
        tbody.innerHTML = tbody.innerHTML.replace(
            `<tr class="group-header"><td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${group.title}</td></tr>`, 
            `<tr class="group-header"><td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${fullTitle}</td></tr>`
        );
        
        // Auto-extract and confirm percentages from title (console log only for MAT. MEZCLAS)
        console.log('=== PROCESO EXTRACCIÓN % PARTICIPACIÓN ===');
        console.log(`Grupo: ${fullTitle}`);
        if (titleParts.length >= 2) {
            titleParts.forEach((part, idx) => {
                const pct = titlePctArr[idx] ? Math.round(titlePctArr[idx] * 100) : 0;
                console.log(`Material ${idx + 1}: ${part}`);
                console.log(`% Participación ${idx + 1}: ${pct}`);
            });
        }
        console.log('Iniciando cálculos de Kg REQ...');
        // group._pctSaved will be set after validating/normalizing extracted percentages

        // Recompute percentages based on material components
        group.componentPercentages = group.componentPercentages || {};
        const groupTotalForPercentages = group.groupRawTotals.reduce((a,b)=>a+b,0);
        Object.keys(componentsByMaterial).forEach(matComp => {
            const compTotal = componentsByMaterial[matComp].totalVector.reduce((a,b)=>a+b,0);
            group.componentPercentages[matComp] = groupTotalForPercentages > 0 ? compTotal / groupTotalForPercentages : 0;
        });
        
        // Order: ALGODONES first (in title order), then OTHER FIBERS (in title order)
        const sortedMatComponents = [];
        const cottonComps = [];
        const otherComps = [];
        
        titleParts.forEach(tp => {
            const tpU = (tp || '').toUpperCase();
            const isCot = isAlgodon(tp) || /PIMA|COP|ALGODON|COTON|COTTON/.test(tpU);
            if (isCot) cottonComps.push(tp); else otherComps.push(tp);
        });
        
        const finalOrder = cottonComps.concat(otherComps);

        // Parse percentages from yarn (fallback) using robust helper
        let parsedPctArr = [];
        // Prefer title percentages when available
        if (titlePctArr && titlePctArr.length > 0) {
            parsedPctArr = titlePctArr.slice();
        } else if (firstItemWithYarn) {
            parsedPctArr = getPercentages(firstItemWithYarn.yarn || '') || [];
        }
        // If not found on first yarn, try other yarns in the group
        if ((!parsedPctArr || parsedPctArr.length === 0) && group.uniqueYarns && group.uniqueYarns.size > 0) {
            for (let gItem of GLOBAL_ITEMS) {
                if (!group.uniqueYarns.has(gItem.id)) continue;
                const p = getPercentages(gItem.yarn || '');
                if (p && p.length > 0) { parsedPctArr = p; break; }
            }
        }

        // Build initial percentage candidates for each material (in finalOrder)
        const pctCandidates = {};
        try {
            finalOrder.forEach(mat => {
                let pv = 0;
                try {
                    const canon = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(mat) : null;
                    if (typeof materialPctMap !== 'undefined' && typeof materialPctMap[mat] !== 'undefined') pv = materialPctMap[mat];
                    else if (typeof materialPctMap !== 'undefined' && canon && typeof materialPctMap[canon] !== 'undefined') pv = materialPctMap[canon];
                    else if (parsedPctArr && parsedPctArr.length === titleParts.length) {
                        const idxTitle = titleParts.indexOf(mat);
                        if (idxTitle >= 0) { const raw = parsedPctArr[idxTitle] || 0; pv = (raw > 1) ? (raw/100) : raw; }
                    }
                    if ((!pv || pv === 0) && group.componentPercentages) {
                        if (canon && typeof group.componentPercentages[canon] !== 'undefined') pv = group.componentPercentages[canon];
                        else if (typeof group.componentPercentages[mat] !== 'undefined') pv = group.componentPercentages[mat];
                    }
                } catch (e) { pv = 0; }
                pctCandidates[mat] = (pv || 0);
            });
        } catch (e) { /* ignore */ }

        // Validate/normalize sum of pctCandidates
        const sumPct = Object.keys(pctCandidates).reduce((s,k)=>s + (pctCandidates[k]||0), 0);
        let adjusted = false;
        const TOL = 0.005; // tolerance 0.5%
        if (sumPct <= 0.0000001) {
            console.warn('MEZCLAS: No se encontraron porcentajes para grupo', group.title);
            group._pctSaved = false;
        } else {
            if (Math.abs(sumPct - 1) > TOL) {
                // normalize proportionally
                const scale = 1 / sumPct;
                Object.keys(pctCandidates).forEach(k => { pctCandidates[k] = (pctCandidates[k] || 0) * scale; });
                adjusted = true;
                console.warn(`MEZCLAS: Porcentajes del grupo '${group.title}' normalizados (factor ${scale.toFixed(4)}). Nueva suma: ${Object.keys(pctCandidates).reduce((s,k)=>s + (pctCandidates[k]||0),0).toFixed(4)}`);
            }
            group._pctSaved = true;
        }

        // Update group header to always include the determined percentages (if any)
        try {
            const headerEl = document.getElementById(`group-header-${groupIndex}`);
            if (headerEl) {
                const pctDisplay = Object.keys(pctCandidates).map(k => Math.round((pctCandidates[k]||0)*100)).join('/');
                const headerHtml = `<td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${group.title}${pctDisplay ? ' (' + pctDisplay + '%)' : ''}</td>`;
                headerEl.innerHTML = headerHtml;
            }
        } catch (e) { /* ignore */ }

        // Debug: when user reports wrong totals, log details for this group's mapping
        try {
            if (rawTitle && /PES\s+RECICLADO\s*\/?\s*COTTON/i.test(rawTitle)) {
                console.groupCollapsed('MEZCLAS DEBUG -', rawTitle);
                console.log('titleParts:', titleParts);
                console.log('titlePctArr:', titlePctArr);
                console.log('materialPctMap:', materialPctMap);
                console.log('parsedPctArr:', parsedPctArr);
                console.log('rawCompTotals keys:', Object.keys(rawCompTotals));
                const compSummary = {};
                Object.keys(componentsByMaterial).forEach(k => { compSummary[k] = componentsByMaterial[k].totalVector.map(v=>Math.round(v)); });
                console.log('componentsByMaterial (rounded):', compSummary);
                console.groupEnd();
            }
        } catch (e) { console.warn('mezclas debug log failed', e); }

        // First pass: compute comp vectors for each material in finalOrder (don't render yet)
        const initialVectors = {}; // matName -> vector
        const initialPcts = {}; // matName -> computed pct (sum divided by group total)
        const usedCandidates = new Set();
        finalOrder.forEach((matCompName, compIndex) => {
            const existing = componentsByMaterial[matCompName] || { totalVector: new Array(12).fill(0), rawKeys: [] };
            let compVector = existing.totalVector.slice();
            // compute fallback pct if empty
            const hasNonZero = compVector.some(v => Math.abs(v) >= 0.01);
            if (!hasNonZero) {
                // Try title-ordered mapping first
                let pct = undefined;
                if (materialPctMap) {
                    if (typeof materialPctMap[matCompName] !== 'undefined') pct = materialPctMap[matCompName];
                    else try { const c = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(matCompName) : null; if (c && typeof materialPctMap[c] !== 'undefined') pct = materialPctMap[c]; } catch(e){}
                }
                if (typeof pct === 'undefined' && parsedPctArr.length === titleParts.length) {
                    const titleIdx = titleParts.indexOf(matCompName);
                    if (titleIdx >= 0) { let rawVal = parsedPctArr[titleIdx] || 0; pct = (rawVal > 1) ? (rawVal / 100) : rawVal; }
                }
                if (typeof pct === 'undefined' && group.componentPercentages && group.componentPercentages[matCompName]) pct = group.componentPercentages[matCompName] || 0;
                if (pct && pct > 0) compVector = group.groupRawTotals.map(v => (v || 0) * pct);
            }
            initialVectors[matCompName] = compVector;
            const sum = (compVector || []).reduce((a,b)=>a+(b||0),0);
            initialPcts[matCompName] = groupTotalSum > 0 ? sum / groupTotalSum : 0;
        });

        // If we have explicit title percentages, build a desiredVectors map that assigns
        // the correct vector to each titlePart according to title order (by canonical match or pct match).
        const desiredVectors = {};
        if (titlePctArr && titlePctArr.length === titleParts.length) {
            // Build a copy of candidate names to match
            const candidates = Object.keys(initialVectors).slice();
            const candidateUsed = {};
            for (let t = 0; t < titleParts.length; t++) {
                const tp = titleParts[t];
                const expectedPct = titlePctArr[t];
                let assigned = null;
                // 1) try canonical exact match
                try {
                    const canonTp = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(tp) : null;
                    for (let c of candidates) {
                        if (candidateUsed[c]) continue;
                        const canonC = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(c) : null;
                        if (canonTp && canonC && canonTp === canonC) { assigned = c; break; }
                    }
                } catch(e) {}
                // 2) if not found, try exact string match
                if (!assigned) {
                    for (let c of candidates) { if (candidateUsed[c]) continue; if (c === tp) { assigned = c; break; } }
                }
                // 3) if still not found, match by nearest computed pct
                if (!assigned) {
                    let best = null; let bestDiff = 1;
                    for (let c of candidates) {
                        if (candidateUsed[c]) continue;
                        const diff = Math.abs((initialPcts[c] || 0) - expectedPct);
                        if (diff < bestDiff) { bestDiff = diff; best = c; }
                    }
                    if (best) assigned = best;
                }
                if (assigned) {
                    desiredVectors[tp] = initialVectors[assigned];
                    candidateUsed[assigned] = true;
                } else {
                    // Fallback: build from group totals * expectedPct
                    desiredVectors[tp] = group.groupRawTotals.map(v => (v || 0) * expectedPct);
                }
            }
        }

        // Second pass: render rows in finalOrder, but pull vector from desiredVectors (title-ordered) when possible
        finalOrder.forEach((matCompName, compIndex) => {
            const defaultMerma = compIndex === 0 ? 40 : 15;
            // Display label should be material name only; % goes into the input field
            const displayLabel = matCompName;
            // Determine compVector to render: prefer desiredVectors matching this material (by canonical or exact), else use initialVectors
            let compVector = initialVectors[matCompName] || new Array(12).fill(0);
            // look for desired vector keyed by same canonical or exact title
            let foundDesired = null;
            try {
                const canon = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(matCompName) : null;
                // check desiredVectors by exact match
                if (desiredVectors && desiredVectors[matCompName]) foundDesired = desiredVectors[matCompName];
                else if (canon) {
                    for (let k of Object.keys(desiredVectors || {})) {
                        const kc = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(k) : null;
                        if (kc && kc === canon) { foundDesired = desiredVectors[k]; break; }
                    }
                }
            } catch(e) {}
            if (foundDesired) compVector = foundDesired.slice();

            // Use precomputed pctCandidates when available
            const pctVal = (typeof pctCandidates !== 'undefined' && typeof pctCandidates[matCompName] !== 'undefined') ? pctCandidates[matCompName] : 0;

            // Render rows (same as before)
            if (isAlgodon(matCompName)) {
                let kgCells = activeIndices.map(idx => {
                    const base = compVector[idx] || 0;
                    if (Math.abs(base) < 0.01) return `<td class="text-right px-2">-</td>`;
                    const req = base / (1 - defaultMerma/100);
                    return `<td class="text-right px-2 font-bold text-orange-800" id="kgreq-m-${groupIndex}-${compIndex}-${idx}">${formatNumber(req)}</td>`;
                }).join('');
                let totalKgReq = 0;
                activeIndices.forEach(idx => { totalKgReq += (compVector[idx] / (1-defaultMerma/100)); });
                kgCells += `<td class="text-right px-2 total-col font-bold text-orange-900">${formatNumber(totalKgReq)}</td>`;
                tbody.innerHTML += `<tr class="row-req bg-orange-50"><td colspan="4" class="text-right pr-2 py-1 text-xs"><div class="flex items-center justify-end w-full"><span class="mr-1 text-orange-900 font-bold">KG REQ ${escapeHtml(displayLabel)}</span><input type="number" id="pct-m-${groupIndex}-${compIndex}" class="pct-input mr-2" value="${Math.round((pctVal || 0)*100)}" min="0" max="100" required placeholder="Requerido" title="El % de participación es obligatorio" oninput="recalcMezclaComponent(${groupIndex}, ${compIndex})"><span class="mr-1 text-orange-900 font-bold">(Merma</span><input type="number" id="merma-m-${groupIndex}-${compIndex}" class="merma-input" value="${defaultMerma}" min="0" max="99" oninput="recalcMezclaComponent(${groupIndex}, ${compIndex})"><span class="text-orange-900 font-bold">%):</span></div></td>${kgCells}</tr>`;

                let qqCells = activeIndices.map(idx => {
                    const base = compVector[idx] || 0;
                    if (Math.abs(base) < 0.01) return `<td class="text-right px-2">-</td>`;
                    const req = base / (1 - defaultMerma/100);
                    return `<td class="text-right px-2 font-bold text-orange-800" id="qq-m-${groupIndex}-${compIndex}-${idx}">${formatNumber(req/46)}</td>`;
                }).join('');
                let totalReq = 0;
                activeIndices.forEach(idx => { totalReq += (compVector[idx] / (1-defaultMerma/100)); });
                qqCells += `<td class="text-right px-2 total-col font-bold text-orange-900">${formatNumber(totalReq/46)}</td>`;
                tbody.innerHTML += `<tr class="row-req bg-orange-50"><td colspan="4" class="text-right pr-2 py-1 text-xs"><div class="flex items-center justify-end w-full"><span class="mr-1 text-orange-900 font-bold">QQ REQ ${escapeHtml(displayLabel)}</span></div></td>${qqCells}</tr>`;
            } else {
                let reqCells = activeIndices.map(idx => {
                    const base = compVector[idx] || 0;
                    if (Math.abs(base) < 0.01) return `<td class="text-right px-2">-</td>`;
                    return `<td class="text-right px-2 font-bold text-orange-800" id="req-m-${groupIndex}-${compIndex}-${idx}">${formatNumber(base/(1-defaultMerma/100))}</td>`;
                }).join('');
                let totalReq = 0;
                activeIndices.forEach(idx => { totalReq += (compVector[idx] / (1-defaultMerma/100)); });
                reqCells += `<td class="text-right px-2 total-col font-bold text-orange-900">${formatNumber(totalReq)}</td>`;
                tbody.innerHTML += `<tr class="row-req bg-orange-50"><td colspan="4" class="text-right pr-2 py-1 text-xs"><div class="flex items-center justify-end w-full"><span class="mr-1 text-orange-900 font-bold">KG REQ ${escapeHtml(displayLabel)}</span><input type="number" id="pct-m-${groupIndex}-${compIndex}" class="pct-input mr-2" value="${Math.round((pctVal || 0)*100)}" min="0" max="100" oninput="recalcMezclaComponent(${groupIndex}, ${compIndex})"><span class="mr-1 text-orange-900 font-bold">(Merma</span><input type="number" id="merma-m-${groupIndex}-${compIndex}" class="merma-input" value="${defaultMerma}" min="0" max="99" oninput="recalcMezclaComponent(${groupIndex}, ${compIndex})"><span class="text-orange-900 font-bold">%):</span></div></td>${reqCells}</tr>`;
            }
        }); 
        
        tbody.innerHTML += `<tr><td colspan="${4 + activeIndices.length + 1}" class="h-4"></td></tr>`; 
    });
    
    const baseTotal = (globalMezclaBase || []).reduce((a,b)=>a+(b||0),0);
    const htrTotal = (globalMezclaHTR || []).reduce((a,b)=>a+(b||0),0);
    const combined = (globalMezclaBase || []).map((v,i) => (v||0) + (globalMezclaHTR||[])[i] || 0);
    const combinedTotal = combined.reduce((a,b)=>a+(b||0),0);
    document.getElementById('mezclasFooter').innerHTML = `<tr class="bg-orange-100 font-bold border-t-2 border-orange-500"><td colspan="4" class="text-right pr-4 py-2 text-orange-900">SUMA MEZCLA (BASE):</td>${generateCellsHTML(globalMezclaBase)}<td class="text-right px-2 font-bold text-orange-900">${formatNumber(baseTotal)}</td></tr><tr class="bg-orange-100 font-bold"><td colspan="4" class="text-right pr-4 py-2 text-orange-900">SUMA HTR (MEZCLA):</td>${generateCellsHTML(globalMezclaHTR)}<td class="text-right px-2 font-bold text-orange-900">${formatNumber(htrTotal)}</td></tr><tr class="grand-total-row" style="background-color: #7c2d12;"><td colspan="4" class="text-right pr-4 py-2">TOTAL MEZCLAS (BASE + HTR):</td>${generateCellsHTML(combined)}<td class="text-right px-2 font-bold">${formatNumber(combinedTotal)}</td></tr>`;
}

function recalcMezclaComponent(groupIndex, compIndex) {
    const group = (window.mezclaGroups || mezclaGroups)[groupIndex];
    if (!group) return;
    // Extract material components exactly like renderMezclasTable (remove trailing pct parentheses first)
    const rawTitle = (group.title || '').toString();
    const titleNoPct = rawTitle.replace(/\s*\(\s*\d+(?:\/\d+)+\s*%?\s*\)\s*$/,'').trim();
    let titleParts = [];
    if (titleNoPct.indexOf('/') >= 0) {
        titleParts = titleNoPct.split('/').map(s => s.trim()).filter(Boolean);
    } else {
        // fallback: use same heuristics as renderMezclasTable
        try {
            const firstItemWithYarn = Array.from(GLOBAL_ITEMS).find(item => group.uniqueYarns.has(item.id));
            let pctArr = [];
            try { pctArr = getPercentages(firstItemWithYarn ? (firstItemWithYarn.yarn || '') : rawTitle) || []; } catch (e) { pctArr = []; }
            if (pctArr && pctArr.length >= 2) {
                try { titleParts = splitComponentsByKeywords(titleNoPct, pctArr.length) || [titleNoPct]; } catch (e) { titleParts = [titleNoPct]; }
            } else {
                try { const comps = getComponentNames(titleNoPct) || []; titleParts = comps.length ? comps : [titleNoPct]; } catch (e) { titleParts = [titleNoPct]; }
            }
        } catch (e) { titleParts = [(titleNoPct || rawTitle)]; }
    }

    // Build titlePctArr and materialPctMap (MUST follow title order)
    let titlePctArr = [];
    try {
        const mTitlePct = rawTitle.match(/\(\s*(\d+(?:\/\d+)+)\s*%?\s*\)/);
        if (mTitlePct) {
            const parts = mTitlePct[1].split('/').map(p => { const num = parseFloat(p.replace(/[^0-9.]/g, '')); return (isNaN(num) ? 0 : num); });
            if (parts.length === titleParts.length) titlePctArr = parts.map(n => (n > 1 ? n / 100 : n));
        }
    } catch (e) { titlePctArr = []; }
    const materialPctMap = {};
    if (titlePctArr && titlePctArr.length === titleParts.length) {
        for (let i = 0; i < titleParts.length; i++) {
            const mat = titleParts[i];
            const pct = titlePctArr[i];
            materialPctMap[mat] = pct;
            try {
                const canon = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(mat) : null;
                if (canon) materialPctMap[canon] = pct;
            } catch (e) {}
        }
    }
    
    // Map raw keys to material components
    const rawCompTotals = group.componentTotalsTotal || {};
    const componentsByMaterial = {};
    Object.keys(titleParts).forEach(idx => {
        componentsByMaterial[titleParts[idx]] = { totalVector: new Array(12).fill(0), rawKeys: [] };
    });
    
    Object.keys(rawCompTotals).forEach(rawKey => {
        const rawKeyUpper = rawKey.toString().toUpperCase();
        let bestMatch = null;
        
        for (let tp of titleParts) {
            const tpUpper = tp.toUpperCase();
            const tpHasAlgodonTerms = /ALGODON|COTTON|ALG\b/.test(tpUpper);
            const rawHasAlgodonTerms = /ALGODON|COTTON|ALG\b/.test(rawKeyUpper);
            const tpHasPesTerms = /PES|REPREVE|RECYCL|RECICLADO/.test(tpUpper);
            const rawHasPesTerms = /PES|REPREVE|RECYCL|RECICLADO/.test(rawKeyUpper);
            const tpHasLyocellTerms = /LYOCELL|TENCEL/.test(tpUpper);
            const rawHasLyocellTerms = /LYOCELL|TENCEL/.test(rawKeyUpper);
            const tpHasModalTerms = /MODAL/.test(tpUpper);
            const rawHasModalTerms = /MODAL/.test(rawKeyUpper);
            const tpHasWoolTerms = /WOOL|MERINO/.test(tpUpper);
            const rawHasWoolTerms = /WOOL|MERINO/.test(rawKeyUpper);

            if ((tpHasAlgodonTerms && rawHasAlgodonTerms) ||
                (tpHasPesTerms && rawHasPesTerms) ||
                (tpHasLyocellTerms && rawHasLyocellTerms) ||
                (tpHasModalTerms && rawHasModalTerms) ||
                (tpHasWoolTerms && rawHasWoolTerms) ||
                rawKeyUpper.includes(tpUpper.replace(/[^A-Z0-9]/g, ''))) {
                bestMatch = tp;
                break;
            }
        }
        
        if (bestMatch) {
            componentsByMaterial[bestMatch].rawKeys.push(rawKey);
            rawCompTotals[rawKey].forEach((v, i) => {
                componentsByMaterial[bestMatch].totalVector[i] += (v || 0);
            });
        }
    });
    
    // Build final order: cottons first, then others, in material order
    const cottonComps = [];
    const otherComps = [];
    titleParts.forEach(tp => {
        const tpU = (tp || '').toUpperCase();
        const isCot = isAlgodon(tp) || /PIMA|COP|ALGODON|COTON|COTTON/.test(tpU);
        if (isCot) cottonComps.push(tp); else otherComps.push(tp);
    });
    const finalOrder = cottonComps.concat(otherComps);

    // Map compIndex directly to finalOrder (we render a row per material component)
    const matCompName = finalOrder[compIndex];
    if (!matCompName) return;

    // Build componentsByMaterial vector (may be zeros)
    const compEntry = componentsByMaterial[matCompName] || { totalVector: new Array(12).fill(0), rawKeys: [] };
    let compVector = compEntry.totalVector.slice();
    const defaultMerma = compIndex === 0 ? 40 : 15;
    const mermaEl = document.getElementById(`merma-m-${groupIndex}-${compIndex}`);
    let merma = mermaEl ? parseFloat(mermaEl.value) : NaN;
    if (isNaN(merma)) merma = defaultMerma;
    const factor = Math.max(0.0001, 1 - merma / 100);

    // If compVector is all zeros, try to rebuild from parsed percentages or group.componentPercentages
    const firstItemWithYarn = Array.from(GLOBAL_ITEMS).find(item => group.uniqueYarns.has(item.id));
    let parsedPctArr = [];
    if (firstItemWithYarn) parsedPctArr = getPercentages(firstItemWithYarn.yarn || '') || [];
    if ((!parsedPctArr || parsedPctArr.length === 0) && group.uniqueYarns && group.uniqueYarns.size > 0) {
        for (let gItem of GLOBAL_ITEMS) {
            if (!group.uniqueYarns.has(gItem.id)) continue;
            const p = getPercentages(gItem.yarn || '');
            if (p && p.length > 0) { parsedPctArr = p; break; }
        }
    }
    const hasNonZero = compVector.some(v => Math.abs(v) >= 0.01);
    // Priority override: if user adjusted percentage input, always use it (regardless of raw totals)
    const pctEl = document.getElementById(`pct-m-${groupIndex}-${compIndex}`);
    // Ensure pct inputs are always filled (like merma). If empty, autofill from title or computed pct.
    const groupTotalSum = (group.groupRawTotals || []).reduce((a,b)=>a+(b||0),0) || 0;
    const compEntry2 = componentsByMaterial[matCompName] || { totalVector: new Array(12).fill(0) };
    const compSum = (compEntry2.totalVector || []).reduce((a,b)=>a+(b||0),0) || 0;
    const computedPct = groupTotalSum > 0 ? (compSum / groupTotalSum) : 0;
    let usedPct = null;
    if (pctEl) {
        if (pctEl.value === '' || pctEl.value == null) {
            // Try to auto-fill from title/extracted maps or group percentages
            let suggestedPct = null;
            try {
                if (typeof materialPctMap !== 'undefined' && typeof materialPctMap[matCompName] !== 'undefined') suggestedPct = materialPctMap[matCompName];
                else {
                    const canon = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(matCompName) : null;
                    if (canon && typeof materialPctMap !== 'undefined' && typeof materialPctMap[canon] !== 'undefined') suggestedPct = materialPctMap[canon];
                }
                if ((!suggestedPct || suggestedPct === 0) && parsedPctArr && parsedPctArr.length === titleParts.length) {
                    const idxTitle = titleParts.indexOf(matCompName);
                    if (idxTitle >= 0) { const raw = parsedPctArr[idxTitle] || 0; suggestedPct = (raw > 1) ? (raw/100) : raw; }
                }
                if ((!suggestedPct || suggestedPct === 0) && group.componentPercentages) {
                    const canon2 = (typeof getStrictCanonicalToken === 'function') ? getStrictCanonicalToken(matCompName) : null;
                    if (canon2 && typeof group.componentPercentages[canon2] !== 'undefined') suggestedPct = group.componentPercentages[canon2];
                    else if (typeof group.componentPercentages[matCompName] !== 'undefined') suggestedPct = group.componentPercentages[matCompName];
                }
            } catch (e) { suggestedPct = null; }
            if (suggestedPct && !isNaN(suggestedPct) && suggestedPct > 0) {
                pctEl.value = Math.round(suggestedPct * 100);
                usedPct = suggestedPct;
                pctEl.style.border = '';
                pctEl.style.backgroundColor = '';
            } else {
                // leave visual hint and stop if we cannot determine a pct
                pctEl.style.border = '2px solid red';
                pctEl.style.backgroundColor = '#ffe6e6';
                return;
            }
        } else {
            const pv = parseFloat(pctEl.value);
            if (!isNaN(pv)) {
                usedPct = (pv > 1) ? (pv / 100) : pv;
                pctEl.style.border = '';
                pctEl.style.backgroundColor = '';
            }
        }
    }

    if (usedPct !== null && !isNaN(usedPct) && usedPct > 0) {
        compVector = group.groupRawTotals.map(v => (v || 0) * usedPct);
    } else if (!hasNonZero) {
        // If materialPctMap exists, USE IT (title order) - MANDATORY
        if (materialPctMap && typeof materialPctMap[matCompName] !== 'undefined') {
            const pct = materialPctMap[matCompName] || 0;
            if (pct > 0) compVector = group.groupRawTotals.map(v => (v || 0) * pct);
        } else if (parsedPctArr.length === titleParts.length) {
            let rawVal = parsedPctArr[titleParts.indexOf(matCompName)] || 0;
            let pct = (rawVal > 1) ? (rawVal / 100) : rawVal;
            compVector = group.groupRawTotals.map(v => (v || 0) * pct);
        } else if (group.componentPercentages && group.componentPercentages[matCompName]) {
            const pct = group.componentPercentages[matCompName] || 0;
            compVector = group.groupRawTotals.map(v => (v || 0) * pct);
        }
    }

    let totalKg = 0;
    let totalQq = 0;
    activeIndices.forEach(idx => {
        const base = compVector[idx] || 0;
        if (Math.abs(base) < 0.01) {
            const kgCell = document.getElementById(`kgreq-m-${groupIndex}-${compIndex}-${idx}`);
            if (kgCell) kgCell.innerHTML = '-';
            const qqCell = document.getElementById(`qq-m-${groupIndex}-${compIndex}-${idx}`);
            if (qqCell) qqCell.innerHTML = '-';
            const reqCell = document.getElementById(`req-m-${groupIndex}-${compIndex}-${idx}`);
            if (reqCell) reqCell.innerHTML = '-';
            return;
        }
        const req = base / factor;
        if (isAlgodon(matCompName)) {
            const kgCell = document.getElementById(`kgreq-m-${groupIndex}-${compIndex}-${idx}`);
            if (kgCell) kgCell.innerHTML = formatNumber(req);
            const qqCell = document.getElementById(`qq-m-${groupIndex}-${compIndex}-${idx}`);
            if (qqCell) qqCell.innerHTML = formatNumber(req / 46);
            totalKg += req;
            totalQq += req / 46;
        } else {
            const cell = document.getElementById(`req-m-${groupIndex}-${compIndex}-${idx}`);
            if (cell) cell.innerHTML = formatNumber(req);
            totalKg += req;
        }
    });

    // Update the KG row total
    if (mermaEl) {
        const kgRow = mermaEl.closest('tr');
        if (kgRow) {
            const tds = Array.from(kgRow.querySelectorAll('td'));
            if (tds.length > 0) {
                const lastTd = tds[tds.length - 1];
                if (lastTd) lastTd.innerHTML = formatNumber(totalKg);
            }
            if (isAlgodon(matCompName)) {
                const qqRow = kgRow.nextElementSibling;
                if (qqRow) {
                    const qqTds = Array.from(qqRow.querySelectorAll('td'));
                    if (qqTds.length > 0) {
                        const lastQ = qqTds[qqTds.length - 1];
                        if (lastQ) lastQ.innerHTML = formatNumber(totalQq);
                    }
                }
            }
        }
    }
}

// Save/confirm percentages for a group and trigger calculations
function saveGroupPcts(groupIndex) {
    const group = (window.mezclaGroups || mezclaGroups)[groupIndex];
    if (!group) return;
    // find pct inputs for this group
    const inputs = Array.from(document.querySelectorAll(`[id^="pct-m-${groupIndex}-"]`));
    if (!inputs || inputs.length === 0) {
        alert('No se encontraron campos de % para este grupo.');
        return;
    }
    // validate none are empty
    for (let inp of inputs) {
        const v = inp.value;
        // clear previous error
        inp.style.border = '';
        const errId = `err-${inp.id}`;
        const prev = document.getElementById(errId);
        if (prev) prev.remove();
        if (v === '' || v == null) {
            inp.style.border = '2px solid red';
            const span = document.createElement('span');
            span.id = errId;
            span.className = 'pct-field-error';
            span.style.color = '#b91c1c';
            span.style.marginLeft = '6px';
            span.textContent = 'Obligatorio';
            inp.parentNode && inp.parentNode.appendChild(span);
            inp.focus();
            return;
        }
    }
    // Validate sum of percentages (inputs hold 0-100 values)
    const sum100 = inputs.reduce((s, i) => s + (parseFloat(i.value) || 0), 0);
    const TOL100 = 0.5; // 0.5% tolerance on 100-scale
    if (sum100 <= 0.000001) {
        alert('La suma de porcentajes es 0. Verifique los valores.');
        return;
    }
    if (Math.abs(sum100 - 100) > TOL100) {
        // normalize proportionally and update inputs
        const scale = 100 / sum100;
        inputs.forEach(i => {
            const v = parseFloat(i.value) || 0;
            i.value = Math.round(v * scale);
        });
        console.warn(`MEZCLAS: Porcentajes auto-normalizados para grupo ${group.title} (factor ${scale.toFixed(4)}).`);
    }
    // mark saved and trigger recalculation for each component
    group._pctSaved = true;
        // Update header to reflect saved percentages
        try {
            const sortedInputs = inputs.slice().sort((a,b) => {
                const ai = parseInt(a.id.split('-').pop(), 10);
                const bi = parseInt(b.id.split('-').pop(), 10);
                return ai - bi;
            });
            const pctDisplay = sortedInputs.map(i => Math.round(parseFloat(i.value) || 0)).join('/');
            const headerEl = document.getElementById(`group-header-${groupIndex}`);
            if (headerEl) headerEl.innerHTML = `<td colspan="${4 + activeIndices.length + 1}" class="py-2 pl-4">MATERIAL: ${group.title}${pctDisplay ? ' (' + pctDisplay + '%)' : ''}</td>`;
        } catch (e) { /* ignore */ }
    // trigger recalc for all component indexes present
    for (let inp of inputs) {
        const m = inp.id.match(/^pct-m-\d+-(\d+)$/);
        if (m) {
            const compIndex = parseInt(m[1], 10);
            try { recalcMezclaComponent(groupIndex, compIndex); } catch (e) { /* ignore */ }
        }
    }
    // remove any lingering error styles
    inputs.forEach(i => { i.style.border = ''; const prev = document.getElementById('err-'+i.id); if (prev) prev.remove(); });
}
