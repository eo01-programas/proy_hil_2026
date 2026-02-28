const MONTH_NAMES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const ORDERED_COTTON_KEYS = [
    "ALGODÓN PIMA NC (QQ)",
    "ALGODÓN PIMA ORGANICO - OCS (QQ)",
    "ALGODÓN UPLAND BCI (QQ)",
    "ALGODÓN ORGANICO - GOTS (QQ)",
    "ALGODÓN ORGANICO - OCS (QQ)",
    "ALGODÓN UPLAND USTCP (QQ)",
    "ALGODÓN TANGUIS (QQ)",
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

// Lightweight polyfills for older browsers (kept ES5 for compatibility)
(function () {
    if (!Array.from) {
        Array.from = function (source, mapFn, thisArg) {
            var out = [];
            if (source == null) return out;
            var hasMap = typeof mapFn === 'function';
            var idx = 0;
            var pushVal = function (val) {
                out.push(hasMap ? mapFn.call(thisArg, val, idx++) : val);
            };
            if (typeof source.length === 'number') {
                for (var i = 0; i < source.length; i++) pushVal(source[i]);
                return out;
            }
            if (typeof source.forEach === 'function') {
                source.forEach(function (v) { pushVal(v); });
                return out;
            }
            return out;
        };
    }
    if (!Object.assign) {
        Object.assign = function (target) {
            if (target == null) throw new TypeError('Cannot convert undefined or null to object');
            var to = Object(target);
            for (var i = 1; i < arguments.length; i++) {
                var next = arguments[i];
                if (next != null) {
                    for (var key in next) {
                        if (Object.prototype.hasOwnProperty.call(next, key)) {
                            to[key] = next[key];
                        }
                    }
                }
            }
            return to;
        };
    }
    if (!Object.values) {
        Object.values = function (obj) {
            var out = [];
            if (obj == null) return out;
            for (var key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) out.push(obj[key]);
            }
            return out;
        };
    }
    if (!String.prototype.includes) {
        String.prototype.includes = function (search, start) {
            if (typeof start !== 'number') start = 0;
            if (start + search.length > this.length) return false;
            return this.indexOf(search, start) !== -1;
        };
    }
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (search, pos) {
            var start = pos || 0;
            return this.substr(start, search.length) === search;
        };
    }
    if (!Array.prototype.includes) {
        Array.prototype.includes = function (search, fromIndex) {
            var len = this.length >>> 0;
            if (!len) return false;
            var i = fromIndex | 0;
            if (i < 0) i = Math.max(len + i, 0);
            for (; i < len; i++) {
                if (this[i] === search || (search !== search && this[i] !== this[i])) return true;
            }
            return false;
        };
    }
    if (!Array.prototype.find) {
        Array.prototype.find = function (predicate, thisArg) {
            if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
            if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
            var list = Object(this);
            var len = list.length >>> 0;
            for (var i = 0; i < len; i++) {
                var value = list[i];
                if (predicate.call(thisArg, value, i, list)) return value;
            }
            return undefined;
        };
    }
})();

function generateId() { return 'row_' + Math.random().toString(36).substr(2, 9); }

function formatNumber(num) {
    var n = parseLocaleNumber(num);
    if (!isFinite(n)) return '-';
    if (Math.abs(n) < 0.0000001) return '0';

    // Mostrar siempre 0 decimales. Si es 0.x, mantener en 0 (no redondear a 1).
    var rounded = Math.abs(n) < 1 ? 0 : Math.round(n);
    if (Object.is(rounded, -0)) rounded = 0;
    if (rounded === 0) return '0';

    // Formato con una sola coma (máximo) y sin puntos
    var intPart = String(rounded);
    var sign = '';
    if (intPart.charAt(0) === '-') { sign = '-'; intPart = intPart.slice(1); }
    if (intPart.length > 3) {
        intPart = intPart.slice(0, -3) + ',' + intPart.slice(-3);
    }
    return sign + intPart;
}

