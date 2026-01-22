// Orchestrator: Lógica de Negocio Principal (Mezclas y Crudos)
(function(){
    const v = new Date().toISOString();
    const el = document.getElementById('appVersion');
    if (el) el.textContent = 'v ' + v + ' (Separación OCS/GOTS)';
    console.log('Orchestrator loaded - version', v);
    window.PROY_VERSION = v;
})();

// --- ESTRATEGIA DE NORMALIZACIÓN ESTRICTA (MEZCLAS) ---
// Esta función define la identidad única de cada fibra dentro de una mezcla.
function getStrictCanonicalToken(raw) {
    if (!raw) return '';
    let u = raw.toString().toUpperCase();
    
    // 1. Limpieza básica
    u = u.normalize('NFD').replace(/\p{Diacritic}/gu,'');
    
    // 2. ELIMINAR RUIDO QUE NO AFECTA LA IDENTIDAD
    u = u.replace(/\bCOP\b/g, ''); // "COP PIMA" es igual a "PIMA"
    
    // 3. CORRECCIÓN DE TYPOS
    u = u.replace(/PREPREVE/g, 'REPREVE').replace(/PREPEVE/g, 'REPREVE');

    // 4. LÓGICA DE ALGODÓN CON CERTIFICACIONES (OCS vs GOTS)
    const isPima = u.includes('PIMA');
    const isTanguis = u.includes('TANGUIS');
    const isAlg = u.includes('ALGODON') || u.includes('COTTON') || u.includes('ALG');
    const isOrg = u.includes('ORG') || u.includes('ORGANICO');

    // --- PRIORIDAD 1: GOTS (Certificación A) ---
    if (u.includes('GOTS')) {
        if (isPima) return 'PIMA_ORG_GOTS';
        if (isTanguis) return 'TANGUIS_ORG_GOTS';
        return 'ALGODON_ORG_GOTS';
    }

    // --- PRIORIDAD 2: OCS (Certificación B) ---
    if (u.includes('OCS')) {
        if (isPima) return 'PIMA_ORG_OCS';
        if (isTanguis) return 'TANGUIS_ORG_OCS';
        return 'ALGODON_ORG_OCS';
    }

    // --- PRIORIDAD 3: ORGÁNICO SIN CERTIFICACIÓN ESPECIFICADA ---
    // Si dice "PIMA ORG" pero no dice ni OCS ni GOTS, lo dejamos como genérico
    // o lo asumimos OCS si prefieres. Aquí lo dejo separado para seguridad.
    if (isOrg) {
        if (isPima) return 'PIMA_ORG_GENERICO'; // O podrías poner 'PIMA_ORG_OCS' si es el default
        if (isTanguis) return 'TANGUIS_ORG_GENERICO';
        return 'ALGODON_ORG_GENERICO';
    }

    // --- PRIORIDAD 4: CONVENCIONAL ---
    if (isPima) return 'PIMA_NC';
    if (isTanguis) return 'TANGUIS_NC';
    if (isAlg) return 'ALGODON_NC';

    // --- OTRAS FIBRAS ---
    // Unificar PES / REPREVE
    if (u.includes('REPREVE') || u.includes('PES') || u.includes('POLY') || u.includes('RECICLADO')) return 'PES_REPREVE';
    
    if (u.includes('LYOCELL') || u.includes('TENCEL')) return 'LYOCELL';
    if (u.includes('MODAL')) return 'MODAL';
    if (u.includes('VISCOSA') || u.includes('VISCOSE')) return 'VISCOSA';
    if (u.includes('NYLON')) return 'NYLON';
    if (u.includes('WOOL') || u.includes('MERINO')) return 'WOOL';
    if (u.includes('LINO')) return 'LINO';
    if (u.includes('CAÑAMO') || u.includes('CANAMO') || u.includes('HEMP')) return 'HEMP';

    // Fallback limpio
    return u.replace(/\s+/g, '_').trim();
}

