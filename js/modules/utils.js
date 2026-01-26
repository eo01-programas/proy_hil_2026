// Shared utility functions moved from app.js
const MONTH_NAMES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const ORDERED_COTTON_KEYS = [
    "ALGODÓN PIMA NC (QQ)",
    "ALGODÓN PIMA ORGANICO - OCS (QQ)",
    "ALGODÓN TANGUIS NC BCI (QQ)",
    "ALGODÓN ORGANICO - GOTS (QQ)",
    "ALGODÓN ORGANICO - OCS (QQ)",
    "ALGODÓN UPLAND USTCP (QQ)",
    "ALGODÓN UPLAND (QQ)",
    "ALGODÓN ELEGANT (QQ)",
    "ALGODÓN PIMA ORGANICO - GOTS (QQ)"
];

const ORDERED_OTHER_KEYS = [
    "LYOCELL STD (KG)",
    "NYLON (KG)",
    "RECYCLED PES (KG)",
    "WOOL 17.5 (KG)",
    "LYOCELL A100 (KG)",
    "MODAL (KG)",
    "ABETE NANO 159 MULTICOLO (KG)",
    "ABETE NANO BLANCO (KG)",
    "CAÑAMO (KG)"
];
function generateId() { return 'row_' + Math.random().toString(36).substr(2, 9); }

function formatNumber(num) {
    let n = Math.round(parseFloat(num || 0));
    if (n === 0) return '-';
    return n.toLocaleString('en-US');
}

function formatCellClass(num) {
    let n = Math.round(parseFloat(num || 0));
    if (n < 0) return 'negative-val text-num';
    if (n === 0) return 'zero-val text-num';
    return 'font-semibold text-gray-700 text-num';
}

function escapeHtml(s) {
    return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isAlgodon(name) {
    if (!name) return false;
    const n = name.toUpperCase();
    return /ALGODON|ALG|PIMA|TANGUIS|COP|UPLAND|BCI|USTCP|OCS|GOTS|FLAME|ELEGANT|COTTON/.test(n);
}

function parseLocaleNumber(stringNumber) {
    if (typeof stringNumber === 'number') return stringNumber;
    if (stringNumber === null || stringNumber === undefined || stringNumber === '') return 0;
    let s = stringNumber.toString().trim();
    s = s.replace(/\u00A0/g, '');
    if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
    } else if (s.indexOf(',') !== -1) {
        s = s.replace(/,/g, '.');
    } else {
        s = s.replace(/\./g, '');
    }
    s = s.replace(/[^0-9\.-]/g, '');
    return parseFloat(s) || 0;
}

function getNormalizedComponent(rawName) {
    let u = rawName.toUpperCase();
    u = u.replace(/PREPREVE/g, 'REPREVE').replace(/PREPEVE/g, 'REPREVE');
    u = u.replace(/\bORG\b/g, 'ORGANICO').replace(/\bORG\./g, 'ORGANICO');
    u = u.replace(/WOOLL/g, 'WOOL');
    u = u.replace(/\bCOP\s+/g, '');
    if (u.includes('PIMA') && u.includes('ORGANICO') && u.includes('OCS')) return 'PIMA_ORG_OCS';
    if (u.includes('PIMA') && u.includes('ORGANICO') && u.includes('GOTS')) return 'PIMA_ORG_GOTS';
    if (u.includes('PIMA') && u.includes('ORGANICO')) return 'PIMA_ORG';
    if (u.includes('ORGANICO') && u.includes('GOTS')) return 'ALG_ORG_GOTS';
    if (u.includes('ORGANICO') && u.includes('OCS')) return 'ALG_ORG_OCS';
    if (u.includes('ORGANICO')) return 'ALG_ORG';
    if (u.includes('TANGUIS') && u.includes('BCI')) return 'TANGUIS_BCI';
    if (u.includes('UPLAND') && u.includes('USTCP')) return 'UPLAND_USTCP';
        u = u.replace(/\bSTD\b/g, '').replace(/\bHTR\b/g, '').replace(/\bHEATHER\b/g, '').replace(/\bNC\b/g, '').replace(/\bOCS\b/g, '')
            .replace(/\bGOTS\b/g, '').replace(/\bBCI\b/g, '').replace(/\bUSTCP\b/g, '')
            .replace(/[0-9\/\%()[\]]/g, '').replace(/\s+/g, ' ').trim();
    if (u.includes('PIMA')) return 'PIMA';
    if (u.includes('TANGUIS')) return 'TANGUIS';
    if (u.includes('UPLAND') || u.includes('FLAME')) return 'UPLAND';
    if (u.includes('ELEGANT')) return 'ELEGANT';
    if (u.includes('ALGODON') || u.includes('COTTON') || u.includes('ORGANICO')) return 'ALGODON';
    if (u.includes('TENCEL') || u.includes('TENCELL') || u.includes('LYOCELL')) return 'LYOCELL';
    if (u.includes('VISCOSA')) return 'VISCOSA';
    if (u.includes('MODAL')) return 'MODAL';
    if (u.includes('MERINO') || u.includes('WOOL')) return 'WOOL';
    if (u.includes('PES') && (u.includes('REPREVE') || u.includes('PREPREVE') || u.includes('PREPEVE'))) return 'PES_REPREVE';
    // Note: REPREVE/PREPREVE handled above; do not classify generic 'RECYCLED' alone as PES_RECYCLED
    if (u.includes('PES')) return 'POLYESTER';
    if (u.includes('NYLON')) return 'NYLON';
    if (u.includes('LINO')) return 'LINO';
    if (u.includes('CAÑAMO') || u.includes('CANAMO')) return 'HEMP';
    return u.replace(/\s+/g, ' ').trim();
}

