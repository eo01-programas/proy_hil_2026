// Orchestrator: moved core orchestration and recalc logic from app.js
(function(){
    const v = new Date().toISOString();
    const el = document.getElementById('appVersion');
    if (el) el.textContent = 'v ' + v;
    console.log('proyeccion (modular) orchestrator loaded - version', v);
    window.PROY_VERSION = v;
})();

// Merge mezcla groups helper (moved from original app)
function mergeMezclaGroups(mezclaGroupsArray) {
    const merged = [];
    const processed = new Set();
    mezclaGroupsArray.forEach((group1, idx1) => {
        if (processed.has(idx1)) return;
        let masterGroup = {
            title: group1.title,
            uniqueYarns: new Set(group1.uniqueYarns),
            colBases: [...group1.colBases],
            groupRawTotals: [...group1.groupRawTotals],
            htrColBases: [...group1.htrColBases],
            componentTotalsTotal: {},
            componentPercentages: {}
        };
        Object.keys(group1.componentTotalsTotal || {}).forEach(key => { masterGroup.componentTotalsTotal[key] = [...group1.componentTotalsTotal[key]]; });
        Object.keys(group1.componentPercentages || {}).forEach(key => { masterGroup.componentPercentages[key] = group1.componentPercentages[key]; });

        function mapTokenForGrouping(t) {
            let u = (t||'').toString().toUpperCase();
            u = u.replace(/PREPREVE/g, 'REPREVE').replace(/PREPEVE/g, 'REPREVE').replace(/WOOLL/g, 'WOOL');
            if (u.includes('PIMA_ORG') || u.includes('ALG_ORG') || u.includes('PIMA ORGANICO') || u.includes('ORGANICO')) return 'PIMA_ORG';
            if (u.includes('PIMA')) return 'PIMA';
            if (u.includes('TANGUIS')) return 'TANGUIS';
            if (u.includes('UPLAND')) return 'UPLAND';
            if (u.includes('LYOCELL') || u.includes('TENCEL')) return 'LYOCELL';
            if (u.includes('REPREVE') || u.includes('PES_REPREVE') || u.includes('RECYCLED') || u.includes('RECICLADO') || u.includes('PES') || u.includes('POLYESTER')) return 'PES';
            if (u.includes('NYLON')) return 'NYLON';
            if (u.includes('WOOL') || u.includes('MERINO')) return 'WOOL';
            if (u.includes('MODAL')) return 'MODAL';
            if (u.includes('LINO')) return 'LINO';
            if (u.includes('CAÑAMO') || u.includes('CANAMO') || u.includes('HEMP')) return 'HEMP';
            return u.replace(/\s+/g,' ').trim();
        }

        for (let idx2 = idx1 + 1; idx2 < mezclaGroupsArray.length; idx2++) {
            if (processed.has(idx2)) continue;
            const group2 = mezclaGroupsArray[idx2];
            const buildPctMap = (group) => {
                const out = {};
                const compTotals = group.componentTotalsTotal || {};
                const groupTotal = group.groupRawTotals.reduce((a,b)=>a+b,0) || 0.0000001;
                Object.keys(compTotals).forEach(k => {
                    const mapped = mapTokenForGrouping(k);
                    const sumComp = (compTotals[k] || []).reduce((a,b)=>a+b,0);
                    out[mapped] = (out[mapped] || 0) + (sumComp / groupTotal);
                });
                return out;
            };

            const map1 = buildPctMap(masterGroup);
            const map2 = buildPctMap(group2);
            const tokens1 = Object.keys(map1).sort();
            const tokens2 = Object.keys(map2).sort();
            if (tokens1.length !== tokens2.length) continue;
            let sameTokens = true; for (let i=0;i<tokens1.length;i++) { if (tokens1[i] !== tokens2[i]) { sameTokens = false; break; } }
            if (!sameTokens) continue;
            let pctMatch = true;
            for (let tk of tokens1) {
                const p1 = map1[tk] || 0; const p2 = map2[tk] || 0;
                if (Math.abs(p1 - p2) > 0.05) { pctMatch = false; break; }
            }
            if (!pctMatch) continue;
            group2.uniqueYarns.forEach(id => masterGroup.uniqueYarns.add(id));
            for (let i = 0; i < 12; i++) {
                masterGroup.groupRawTotals[i] += group2.groupRawTotals[i];
                masterGroup.colBases[i] += group2.colBases[i];
                masterGroup.htrColBases[i] += group2.htrColBases[i];
            }
            const allKeys = new Set([...Object.keys(masterGroup.componentTotalsTotal || {}), ...Object.keys(group2.componentTotalsTotal || {})]);
            allKeys.forEach(key => {
                if (!masterGroup.componentTotalsTotal[key]) {
                    masterGroup.componentTotalsTotal[key] = new Array(12).fill(0);
                }
                if (group2.componentTotalsTotal[key]) {
                    for (let i = 0; i < 12; i++) {
                        masterGroup.componentTotalsTotal[key][i] += group2.componentTotalsTotal[key][i];
                    }
                }
                if (group2.componentPercentages && group2.componentPercentages[key]) {
                    masterGroup.componentPercentages[key] = Math.max(masterGroup.componentPercentages[key] || 0, group2.componentPercentages[key]);
                }
            });
            processed.add(idx2);
        }
        processed.add(idx1);
        merged.push(masterGroup);
    });
    return merged;
}