// Merge mezcla groups helper
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
            componentPercentages: {} // Guardará el % canónico
        };
        
        // Copia inicial de datos
        Object.keys(group1.componentTotalsTotal || {}).forEach(key => { masterGroup.componentTotalsTotal[key] = [...group1.componentTotalsTotal[key]]; });
        Object.keys(group1.componentPercentages || {}).forEach(key => { masterGroup.componentPercentages[key] = group1.componentPercentages[key]; });

        // Función para obtener la "huella digital" del porcentaje de un grupo
        const getGroupSignature = (grp) => {
            const pctMap = {};
            const total = grp.groupRawTotals.reduce((a,b)=>a+b,0) || 0.00001;
            
            // Recorremos los componentes brutos
            Object.keys(grp.componentTotalsTotal || {}).forEach(rawKey => {
                const canonKey = getStrictCanonicalToken(rawKey); // Convertimos a PIMA_ORG_OCS, etc.
                const val = (grp.componentTotalsTotal[rawKey] || []).reduce((a,b)=>a+b,0);
                pctMap[canonKey] = (pctMap[canonKey] || 0) + (val/total);
            });
            return pctMap;
        };

        for (let idx2 = idx1 + 1; idx2 < mezclaGroupsArray.length; idx2++) {
            if (processed.has(idx2)) continue;
            const group2 = mezclaGroupsArray[idx2];
            
            const sig1 = getGroupSignature(masterGroup);
            const sig2 = getGroupSignature(group2);
            
            const keys1 = Object.keys(sig1).sort();
            const keys2 = Object.keys(sig2).sort();
            
            // 1. Deben tener exactamente los mismos componentes (OCS vs OCS, GOTS vs GOTS)
            if (keys1.length !== keys2.length) continue;
            let sameComps = true;
            for(let k=0; k<keys1.length; k++) {
                if (keys1[k] !== keys2[k]) { sameComps = false; break; }
            }
            if (!sameComps) continue;

            // 2. Deben tener los mismos porcentajes (tolerancia estricta)
            // Esto asegura que 75/25 no se mezcle con 50/50
            let samePcts = true;
            for (let key of keys1) {
                if (Math.abs(sig1[key] - sig2[key]) > 0.03) { // Tolerancia 3% para variaciones de redondeo
                    samePcts = false; 
                    break; 
                }
            }
            if (!samePcts) continue;
            
            // --- FUSIÓN EXITOSA ---
            group2.uniqueYarns.forEach(id => masterGroup.uniqueYarns.add(id));
            
            for (let i = 0; i < 12; i++) {
                masterGroup.groupRawTotals[i] += group2.groupRawTotals[i];
                masterGroup.colBases[i] += group2.colBases[i];
                masterGroup.htrColBases[i] += group2.htrColBases[i];
            }
            
            const allRawKeys = new Set([...Object.keys(masterGroup.componentTotalsTotal), ...Object.keys(group2.componentTotalsTotal)]);
            allRawKeys.forEach(rk => {
                if (!masterGroup.componentTotalsTotal[rk]) masterGroup.componentTotalsTotal[rk] = new Array(12).fill(0);
                if (group2.componentTotalsTotal[rk]) {
                    for(let i=0; i<12; i++) masterGroup.componentTotalsTotal[rk][i] += group2.componentTotalsTotal[rk][i];
                }
                // Actualizar porcentaje de referencia
                if (group2.componentPercentages && group2.componentPercentages[rk]) {
                    masterGroup.componentPercentages[rk] = Math.max(masterGroup.componentPercentages[rk]||0, group2.componentPercentages[rk]);
                }
            });
            
            processed.add(idx2);
        }
        processed.add(idx1);
        merged.push(masterGroup);
    });
    return merged;
}

// --- GLOBAL STATE ---
let GLOBAL_ITEMS = [];
let activeIndices = [];
let grandTotalVector = new Array(12).fill(0);
let crudoGroups = [];
let mezclaGroups = [];
let missingItems = [];

