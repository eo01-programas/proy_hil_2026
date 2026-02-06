// Orchestrator: Lógica de Negocio Principal (Mezclas y Crudos)
(function(){
    const v = 'v09';
    const el = document.getElementById('appVersion');
    if (el) el.textContent = v;
    console.log('Orchestrator loaded - version', v);
    window.PROY_VERSION = v;
})();

// --- ESTRATEGIA DE NORMALIZACIÓN ESTRICTA (MEZCLAS) ---
// Esta función define la identidad única de cada fibra dentro de una mezcla.
function getStrictCanonicalToken(raw) {
    if (!raw) return '';
    let u = raw.toString().toUpperCase();
    
    // 1. Limpieza básica
    u = stripDiacritics(u);
    
    // 2. ELIMINAR RUIDO QUE NO AFECTA LA IDENTIDAD
    u = u.replace(/\bCOP\b/g, ''); // "COP PIMA" es igual a "PIMA"
    
    // 3. CORRECCIÓN DE TYPOS
    u = u.replace(/PREPREVE/g, 'REPREVE').replace(/PREPEVE/g, 'REPREVE');

    // 4. LÓGICA DE ALGODÓN CON CERTIFICACIONES (OCS vs GOTS)
    const isPima = u.includes('PIMA');
    const isTanguis = u.includes('TANGUIS');
    const isUpland = u.includes('UPLAND');
    const isAlg = u.includes('ALGODON') || u.includes('COTTON') || u.includes('ALG');
    const isOrg = u.includes('ORG') || u.includes('ORGANICO');
    const isBci = u.includes('BCI');

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

    // --- PRIORIDAD 4: BCI (No orgánico) ---
    if (isBci) {
        if (isTanguis || isUpland || isAlg) return 'UPLAND_BCI';
    }

    // --- PRIORIDAD 5: CONVENCIONAL ---
    if (isPima) return 'PIMA_NC';
    if (isTanguis) return 'TANGUIS_NC';
    if (isAlg) return 'ALGODON_NC';

    // --- OTRAS FIBRAS ---
    // Unificar PES / REPREVE
    if (u.includes('REPREVE') || u.includes('PES') || u.includes('RECICLADO')) return 'PES_REPREVE';
    
    // LYOCELL: Diferenciar A100 de STD/TENCEL
    if (u.includes('LYOCELL') && u.includes('A100')) return 'LYOCELL_A100';
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
var globalCrudoBase = new Array(12).fill(0);
var globalCrudoHTR = new Array(12).fill(0);
var globalCrudoRaw = new Array(12).fill(0);
var globalMezclaRaw = new Array(12).fill(0);
var globalMezclaBase = new Array(12).fill(0);
var globalMezclaHTR = new Array(12).fill(0);

// Asignar a window para hacerlas globales y accesibles desde otros módulos
window.globalCrudoBase = globalCrudoBase;
window.globalCrudoHTR = globalCrudoHTR;
window.globalCrudoRaw = globalCrudoRaw;
window.globalMezclaRaw = globalMezclaRaw;
window.globalMezclaBase = globalMezclaBase;
window.globalMezclaHTR = globalMezclaHTR;

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

// === FUNCIÓN PARA DIVIDIR HILADOS MULTI-COMPONENTE ===
// Divide un hilado como "40/1 PIMA ORG (OCS)/LYOCELL STD/PES PREPREVE (40/30/30%)" 
// en 3 items separados, cada uno con su porcentaje prorrateado
function splitMixedYarnByComponents(item) {
    const yarn = (item.yarn || '').toString();
    
    // Patrón: "40/1 PIMA ORG (OCS)/LYOCELL STD/PES PREPREVE (40/30/30%)HTR"
    // Extraer porcentajes finales: (40/30/30%)
    const pctMatch = yarn.match(/\(\s*(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*)\s*%?\s*\)/);
    if (!pctMatch) {
        return [item]; // Sin porcentajes: no dividir
    }
    
    const pctStr = pctMatch[1];
    const pcts = pctStr.split('/').map(p => {
        const v = parseFloat(p.trim());
        return isNaN(v) ? 0 : (v / 100);
    });
    
    if (pcts.length < 2) {
        return [item]; // Un solo componente: no dividir
    }
    
    // Extraer yarn antes de los porcentajes
    const yarnBeforePct = yarn.slice(0, pctMatch.index).trim();
    
    // Extraer componentes: "40/1 PIMA ORG (OCS)/LYOCELL STD/PES PREPREVE"
    let yarnWithComps = yarnBeforePct.replace(/^\d+\/\d+\s+/, '').trim(); // Quitar "40/1 "
    
    // Dividir por "/" para obtener componentes
    const compParts = yarnWithComps.split('/').map(c => c.trim()).filter(c => c.length > 0);
    
    // Si no coinciden conteos, intentar heurística por palabras clave
    if (compParts.length !== pcts.length) {
        // Lista de keywords para detectar límites de componentes (en mayúsculas)
        const keywordList = ['LYOCELL','TENCEL','MODAL','VISCOSA','VISCOSE','NYLON','PES','REPREVE','PREPREVE','RECICLADO','RECYCLED','WOOL','MERINO','CAÑAMO','CANAMO','HEMP','ELASTANO','SPANDEX','COTTON','COP','PIMA','ORGANICO','ORG','NC','HTR','STD'];
        const yarnU = yarnWithComps.toUpperCase();
        const positions = [];
        // buscar posiciones de todas las keywords
        for (const kw of keywordList) {
            let idx = yarnU.indexOf(kw);
            while (idx !== -1) {
                positions.push(idx);
                idx = yarnU.indexOf(kw, idx + 1);
            }
        }
        // eliminar duplicados y ordenar
        const uniqPos = Array.from(new Set(positions)).sort((a,b)=>a-b);
        let derivedParts = null;
        if (uniqPos.length >= pcts.length && uniqPos.length > 0) {
            // Usar posiciones para trocear en tantas piezas como porcentajes
            derivedParts = [];
            for (let i = 0; i < pcts.length; i++) {
                const start = uniqPos[i] || 0;
                const end = uniqPos[i+1] || yarnWithComps.length;
                const slice = yarnWithComps.substring(start, end).trim();
                // Asegurar que no cortamos a mitad de palabra: expandir a límites de espacios
                const left = Math.max(0, start - 20);
                const right = Math.min(yarnWithComps.length, end + 20);
                let part = yarnWithComps.substring(start, end).trim();
                if (!part || part.length === 0) part = yarnWithComps.substring(left, right).trim();
                derivedParts.push(part.replace(/^[-\/\s]+|[-\/\s]+$/g, '').trim());
            }
        } else if (pcts.length === 2) {
            // heurística simple: dividir en dos usando la primera keyword encontrada
            const firstKwPos = uniqPos.length>0 ? uniqPos[0] : -1;
            if (firstKwPos > 3) {
                const comp1 = yarnWithComps.substring(0, firstKwPos).trim();
                const comp2 = yarnWithComps.substring(firstKwPos).trim();
                derivedParts = [comp1, comp2];
            }
        }

        if (Array.isArray(derivedParts) && derivedParts.length === pcts.length) {
            // usar derivedParts en lugar de compParts
            for (let i=0;i<derivedParts.length;i++) compParts[i] = derivedParts[i];
        } else {
            // no pudimos derivar componentes, no dividir
            return [item];
        }
    }
    
    // Crear un ítem para cada componente
    const result = [];
    compParts.forEach((comp, idx) => {
        const pct = pcts[idx] || 1;
        if (pct <= 0) return;
        
        const newItem = Object.assign({}, item);
        // Generar id único para la parte
        newItem.id = (item.id ? item.id.toString() : 'item') + '_c' + idx + '_' + Math.random().toString(36).slice(2,7);
        newItem.yarn = comp.trim();
        newItem.componentPct = pct;
        newItem.originalYarn = yarn;
        newItem._isComponentPart = true;
        // Prorratear valores (vector mensual y kgSol)
        newItem.values = (item.values || []).map(v => (parseFloat(v) || 0) * pct);
        newItem.originalValues = (item.originalValues || [...(item.values || [])]).map(v => (parseFloat(v) || 0) * pct);
        newItem.kgSol = (parseFloat(item.kgSol) || 0) * pct;
        
        result.push(newItem);
    });
    
    return result.length > 0 ? result : [item];
}

// Función wrapper que divide todos los items en GLOBAL_ITEMS
function applySplitToAllItems() {
    if (!window.GLOBAL_ITEMS || GLOBAL_ITEMS.length === 0) return;
    
    const newItems = [];
    GLOBAL_ITEMS.forEach(item => {
        const parts = splitMixedYarnByComponents(item);
        newItems.push(...parts);
    });
    
    const originalCount = GLOBAL_ITEMS.length;
    const newCount = newItems.length;
    if (newCount > originalCount) {
        console.log(`[COMPONENT SPLIT] Divided ${originalCount} items into ${newCount} parts (${newCount - originalCount} new items from multi-component yarns)`);
        window.GLOBAL_ITEMS = newItems;
    }
}

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
    applySplitToAllItems();
    closeModal();
    recalcAll();
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
    // Ensure multi-component yarns are split into component items before any classification
    try { applySplitToAllItems(); } catch(e) { console.debug('applySplitToAllItems() failed', e); }
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
    
    // Actualizar referencias globales de window cuando se reinician
    window.globalCrudoBase = globalCrudoBase;
    window.globalCrudoHTR = globalCrudoHTR;
    window.globalCrudoRaw = globalCrudoRaw;
    window.globalMezclaRaw = globalMezclaRaw;
    window.globalMezclaBase = globalMezclaBase;
    window.globalMezclaHTR = globalMezclaHTR;
    let crudoMap = {};
    let mezclaMap = {};
    let itemAudit = {};

    GLOBAL_ITEMS.forEach(item => { itemAudit[item.id] = { row: item, allocatedVector: new Array(12).fill(0), originalVector: item.values }; });

    // 2. Iterar items
    GLOBAL_ITEMS.forEach(item => {
        const clientCode = (item.client || "").toUpperCase().trim();
        const lineaUpper = (item.line || "").toUpperCase().trim();
        const isHTRitem = lineaUpper === 'HTR';
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
            
            // CRITICAL: Clean the yarnForSignature to remove HEATHER, HTR, and other unwanted tokens
            yarnForSignature = yarnForSignature.replace(/\b(?:HTR|HEATHER)\b/gi, '').trim();
            // Also remove any nested percentage patterns that shouldn't be part of the title
            yarnForSignature = yarnForSignature.replace(/\s+\(\s*\d+(?:\/\d+)+\s*%?\s*\)\s*/gi, ' ').trim();
            // Collapse multiple spaces
            yarnForSignature = yarnForSignature.replace(/\s+/g, ' ').trim();
            
            // AGGRESSIVE CLEANING: Keep only words that contain fiber keywords (remove decorative text like "B2NT19 OATMEAL")
            const fiberKeywords = ['PIMA', 'LYOCELL', 'VISCOSA', 'ALGODON', 'COTON', 'COTTON', 'ORG', 'ORGANICO', 'PES', 'POLY', 'POLIESTER', 
                                    'LANA', 'WOOL', 'NYLON', 'ELASTANO', 'SPANDEX', 'ACRILICO', 'LINO', 'HEMP', 'COP', 
                                    'REPREVE', 'PREPREVE', 'RECYCLED', 'RECICLADO', 'GOTS', 'TENCEL', 'MODAL', 'BAMBOO'];
            const cleanParts = yarnForSignature.split(/\s+/).filter(word => {
                const wordUpper = word.toUpperCase();
                if (wordUpper === '/') return true; // keep separators so we preserve component splits
                return fiberKeywords.some(kw => wordUpper.includes(kw)) || /^[\(\[]?\d/.test(word);
            });
            yarnForSignature = cleanParts.join(' ').trim();

            // 4) Split into component names
            // IMPORTANT: If percentages exist, preserve the ORIGINAL order from the yarn
            // so pct[i] maps to the correct component (e.g., "MODAL / COP ORGANICO (75/25%)").
            let compNames = [];
            if (pcts && pcts.length > 0) {
                try {
                    if (typeof extractComponentNamesPreserveQualifiers === 'function') {
                        compNames = extractComponentNamesPreserveQualifiers(yarnForSignature) || [];
                    }
                } catch (e) { /* ignore */ }
            }
            if (!compNames || compNames.length === 0) {
                compNames = getComponentNames(yarnForSignature);
            }

            // Caso especial: 1 nombre, multiples porcentajes (e.g. "Algodon/Poly 50/50")
            if (compNames.length === 1 && pcts.length > 1) compNames = splitComponentsByKeywords(compNames[0], pcts.length);
            // If counts still don't match, attempt a keyword-based split using expected count
            if (pcts.length > 1 && compNames.length !== pcts.length) {
                try { compNames = splitComponentsByKeywords(yarnForSignature, pcts.length) || compNames; } catch (e) { /* ignore */ }
            }
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
                    // Build signature INCLUDING both component tokens AND rounded percentages
                    // This ensures "PES REPREVE / COP ORGANICO GOTS (65/35%)" groups with same components and pcts
                    // Format: "TOKEN1_TOKEN2__65/35" (alphabetically sorted by token)
                    const componentSignature = normComps.map(c => c.token).join('_');
                    const pctRoundedArr = normComps.map(c => Math.round((c.pct || 0) * 100));
                    const pctSignature = pctRoundedArr.join('/');
                    signature = componentSignature + '__' + pctSignature;
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
                    // DEBUG: Log signature creation for PES REPREVE items
                    if (yarnForSignature.includes('PES') && yarnForSignature.includes('REPREVE')) {
                        console.log(`📋 NEW MEZCLA GROUP: yarn="${item.yarn}" | cleaned="${yarnForSignature}" | signature="${signature}"`);
                    }
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

    // FUSIÓN MEZCLAS POR TÍTULO: Consolidar grupos con títulos idénticos
    // Si dos mezclas tienen exactamente el mismo título (después de limpieza), deben fusionarse en un solo grupo
    const mergedByTitle = {};
    mezclaGroups.forEach(group => {
        const titleKey = group.title || 'OTROS (MEZCLAS)';
        if (!mergedByTitle[titleKey]) {
            mergedByTitle[titleKey] = {
                key: group.key,
                title: group.title,
                uniqueYarns: new Set(group.uniqueYarns),
                colBases: [...group.colBases],
                groupRawTotals: [...group.groupRawTotals],
                htrColBases: [...group.htrColBases],
                componentTotalsTotal: { ...group.componentTotalsTotal },
                componentPercentages: { ...group.componentPercentages }
            };
        } else {
            // Fusionar: sumar colBases, groupRawTotals, etc.
            group.uniqueYarns.forEach(id => mergedByTitle[titleKey].uniqueYarns.add(id));
            for (let i = 0; i < 12; i++) {
                mergedByTitle[titleKey].colBases[i] += group.colBases[i];
                mergedByTitle[titleKey].groupRawTotals[i] += group.groupRawTotals[i];
                mergedByTitle[titleKey].htrColBases[i] += group.htrColBases[i];
            }
            Object.keys(group.componentTotalsTotal).forEach(token => {
                if (!mergedByTitle[titleKey].componentTotalsTotal[token]) {
                    mergedByTitle[titleKey].componentTotalsTotal[token] = [...group.componentTotalsTotal[token]];
                } else {
                    for (let i = 0; i < 12; i++) {
                        mergedByTitle[titleKey].componentTotalsTotal[token][i] += group.componentTotalsTotal[token][i];
                    }
                }
            });
            Object.keys(group.componentPercentages).forEach(token => {
                mergedByTitle[titleKey].componentPercentages[token] = group.componentPercentages[token];
            });
        }
    });
    mezclaGroups = Object.values(mergedByTitle);
    console.log(`✅ MEZCLA GROUPS MERGED BY TITLE: ${mezclaGroups.length} unique groups`);
    mezclaGroups.forEach(g => {
        if (g.title.includes('PES') && g.title.includes('REPREVE')) {
            console.log(`   ✨ PES REPREVE GROUP: "${g.title}" | Total KG: ${g.groupRawTotals.reduce((s,v)=>s+v,0)}`);
        }
    });

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

    ORDERED_COTTON_KEYS.forEach(k => { detailAlgodon[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });
    ORDERED_OTHER_KEYS.forEach(k => { detailOtras[k] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] }; });

    function defaultMermaForToken(t) {
        const u = (t||'').toString().toUpperCase();
        // ALGODÓN: 40%
        if (u.includes('PIMA') || u.includes('TANGUIS') || u.includes('ALGODON') || u.includes('UPLAND') || u.includes('COP')) return 40;
        // Regenerated cellulose (15%): LYOCELL, MODAL, VISCOSA
        if (u.includes('LYOCELL') || u.includes('TENCEL') || u.includes('MODAL') || u.includes('VISCOSA')) return 15;
        // Recycled PES (15%): detect REPREVE / PREPREVE (these alone are sufficient)
        if (u.includes('REPREVE') || u.includes('PREPREVE')) return 15;
        // Virgin PES (85%): if contains PES but not REPREVE/RECYCLED, then virgin
        if (u.includes('PES')) return 85;
        // Everything else (synthetics, natural): 85%
        return 85;
    }

    function isCottonToken(t) {
        const u = (t||'').toString().toUpperCase();
        return /PIMA|TANGUIS|ALGODON|UPLAND|COP|FLAME|ELEGANT|COTTON|BCI|USTCP|OCS|GOTS/.test(u);
    }
    
    // Mapeo inverso para visualización en Tabla Resumen Materiales
    function getFiberNameFromStrict(strictToken) {
        // ALGODÓN
        if (strictToken === 'PIMA_ORG_OCS') return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
        if (strictToken === 'PIMA_ORG_GOTS') return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
        if (strictToken === 'PIMA_NC') return 'ALGODÓN PIMA NC (QQ)';
        if (strictToken === 'TANGUIS_ORG_OCS') return 'ALGODÓN TANGUIS ORGANICO (OCS) (QQ)';
        if (strictToken === 'TANGUIS_ORG_GOTS') return 'ALGODÓN TANGUIS ORGANICO (GOTS) (QQ)';
        if (strictToken === 'UPLAND_BCI' || strictToken === 'TANGUIS_BCI') return 'ALGODÓN UPLAND BCI (QQ)';
        if (strictToken === 'TANGUIS_NC') return 'ALGODÓN TANGUIS (QQ)';
        if (strictToken === 'ALGODON_ORG_OCS') return 'ALGODÓN ORGANICO - OCS (QQ)';
        if (strictToken === 'ALGODON_ORG_GOTS') return 'ALGODÓN ORGANICO - GOTS (QQ)';
        if (strictToken === 'ALGODON_NC') return 'ALGODÓN UPLAND (QQ)';
        
        // OTRAS FIBRAS - preserve qualifiers like A100, STD, NANO variants
        if (strictToken === 'LYOCELL_A100') return 'LYOCELL A100 (KG)';
        if (strictToken === 'LYOCELL_STD' || strictToken === 'LYOCELL') return 'LYOCELL STD (KG)';
        if (strictToken === 'MODAL') return 'MODAL (KG)';
        if (strictToken === 'VISCOSA') return 'VISCOSA (KG)';
        if (strictToken === 'NYLON') return 'NYLON (KG)';
        if (strictToken === 'ELASTANO' || strictToken === 'SPANDEX') return 'ELASTANO (KG)';
        if (strictToken === 'PES_REPREVE' || strictToken === 'PES_RECYCLED') return 'RECYCLED PES (KG)';
        if (strictToken === 'PES_VIRGIN') return 'PES VIRGEN (KG)';
        if (strictToken === 'PES') return 'PES VIRGEN (KG)';
        if (strictToken === 'WOOL' || strictToken === 'MERINO') return 'WOOL 17.5 (KG)';
        if (strictToken === 'ABETE_NANO_BLANCO') return 'ABETE NANO BLANCO (KG)';
        if (strictToken === 'ABETE_NANO_MULTI') return 'ABETE NANO 159 MULTICOLO (KG)';
        if (strictToken === 'HEMP' || strictToken === 'CAÑAMO') return 'CAÑAMO (KG)';
        
        return strictToken;
    }

    // Lógica para Crudos (Legacy + Compatibilidad)
    function getFiberName(yarn) {
        const u = (yarn||'').toString().toUpperCase();
        // ALGODÓN
        if (u === 'PIMA_ORG_OCS') return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
        if (u === 'PIMA_ORG_GOTS') return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
        if (u === 'ALG_ORG_GOTS') return 'ALGODÓN ORGANICO - GOTS (QQ)';
        if (u === 'ALG_ORG_OCS') return 'ALGODÓN ORGANICO - OCS (QQ)';
        if (u === 'TANGUIS_BCI' || u === 'UPLAND_BCI') return 'ALGODÓN UPLAND BCI (QQ)';
        if ((u.includes('TANGUIS') || u.includes('UPLAND')) && u.includes('BCI')) return 'ALGODÓN UPLAND BCI (QQ)';
        if (u === 'UPLAND_USTCP') return 'ALGODÓN UPLAND USTCP (QQ)';
        if (u.includes('PIMA') && u.includes('ORGANICO')) {
             if(u.includes('GOTS')) return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
             return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
        }
        if (u.includes('PIMA')) return 'ALGODÓN PIMA NC (QQ)';
        if (u.includes('TANGUIS')) return 'ALGODÓN TANGUIS (QQ)';
        if (u.includes('UPLAND')) return 'ALGODÓN UPLAND (QQ)';
        if (u.includes('ELEGANT')) return 'ALGODÓN ELEGANT (QQ)';
        
        // OTRAS FIBRAS (en orden de ORDERED_OTHER_KEYS)
        // Regenerated Cellulose - check for A100 qualifier first
        if (u.includes('LYOCELL') && u.includes('A100')) return 'LYOCELL A100 (KG)';
        if (u.includes('LYOCELL') || u.includes('TENCEL')) return 'LYOCELL STD (KG)';
        if (u.includes('MODAL')) return 'MODAL (KG)';
        if (u.includes('VISCOSA') || u.includes('VISCOSE')) return 'VISCOSA (KG)';
        // Synthetics
        if (u.includes('NYLON')) return 'NYLON (KG)';
        if (u.includes('ELASTANO') || u.includes('SPANDEX')) return 'ELASTANO (KG)';
        // Polyester (differentiate recycled vs virgin)
        if (u.includes('REPREVE') || u.includes('PREPREVE')) return 'RECYCLED PES (KG)';
        if (u.includes('PES') && (u.includes('RECYCLED') || u.includes('RECICLADO'))) return 'RECYCLED PES (KG)';
        if (u.includes('PES')) return 'PES VIRGEN (KG)';
        // Natural
        if (u.includes('WOOL') || u.includes('MERINO')) return 'WOOL 17.5 (KG)';
        if (u.includes('ABETE') && u.includes('BLANCO')) return 'ABETE NANO BLANCO (KG)';
        if (u.includes('ABETE') && (u.includes('MULTI') || u.includes('MULTICOLOR') || u.includes('MULTICOLO'))) return 'ABETE NANO 159 MULTICOLO (KG)';
        if (u.includes('ABETE')) return 'ABETE NANO 159 MULTICOLO (KG)'; // Default to multicolor if not specified
        if (u.includes('CAÑAMO') || u.includes('CANAMO') || u.includes('HEMP')) return 'CAÑAMO (KG)';
        
        return yarn;
    }

    // 3.1 Procesar CRUDOS
    crudoGroups.forEach(g => {
        const groupTitle = g.title || '';
        g.rows.forEach(row => {
            const isCot = isCottonToken(row.yarn);
            const isOther = !isCot && isOtherFiberToken(row.yarn);
            
            if (isCot) {
                const fiberName = getFiberName(row.yarn);
                if (!detailAlgodon[fiberName]) detailAlgodon[fiberName] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                if (!detailAlgodon[fiberName].crudoRows) detailAlgodon[fiberName].crudoRows = [];
                if (!detailAlgodon[fiberName].clients[row.client]) detailAlgodon[fiberName].clients[row.client] = new Array(12).fill(0);
                // Agregar el hilado a crudoRows
                const key = `${groupTitle}||${row.client||''}||${row.line||''}||${row.yarn||''}||${row.id||row.rowIndex||''}`;
                detailAlgodon[fiberName].crudoRows.push(Object.assign({ key, groupTitle }, row));
                for (let i=0;i<12;i++) {
                    const raw = row.values[i] || 0;
                    if (Math.abs(raw) < 0.0001) continue;
                    const req = raw / (1 - 0.40);
                    const qq = req / 46;
                    detailAlgodon[fiberName].clients[row.client][i] += qq;
                    detailAlgodon[fiberName].totalValues[i] += qq;
                }
            } else if (isOther) {
                // OTRAS FIBRAS: Evaluar yarn individual para obtener fiberName correcto
                let fiberName = getFiberName(row.yarn);
                const yarnU = (row.yarn || '').toString().toUpperCase();
                
                // Verificar calificadores específicos
                if (yarnU.includes('LYOCELL')) {
                    if (yarnU.includes('A100')) {
                        fiberName = 'LYOCELL A100 (KG)';
                    } else {
                        fiberName = 'LYOCELL STD (KG)';
                    }
                } else if (yarnU.includes('ABETE')) {
                    if (yarnU.includes('BLANCO')) {
                        fiberName = 'ABETE NANO BLANCO (KG)';
                    } else if (yarnU.includes('MULTI') || yarnU.includes('MULTICOLOR') || yarnU.includes('MULTICOLO')) {
                        fiberName = 'ABETE NANO 159 MULTICOLO (KG)';
                    }
                }
                
                if (!detailOtras[fiberName]) detailOtras[fiberName] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                if (!detailOtras[fiberName].crudoRows) detailOtras[fiberName].crudoRows = [];
                if (!detailOtras[fiberName].clients[row.client]) detailOtras[fiberName].clients[row.client] = new Array(12).fill(0);
                // Agregar el hilado a crudoRows
                const key = `${groupTitle}||${row.client||''}||${row.line||''}||${row.yarn||''}||${row.id||row.rowIndex||''}`;
                detailOtras[fiberName].crudoRows.push(Object.assign({ key, groupTitle }, row));
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
            
            // Determine fiber name: use strict canonical token first so qualifiers (A100, STD, NANO...) are respected
            const compLabelUpper = (componentToken || '').toString().toUpperCase();
            const isPimaToken = /\bPIMA\b/.test(compLabelUpper);
            const isCertifiedToken = /OCS|GOTS|ORGANICO|ORGANIC|CERT|ORG/.test(compLabelUpper);
            // Compute strict token from the raw component label
            let strictToken = componentToken;
            try { if (typeof getStrictCanonicalToken === 'function') strictToken = getStrictCanonicalToken(componentToken || ''); } catch(e) { strictToken = componentToken; }
            let fiberName;
            if (isPimaToken && !isCertifiedToken) {
                fiberName = 'ALGODÓN PIMA NC (QQ)';
            } else {
                // Map from strict token to display name (this preserves qualifiers like A100)
                try { fiberName = (typeof getFiberNameFromStrict === 'function') ? getFiberNameFromStrict(strictToken) : getFiberName(strictToken); } catch(e) { fiberName = getFiberName(strictToken); }
            }

            const groupTitle = g.title || '';
            let client = 'VARIOS';
            if (g.uniqueYarns && g.uniqueYarns.size > 0) {
                const ids = Array.from(g.uniqueYarns);
                let firstItem = null;
                for (let i = 0; i < ids.length; i++) {
                    const candidate = GLOBAL_ITEMS.find(x => x.id === ids[i]);
                    if (candidate) { firstItem = candidate; break; }
                }
                if (firstItem && firstItem.client) client = firstItem.client;
            }
            // Decide si es algodón comprobando el token estricto (más fiable que el texto bruto)
            const isCotton = (typeof strictToken === 'string' && /PIMA|TANGUIS|ALGODON|UPLAND|COP/.test(strictToken.toUpperCase())) || /PIMA|TANGUIS|ALGODON|UPLAND|COP/.test(compLabelUpper);
            
            // Extraer los items individuales de uniqueYarns para mezclaItems
            const mezclaItemsToAdd = [];
            const compPctMap = g.componentPercentages || {};
            function extractPctFromYarn_local(yarn) {
                try {
                    if (!yarn) return null;
                    const s = yarn.toString();
                    // Regex mejorado: captura "65/35 %" o "65/35%" o "(65/35%)" con espacios opcionales
                    const m = s.match(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*%/);
                    if (!m) return null;
                    const pctBlock = m[1].trim(); // grupo 1 sin el %
                    const parts = pctBlock.split('/').map(p => { const v = parseFloat(p.trim()); return isNaN(v) ? null : v/100; }).filter(x => x !== null);
                    return (parts && parts.length > 0) ? parts : null;
                } catch(e) { return null; }
            }

            if (g.uniqueYarns && g.uniqueYarns.size > 0) {
                Array.from(g.uniqueYarns).forEach(id => {
                    try {
                        const itSrc = GLOBAL_ITEMS.find(x => x.id === id);
                        if (!itSrc || !itSrc.yarn) return;
                        const it = Object.assign({ groupTitle }, itSrc);

                        // Determine pct: ESTRATEGIA DIRECTA - Extraer componentes por orden posicional desde el yarn
                        let pct = null;
                        let actualComponentName = componentToken; // Nombre real extraído del yarn
                        
                        try {
                            const pctList = extractPctFromYarn_local(it.yarn);
                            if (Array.isArray(pctList) && pctList.length > 0) {
                                // Extraer componentes en orden posicional (sin el bloque de %)
                                let yarnStr = it.yarn.toString();
                                yarnStr = yarnStr.replace(/^\s*\d+\/\d+\s*/,'').trim(); // quitar "40/1 "
                                yarnStr = yarnStr.replace(/\s*\(?\d+(?:\/\d+)*%?\)?\s*$/,'').trim(); // quitar "(75/25%)" al final
                                yarnStr = yarnStr.replace(/\s*(HTR|NC|STD)\s*$/i, '').trim(); // quitar sufijos al final
                                
                                // Dividir por "/" pero solo si hay "/" que separe componentes reales
                                let comps = yarnStr.split('/').map(c => c.trim()).filter(c => c.length > 0);
                                
                                // CASO ESPECIAL: Si comps.length != pctList.length, el hilado puede no usar "/" como separador
                                // Ejemplo: "COP PIMA NC TENCEL STD" con (75/25%) => 2 componentes sin "/"
                                // Debemos usar keywords para extraer componentes
                                if (comps.length !== pctList.length && pctList.length >= 2) {
                                    // Analizar yarnStr para extraer componentes por keyword boundaries
                                    const fiberBoundaries = ['LYOCELL', 'TENCEL', 'MODAL', 'VISCOSA', 'NYLON', 'PES', 'REPREVE', 'PREPREVE', 'WOOL', 'MERINO', 'ABETE', 'CAÑAMO', 'CANAMO', 'ELASTANO'];
                                    const yarnU = yarnStr.toUpperCase();
                                    
                                    // Buscar donde comienza el segundo componente
                                    let splitPos = -1;
                                    for (const fb of fiberBoundaries) {
                                        const idx = yarnU.indexOf(fb);
                                        // Solo si no está al inicio (el primer componente podría empezar con una keyword de algodón)
                                        if (idx > 3) { // al menos 3 caracteres antes
                                            if (splitPos === -1 || idx < splitPos) {
                                                splitPos = idx;
                                            }
                                        }
                                    }
                                    
                                    if (splitPos > 0) {
                                        // Dividir en 2 componentes
                                        const comp1 = yarnStr.substring(0, splitPos).trim();
                                        const comp2 = yarnStr.substring(splitPos).trim();
                                        comps = [comp1, comp2];
                                    }
                                }

                                // Keywords para identificar tipo de fibra
                                const fiberKeywords = {
                                    'PIMA': ['PIMA'],
                                    'TANGUIS': ['TANGUIS'],
                                    'ALGODON': ['ALGODON', 'COTTON', 'COP'],
                                    'LYOCELL': ['LYOCELL', 'TENCEL'],
                                    'MODAL': ['MODAL'],
                                    'VISCOSA': ['VISCOSA', 'VISCOSE', 'RAYON'],
                                    'NYLON': ['NYLON'],
                                    'PES': ['PES', 'REPREVE', 'RECYCLED'],
                                    'WOOL': ['WOOL', 'MERINO'],
                                    'ABETE': ['ABETE'],
                                    'CAÑAMO': ['CAÑAMO', 'CANAMO', 'HEMP'],
                                    'ELASTANO': ['ELASTANO', 'SPANDEX']
                                };

                                // Determinar qué fibra esperar según componentToken
                                const tokenU = (componentToken || '').toString().toUpperCase();
                                let expectedFiberType = null;
                                
                                // Primero buscar en tipos más específicos (LYOCELL antes de ALGODON)
                                const orderedTypes = ['LYOCELL', 'MODAL', 'VISCOSA', 'NYLON', 'PES', 'WOOL', 'ABETE', 'CAÑAMO', 'ELASTANO', 'PIMA', 'TANGUIS', 'ALGODON'];
                                for (let fType of orderedTypes) {
                                    const keywords = fiberKeywords[fType];
                                    for (let kw of keywords) {
                                        if (tokenU.includes(kw)) {
                                            expectedFiberType = fType;
                                            break;
                                        }
                                    }
                                    if (expectedFiberType) break;
                                }

                                // Buscar el componente que coincide con expectedFiberType
                                let compIndex = -1;
                                if (expectedFiberType) {
                                    const keywords = fiberKeywords[expectedFiberType];
                                    for (let ci = 0; ci < comps.length; ci++) {
                                        const compU = comps[ci].toUpperCase();
                                        for (let kw of keywords) {
                                            if (compU.includes(kw)) {
                                                compIndex = ci;
                                                actualComponentName = comps[ci];
                                                break;
                                            }
                                        }
                                        if (compIndex !== -1) break;
                                    }
                                }
                                
                                // Fallback: si no hay match y los conteos coinciden, usar posición 0
                                if (compIndex === -1 && comps.length === pctList.length) {
                                    compIndex = 0;
                                    actualComponentName = comps[0];
                                }

                                // Asignar el porcentaje por índice posicional
                                if (compIndex >= 0 && compIndex < pctList.length) {
                                    pct = pctList[compIndex];
                                }
                            }
                        } catch (e) { /* ignore parse failures */ }

                        // Normalizar pct a fracción (si viene como porcentaje como 30 -> 0.3)
                        if (pct !== null && pct > 1) pct = pct / 100;

                        it.pct = pct; // may be null
                        it.actualComponentName = actualComponentName; // Guardar nombre real para clasificación
                        mezclaItemsToAdd.push(it);
                    } catch (e) {}
                });
            }
            
            if (isCotton) {
                const merma = 40;
                // Inicializar si no existe
                if (!detailAlgodon[fiberName]) detailAlgodon[fiberName] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                if (!detailAlgodon[fiberName].mezclaItems) detailAlgodon[fiberName].mezclaItems = [];
                if (!detailAlgodon[fiberName].clients[client]) detailAlgodon[fiberName].clients[client] = new Array(12).fill(0);
                
                // Agregar mezclaItems
                mezclaItemsToAdd.forEach(it => {
                    if (!detailAlgodon[fiberName].mezclaItems.some(x => x.id === it.id)) {
                        detailAlgodon[fiberName].mezclaItems.push(it);
                    }
                });
                
                // Calcular QQ POR ITEM (aplicando pct) en lugar de usar vec[i] agregado
                for (let i=0;i<12;i++) {
                    let monthQQ = 0;
                    mezclaItemsToAdd.forEach(it => {
                        try {
                            const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                            if (Math.abs(raw) < 0.0001) return;
                            // Aplicar pct si existe
                            const pct = (it.pct !== null && typeof it.pct === 'number' && it.pct > 0) ? it.pct : 1;
                            const componentRaw = raw * pct;
                            const kgReq = componentRaw / (1 - merma/100);
                            const qq = kgReq / 46;
                            monthQQ += qq;
                        } catch(e) { }
                    });
                    if (monthQQ > 0.0001) {
                        detailAlgodon[fiberName].clients[client][i] += monthQQ;
                        detailAlgodon[fiberName].totalValues[i] += monthQQ;
                    }
                }
            } else {
                // OTRAS FIBRAS: Procesar cada item usando el nombre real del componente extraído del yarn
                mezclaItemsToAdd.forEach(it => {
                    try {
                        // Usar actualComponentName (extraído del yarn) para determinar fiberName correcto
                        const realCompName = it.actualComponentName || componentToken;
                        const realCompUpper = (realCompName || '').toString().toUpperCase();
                        
                        // Determinar fiberName basado en el nombre REAL del componente
                        let itemFiberName = fiberName; // Default
                        if (realCompUpper.includes('LYOCELL') || realCompUpper.includes('TENCEL')) {
                            if (realCompUpper.includes('A100')) {
                                itemFiberName = 'LYOCELL A100 (KG)';
                            } else {
                                itemFiberName = 'LYOCELL STD (KG)';
                            }
                        } else if (realCompUpper.includes('ABETE')) {
                            if (realCompUpper.includes('BLANCO')) {
                                itemFiberName = 'ABETE NANO BLANCO (KG)';
                            } else {
                                itemFiberName = 'ABETE NANO 159 MULTICOLO (KG)';
                            }
                        } else if (realCompUpper.includes('CAÑAMO') || realCompUpper.includes('CANAMO') || realCompUpper.includes('HEMP')) {
                            itemFiberName = 'CAÑAMO (KG)';
                        } else if (realCompUpper.includes('WOOL') || realCompUpper.includes('MERINO')) {
                            itemFiberName = 'WOOL 17.5 (KG)';
                        } else if (realCompUpper.includes('NYLON')) {
                            itemFiberName = 'NYLON (KG)';
                        } else if (realCompUpper.includes('MODAL')) {
                            itemFiberName = 'MODAL (KG)';
                        } else if (realCompUpper.includes('REPREVE') || realCompUpper.includes('PREPREVE') || (realCompUpper.includes('PES') && (realCompUpper.includes('RECYCLED') || realCompUpper.includes('RECICLADO')))) {
                            itemFiberName = 'RECYCLED PES (KG)';
                        }
                        
                        const merma = defaultMermaForToken(realCompName);
                        const itemClient = it.client || client;
                        
                        // Inicializar si no existe
                        if (!detailOtras[itemFiberName]) detailOtras[itemFiberName] = { totalValues: new Array(12).fill(0), clients: {}, crudoRows: [], mezclaItems: [] };
                        if (!detailOtras[itemFiberName].mezclaItems) detailOtras[itemFiberName].mezclaItems = [];
                        if (!detailOtras[itemFiberName].clients[itemClient]) detailOtras[itemFiberName].clients[itemClient] = new Array(12).fill(0);
                        
                        // Agregar mezclaItem (evitar duplicados)
                        if (!detailOtras[itemFiberName].mezclaItems.some(x => x.id === it.id)) {
                            detailOtras[itemFiberName].mezclaItems.push(it);
                        }
                        
                        // Calcular KgReq POR ITEM (SIN QQ - QQ solo para algodón)
                        for (let i=0;i<12;i++) {
                            try {
                                const raw = parseFloat(it.values && it.values[i] ? it.values[i] : 0) || 0;
                                if (Math.abs(raw) < 0.0001) continue;
                                const pct = (it.pct !== null && typeof it.pct === 'number' && it.pct > 0) ? it.pct : 1;
                                const componentRaw = raw * pct;
                                const req = componentRaw / (1 - merma/100);
                                detailOtras[itemFiberName].clients[itemClient][i] += req;
                                detailOtras[itemFiberName].totalValues[i] += req;
                            } catch(e) { }
                        }
                    } catch(e) { }
                });
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