function formatCellClass(num) {
    var n = parseLocaleNumber(num);
    if (n < 0) return 'negative-val text-num';
    if (Math.abs(n) < 0.0000001) return 'zero-val text-num';
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

function stripDiacritics(input) {
    if (input === null || input === undefined) return '';
    var s = input.toString();
    if (s.normalize) {
        try {
            return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) { /* fallback below */ }
    }
    return s
        .replace(/[ÁÀÂÄÃÅ]/g, 'A').replace(/[áàâäãå]/g, 'a')
        .replace(/[ÉÈÊË]/g, 'E').replace(/[éèêë]/g, 'e')
        .replace(/[ÍÌÎÏ]/g, 'I').replace(/[íìîï]/g, 'i')
        .replace(/[ÓÒÔÖÕ]/g, 'O').replace(/[óòôöõ]/g, 'o')
        .replace(/[ÚÙÛÜ]/g, 'U').replace(/[úùûü]/g, 'u')
        .replace(/[Ñ]/g, 'N').replace(/[ñ]/g, 'n')
        .replace(/[Ç]/g, 'C').replace(/[ç]/g, 'c');
}

function parseLocaleNumber(stringNumber) {
    if (typeof stringNumber === 'number') return stringNumber;
    if (stringNumber === null || stringNumber === undefined || stringNumber === '') return 0;
    var s = stringNumber.toString().trim();
    if (!s) return 0;
    s = s.replace(/\u00A0/g, '').replace(/\s+/g, '');

    // If scientific notation, parse directly
    if (/[eE]/.test(s)) {
        var sci = Number(s.replace(',', '.'));
        return isNaN(sci) ? 0 : sci;
    }

    var hasDot = s.indexOf('.') !== -1;
    var hasComma = s.indexOf(',') !== -1;
    if (hasDot && hasComma) {
        // decimal separator is the last one
        if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
            s = s.replace(/,/g, '');
        } else {
            s = s.replace(/\./g, '');
            s = s.replace(/,/g, '.');
        }
    } else if (hasDot || hasComma) {
        var sep = hasComma ? ',' : '.';
        var parts = s.split(sep);
        if (parts.length > 2) {
            s = parts.join('');
        } else {
            var intPart = parts[0];
            var fracPart = parts[1] || '';
            if (fracPart.length > 0 && (fracPart.length <= 2 || intPart === '0' || intPart === '-0')) {
                s = intPart + '.' + fracPart;
            } else {
                s = intPart + fracPart;
            }
        }
    }
    s = s.replace(/[^0-9\.-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
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
    if (!u.includes('PIMA') && u.includes('BCI')) return 'UPLAND_BCI';
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
            const sum = numParts.reduce((a, b) => a + b, 0);
            let result;
            if (Math.abs(sum - 100) < 0.1) {
                result = numParts.map(n => n / 100);
            } else {
                result = numParts.map(n => n > 1 ? n / 100 : n);
            }
            const allValid = result.every(p => !isNaN(p) && p > 0 && p <= 1);
            const sumValid = Math.abs(result.reduce((a, b) => a + b, 0) - 1.0) < 0.01;
            if (allValid && sumValid) return result;
        }
    }
    // Fallback: buscar cualquier secuencia de porcentajes tipo 50/30/20 o 50/30/20% incluso si está pegado a palabras
    try {
        const m = s.match(/(\d{1,3}(?:\/\d{1,3})+)\%?/);
        if (m) {
            const parts = m[1].trim().split(/\//).map(p => p.replace(/%/g, '').trim()).filter(Boolean);
            if (parts.length >= 2) {
                const numParts = parts.map(n => parseFloat(n));
                const sum = numParts.reduce((a, b) => a + b, 0);
                let result = numParts.map(n => n > 1 ? n / 100 : n);
                const allValid = result.every(p => !isNaN(p) && p > 0 && p <= 1);
                const sumValid = Math.abs(result.reduce((a, b) => a + b, 0) - 1.0) < 0.05;
                if (allValid && sumValid) return result;
            }
        }
    } catch (e) { /* ignore fallback errors */ }
    return [];
}

function cleanImportedName(yarnRaw, clientRaw) {
    if (!yarnRaw) return "";
    let s = yarnRaw.toString().toUpperCase().trim();
    const client = (clientRaw || "").toString().toUpperCase().trim();

    // Extraer porcentajes de participación (ej: 50/30/20%, 50/30/20, 50/30%, 50/30)
    let percentageMatch = s.match(/(\d+[\s\/]\d+(?:[\s\/]\d+)?)\s*%?\s*$/);
    let percentages = '';
    if (percentageMatch) {
        percentages = percentageMatch[1].replace(/\s+/g, '/');
        // Asegurar que los porcentajes estén formateados correctamente (X/Y% o X/Y/Z%)
        if (!percentages.includes('%')) {
            percentages += '%';
        }
        // Remover los porcentajes del string principal
        s = s.replace(/(\d+[\s\/]\d+(?:[\s\/]\d+)?)\s*%?\s*$/, '').trim();
    }

    // REGLA 1: Cambiar "PES PREPREVE" a "PES REPREVE"
    s = s.replace(/PES\s+PREPREVE/gi, 'PES REPREVE');

    // REGLA 1B: Traducir "VI" a "VISCOSA" para que se reconozca correctamente como mezcla
    s = s.replace(/\bVI\b/gi, 'VISCOSA');

    // REGLA 2: Eliminar los términos "HTR" y "HEATHER" completamente del hilado
    // Eliminar HTR o HEATHER al final
    s = s.replace(/\s+(HTR|HEATHER)\s*$/i, '').trim();
    // Eliminar HTR o HEATHER como palabra completa en cualquier posición
    s = s.replace(/\b(?:HTR|HEATHER)\b/gi, '').trim();
    // Limpiar espacios múltiples resultantes
    s = s.replace(/\s+/g, ' ').trim();

    // REGLA 3: Si contiene LYOCELL (o TENCEL/TENCELL) y WOOL, cambiar LYOCELL a LYOCELL A100
    if (/\b(LYOCELL|TENCEL|TENCELL)\b/i.test(s) && /\bWOOL\b/i.test(s)) {
        s = s.replace(/\bLYOCELL\b/gi, 'LYOCELL A100');
        s = s.replace(/\bTENCEL\b/gi, 'LYOCELL A100');
        s = s.replace(/\bTENCELL\b/gi, 'LYOCELL A100');
        s = s.replace(/\s+/g, ' ').trim();
    }

    // Normalizar acentos en ORGÁNICO/ORGÁNICA para evitar cortes como "ORG (OCS)ÁNICO"
    s = s.replace(/ORGÁNICO/gi, 'ORGANICO').replace(/ORGÁNICA/gi, 'ORGANICA');

    // REGLA 4: Si contiene TANGUIS y BCI, reemplazar TANGUIS -> UPLAND y quitar NC
    if (/\bTANGUIS\b/i.test(s) && /\bBCI\b/i.test(s)) {
        s = s.replace(/\bTANGUIS\b/gi, 'UPLAND');
        s = s.replace(/\bNC\b/gi, '').replace(/\s+/g, ' ').trim();
    }

    const orgRegex = /\b(ORGANICO|ORGANIC|ORG\.?)/gi;
    if (orgRegex.test(s)) {
        const cert = (client === "LLL") ? "(OCS)" : "(GOTS)";
        s = s.replace(/\(OCS\)/g, "").replace(/\(GOTS\)/g, "").replace(/\bOCS\b/g, "").replace(/\bGOTS\b/g, "");
        s = s.replace(orgRegex, `$1 ${cert}`);
        s = s.replace(/\s+/g, " ").trim();
    }

    // Agregar los porcentajes al final entre paréntesis si existen
    if (percentages) {
        s += ` (${percentages})`;
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

// Función para limpiar el nombre del material/grupo (aplica criterio LYOCELL A100 cuando hay WOOL)
function cleanMaterialTitle(title) {
    if (!title) return title;
    let s = title.toString().toUpperCase();

    // Si contiene LYOCELL (o TENCEL/TENCELL) y WOOL, cambiar LYOCELL a LYOCELL A100
    if (/\b(LYOCELL|TENCEL|TENCELL)\b/i.test(s) && /\bWOOL\b/i.test(s)) {
        s = s.replace(/\bLYOCELL\b/gi, 'LYOCELL A100');
        s = s.replace(/\bTENCEL\b/gi, 'LYOCELL A100');
        s = s.replace(/\bTENCELL\b/gi, 'LYOCELL A100');
    }

    // TANGUIS + BCI => UPLAND BCI (display)
    if (/\bTANGUIS\b/i.test(s) && /\bBCI\b/i.test(s)) {
        s = s.replace(/\bTANGUIS\b/gi, 'UPLAND');
        s = s.replace(/\bNC\b/gi, '').replace(/\s+/g, ' ').trim();
    }

    return s;
}

function extractCottonName(yarn) {
    if (!yarn) return 'ALGODON';
    const upper = yarn.toString().toUpperCase();
    if (upper.includes('PIMA') && upper.includes('ORGANICO') && upper.includes('GOTS')) return 'ALGODÓN PIMA ORGANICO - GOTS (QQ)';
    if (upper.includes('PIMA') && upper.includes('ORGANICO') && upper.includes('OCS')) return 'ALGODÓN PIMA ORGANICO - OCS (QQ)';
    if (upper.includes('PIMA') && upper.includes('ORGANICO')) return 'ALGODÓN PIMA ORGANICO (QQ)';
    if (upper.includes('COP') && upper.includes('PIMA')) return 'COP PIMA';
    if (upper.includes('PIMA')) return 'PIMA';
    if (upper.includes('COP') && !upper.includes('PIMA') && upper.includes('BCI')) return 'COP UPLAND BCI';
    if (!upper.includes('PIMA') && upper.includes('BCI')) return 'ALGODÓN UPLAND BCI (QQ)';
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
    const fiberKeywords = ['TENCEL', 'LYOCELL', 'VISCOSE', 'PIMA', 'ALGODON', 'COTTON', 'POLYESTER', 'PES', 'ELASTANO', 'NYLON', 'MODAL', 'WOOL', 'ACRYLIC'];
    const matches = [];
    let m;
    const regex = new RegExp('\\b(' + fiberKeywords.join('|') + ')\\b', 'ig');
    while ((m = regex.exec(s)) !== null) matches.push({ idx: m.index, key: m[1] });
    if (expectedCount === 2 && matches.length) {
        const splitAt = matches[matches.length - 1].idx;
        const left = s.slice(0, splitAt).trim();
        const right = s.slice(splitAt).trim();
        if (left && right) return [left, right];
    }
    if (matches.length >= expectedCount) {
        const starts = matches.slice(0, expectedCount).map(x => x.idx);
        starts.push(s.length);
        const parts = [];
        let last = 0;
        for (let i = 0; i < starts.length; i++) {
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
    for (let k = 0; k < expectedCount - 1; k++) {
        const take = Math.max(1, avg);
        out.push(words.slice(i, i + take).join(' '));
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

function generateCellsHTML(values, isHeader = false, customClass = '', includeTotal = false) {
    if (!Array.isArray(activeIndices)) return '';
    let html = activeIndices.map(idx => {
        if (isHeader) return `<th class="text-right px-2 py-1 w-14 ${customClass}">${MONTH_NAMES[idx]}</th>`;
        const cls = customClass || formatCellClass(values ? values[idx] : 0);
        const val = values && typeof values[idx] !== 'undefined' ? values[idx] : 0;
        return `<td class="text-right px-2 border-l border-gray-100 ${cls}">${formatNumber(val)}</td>`;
    }).join('');

    if (includeTotal) {
        if (isHeader) {
            html += `<th class="text-right px-2 py-1 w-20">TOTAL</th>`;
        } else {
            const total = (Array.isArray(values) && values.length > 0) ? activeIndices.reduce((s, idx) => s + (parseFloat(values[idx] || 0) || 0), 0) : 0;
            const cls = formatCellClass(total);
            html += `<td class="text-right px-2 border-l border-gray-100 ${cls}">${formatNumber(total)}</td>`;
        }
    }
    return html;
}

function getCrudoGroupKey(yarnName, clientName = "") {
    if (!yarnName) return "";
    const s = yarnName.toUpperCase().trim();
    if (s.includes('USTCP')) return '__GROUP_ALGODON_USTCP__';
    if (s.includes('BCI')) return '__GROUP_ALGODON_BCI__';
    if (s.includes('PIMA')) {
        if (s.includes('GOTS')) return '__GROUP_ALGODON_PIMA_ORGANICO_GOTS__';
        if (s.includes('OCS')) return '__GROUP_ALGODON_PIMA_ORGANICO_OCS__';
        return '__GROUP_ALGODON_PIMA__';
    }
    if (s.includes('TANGUIS')) {
        if (s.includes('GOTS')) return '__GROUP_ALGODON_TANGUIS_ORGANICO_GOTS__';
        if (s.includes('OCS')) return '__GROUP_ALGODON_TANGUIS_ORGANICO_OCS__';
        return '__GROUP_ALGODON_TANGUIS__';
    }
    if (s.includes('ORGANICO') || s.includes('ORG')) {
        if (s.includes('GOTS')) return '__GROUP_ALGODON_ORGANICO_GOTS__';
        if (s.includes('OCS')) return '__GROUP_ALGODON_ORGANICO_OCS__';
    }
    if (s.includes('UPLAND') || s.includes('FLAME') || s.includes('ELEGANT') || s.includes('COTTON') || (!s.includes('TANGUIS') && s.includes('COP')) || s.includes('ALGODON') && !s.includes('TANGUIS')) {
        return '__GROUP_ALGODON_UPLAND__';
    }
    return '__OTROS_CRUDOS__';
}

function getCrudoGroupTitle(yarnName, clientName = "") {
    if (!yarnName) return "";
    const s = yarnName.toUpperCase().trim();
    if (s.includes('USTCP')) return 'ALGODON USTCP';
    if (s.includes('BCI')) return 'ALGODON BCI';
    if (s.includes('PIMA')) {
        if (s.includes('GOTS')) return 'ALGODON PIMA ORGANICO (GOTS)';
        if (s.includes('OCS')) return 'ALGODON PIMA ORGANICO (OCS)';
        return 'ALGODON PIMA';
    }
    if (s.includes('TANGUIS')) {
        if (s.includes('GOTS')) return 'ALGODON TANGUIS ORGANICO (GOTS)';
        if (s.includes('OCS')) return 'ALGODON TANGUIS ORGANICO (OCS)';
        return 'ALGODON TANGUIS';
    }
    if (s.includes('ORGANICO') || s.includes('ORG')) {
        if (s.includes('GOTS')) return 'ALGODON ORGANICO (GOTS)';
        if (s.includes('OCS')) return 'ALGODON ORGANICO (OCS)';
    }
    if (s.includes('UPLAND') || s.includes('FLAME') || s.includes('ELEGANT') || s.includes('COTTON') || (!s.includes('TANGUIS') && s.includes('COP')) || s.includes('ALGODON') && !s.includes('TANGUIS')) {
        return 'ALGODON UPLAND';
    }
    return 'OTROS (CRUDOS)';
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