// Vectores globales
let globalCrudoBase = new Array(12).fill(0);
let globalCrudoHTR = new Array(12).fill(0);
let globalCrudoRaw = new Array(12).fill(0);
let globalMezclaRaw = new Array(12).fill(0);
let globalMezclaBase = new Array(12).fill(0);
let globalMezclaHTR = new Array(12).fill(0);

// Resumen Materiales
let globalAlgodonQQ = new Array(12).fill(0);
let globalOtrasKgReq = new Array(12).fill(0);
let detailAlgodon = {};
let detailOtras = {};
let excelGroupTotals = null;

// Stats Clientes/Lineas
let statsLLL = { values: new Array(12).fill(0), total: 0 };
let statsVariosTotal = { values: new Array(12).fill(0), total: 0 };
let statsVariosDetalle = {};
let lineSummary = {};

let EXCEL_FORMULA_TOTALS = new Array(12).fill(0);
let DISCREPANCY_ITEMS = [];
let DISCREPANCY_GROUP_TOTALS = { hasError: false, monthDiffs: [] };
let HIDDEN_ROWS = new Set();
let HIDDEN_ROWS_SAMPLES = [];

// --- UI HELPERS ---
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
    let sumaVisible = 0;
    GLOBAL_ITEMS.forEach(row => {
        const joined = ((row.line||'') + '|' + (row.client||'') + '|' + (row.yarn||'')).toString().toUpperCase();
        if (joined.includes('TOTAL')) return;
        const v = row.values && row.values[monthIdx] ? row.values[monthIdx] : 0;
        sumaVisible += (typeof v === 'number') ? v : (parseFloat(v) || 0);
    });
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
    let html = `<div class="p-4 max-w-2xl"><h3 class="text-lg font-bold mb-3">Diferencia - ${monthName}</h3>`;
    try {
        const target = Math.round(hiddenSum);
        const rows = rowsDetail.map(d => ({ row: d.row, value: d.value, sample: d.sample }));
        const matches = rows.filter(r => Math.abs(Math.round(r.value) - target) <= 1 || Math.abs(r.value - target) <= 1);
        if (matches.length > 0) {
            matches.forEach(m => { html += `<div class="mb-1 font-semibold">Fila ${m.row}: ${escapeHtml(m.sample)} → ${formatNumber(m.value)}</div>`; });
        } else {
            html += `<div class="text-sm font-medium">Diferencia detectada: ${formatNumber(diff)}</div>`;
        }
    } catch (e) {
        html += `<div class="text-sm">Diferencia: ${formatNumber(diff)}</div>`;
    }
    html += `<div class="mt-4 text-right"><button onclick="closeDiscrepancyModal()" class="px-4 py-2 bg-blue-600 text-white rounded">Cerrar</button></div></div>`;
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

function closeDiscrepancyModal() {
    const modal = document.getElementById('discrepancyModal'); if (modal) modal.classList.add('hidden');
}

