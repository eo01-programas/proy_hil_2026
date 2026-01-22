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
    // Print detailed breakdown for Algodón (QQ) totals to console
    try { logAlgodonQQDetail(); } catch (e) { /* ignore logging errors */ }
    try { logPimaOrgOcsDetail(); } catch (e) { /* ignore logging errors */ }
    try { logPimaOrgOcsAllMonths(); } catch (e) { /* ignore logging errors */ }
    renderFiberTable('otrasTable', detailOtras, ORDERED_OTHER_KEYS, false);
}

// Print all 12 months (total QQ) and per-client breakdown for a given fiber


function renderFiberTable(tableId, dataObj, orderedKeys, isAlgodon) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let html = `<thead class="sum-header-top"><tr><th class="py-2 px-3 text-left">FIBRA</th>${generateCellsHTML(null, true)}</tr></thead><tbody class="bg-white">`;
    
    let strictTotalVec = new Array(12).fill(0);

    orderedKeys.forEach((fiberName, idx) => {
        // Special case: ALGODÓN PIMA NC (QQ) must sum all PIMA that are NOT organic
        let fiberData = dataObj[fiberName] || { totalValues: new Array(12).fill(0), clients: {} };
        const fnU = (fiberName || '').toUpperCase();
        if (fnU.includes('PIMA') && fnU.includes('NC')) {
            // Compute PIMA NC totals and per-client breakdown directly from crudoGroups and mezclaGroups
            const agg = new Array(12).fill(0);
            const clientsMap = {}; // client -> vector[12]

            // Helper to ensure client vector exists
            const ensureClient = (c) => { if (!clientsMap[c]) clientsMap[c] = new Array(12).fill(0); };

            // 1) From crudoGroups (per-row hilados)
            try {
                (window.crudoGroups || crudoGroups || []).forEach(g => {
                    try {
                        const title = (g.title || '').toString().toUpperCase();
                        if (!/PIMA/.test(title)) return;
                        if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(title)) return;
                        const filteredRows = (g.rows || []).filter(r => {
                            const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                            return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                        });
                        filteredRows.forEach(row => {
                            try {
                                if (!row || !row.yarn) return;
                                const yarnUp = (row.yarn || '').toString().toUpperCase();
                                if (!/PIMA/.test(yarnUp)) return;
                                if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(yarnUp)) return;
                                const client = row.client || 'VARIOS';
                                ensureClient(client);
                                for (let i = 0; i < 12; i++) {
                                    const raw = parseFloat(row.values && row.values[i] ? row.values[i] : 0) || 0;
                                    if (Math.abs(raw) < 0.0001) continue;
                                    const kgReq = raw / (1 - 0.40);
                                    const qq = kgReq / 46;
                                    agg[i] += qq;
                                    clientsMap[client][i] += qq;
                                }
                            } catch (e) { /* ignore row */ }
                        });
                    } catch (e) { /* ignore group */ }
                });
            } catch (e) { /* ignore */ }

            // 2) From mezclaGroups: use componentTotalsTotal and assign group contribution to first client in uniqueYarns
            try {
                (window.mezclaGroups || mezclaGroups || []).forEach(g => {
                    try {
                        const title = (g.title || '').toString().toUpperCase();
                        if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(title)) return; // skip certified groups
                        const compTotals = g.componentTotalsTotal || {};
                        const client = g.uniqueYarns && g.uniqueYarns.size > 0 ? (Array.from(g.uniqueYarns).map(id => GLOBAL_ITEMS.find(x => x.id === id)).filter(x => x)[0]?.client || 'VARIOS') : 'VARIOS';
                        ensureClient(client);
                        Object.keys(compTotals).forEach(ct => {
                            try {
                                if (!ct) return;
                                const cu = ct.toString().toUpperCase();
                                if (!/PIMA/.test(cu)) return;
                                if (/OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(cu)) return;
                                const vec = compTotals[ct] || new Array(12).fill(0);
                                for (let i = 0; i < 12; i++) {
                                    const kgContrib = parseFloat(vec[i] || 0) || 0;
                                    if (Math.abs(kgContrib) < 0.0001) continue;
                                    const kgReq = kgContrib / (1 - 0.40);
                                    const qq = kgReq / 46;
                                    agg[i] += qq;
                                    clientsMap[client][i] += qq;
                                }
                            } catch (e) { /* ignore comp */ }
                        });
                    } catch (e) { /* ignore group */ }
                });
            } catch (e) { /* ignore */ }

            fiberData = { totalValues: agg, clients: clientsMap };
            try { if (typeof detailAlgodon !== 'undefined' && fiberName) detailAlgodon[fiberName] = fiberData; } catch (e) { /* ignore */ }
        }

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
        // main numeric row (plain values, no click)
        let row = `<tr class="border-b hover:bg-gray-50"><td class="border px-3 py-2">${escapeHtml(client)}</td>`;
        for (let i = 0; i < 12; i++) {
            const val = values[i] || 0; totals[i] += val;
            row += `<td class="border px-3 py-2 text-right">${formatNumber(val)}</td>`;
        }
        const sum = values.reduce((a, b) => a + b, 0);
        row += `<td class="border px-3 py-2 text-right font-bold">${formatNumber(sum)}</td></tr>`;
        tbody += row;

        // (Removed per-user request: no inline 'Fuente' row)
    });
    // After building the table body, log per-cell breakdowns to console for algodón modal
    try {
        clientKeys.forEach(client => {
            const values = clients[client] || [];
            for (let i = 0; i < 12; i++) {
                const val = parseFloat(values[i] || 0) || 0;
                if (Math.abs(val) < 0.0001) continue;
                try { logFiberCellBreakdown(fiberName, client, i, val, !!isAlgodon); } catch (e) { /* ignore logging errors */ }
            }
        });
    } catch (e) { /* ignore overall */ }

    let totalRow = `<tr class="bg-gray-200 font-bold border-top"><td class="border px-3 py-2">TOTAL</td>`;
    for (let i = 0; i < 12; i++) { totalRow += `<td class="border px-3 py-2 text-right">${formatNumber(totals[i])}</td>`; }
    const grandTotal = totals.reduce((a, b) => a + b, 0);
    totalRow += `<td class="border px-3 py-2 text-right">${formatNumber(grandTotal)}</td></tr>`;
    tbody += totalRow;
    document.getElementById('fiberDetailBody').innerHTML = tbody;
    document.getElementById('fiberDetailModal').classList.remove('hidden');
}