// --- GLOBAL STATE (moved from app.js) ---
let GLOBAL_ITEMS = [];
let activeIndices = [];
let grandTotalVector = new Array(12).fill(0);
let crudoGroups = [];
let mezclaGroups = [];
let missingItems = [];

let globalCrudoBase = new Array(12).fill(0);
let globalCrudoHTR = new Array(12).fill(0);
let globalCrudoRaw = new Array(12).fill(0);
let globalMezclaRaw = new Array(12).fill(0);
let globalMezclaBase = new Array(12).fill(0);
let globalMezclaHTR = new Array(12).fill(0);
let globalAlgodonQQ = new Array(12).fill(0);
let globalOtrasKgReq = new Array(12).fill(0);
let detailAlgodon = {};
let detailOtras = {};
let excelGroupTotals = null;

let statsLLL = { values: new Array(12).fill(0), total: 0 };
let statsVariosTotal = { values: new Array(12).fill(0), total: 0 };
let statsVariosDetalle = {};
let lineSummary = {};

let EXCEL_FORMULA_TOTALS = new Array(12).fill(0);
let DISCREPANCY_ITEMS = [];
let DISCREPANCY_GROUP_TOTALS = { hasError: false, monthDiffs: [] };
let HIDDEN_ROWS = new Set();
let HIDDEN_ROWS_SAMPLES = [];

// --- UI helpers moved from app.js ---
function switchTab(viewId, btnElement) {
    ['detailView', 'summaryView', 'crudosView', 'mezclasView', 'balanceView'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    const viewEl = document.getElementById(viewId); if (viewEl) viewEl.classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('tab-active'); b.classList.add('tab-inactive'); });
    if (btnElement) { btnElement.classList.remove('tab-inactive'); btnElement.classList.add('tab-active'); }
}

let currentModalItemId = null;
function openMoveModal(id) {
    currentModalItemId = id;
    const item = GLOBAL_ITEMS.find(x => x.id === id);
    if (!item) { alert('Error: Hilado no encontrado.'); return; }
    const elLine = document.getElementById('modalLine'); if (elLine) elLine.textContent = item.line || '-';
    const elClient = document.getElementById('modalClient'); if (elClient) elClient.textContent = item.client || '-';
    const elYarn = document.getElementById('modalYarn'); if (elYarn) elYarn.textContent = item.yarn || '-';
    const sel = document.getElementById('modalModuleSelect'); if (sel) sel.value = '';
    const cont = document.getElementById('modalGroupContainer'); if (cont) cont.classList.add('hidden');
    const groupSel = document.getElementById('modalGroupSelect'); if (groupSel) groupSel.innerHTML = '<option value="">-- Elegir Bloque --</option>';
    const modal = document.getElementById('moveModal'); if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('moveModal'); if (modal) modal.classList.add('hidden'); currentModalItemId = null;
}

function onModalModuleChange(val) {
    const container = document.getElementById('modalGroupContainer');
    const sel = document.getElementById('modalGroupSelect'); if (sel) sel.innerHTML = '<option value="">-- Elegir Bloque --</option>';
    if (!val || val === '') { if (container) container.classList.add('hidden'); return; }
    const list = (val === 'CRUDO') ? (window.availableCrudoGroups || []) : (window.availableMezclaGroups || []);
    list.forEach(g => { const opt = document.createElement('option'); opt.value = g.key || g.title || g; opt.text = g.title || g.key || g; if (sel) sel.appendChild(opt); });
    if (container) container.classList.remove('hidden');
}