function getComponentPriority(compName) {
    const u = compName.toUpperCase();
    if (u.includes('PIMA')) return 0;
    if (u.includes('TANGUIS')) return 0;
    if (u.includes('COP')) return 0;
    if (u.includes('ALGODON')) return 0;
    if (u.includes('COTTON')) return 0;
    if (u.includes('UPLAND')) return 0;
    if (u.includes('ORGANICO')) return 0;
    if (u.includes('ELEGANT')) return 0;
    if (u.includes('FLAME')) return 0;
    if (u.includes('LYOCELL')) return 1;
    if (u.includes('MODAL')) return 2;
    if (u.includes('VISCOSA')) return 3;
    if (u.includes('NYLON')) return 4;
    if (u.includes('PES')) return 5;
    if (u.includes('POLYESTER')) return 5;
    if (u.includes('REPREVE')) return 5;
    return 10;
}

function isOtherFiberToken(t) {
    if (!t) return false;
    const u = t.toString().toUpperCase();
    return /LYOCELL|TENCEL|NYLON|REPREVE|PES|MODAL|ABETE|CAÑAMO|CANAMO|WOOL|MERINO|VISCOSA|VISCOSE|POLYESTER|LINO/.test(u);
}

function getPercentages(yarn) {
    if (!yarn) return [];
    let s = yarn.toString();
    // Insertar espacio cuando números están pegados al texto (p.ej. LYOCELL50/30/20% -> LYOCELL 50/30/20%)
    try {
        s = s.replace(/([A-Za-zÀ-ÖØ-öø-ÿ])(?=\d)/g, '$1 ');
    } catch (e) { /* ignore regex issues on exotic environments */ }
    s = s.replace(/\s+(HTR|NC|STD|HEATHER)\s*$/i, '');
    const patterns = [
        /\(\s*(\d{1,3}(?:[\s\/]\s*\d{1,3})+)\s*%?\s*\)/,
        /\[\s*(\d{1,3}(?:[\s\/]\s*\d{1,3})+)\s*%?\s*\]/,
        /\s(\d{1,3}(?:[\s\/]\s*\d{1,3})+)%?\s*$/,
    ];
    for (let pattern of patterns) {
        const match = s.match(pattern);
        if (match) {
            const parts = match[1].trim().split(/[\s\/]+/).map(p => p.replace(/%/g, '').trim()).filter(Boolean);
            if (parts.length < 2) continue;
            const numParts = parts.map(n => parseFloat(n));
            const sum = numParts.reduce((a,b)=>a+b, 0);
            let result;
            if (Math.abs(sum - 100) < 0.1) {
                result = numParts.map(n => n / 100);
            } else {
                result = numParts.map(n => n > 1 ? n / 100 : n);
            }
            const allValid = result.every(p => !isNaN(p) && p > 0 && p <= 1);
            const sumValid = Math.abs(result.reduce((a,b)=>a+b,0) - 1.0) < 0.01;
            if (allValid && sumValid) return result;
        }
    }
    // Fallback: buscar cualquier secuencia de porcentajes tipo 50/30/20 o 50/30/20% incluso si está pegado a palabras
    try {
        const m = s.match(/(\d{1,3}(?:\/\d{1,3})+)\%?/);
        if (m) {
            const parts = m[1].trim().split(/\//).map(p => p.replace(/%/g,'').trim()).filter(Boolean);
            if (parts.length >= 2) {
                const numParts = parts.map(n => parseFloat(n));
                const sum = numParts.reduce((a,b)=>a+b,0);
                let result = numParts.map(n => n > 1 ? n/100 : n);
                const allValid = result.every(p => !isNaN(p) && p > 0 && p <= 1);
                const sumValid = Math.abs(result.reduce((a,b)=>a+b,0) - 1.0) < 0.05;
                if (allValid && sumValid) return result;
            }
        }
    } catch(e) { /* ignore fallback errors */ }
    return [];
}

function cleanImportedName(yarnRaw, clientRaw) {
    if (!yarnRaw) return "";
    let s = yarnRaw.toString().toUpperCase().trim();
    const client = (clientRaw || "").toString().toUpperCase().trim();
    
    // REGLA 1: Cambiar "PES PREPREVE" a "PES REPREVE"
    s = s.replace(/PES\s+PREPREVE/gi, 'PES REPREVE');
    
    // REGLA 2: Eliminar los términos "HTR" y "HEATHER" completamente del hilado
    // Eliminar HTR o HEATHER al final
    s = s.replace(/\s+(HTR|HEATHER)\s*$/i, '').trim();
    // Eliminar HTR o HEATHER como palabra completa en cualquier posición
    s = s.replace(/\b(?:HTR|HEATHER)\b/gi, '').trim();
    // Limpiar espacios múltiples resultantes
    s = s.replace(/\s+/g, ' ').trim();
    
    const orgRegex = /\b(ORGANICO|ORGANIC|ORG\.?)/gi;
    if (orgRegex.test(s)) {
        const cert = (client === "LLL") ? "(OCS)" : "(GOTS)";
        s = s.replace(/\(OCS\)/g, "").replace(/\(GOTS\)/g, "").replace(/\bOCS\b/g, "").replace(/\bGOTS\b/g, "");
        s = s.replace(orgRegex, `$1 ${cert}`);
        s = s.replace(/\s+/g, " ").trim();
    }
    return s;
}

function getComponentNames(yarn) {
    if (!yarn) return [];
    let clean = yarn.toString().toUpperCase();
    clean = clean.replace(/^\d+\/\d+\s+/, '').replace(/\s+\d{1,3}[\s\/]\d{1,3}%?\s*$/, '').replace(/\s+\d{1,3}%\s*$/, '').replace(/\b(STD|HTR|NC|HEATHER)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    const cottonKeywords = ['PIMA', 'TANGUIS', 'UPLAND', 'COP', 'ALGODON', 'COTTON', 'FLAME', 'ELEGANT', 'BCI', 'OCS', 'GOTS', 'USTCP', 'ORGANICO'];
    const otherFibers = ['LYOCELL', 'TENCEL', 'MODAL', 'VISCOSA', 'VISCOSE', 'NYLON', 'PES', 'POLYESTER', 'REPREVE', 'PREPREVE', 'WOOL', 'MERINO', 'ACRYLIC', 'LINO', 'CAÑAMO', 'CANAMO', 'ELASTANO', 'SPANDEX', 'ABETE'];
    const components = [];
    if (cottonKeywords.some(kw => clean.includes(kw))) components.push(extractCottonName(yarn));
    otherFibers.filter(fiber => clean.includes(fiber)).forEach(fiber => components.push(fiber));
    return components.length > 0 ? components : [];
}

function extractCottonName(yarn) {
    if (!yarn) return 'ALGODON';
    const upper = yarn.toString().toUpperCase();
    if (upper.includes('PIMA') && upper.includes('ORGANICO') && upper.includes('GOTS')) return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
    if (upper.includes('PIMA') && upper.includes('ORGANICO') && upper.includes('OCS')) return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
    if (upper.includes('PIMA') && upper.includes('ORGANICO')) return 'ALGODÓN PIMA ORGANICO (QQ)';
    if (upper.includes('COP') && upper.includes('PIMA')) return 'COP PIMA';
    if (upper.includes('PIMA')) return 'PIMA';
    if (upper.includes('TANGUIS') && upper.includes('BCI')) return 'ALGODÓN TANGUIS NC BCI (QQ)';
    if (upper.includes('COP') && upper.includes('TANGUIS') && upper.includes('BCI')) return 'COP TANGUIS BCI';
    if (upper.includes('COP') && upper.includes('TANGUIS')) return 'COP TANGUIS';
    if (upper.includes('TANGUIS')) return 'TANGUIS';
    if (upper.includes('UPLAND') && upper.includes('USTCP')) return 'UPLAND USTCP';
    if (upper.includes('UPLAND') && upper.includes('FLAME')) return 'UPLAND FLAME';
    if (upper.includes('UPLAND')) return 'UPLAND';
    if (upper.includes('ORGANICO') && upper.includes('GOTS')) return 'ORGANICO (GOTS)';
    if (upper.includes('ORGANICO') && upper.includes('OCS')) return 'ORGANICO (OCS)';
    if (upper.includes('COP') && upper.includes('ORGANICO')) return 'COP ORGANICO';
    if (upper.includes('ELEGANT')) return 'ELEGANT';
    if (upper.includes('FLAME')) return 'FLAME';
    return 'ALGODON';
}

function hasMultipleFiberTypes(yarn) {
    if (!yarn) return false;
    const upper = yarn.toString().toUpperCase().replace(/^\d+\/\d+\s+/, '');
    const hasPercentages = /\d{1,3}[\s\/]\d{1,3}%?/.test(upper) || /\d{1,3}%/.test(upper);
    const nonCottonFibers = ['LYOCELL', 'TENCEL', 'MODAL', 'VISCOSA', 'VISCOSE', 'NYLON', 'PES', 'POLYESTER', 'REPREVE', 'PREPREVE', 'WOOL', 'MERINO', 'ACRYLIC', 'LINO', 'CAÑAMO', 'CANAMO', 'ELASTANO', 'SPANDEX', 'ABETE'];
    const cottonKeywords = ['PIMA', 'TANGUIS', 'UPLAND', 'COP', 'ALGODON', 'COTTON', 'FLAME', 'ELEGANT'];
    const hasCotton = cottonKeywords.some(kw => upper.includes(kw));
    const hasOtherFiber = nonCottonFibers.some(fiber => upper.includes(fiber));
    if (hasCotton && hasOtherFiber) return true;
    if (nonCottonFibers.filter(fiber => upper.includes(fiber)).length >= 2) return true;
    if (hasPercentages) {
        const slashParts = upper.split('/');
        if (slashParts.length >= 2) {
            const allFibers = [...cottonKeywords, ...nonCottonFibers];
            let fiberPartsCount = 0;
            slashParts.forEach(part => { if (allFibers.some(f => part.includes(f))) fiberPartsCount++; });
            if (fiberPartsCount >= 2) return true;
        }
    }
    return false;
}

function splitComponentsByKeywords(componentStr, expectedCount) {
    const s = componentStr.trim();
    const fiberKeywords = ['TENCEL','LYOCELL','VISCOSE','PIMA','ALGODON','COTTON','POLYESTER','PES','ELASTANO','NYLON','MODAL','WOOL','ACRYLIC'];
    const matches = [];
    let m;
    const regex = new RegExp('\\b(' + fiberKeywords.join('|') + ')\\b', 'ig');
    while ((m = regex.exec(s)) !== null) matches.push({idx: m.index, key: m[1]});
    if (expectedCount === 2 && matches.length) {
        const splitAt = matches[matches.length-1].idx;
        const left = s.slice(0, splitAt).trim();
        const right = s.slice(splitAt).trim();
        if (left && right) return [left, right];
    }
    if (matches.length >= expectedCount) {
        const starts = matches.slice(0, expectedCount).map(x => x.idx);
        starts.push(s.length);
        const parts = [];
        let last = 0;
        for (let i=0;i<starts.length;i++) {
            const part = s.slice(last, starts[i]).trim();
            if (part) parts.push(part);
            last = starts[i];
        }
        if (parts.length === expectedCount) return parts;
    }
    const words = s.split(/\s+/).filter(Boolean);
    if (expectedCount <= 1 || expectedCount > words.length) return [s];
    const avg = Math.floor(words.length / expectedCount);
    const out = [];
    let i = 0;
    for (let k=0;k<expectedCount-1;k++) {
        const take = Math.max(1, avg);
        out.push(words.slice(i, i+take).join(' '));
        i += take;
    }
    out.push(words.slice(i).join(' '));
    return out.map(x => x.trim());
}

function classifyItem(item) {
    if (!item) return 'CRUDO';
    if (item._forcedClassification) return item._forcedClassification;
    const lineaUpper = (item.line || "").toString().toUpperCase().trim();
    const isMultiFiber = hasMultipleFiberTypes(item.yarn);
    if (lineaUpper === "CRUDO") return 'CRUDO';
    if (lineaUpper === "MEZCLA") return 'MEZCLA';
    if (lineaUpper === "HTR") return isMultiFiber ? 'MEZCLA' : 'CRUDO';
    if (isMultiFiber) return 'MEZCLA';
    return 'CRUDO';
}

function generateCellsHTML(values, isHeader = false, customClass = '') {
    if (!Array.isArray(activeIndices)) return '';
    return activeIndices.map(idx => {
        if (isHeader) return `<th class="text-right px-2 py-1 w-14 ${customClass}">${MONTH_NAMES[idx]}</th>`;
        const cls = customClass || formatCellClass(values ? values[idx] : 0);
        const val = values && typeof values[idx] !== 'undefined' ? values[idx] : 0;
        return `<td class="text-right px-2 border-l border-gray-100 ${cls}">${formatNumber(val)}</td>`;
    }).join('');
}

function getCrudoGroupKey(yarnName, clientName = "") {
    if (!yarnName) return "";
    const s = yarnName.toUpperCase().trim();
    if (s.includes('USTCP')) return '__GROUP_ALGODON_USTCP__';
    if (s.includes('BCI')) return '__GROUP_ALGODON_BCI__';
    const hasPIMA = s.includes('PIMA');
    if (hasPIMA) {
        if (s.includes('GOTS')) return '__GROUP_ALGODON_PIMA_ORGANICO_GOTS__';
        if (s.includes('OCS')) return '__GROUP_ALGODON_PIMA_ORGANICO_OCS__';
        return '__GROUP_ALGODON_PIMA__';
    } else {
        if (s.includes('GOTS')) return '__GROUP_ALGODON_TANGUIS_ORGANICO_GOTS__';
        if (s.includes('OCS')) return '__GROUP_ALGODON_TANGUIS_ORGANICO_OCS__';
        return '__GROUP_ALGODON_TANGUIS__';
    }
}

function getCrudoGroupTitle(yarnName, clientName = "") {
    if (!yarnName) return "";
    const s = yarnName.toUpperCase().trim();
    if (s.includes('USTCP')) return 'ALGODON USTCP';
    if (s.includes('BCI')) return 'ALGODON BCI';
    const hasPIMA = s.includes('PIMA');
    if (hasPIMA) {
        if (s.includes('GOTS')) return 'ALGODON PIMA ORGANICO (GOTS)';
        if (s.includes('OCS')) return 'ALGODON PIMA ORGANICO (OCS)';
        return 'ALGODON PIMA';
    } else {
        if (s.includes('GOTS')) return 'ALGODON TANGUIS ORGANICO (GOTS)';
        if (s.includes('OCS')) return 'ALGODON TANGUIS ORGANICO (OCS)';
        return 'ALGODON TANGUIS';
    }
}

function classifyItem(item) {
    if (!item) return 'CRUDO';
    if (item._forcedClassification) return item._forcedClassification;
    const lineaUpper = (item.line || "").toUpperCase().trim();
    const isMultiFiber = hasMultipleFiberTypes(item.yarn);
    if (lineaUpper === "CRUDO") return 'CRUDO';
    if (lineaUpper === "MEZCLA") return 'MEZCLA';
    if (lineaUpper === "HTR") return isMultiFiber ? 'MEZCLA' : 'CRUDO';
    if (isMultiFiber) return 'MEZCLA';
    return 'CRUDO';
}
// Helper: Extract component names from a mixed yarn, preserving type qualifiers like A100, STD, NANO
function extractComponentNamesPreserveQualifiers(titleStr) {
    if (!titleStr) return [];
    
    // Split by "/" and preserve everything including qualifiers
    const parts = titleStr.split('/').map(s => s.trim()).filter(s => s.length > 0);
    const fiberKeywords = ['LYOCELL', 'TENCEL', 'MODAL', 'VISCOSA', 'VISCOSE', 'NYLON', 'PES', 'POLYESTER', 'REPREVE', 'WOOL', 'MERINO', 'ACRYLIC', 'LINO', 'CAÑAMO', 'CANAMO', 'ELASTANO', 'SPANDEX', 'ABETE', 'PIMA', 'ALGODON', 'COTTON', 'COP', 'TANGUIS', 'UPLAND'];
    
    const components = [];
    
    parts.forEach(part => {
        const partUpper = part.toUpperCase();
        // Check if this part contains a fiber keyword; if so, preserve it as-is (with qualifiers)
        const hasFiber = fiberKeywords.some(kw => partUpper.includes(kw));
        if (hasFiber) {
            components.push(part);
        }
    });
    
    return components.length > 0 ? components : parts; // fallback: return all parts if no fiber matched
}