function closeFiberModal() { document.getElementById('fiberDetailModal').classList.add('hidden'); }

// Build contributors for a given fiber/client/month
function getTraceContributors(fiberDisplay, client, monthIdx, isAlgodon) {
    const contributors = [];
    // Helper to match fiber: normalize strings (remove diacritics, non-alnum) for robust comparison
    const normalizeForCompare = (s) => {
        if (s == null) return '';
        try {
            return s.toString().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z0-9]/g, '');
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
                return input.toString().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z0-9_]/g, ' ');
            } catch (e) { return input.toString().toUpperCase().replace(/[^A-Z0-9_]/g, ' '); }
        };

        // Detecta PIMA ORGANICO OCS:
        // Si el grupo TÍTULO tiene "(COP/PIMA/ALGODÓN) ORGANICO (OCS)" sin GOTS,
        // entonces cuenta componentes que tengan ORGANICO/ORG en el token
        // (sin requerir PIMA explícitamente en el componente)
        const tokenMatchesPimaOcs = (compToken, groupTitle) => {
            const a = normStr(compToken);
            const t = normStr(groupTitle || '');
            if (!a || !t) return false;

            // Excluir GOTS siempre
            if (a.includes('GOTS') || t.includes('GOTS')) return false;

            // Si el grupo NO tiene OCS, rechazar
            if (!t.includes('OCS')) return false;

            // Si el grupo tiene OCS pero no tiene ni PIMA ni COP ni ALGODON, rechazar
            const titleHasAlgodon = t.includes('PIMA') || t.includes('COP') || t.includes('ALGODON');
            if (!titleHasAlgodon) return false;

            // Ahora, si el grupo es (PIMA/COP) ORGANICO (OCS), acepta componentes con ORGANICO/ORG
            const hasPima = a.includes('PIMA');
            const hasCop = a.includes('COP');
            const hasOrg = a.includes('ORG') || a.includes('ORGANICO');
            const hasOcsToken = a.includes('OCS');

            // Caso 1: Componente tiene PIMA + OCS
            if (hasPima && hasOcsToken) return true;

            // Caso 2: Componente tiene PIMA + ORG y grupo tiene OCS
            if (hasPima && hasOrg) return true;

            // Caso 3: Componente tiene solo ORG/ORGANICO y grupo tiene (COP/PIMA) + OCS
            if (hasOrg && (t.includes('PIMA') || t.includes('COP'))) return true;

            // Caso 4: Token normalizado es PIMA_ORG_OCS
            if (a.includes('PIMA_ORG_OCS')) return true;

            // check normalized helpers
            try {
                if (typeof getNormalizedComponent === 'function') {
                    const norm = getNormalizedComponent(compToken);
                    if (norm && norm.toString().toUpperCase().indexOf('PIMA_ORG_OCS') >= 0) return true;
                }
            } catch (e) { }

            return false;
        };

        console.group(`ALGODÓN PIMA ORGANICO - OCS (QQ) — ${monthLabel} — Detalle completo (mejorado)`);
        let totalSumQQ = 0;

        // MAT. CRUDOS (fila por fila)
        console.group('MAT. CRUDOS');
        try {
            (window.crudoGroups || crudoGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    const titleUp = title.toUpperCase();
                    // quickly skip non-pima groups
                    if (!/PIMA/.test(titleUp) && !/OCS/.test(titleUp)) return;

                    let groupSum = 0;
                    console.group(`[${title}]`);
                    const filteredRows = (g.rows || []).filter(r => {
                        const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                        return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                    });
                    filteredRows.forEach(row => {
                        try {
                            if (!row || !row.yarn) return;
                            if (!tokenMatchesPimaOcs(row.yarn, g.title)) return;
                            const raw = parseFloat(row.values && row.values[monthIdx] ? row.values[monthIdx] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) return;
                            const merma = 40;
                            const kgReq = raw / (1 - merma/100);
                            const qq = kgReq / 46;
                            console.log(`${row.client} | ${row.yarn} — Raw: ${formatNumber(raw)} kg → Kg REQ: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                            groupSum += qq;
                        } catch (e) { /* ignore row */ }
                    });
                    console.log(`Grupo suma (${monthLabel}): ${formatNumber(groupSum)}`);
                    console.groupEnd();
                    totalSumQQ += groupSum;
                } catch (e) { /* ignore group */ }
            });
        } catch (e) { /* ignore */ }
        console.groupEnd();

        // MAT. MEZCLAS (componentes) — barrido completo, solo PIMA OCS
        console.group('MAT. MEZCLAS');
        try {
            (window.mezclaGroups || mezclaGroups || []).forEach((g) => {
                try {
                    const title = (g.title || '').toString();
                    const titleUp = normStr(title);
                    const compTotals = g.componentTotalsTotal || {};
                    const compPctMap = g.componentPercentages || {};
                    // Iterate ALL components; track if any PIMA OCS found
                    const keys = Object.keys(compTotals || {});

                    // DEBUG: Si el título tiene OCS, mostrar todos los componentes disponibles
                    if (titleUp.includes('OCS') && !titleUp.includes('GOTS')) {
                        console.log(`DEBUG [${title}] — Componentes disponibles: ${keys.join(', ')}`);
                    }

                    let groupSum = 0;
                    let groupPrinted = false;
                    console.group(`[${title}]`);
                    keys.forEach(compToken => {
                        try {
                            // Check if this component is PIMA OCS (component token + group title for OCS certification)
                            const meta = (g.componentMeta && g.componentMeta[compToken]) || null;
                            const isPimaOcsComp = (meta && meta.isPimaOcs) || tokenMatchesPimaOcs(compToken, title);
                            if (!isPimaOcsComp) return; // Skip non-PIMA OCS components

                            if (!groupPrinted) { groupPrinted = true; } // mark group as having relevant content
                            let vec = compTotals[compToken] || new Array(12).fill(0);
                            let kgContrib = parseFloat(vec[monthIdx] || 0) || 0;

                            // Fallback: if compTotals has 0 for this month, but we have a percentage and group colBases,
                            // attempt to compute kgContrib = g.colBases[monthIdx] * pct
                            if (Math.abs(kgContrib) < 0.0001) {
                                const pct = (typeof compPctMap[compToken] !== 'undefined') ? compPctMap[compToken] : null;
                                const groupBaseCol = (g.colBases && g.colBases[monthIdx]) ? parseFloat(g.colBases[monthIdx]) : 0;
                                const groupRawTotal = (g.groupRawTotals && g.groupRawTotals[monthIdx]) ? parseFloat(g.groupRawTotals[monthIdx]) : 0;
                                // 1) try pct * colBases
                                if (pct && groupBaseCol && groupBaseCol > 0) {
                                    kgContrib = groupBaseCol * pct;
                                    vec = vec.slice(); vec[monthIdx] = kgContrib;
                                    console.log(`(fallback) usado pct*colBases para ${compToken}: pct=${pct} colBases=${formatNumber(groupBaseCol)} => contrib=${formatNumber(kgContrib)}`);
                                }
                                // 2) try pct * groupRawTotals
                                if (Math.abs(kgContrib) < 0.0001 && pct && groupRawTotal && groupRawTotal > 0) {
                                    kgContrib = groupRawTotal * pct;
                                    vec = vec.slice(); vec[monthIdx] = kgContrib;
                                    console.log(`(fallback) usado pct*groupRawTotals para ${compToken}: pct=${pct} groupRaw=${formatNumber(groupRawTotal)} => contrib=${formatNumber(kgContrib)}`);
                                }
                                // 3) try summing unique yarns values * pct
                                if (Math.abs(kgContrib) < 0.0001 && pct && g.uniqueYarns && g.uniqueYarns.size > 0) {
                                    try {
                                        let sumItems = 0;
                                        Array.from(g.uniqueYarns).forEach(id => { const it = GLOBAL_ITEMS.find(x => x.id === id); if (it && it.values) sumItems += parseFloat(it.values[monthIdx] || 0) || 0; });
                                        if (sumItems > 0) {
                                            kgContrib = sumItems * pct;
                                            vec = vec.slice(); vec[monthIdx] = kgContrib;
                                            console.log(`(fallback) usado sum(uniqueYarns)*pct para ${compToken}: sumItems=${formatNumber(sumItems)} pct=${pct} => contrib=${formatNumber(kgContrib)}`);
                                        }
                                    } catch (e) { /* ignore item-sum fallback */ }
                                }
                            }

                            if (Math.abs(kgContrib) < 0.0001) return;
                            const pct = (typeof compPctMap[compToken] !== 'undefined') ? compPctMap[compToken] : null;
                            const merma = 40;
                            const kgReq = kgContrib / (1 - merma/100);
                            const qq = kgReq / 46;
                            console.log(`Componente: ${compToken} — Kg contrib: ${formatNumber(kgContrib)}${pct ? ' → pct: ' + Math.round(pct*100) + '%' : ''} → Kg REQ: ${formatNumber(kgReq)} → QQ: ${formatNumber(qq)}`);
                            groupSum += qq;
                        } catch (e) { /* ignore comp */ }
                    });
                    if (groupPrinted) {
                        console.log(`Grupo suma (${monthLabel}): ${formatNumber(groupSum)}`);
                        totalSumQQ += groupSum;
                    }
                    console.groupEnd();
                } catch (e) { /* ignore group */ }
            });
        } catch (e) { /* ignore */ }
        console.groupEnd();

        console.log('SUMA TOTAL QQ ('+monthLabel+'):', formatNumber(totalSumQQ));
        console.log('=== FIN DETALLE ===');
        console.groupEnd();
    } catch (e) { console.warn('Error al generar el log PIMA ORG OCS QQ (ENE)', e); }
}

// Log all 12 months for PIMA ORGANICO - OCS (QQ)
function logPimaOrgOcsAllMonths() {
    try {
        // Helper: normaliza string
        const normStr = (input) => {
            if (!input) return '';
            try {
                return input.toString().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z0-9_]/g, ' ');
            } catch (e) { return input.toString().toUpperCase().replace(/[^A-Z0-9_]/g, ' '); }
        };

        const tokenMatchesPimaOcs = (compToken, groupTitle) => {
            const a = normStr(compToken);
            const t = normStr(groupTitle || '');
            if (!a || !t) return false;
            if (a.includes('GOTS') || t.includes('GOTS')) return false;
            if (!t.includes('OCS')) return false;
            const titleHasAlgodon = t.includes('PIMA') || t.includes('COP') || t.includes('ALGODON');
            if (!titleHasAlgodon) return false;
            const hasPima = a.includes('PIMA');
            const hasCop = a.includes('COP');
            const hasOrg = a.includes('ORG') || a.includes('ORGANICO');
            const hasOcsToken = a.includes('OCS');
            if (hasPima && hasOcsToken) return true;
            if (hasPima && hasOrg) return true;
            if (hasOrg && (t.includes('PIMA') || t.includes('COP'))) return true;
            if (a.includes('PIMA_ORG_OCS')) return true;
            try {
                if (typeof getNormalizedComponent === 'function') {
                    const norm = getNormalizedComponent(compToken);
                    if (norm && norm.toString().toUpperCase().indexOf('PIMA_ORG_OCS') >= 0) return true;
                }
            } catch (e) { }
            return false;
        };

        const months = (typeof MONTH_NAMES !== 'undefined') ? MONTH_NAMES : ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
        console.group(`%cALGODÓN PIMA ORGANICO - OCS (QQ) — DETALLE COMPLETO 12 MESES`, 'font-weight:bold;font-size:14px;color:#007acc');

        // Iterar por mes
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            const monthLabel = months[monthIdx] || ('M' + (monthIdx+1));
            let crudosTotalQQ = 0;
            let mezclasTotalQQ = 0;

            console.group(`${monthLabel} — MAT. CRUDOS`);

            // MAT. CRUDOS - con detalle
            try {
                (window.crudoGroups || crudoGroups || []).forEach((g) => {
                    try {
                        const title = (g.title || '').toString();
                        const titleUp = title.toUpperCase();
                        if (!/PIMA/.test(titleUp) && !/OCS/.test(titleUp)) return;

                        const filteredRows = (g.rows || []).filter(r => {
                            const txt = ((r.line||'') + '|' + (r.client||'') + '|' + (r.yarn||'')).toString().toUpperCase();
                            return !(txt.includes('CLIENTES VARIOS') || txt.includes('CLIENTE VARIOS') || txt.includes('PROYECCI') || txt.includes('PROYECCIÓN') || txt.includes('RESERVA'));
                        });
                        
                        let groupSum = 0;
                        let groupRows = [];
                        
                        filteredRows.forEach(row => {
                            try {
                                if (!row || !row.yarn) return;
                                if (!tokenMatchesPimaOcs(row.yarn, g.title)) return;
                                const raw = parseFloat(row.values && row.values[monthIdx] ? row.values[monthIdx] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) return;
                                const merma = 40;
                                const kgReq = raw / (1 - merma/100);
                                const qq = kgReq / 46;
                                groupSum += qq;
                                groupRows.push({ yarn: row.yarn, raw, kgReq, qq });
                            } catch (e) { }
                        });
                        
                        if (groupSum > 0.0001) {
                            console.group(`${title}`);
                            groupRows.forEach(row => {
                                console.log(`  Yarn: ${row.yarn} | Raw: ${formatNumber(row.raw)} kg | KG REQ: ${formatNumber(row.kgReq)} | QQ: ${formatNumber(row.qq)}`);
                            });
                            console.log(`  %cGrupo suma (${monthLabel}): ${formatNumber(groupSum)}`, 'font-weight:bold;color:#4ec9b0');
                            console.groupEnd();
                            crudosTotalQQ += groupSum;
                        }
                    } catch (e) { }
                });
            } catch (e) { }
            
            console.log(`%c${monthLabel} MAT. CRUDOS Total: ${formatNumber(crudosTotalQQ)}`, 'font-weight:bold;color:#dcdcaa');
            console.groupEnd();

            console.group(`${monthLabel} — MAT. MEZCLAS`);

            // MAT. MEZCLAS - con detalle
            try {
                (window.mezclaGroups || mezclaGroups || []).forEach((g) => {
                    try {
                        const title = (g.title || '').toString();
                        const compTotals = g.componentTotalsTotal || {};
                        const compPctMap = g.componentPercentages || {};
                        const keys = Object.keys(compTotals || {});

                        let groupSum = 0;
                        let components = [];
                        
                        keys.forEach(compToken => {
                            try {
                                const meta = (g.componentMeta && g.componentMeta[compToken]) || null;
                                const isPimaOcsComp = (meta && meta.isPimaOcs) || tokenMatchesPimaOcs(compToken, title);
                                if (!isPimaOcsComp) return;

                                let vec = compTotals[compToken] || new Array(12).fill(0);
                                let kgContrib = parseFloat(vec[monthIdx] || 0) || 0;
                                const pct = (typeof compPctMap[compToken] !== 'undefined') ? compPctMap[compToken] : null;

                                // Fallback
                                if (Math.abs(kgContrib) < 0.0001) {
                                    const groupBaseCol = (g.colBases && g.colBases[monthIdx]) ? parseFloat(g.colBases[monthIdx]) : 0;
                                    const groupRawTotal = (g.groupRawTotals && g.groupRawTotals[monthIdx]) ? parseFloat(g.groupRawTotals[monthIdx]) : 0;
                                    if (pct && groupBaseCol && groupBaseCol > 0) {
                                        kgContrib = groupBaseCol * pct;
                                    } else if (pct && groupRawTotal && groupRawTotal > 0) {
                                        kgContrib = groupRawTotal * pct;
                                    } else if (pct && g.uniqueYarns && g.uniqueYarns.size > 0) {
                                        try {
                                            let sumItems = 0;
                                            Array.from(g.uniqueYarns).forEach(id => { const it = GLOBAL_ITEMS.find(x => x.id === id); if (it && it.values) sumItems += parseFloat(it.values[monthIdx] || 0) || 0; });
                                            if (sumItems > 0) kgContrib = sumItems * pct;
                                        } catch (e) { }
                                    }
                                }

                                if (Math.abs(kgContrib) >= 0.0001) {
                                    const merma = 40;
                                    const kgReq = kgContrib / (1 - merma/100);
                                    const qq = kgReq / 46;
                                    groupSum += qq;
                                    components.push({ compToken, kgContrib, pct, kgReq, qq });
                                }
                            } catch (e) { }
                        });
                        
                        if (groupSum > 0.0001) {
                            console.group(`${title}`);
                            components.forEach(c => {
                                console.log(`  Component: ${c.compToken} | Kg: ${formatNumber(c.kgContrib)} = pct: ${formatNumber(c.pct*100)}% × Kg REQ: ${formatNumber(c.kgReq)} = QQ: ${formatNumber(c.qq)}`);
                            });
                            console.log(`  %cGrupo suma (${monthLabel}): ${formatNumber(groupSum)}`, 'font-weight:bold;color:#4ec9b0');
                            console.groupEnd();
                            mezclasTotalQQ += groupSum;
                        }
                    } catch (e) { }
                });
            } catch (e) { }
            
            console.log(`%c${monthLabel} MAT. MEZCLAS Total: ${formatNumber(mezclasTotalQQ)}`, 'font-weight:bold;color:#dcdcaa');
            console.groupEnd();

            const totalQQ = crudosTotalQQ + mezclasTotalQQ;
            console.log(`%c${monthLabel} TOTAL QQ: ${formatNumber(totalQQ)}`, 'font-weight:bold;font-size:12px;color:#f48771;background:#1e1e1e;padding:2px 4px');
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

        console.log('Suma QQ (contribuidores):', formatNumber(sumContribQQ));
        console.log('Valor mostrado en tabla:', formatNumber(displayedVal));
        console.log('Diferencia (tabla - suma contrib):', formatNumber(displayedVal - sumContribQQ));
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