function applyModalMove() {
    if (!currentModalItemId) return closeModal();
    const module = (document.getElementById('modalModuleSelect') || {}).value;
    const groupKey = (document.getElementById('modalGroupSelect') || {}).value;
    const item = GLOBAL_ITEMS.find(x => x.id === currentModalItemId);
    if (!item) return closeModal();
    if (!module || module === '') { alert('Elige un módulo'); return; }
    if (!groupKey || groupKey === '') { alert('Elige un bloque'); return; }
    if (module === 'CRUDO') { item._forcedClassification = 'CRUDO'; item._forcedGroup = groupKey; }
    else { item._forcedClassification = 'MEZCLA'; item._forcedGroup = groupKey; }
    closeModal(); recalcAll();
}

function showDiscrepancyModal(monthIdx) {
    const modal = document.getElementById('discrepancyModal');
    const content = document.getElementById('discrepancyContent');
    if (!modal || !content) return;
    const monthName = MONTH_NAMES[monthIdx] || ('M' + (monthIdx+1));
    const excelVal = (excelGroupTotals && excelGroupTotals[monthIdx]) ? excelGroupTotals[monthIdx] : 0;

    // Recalcular suma visible (excluir filas con 'TOTAL')
    let sumaVisible = 0;
    GLOBAL_ITEMS.forEach(row => {
        const joined = ((row.line||'') + '|' + (row.client||'') + '|' + (row.yarn||'')).toString().toUpperCase();
        if (joined.includes('TOTAL')) return;
        const v = row.values && row.values[monthIdx] ? row.values[monthIdx] : 0;
        sumaVisible += (typeof v === 'number') ? v : (parseFloat(v) || 0);
    });

    // Calcular contribución de filas ocultas (si tenemos RAW JSON y month-column mapping)
    let hiddenSum = 0;
    const rowsDetail = [];
    try {
        const raw = window.GLOBAL_JSONDATA || null;
        const monthCols = window.MONTH_COLUMN_INDEXES || null;
        if (raw && monthCols && monthCols.length === 12) {
            const colIdx = monthCols[monthIdx];
            Array.from(HIDDEN_ROWS || []).forEach(ridx => {
                const row = raw[ridx] || [];
                const cell = row[colIdx];
                const val = parseLocaleNumber(cell);
                if (Math.abs(val) > 0.0001) {
                    hiddenSum += val;
                }
                const sample = (row[0] || '') + ' | ' + (row[2] || '') + ' | ' + (row[3] || '');
                rowsDetail.push({ row: ridx+1, sample: sample, value: val });
            });
        }
    } catch (e) { console.debug('Error computing hidden contributions', e); }

    const diff = (sumaVisible + hiddenSum) - excelVal;

    // Construir modal minimalista: mostrar solo la(s) fila(s) oculta(s) que explican la contribución
    let html = `<div class="p-4 max-w-2xl"><h3 class="text-lg font-bold mb-3">Diferencia - ${monthName}</h3>`;

    try {
        const target = Math.round(hiddenSum);
        const rows = rowsDetail.map(d => ({ row: d.row, value: d.value, sample: d.sample }));
        const matches = rows.filter(r => Math.abs(Math.round(r.value) - target) <= 1 || Math.abs(r.value - target) <= 1);

        if (matches.length > 0) {
            // Mostrar únicamente las coincidencias encontradas (compacto)
            matches.forEach(m => { html += `<div class="mb-1 font-semibold">Fila ${m.row}: ${escapeHtml(m.sample)} → ${formatNumber(m.value)}</div>`; });
        } else {
            // Si no hay coincidencias exactas, mostrar la diferencia numérica mínima
            html += `<div class="text-sm font-medium">Diferencia detectada: ${formatNumber(diff)}</div>`;
        }
    } catch (e) {
        console.debug('Error mostrando modal minimalista', e);
        html += `<div class="text-sm">Diferencia: ${formatNumber(diff)}</div>`;
    }

    html += `<div class="mt-4 text-right"><button onclick="closeDiscrepancyModal()" class="px-4 py-2 bg-blue-600 text-white rounded">Cerrar</button></div></div>`;

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function closeDiscrepancyModal() {
    const modal = document.getElementById('discrepancyModal'); if (modal) modal.classList.add('hidden');
}

// Buscar y mostrar solo las filas ocultas cuya contribución coincida con la contribución calculada
function findHiddenMatches(monthIdx) {
    const content = document.getElementById('discrepancyContent');
    if (!content) return;
    const monthCols = window.MONTH_COLUMN_INDEXES || null;
    const raw = window.GLOBAL_JSONDATA || null;
    if (!monthCols || !raw) { content.innerHTML = '<div class="p-4">No hay datos RAW disponibles para buscar coincidencias.</div>'; return; }
    const colIdx = monthCols[monthIdx];

    // calcular target: la contribución de filas ocultas que mostramos antes
    let hiddenSum = 0;
    const rows = [];
    Array.from(HIDDEN_ROWS || []).forEach(ridx => {
        const row = raw[ridx] || [];
        const cell = row[colIdx];
        const val = parseLocaleNumber(cell);
        if (Math.abs(val) > 0.0001) {
            hiddenSum += val;
            rows.push({ row: ridx+1, value: val, sample: (row[0]||'') + ' | ' + (row[2]||'') + ' | ' + (row[3]||'') });
        }
    });

    const target = Math.round(hiddenSum);
    // Filtrar coincidencias exactas con tolerancia 1
    const matches = rows.filter(r => Math.abs(Math.round(r.value) - target) <= 1 || Math.abs(r.value - target) <= 1);
    let html = `<div class="p-4 max-w-2xl"><h3 class="text-lg font-bold mb-3">Coincidencias ocultas - ${MONTH_NAMES[monthIdx] || monthIdx}</h3>`;
    if (matches.length === 0) {
        html += `<div>No se encontraron filas que coincidan exactamente con ${formatNumber(target)}. Se muestra lista completa de filas ocultas con valor distinto de 0.</div>`;
        html += '<div class="mt-3 text-xs max-h-48 overflow-auto border p-2">';
        rows.forEach(r => { html += `<div class="mb-1">Fila ${r.row}: ${escapeHtml(r.sample)} → ${formatNumber(r.value)}</div>`; });
        html += '</div>';
    } else {
        html += `<div class="text-sm mb-2">Se encontraron ${matches.length} coincidencia(s):</div><div class="text-xs max-h-48 overflow-auto border p-2">`;
        matches.forEach(m => { html += `<div class="mb-1 font-semibold">Fila ${m.row}: ${escapeHtml(m.sample)} → ${formatNumber(m.value)}</div>`; });
        html += '</div>';
    }
    html += `<div class="mt-4 text-right"><button onclick="closeDiscrepancyModal()" class="px-4 py-2 bg-blue-600 text-white rounded">Cerrar</button></div></div>`;
    content.innerHTML = html;
}

// --- Recalculation orchestration (moved from app.js) ---
function recalcAll() {
    crudoGroups = [];
    mezclaGroups = [];
    missingItems = [];
    statsLLL = { values: new Array(12).fill(0), total: 0 };
    statsVariosTotal = { values: new Array(12).fill(0), total: 0 };
    statsVariosDetalle = {};
    lineSummary = {};
    globalCrudoBase = new Array(12).fill(0);
    globalCrudoHTR = new Array(12).fill(0);
    globalCrudoRaw = new Array(12).fill(0);
    globalMezclaRaw = new Array(12).fill(0);
    globalMezclaBase = new Array(12).fill(0);
    globalMezclaHTR = new Array(12).fill(0);
    let crudoMap = {};
    let mezclaMap = {};
    let itemAudit = {};

    GLOBAL_ITEMS.forEach(item => { itemAudit[item.id] = { row: item, allocatedVector: new Array(12).fill(0), originalVector: item.values }; });

    GLOBAL_ITEMS.forEach(item => {
        const clientCode = (item.client || "").toUpperCase().trim();
        const lineaUpper = (item.line || "").toUpperCase().trim();
        const isHTRitem = (item.yarn || '').toString().toUpperCase().includes('HTR');

        const classification = classifyItem(item);
        const shouldGoToCrudos = classification === 'CRUDO';
        const shouldGoToMezclas = classification === 'MEZCLA';

        if (item.client) {
            if (clientCode === "LLL") { for(let k=0; k<12; k++) statsLLL.values[k] += item.values[k]; statsLLL.total += item.kgSol; }
            else { for(let k=0; k<12; k++) statsVariosTotal.values[k] += item.values[k]; statsVariosTotal.total += item.kgSol; if (!statsVariosDetalle[item.client]) statsVariosDetalle[item.client] = { values: new Array(12).fill(0), total: 0 }; for(let k=0; k<12; k++) statsVariosDetalle[item.client].values[k] += item.values[k]; statsVariosDetalle[item.client].total += item.kgSol; }
        }
        if (item.line) {
            if(!lineSummary[item.line]) lineSummary[item.line] = { values: new Array(12).fill(0), total: 0 };
            for(let k=0; k<12; k++) lineSummary[item.line].values[k] += item.values[k];
            lineSummary[item.line].total += item.kgSol;
        }

        if (shouldGoToCrudos) {
            let groupKey = (item._forcedClassification === 'CRUDO' && item._forcedGroup) ? item._forcedGroup : getCrudoGroupKey(item.yarn, item.client);
            if (!groupKey || groupKey.trim() === '') groupKey = '__OTROS_CRUDOS__';
            if(!crudoMap[groupKey]) {
                const title = groupKey === '__OTROS_CRUDOS__' ? 'OTROS (CRUDOS)' : getCrudoGroupTitle(item.yarn, item.client);
                crudoMap[groupKey] = { title: title, rows: [], columnTotals: new Array(12).fill(0), baseTotals: new Array(12).fill(0), htrTotals: new Array(12).fill(0) };
            }
            crudoMap[groupKey].rows.push(item);
            item.values.forEach((v, i) => {
                crudoMap[groupKey].columnTotals[i] += v;
                globalCrudoRaw[i] += v;
                itemAudit[item.id].allocatedVector[i] += v;
                if (isHTRitem) { crudoMap[groupKey].htrTotals[i] += v; globalCrudoHTR[i] += v; } else { crudoMap[groupKey].baseTotals[i] += v; globalCrudoBase[i] += v; }
            });
        }
        else if (shouldGoToMezclas) {
            let yarnForSignature = item.yarn.toString().replace(/\s+(HTR|NC|STD)\s*$/i, '');
            let pcts = getPercentages(item.yarn);
            let compNames = getComponentNames(yarnForSignature);
            if (compNames.length === 1 && pcts.length > 1) compNames = splitComponentsByKeywords(compNames[0], pcts.length);
            let usePcts = pcts.slice();
            if (usePcts.length === 0 && compNames.length > 1) { const equal = 1 / compNames.length; usePcts = Array(compNames.length).fill(equal); }

            const normComps = compNames.map((c, idx) => {
                let token = getNormalizedComponent(c);
                return { original: c, token: token, pct: usePcts[idx] || 0 };
            }).filter(x => x.token && x.pct > 0);

            if (normComps.length === 0) {
                normComps.push({ original: item.yarn, token: getNormalizedComponent(item.yarn), pct: 1.0 });
                if (usePcts.length === 0) usePcts = [1.0];
            }

            if (normComps.length > 0) {
                normComps.sort((a, b) => a.token.localeCompare(b.token));
                let signature;
                if (item._forcedClassification === 'MEZCLA' && item._forcedGroup) {
                    signature = item._forcedGroup;
                } else {
                    const signatureParts = normComps.map(c => {
                        const pctRounded = Math.round(c.pct * 100);
                        return `${pctRounded}% ${c.token}`;
                    });
                    signature = signatureParts.join(' / ');
                    if (!signature || signature.trim() === '') signature = '__OTROS_MEZCLAS__';
                }

                if (!mezclaMap[signature]) {
                    const title = signature === '__OTROS_MEZCLAS__' ? 'OTROS (MEZCLAS)' : yarnForSignature;
                    mezclaMap[signature] = { title: title, uniqueYarns: new Set(), colBases: new Array(12).fill(0), groupRawTotals: new Array(12).fill(0), htrColBases: new Array(12).fill(0), componentTotalsTotal: {}, componentPercentages: {} };
                }

                mezclaMap[signature].uniqueYarns.add(item.id);
                item.values.forEach((v, i) => { mezclaMap[signature].groupRawTotals[i] += v; globalMezclaRaw[i] += v; });

                normComps.forEach((comp, idx) => {
                    const pct = comp.pct;
                    const finalKey = comp.token;
                    if (!mezclaMap[signature].componentPercentages[finalKey]) { mezclaMap[signature].componentPercentages[finalKey] = pct; } else { mezclaMap[signature].componentPercentages[finalKey] = Math.max(mezclaMap[signature].componentPercentages[finalKey], pct); }

                    const compBaseValues = item.values.map(v => { let calc = v * pct; return Math.abs(calc) < 0.001 ? 0 : calc; });
                    compBaseValues.forEach((v, i) => {
                        mezclaMap[signature].colBases[i] += v;
                        itemAudit[item.id].allocatedVector[i] += v;
                        if (isHTRitem) { mezclaMap[signature].htrColBases[i] += v; globalMezclaHTR[i] += v; } else { globalMezclaBase[i] += v; }
                    });
                    if (!mezclaMap[signature].componentTotalsTotal[finalKey]) { mezclaMap[signature].componentTotalsTotal[finalKey] = new Array(12).fill(0); }
                    mezclaMap[signature].componentTotalsTotal[finalKey] = mezclaMap[signature].componentTotalsTotal[finalKey].map((old, j) => old + compBaseValues[j]);
                });
            }
        }
    });

    Object.values(itemAudit).forEach(obj => { let diff = obj.originalVector.reduce((a,b)=>a+b,0) - obj.allocatedVector.reduce((a,b)=>a+b,0); if (Math.abs(diff) > 0.1) missingItems.push({ ...obj.row, diff: diff }); });

    crudoGroups = Object.entries(crudoMap).map(([key, group]) => ({ key, ...group })).filter(group => group.rows.length > 0).map(group => {
        const newTotals = new Array(12).fill(0); const newBaseTotals = new Array(12).fill(0); const newHTRTotals = new Array(12).fill(0);
        group.rows.forEach(row => { const isHTR = row._isHTR; row.values.forEach((v, i) => { newTotals[i] += v; if (isHTR) { newHTRTotals[i] += v; } else { newBaseTotals[i] += v; } }); });
        return { ...group, columnTotals: newTotals, baseTotals: newBaseTotals, htrTotals: newHTRTotals };
    }).sort((a, b) => {
        const orderMap = {
            '__GROUP_ALGODON_PIMA__': 0,
            '__GROUP_ALGODON_PIMA_ORGANICO_OCS__': 1,
            '__GROUP_ALGODON_PIMA_ORGANICO_GOTS__': 2,
            '__GROUP_ALGODON_TANGUIS__': 3,
            '__GROUP_ALGODON_TANGUIS_ORGANICO_OCS__': 4,
            '__GROUP_ALGODON_TANGUIS_ORGANICO_GOTS__': 5,
            '__GROUP_ALGODON_BCI__': 6,
            '__GROUP_ALGODON_USTCP__': 7,
            '__OTROS_CRUDOS__': 8
        };
        const orderA = orderMap[a.key] !== undefined ? orderMap[a.key] : 999;
        const orderB = orderMap[b.key] !== undefined ? orderMap[b.key] : 999;
        return orderA - orderB;
    });

    mezclaGroups = Object.entries(mezclaMap).map(([key, group]) => ({ key, ...group })).filter(group => group.uniqueYarns.size > 0).sort((a,b) => b.colBases.reduce((s,v)=>s+v,0) - a.colBases.reduce((s,v)=>s+v,0));

    try {
        const sigCounts = Object.entries(mezclaMap).map(([sig, g]) => ({ signature: sig, title: g.title, count: (g.uniqueYarns ? g.uniqueYarns.size : 0), totalKg: (g.groupRawTotals||[]).reduce((s,v)=>s+v,0) }));
        console.log('Mezcla signatures:', sigCounts);
        const dbg = document.getElementById('debugInfo');
        if (dbg) {
            const top = sigCounts.sort((a,b)=>b.totalKg - a.totalKg).slice(0,30).map(s => `${s.count} × ${s.signature} → ${s.title} (${Math.round(s.totalKg)} kg)`).join('\n');
            dbg.classList.remove('hidden');
            dbg.textContent = `Mezcla firmas encontradas (${sigCounts.length}):\n` + top;
        }
    } catch(e) { console.warn('Error producing mezcla debug info', e); }
    mezclaGroups = mergeMezclaGroups(mezclaGroups);
    mezclaGroups = mezclaGroups.map(g => ({ key: g.key || g.title, ...g }));

    window.availableCrudoGroups = crudoGroups.map(g => ({ key: g.key || g.title, title: g.title }));
    window.availableMezclaGroups = mezclaGroups.map(g => ({ key: g.key || g.title, title: g.title }));

    // Resumen agrupaciones
    globalAlgodonQQ = new Array(12).fill(0);
    globalOtrasKgReq = new Array(12).fill(0);
    detailAlgodon = {};
    detailOtras = {};

    ORDERED_COTTON_KEYS.forEach(k => { detailAlgodon[k] = { totalValues: new Array(12).fill(0), clients: {} }; });
    ORDERED_OTHER_KEYS.forEach(k => { detailOtras[k] = { totalValues: new Array(12).fill(0), clients: {} }; });

    function defaultMermaForToken(t) {
        const u = (t||'').toString().toUpperCase();
        if (u.includes('PIMA') || u.includes('TANGUIS') || u.includes('ALGODON') || u.includes('UPLAND') || u.includes('COP')) return 40;
        if (u.includes('LYOCELL') || u.includes('TENCEL') || u.includes('MODAL') || u.includes('VISCOSA')) return 15;
        if (u.includes('PES') || u.includes('POLY') || u.includes('REPREVE')) return 15;
        return 85;
    }

    function isCottonToken(t) {
        const u = (t||'').toString().toUpperCase();
        return /PIMA|TANGUIS|ALGODON|UPLAND|COP|FLAME|ELEGANT|COTTON|BCI|USTCP|OCS|GOTS/.test(u);
    }

    function getFiberName(yarn) {
        const u = (yarn||'').toString().toUpperCase();
        if (u === 'PIMA_ORG_OCS') return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
        if (u === 'PIMA_ORG_GOTS') return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
        if (u === 'ALG_ORG_GOTS') return 'ALGODÓN ORGANICO - GOTS (QQ)';
        if (u === 'ALG_ORG_OCS') return 'ALGODÓN ORGANICO - OCS (QQ)';
        if (u === 'TANGUIS_BCI') return 'ALGODÓN TANGUIS NC BCI (QQ)';
        if (u === 'UPLAND_USTCP') return 'ALGODÓN UPLAND USTCP (QQ)';
        if (u.includes('PIMA') && u.includes('ORGANICO')) {
            if (u.includes('GOTS')) return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
            if (u.includes('OCS')) return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
            return 'ALGODÓN PIMA ORGANICO (QQ)';
        }
        if (u.includes('PIMA')) return 'ALGODÓN PIMA NC (QQ)';
        if (u.includes('TANGUIS')) {
            if (u.includes('BCI')) return 'ALGODÓN TANGUIS NC BCI (QQ)';
            return 'ALGODÓN TANGUIS (QQ)';
        }
        if (u.includes('UPLAND')) {
            if (u.includes('USTCP')) return 'ALGODÓN UPLAND USTCP (QQ)';
            return 'ALGODÓN UPLAND (QQ)';
        }
        if (u.includes('ELEGANT')) return 'ALGODÓN ELEGANT (QQ)';
        if (u.includes('ORGANICO') || (u.includes('ALGODON') && (u.includes('OCS') || u.includes('GOTS')))) {
            if (u.includes('GOTS')) return 'ALGODÓN ORGANICO - GOTS (QQ)';
            if (u.includes('OCS')) return 'ALGODÓN ORGANICO - OCS (QQ)';
            return 'ALGODÓN (QQ)';
        }
        if (u.includes('LYOCELL A100')) return 'LYOCELL A100 (KG)';
        if (u.includes('LYOCELL')) return 'LYOCELL STD (KG)';
        if (u.includes('NYLON')) return 'NYLON (KG)';
        if (u.includes('REPREVE') || (u.includes('PES') && u.includes('RECYCLED'))) return 'RECYCLED PES (KG)';
        if (u.includes('WOOL')) return 'WOOL 17.5 (KG)';
        if (u.includes('MODAL')) return 'MODAL (KG)';
        if (u.includes('ABETE NANO')) {
            if (u.includes('MULTICOLOR') || u.includes('MULTICOLO')) return 'ABETE NANO 159 MULTICOLO (KG)';
            return 'ABETE NANO BLANCO (KG)';
        }
        if (u.includes('CAÑAMO') || u.includes('CANAMO')) return 'CAÑAMO (KG)';
        return yarn;
    }

    // 1. Procesar CRUDOS
    crudoGroups.forEach(g => {
        g.rows.forEach(row => {
            const isCot = isCottonToken(row.yarn);
            const isOther = !isCot && isOtherFiberToken(row.yarn);
            const fiberName = getFiberName(row.yarn);
            if (isCot) {
                if (!detailAlgodon[fiberName]) detailAlgodon[fiberName] = { totalValues: new Array(12).fill(0), clients: {} };
                if (!detailAlgodon[fiberName].clients[row.client]) detailAlgodon[fiberName].clients[row.client] = new Array(12).fill(0);
                for (let i=0;i<12;i++) {
                    const raw = row.values[i] || 0;
                    if (Math.abs(raw) < 0.0001) continue;
                    const req = raw / (1 - 0.40);
                    const qq = req / 46;
                    detailAlgodon[fiberName].clients[row.client][i] += qq;
                    detailAlgodon[fiberName].totalValues[i] += qq;
                }
            } else if (isOther) {
                if (!detailOtras[fiberName]) detailOtras[fiberName] = { totalValues: new Array(12).fill(0), clients: {} };
                if (!detailOtras[fiberName].clients[row.client]) detailOtras[fiberName].clients[row.client] = new Array(12).fill(0);
                for (let i=0;i<12;i++) {
                    const raw = row.values[i] || 0;
                    if (Math.abs(raw) < 0.0001) continue;
                    const merma = defaultMermaForToken(row.yarn);
                    const req = raw / (1 - merma/100);
                    detailOtras[fiberName].clients[row.client][i] += req;
                    detailOtras[fiberName].totalValues[i] += req;
                }
            }
        });
    });

    // 2. Procesar MEZCLAS
    mezclaGroups.forEach(g => {
        const compTotals = g.componentTotalsTotal || {};
        Object.keys(compTotals).forEach(componentToken => {
            const vec = compTotals[componentToken];
            if (!vec) return;
            const client = g.uniqueYarns.size > 0 ? (Array.from(g.uniqueYarns).map(id => GLOBAL_ITEMS.find(x => x.id === id)).filter(x => x)[0]?.client || 'VARIOS') : 'VARIOS';
            const combinedToken = (componentToken || '') + ' ' + (g.title || '');
            const fiberName = getFiberName(combinedToken);
            const isCotton = isCottonToken(combinedToken) || isCottonToken(componentToken) || ['PIMA_ORG_OCS','PIMA_ORG_GOTS','ALG_ORG_GOTS','ALG_ORG_OCS','TANGUIS_BCI','UPLAND_USTCP'].includes((componentToken||''));
            if (isCotton) {
                const merma = 40;
                if (!detailAlgodon[fiberName]) detailAlgodon[fiberName] = { totalValues: new Array(12).fill(0), clients: {} };
                if (!detailAlgodon[fiberName].clients[client]) detailAlgodon[fiberName].clients[client] = new Array(12).fill(0);
                for (let i=0;i<12;i++) {
                    const base = vec[i] || 0;
                    if (Math.abs(base) < 0.0001) continue;
                    const req = base / (1 - merma/100);
                    const qq = req / 46;
                    detailAlgodon[fiberName].clients[client][i] += qq;
                    detailAlgodon[fiberName].totalValues[i] += qq;
                }
            } else if (isOtherFiberToken(componentToken)) {
                const merma = defaultMermaForToken(componentToken);
                if (!detailOtras[fiberName]) detailOtras[fiberName] = { totalValues: new Array(12).fill(0), clients: {} };
                if (!detailOtras[fiberName].clients[client]) detailOtras[fiberName].clients[client] = new Array(12).fill(0);
                for (let i=0;i<12;i++) {
                    const base = vec[i] || 0;
                    if (Math.abs(base) < 0.0001) continue;
                    const req = base / (1 - merma/100);
                    detailOtras[fiberName].clients[client][i] += req;
                    detailOtras[fiberName].totalValues[i] += req;
                }
            }
        });
    });

    // 3. RENDERING (comparison logic disabled)
    if (typeof renderDetailTable === 'function') renderDetailTable();
    if (typeof renderSummaryTables === 'function') renderSummaryTables();
    if (typeof renderCrudosTable === 'function') renderCrudosTable();
    if (typeof renderMezclasTable === 'function') renderMezclasTable();
    if (typeof renderBalanceView === 'function') renderBalanceView();
}