// --- ORQUESTADOR PRINCIPAL (RECALC ALL) ---
function recalcAll() {
    // 1. Resetear estados
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

    // 2. Iterar items
    GLOBAL_ITEMS.forEach(item => {
        const clientCode = (item.client || "").toUpperCase().trim();
        const isHTRitem = (item.yarn || '').toString().toUpperCase().includes('HTR');
        const classification = classifyItem(item);
        const shouldGoToCrudos = classification === 'CRUDO';
        const shouldGoToMezclas = classification === 'MEZCLA';

        // Stats Cliente/Linea
        if (item.client) {
            if (clientCode === "LLL") { for(let k=0; k<12; k++) statsLLL.values[k] += item.values[k]; statsLLL.total += item.kgSol; }
            else { for(let k=0; k<12; k++) statsVariosTotal.values[k] += item.values[k]; statsVariosTotal.total += item.kgSol; if (!statsVariosDetalle[item.client]) statsVariosDetalle[item.client] = { values: new Array(12).fill(0), total: 0 }; for(let k=0; k<12; k++) statsVariosDetalle[item.client].values[k] += item.values[k]; statsVariosDetalle[item.client].total += item.kgSol; }
        }
        if (item.line) {
            if(!lineSummary[item.line]) lineSummary[item.line] = { values: new Array(12).fill(0), total: 0 };
            for(let k=0; k<12; k++) lineSummary[item.line].values[k] += item.values[k];
            lineSummary[item.line].total += item.kgSol;
        }

        // Lógica CRUDOS (Sin cambios)
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
        // Lógica MEZCLAS (Actualizada)
        else if (shouldGoToMezclas) {
            // Robust parsing: 
            // 1. Remove HTR/NC/STD suffixes FIRST (they don't affect grouping)
            // 2. Remove leading title like "20/1"
            // 3. Extract and remove trailing percentages
            // 4. What remains is yarnForSignature (used as group title)
            const rawYarn = (item.yarn || '').toString();
            let yarnStr = rawYarn.trim();

            // 1) FIRST: Remove trailing HTR/NC/STD markers (these don't affect grouping)
            yarnStr = yarnStr.replace(/\s*(HTR|NC|STD)\s*$/i, '').trim();

            // 2) Extract trailing percentages e.g. "(...50/30/20%)", "50/30/20%" or glued "LYOCELL50/30/20%"
            let pcts = [];
            const pctMatch = yarnStr.match(/(?:\(|\[)?\s*(\d+(?:\/\d+)+)\s*%?\s*(?:\)|\])?\s*$/);
            if (pctMatch) {
                const rawPcts = pctMatch[1];
                pcts = rawPcts.split('/').map(s => { const n = parseFloat(s.replace(/[^0-9.]/g,'')); return isNaN(n) ? 0 : (n/100); });
                yarnStr = yarnStr.slice(0, pctMatch.index).trim();
            }

            // 3) Extract and remove leading title like "20/1"
            const titleMatch = yarnStr.match(/^\s*([\d.]+\/[\d.]+)\b/);
            if (titleMatch) {
                yarnStr = yarnStr.slice(titleMatch[0].length).trim();
            }

            // 4) What remains is yarnForSignature (will be used as group title)
            let yarnForSignature = yarnStr.trim();

            // 4) Split into component names
            let compNames = getComponentNames(yarnForSignature);

            // Caso especial: 1 nombre, multiples porcentajes (e.g. "Algodon/Poly 50/50")
            if (compNames.length === 1 && pcts.length > 1) compNames = splitComponentsByKeywords(compNames[0], pcts.length);
            let usePcts = pcts.slice();
            if (usePcts.length === 0 && compNames.length > 1) { const equal = 1 / compNames.length; usePcts = Array(compNames.length).fill(equal); }

            const normComps = compNames.map((c, idx) => {
                // TOKEN ESTRICTO para agrupar (OCS vs GOTS se separan aquí)
                let token = getStrictCanonicalToken(c); 
                return { original: c, token: token, pct: usePcts[idx] || 0 };
            }).filter(x => x.token && x.pct > 0);

            // Fallback si no detectó componentes
            if (normComps.length === 0) {
                normComps.push({ original: item.yarn, token: getStrictCanonicalToken(item.yarn), pct: 1.0 });
                if (usePcts.length === 0) usePcts = [1.0];
            }

            if (normComps.length > 0) {
                // Ordenar componentes alfabéticamente por su token estricto
                // Esto asegura que "40% PIMA / 60% PES" sea igual que "60% PES / 40% PIMA" si los tokens son iguales
                normComps.sort((a, b) => a.token.localeCompare(b.token));
                
                let signature;
                if (item._forcedClassification === 'MEZCLA' && item._forcedGroup) {
                    signature = item._forcedGroup;
                } else {
                    // La firma incluye el porcentaje redondeado para diferenciar 50/50 de 75/25
                    // Build signature based on rounded percentages only (ej. "75/25", "40/30/30")
                    const pctRoundedArr = normComps.map(c => Math.round((c.pct || 0) * 100));
                    signature = pctRoundedArr.join('/');
                    if (!signature || signature.trim() === '') signature = '__OTROS_MEZCLAS__';
                }

                // Crear o asignar al grupo
                    if (!mezclaMap[signature]) {
                    const title = signature === '__OTROS_MEZCLAS__' ? 'OTROS (MEZCLAS)' : yarnForSignature;
                    mezclaMap[signature] = {
                        title: title,
                        uniqueYarns: new Set(), 
                        colBases: new Array(12).fill(0), 
                        groupRawTotals: new Array(12).fill(0), 
                        htrColBases: new Array(12).fill(0), 
                        componentTotalsTotal: {}, 
                        componentPercentages: {} 
                    };
                }

                mezclaMap[signature].uniqueYarns.add(item.id);
                item.values.forEach((v, i) => { mezclaMap[signature].groupRawTotals[i] += v; globalMezclaRaw[i] += v; });

                // Distribuir componentes
                normComps.forEach((comp, idx) => {
                    const pct = comp.pct;
                    // IMPORTANTE: Usamos el token estricto como clave interna
                    const finalKey = comp.token;
                    
                    if (!mezclaMap[signature].componentPercentages[finalKey]) { 
                        mezclaMap[signature].componentPercentages[finalKey] = pct; 
                    } else { 
                        mezclaMap[signature].componentPercentages[finalKey] = Math.max(mezclaMap[signature].componentPercentages[finalKey], pct); 
                    }
                    
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

    // Ordenar Crudos
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

    // Ordenar Mezclas Inicial
    mezclaGroups = Object.entries(mezclaMap).map(([key, group]) => ({ key, ...group })).filter(group => group.uniqueYarns.size > 0).sort((a,b) => b.colBases.reduce((s,v)=>s+v,0) - a.colBases.reduce((s,v)=>s+v,0));

    // FUSIÓN MEZCLAS (Merge similar blocks)
    // Skip merge/fusion step - keep groups as built (one group per item signature)
    // mezclaGroups = mergeMezclaGroups(mezclaGroups);
    // Add component metadata to each mezcla group for robust downstream matching
    mezclaGroups = mezclaGroups.map(g => {
        const compTotals = g.componentTotalsTotal || {};
        const compMeta = {};
        Object.keys(compTotals).forEach(token => {
            try {
                const tokenUp = (token || '').toString().toUpperCase();
                // try normalized token from helper
                let normalized = token;
                try { if (typeof getNormalizedComponent === 'function') normalized = getNormalizedComponent(token) || token; } catch (e) {}

                // detect PIMA OCS via multiple heuristics
                let isPimaOcs = false;
                const titleUp = (g.title || '').toString().toUpperCase();
                if (normalized && normalized.toString().toUpperCase().indexOf('PIMA_ORG_OCS') >= 0) isPimaOcs = true;
                if (!isPimaOcs && /\bPIMA\b/.test(tokenUp) && /\bOCS\b/.test(tokenUp)) isPimaOcs = true;
                if (!isPimaOcs && /\bPIMA\b/.test(tokenUp) && /\bOCS\b/.test(titleUp)) isPimaOcs = true;
                try {
                    if (!isPimaOcs && typeof getFiberNameFromStrict === 'function') {
                        const mapped = getFiberNameFromStrict(token);
                        if (mapped && mapped.toString().toUpperCase().includes('PIMA') && mapped.toString().toUpperCase().includes('OCS')) isPimaOcs = true;
                    }
                } catch (e) { /* ignore */ }

                // canonical fiber name
                let canonical = null;
                try {
                    if (isPimaOcs) canonical = 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
                    else if (typeof getFiberNameFromStrict === 'function') canonical = getFiberNameFromStrict(token);
                    else canonical = getFiberName(token);
                } catch (e) { canonical = (typeof getFiberName === 'function') ? getFiberName(token) : token; }

                compMeta[token] = { normalizedToken: normalized, isPimaOcs: !!isPimaOcs, canonicalFiber: canonical };
            } catch (e) { /* ignore token */ }
        });
        return { key: g.key || g.title, ...g, componentMeta: compMeta };
    });

    window.availableCrudoGroups = crudoGroups.map(g => ({ key: g.key || g.title, title: g.title }));
    window.availableMezclaGroups = mezclaGroups.map(g => ({ key: g.key || g.title, title: g.title }));

    // Resumen Materiales
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
    
    // Mapeo inverso para visualización en Tabla Resumen Materiales
    function getFiberNameFromStrict(strictToken) {
        if (strictToken === 'PIMA_ORG_OCS') return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
        if (strictToken === 'PIMA_ORG_GOTS') return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
        if (strictToken === 'PIMA_NC') return 'ALGODÓN PIMA NC (QQ)';
        
        if (strictToken === 'TANGUIS_ORG_OCS') return 'ALGODÓN TANGUIS ORGANICO (OCS) (QQ)';
        if (strictToken === 'TANGUIS_ORG_GOTS') return 'ALGODÓN TANGUIS ORGANICO (GOTS) (QQ)';
        if (strictToken === 'TANGUIS_NC') return 'ALGODÓN TANGUIS NC (QQ)';
        
        if (strictToken === 'ALGODON_ORG_OCS') return 'ALGODÓN ORGANICO - OCS (QQ)';
        if (strictToken === 'ALGODON_ORG_GOTS') return 'ALGODÓN ORGANICO - GOTS (QQ)';
        if (strictToken === 'ALGODON_NC') return 'ALGODÓN UPLAND (QQ)';
        
        if (strictToken === 'LYOCELL') return 'LYOCELL STD (KG)';
        if (strictToken === 'MODAL') return 'MODAL (KG)';
        if (strictToken === 'VISCOSA') return 'VISCOSA (KG)';
        if (strictToken === 'PES_REPREVE') return 'RECYCLED PES (KG)';
        if (strictToken === 'NYLON') return 'NYLON (KG)';
        if (strictToken === 'WOOL') return 'WOOL 17.5 (KG)';
        if (strictToken === 'HEMP') return 'CAÑAMO (KG)';
        
        return strictToken;
    }

    // Lógica para Crudos (Legacy + Compatibilidad)
    function getFiberName(yarn) {
        const u = (yarn||'').toString().toUpperCase();
        if (u === 'PIMA_ORG_OCS') return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
        if (u === 'PIMA_ORG_GOTS') return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
        if (u === 'ALG_ORG_GOTS') return 'ALGODÓN ORGANICO - GOTS (QQ)';
        if (u === 'ALG_ORG_OCS') return 'ALGODÓN ORGANICO - OCS (QQ)';
        if (u === 'TANGUIS_BCI') return 'ALGODÓN TANGUIS NC BCI (QQ)';
        if (u === 'UPLAND_USTCP') return 'ALGODÓN UPLAND USTCP (QQ)';
        if (u.includes('PIMA') && u.includes('ORGANICO')) {
             if(u.includes('GOTS')) return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
             return 'ALGODÓN PIMA ORGANICO - OCS (QQ)'; // Default OCS si es genérico
        }
        if (u.includes('PIMA')) return 'ALGODÓN PIMA NC (QQ)';
        if (u.includes('TANGUIS')) return 'ALGODÓN TANGUIS (QQ)';
        if (u.includes('UPLAND')) return 'ALGODÓN UPLAND (QQ)';
        if (u.includes('ELEGANT')) return 'ALGODÓN ELEGANT (QQ)';
        if (u.includes('LYOCELL A100')) return 'LYOCELL A100 (KG)';
        if (u.includes('LYOCELL')) return 'LYOCELL STD (KG)';
        if (u.includes('NYLON')) return 'NYLON (KG)';
        if (u.includes('REPREVE') || (u.includes('PES') && u.includes('RECYCLED'))) return 'RECYCLED PES (KG)';
        if (u.includes('WOOL')) return 'WOOL 17.5 (KG)';
        if (u.includes('MODAL')) return 'MODAL (KG)';
        return yarn;
    }

    // 3.1 Procesar CRUDOS
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

    // 3.2 Procesar MEZCLAS
    mezclaGroups.forEach(g => {
        const compTotals = g.componentTotalsTotal || {};
        Object.keys(compTotals).forEach(componentToken => {
            const vec = compTotals[componentToken];
            if (!vec) return;
            
            // Determine fiber name: prefer mapping PIMA non-certified explicitly to PIMA NC
            const compLabelUpper = (componentToken || '').toString().toUpperCase();
            const isPimaToken = /\bPIMA\b/.test(compLabelUpper);
            const isCertifiedToken = /OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(compLabelUpper);
            let fiberName;
            if (isPimaToken && !isCertifiedToken) {
                fiberName = 'ALGODÓN PIMA NC (QQ)';
            } else {
                // Usamos la nueva función para obtener el nombre legible desde el token estricto
                fiberName = getFiberNameFromStrict(componentToken);
            }
            
            const client = g.uniqueYarns.size > 0 ? (Array.from(g.uniqueYarns).map(id => GLOBAL_ITEMS.find(x => x.id === id)).filter(x => x)[0]?.client || 'VARIOS') : 'VARIOS';
            const isCotton = componentToken.includes('PIMA') || componentToken.includes('TANGUIS') || componentToken.includes('ALGODON');
            
            if (isCotton) {
                const merma = 40;
                // Inicializar si no existe
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
            } else {
                const merma = defaultMermaForToken(componentToken);
                // Inicializar si no existe
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

    // 4. RENDERING
    if (typeof renderDetailTable === 'function') renderDetailTable();
    if (typeof renderSummaryTables === 'function') renderSummaryTables();
    if (typeof renderCrudosTable === 'function') renderCrudosTable();
    if (typeof renderMezclasTable === 'function') renderMezclasTable();
    if (typeof renderBalanceView === 'function') renderBalanceView();
}

// Debug helper: expose parsing of yarn strings for quick console testing
window.debugParseYarn = function(rawYarn) {
    const raw = (rawYarn || '').toString();
    let yarnStr = raw.trim();
    // 1) FIRST: Remove trailing HTR/NC/STD markers
    yarnStr = yarnStr.replace(/\s*(HTR|NC|STD)\s*$/i, '').trim();
    // 2) Extract trailing percentages
    let pcts = [];
    const pctMatch = yarnStr.match(/(?:\(|\[)?\s*(\d+(?:\/\d+)+)\s*%?\s*(?:\)|\])?\s*$/);
    if (pctMatch) {
        const rawPcts = pctMatch[1];
        pcts = rawPcts.split('/').map(s => { const n = parseFloat(s.replace(/[^0-9.]/g,'')); return isNaN(n) ? 0 : (n/100); });
        yarnStr = yarnStr.slice(0, pctMatch.index).trim();
    }
    // 3) Extract and remove leading title
    const titleMatch = yarnStr.match(/^\s*([\d.]+\/[\d.]+)\b/);
    let title = '';
    if (titleMatch) { title = titleMatch[1]; yarnStr = yarnStr.slice(titleMatch[0].length).trim(); }
    // 4) What remains is yarnForSignature
    const yarnForSignature = yarnStr.trim();
    const compNames = (typeof getComponentNames === 'function') ? getComponentNames(yarnForSignature) : [];
    return { raw: raw, title: title, yarnForSignature: yarnForSignature, components: compNames, percentages: pcts.map(p => Math.round(p*100)) };
};
