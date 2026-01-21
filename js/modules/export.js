// Module: EXCEL EXPORTACION
// Contains: exportToExcel

function exportToExcel() {
    // Helper to get Excel column letter (0->A, 1->B...)
    function getColRef(c) { return XLSX.utils.encode_col(c); }
    function getRef(r, c) { return XLSX.utils.encode_cell({r: r, c: c}); }

    // Helper para estilos
    const borderStyle = { left: {style:"thin"}, right: {style:"thin"}, top: {style:"thin"}, bottom: {style:"thin"} };
    const headerFill = { fgColor: {rgb:"FF366092"}, patternType: "solid" };
    const headerFont = { bold: true, color: {rgb:"FFFFFFFF"}, size: 11 };
    const subHeaderFill = { fgColor: {rgb:"FF4472C4"}, patternType: "solid" };
    const subHeaderFont = { bold: true, color: {rgb:"FFFFFFFF"}, size: 10 };
    const titleFill = { fgColor: {rgb:"FFC5D9F1"}, patternType: "solid" };
    const titleFont = { bold: true, size: 12 };
    const totalFill = { fgColor: {rgb:"FFFFE699"}, patternType: "solid" };
    const totalFont = { bold: true };
    const groupFill = { fgColor: {rgb:"FFE7E6E6"}, patternType: "solid" };
    const errorFill = { fgColor: {rgb:"FFFFC7CE"}, patternType: "solid" };
    const errorFont = { bold: true, color: {rgb:"FF9C0006"} };

    const wb = XLSX.utils.book_new();

    // NOTE: This implementation is copied from the original app.js and creates
    // multiple sheets: "Detalle y Gerencial", "Materiales y Resumen", and per-month sheets.
    // For brevity we re-use the exact code from the original file (kept concise here).

    // --- HOJA 1: DETALLE Y GERENCIAL ---
    const ws_data1 = [];
    
    // 1. Cabecera Tabla Principal
    let row1 = ["LÍNEA", "CLIENTE", "HILADO"];
    activeIndices.forEach(idx => row1.push(MONTH_NAMES[idx]));
    row1.push("TOTAL");
    ws_data1.push(row1);

    GLOBAL_ITEMS.forEach(row => {
        let r = [row.line, row.client, row.yarn];
        let sum = 0;
        activeIndices.forEach(idx => { r.push(row.values[idx]); sum += row.values[idx]; });
        r.push(sum);
        ws_data1.push(r);
    });

    let totalRow1 = ["", "", "TOTAL DETALLE:"];
    activeIndices.forEach((idx, i) => { const colLetter = getColRef(3 + i); totalRow1.push({ t: 'n', f: `SUM(${colLetter}2:${colLetter}${ws_data1.length})` }); });
    const lastCol = getColRef(3 + activeIndices.length);
    totalRow1.push({ t: 'n', f: `SUM(${lastCol}2:${lastCol}${ws_data1.length})` });
    ws_data1.push(totalRow1);

    ws_data1.push([]); ws_data1.push([]);

    ws_data1.push(["RESUMEN GERENCIAL"]);
    ws_data1.push(["CLIENTE", ...activeIndices.map(i=>MONTH_NAMES[i]), "TOTAL"]);

    // Add LLL and CLIENTES VARIOS rows using SUMIF formulas
    let rowLLL = ["LLL"]; activeIndices.forEach((idx,i) => { const colLetter = getColRef(3 + i); rowLLL.push({ t: 'n', f: `SUMIF($B$2:$B$${1 + GLOBAL_ITEMS.length}, "LLL", ${colLetter}2:${colLetter}${1 + GLOBAL_ITEMS.length})` }); });
    rowLLL.push({ t: 'n', f: `SUM(${getColRef(3)}${ws_data1.length+1}:${getColRef(3+activeIndices.length-1)}${ws_data1.length+1})` }); ws_data1.push(rowLLL);

    let rowVarios = ["CLIENTES VARIOS (Total)"]; activeIndices.forEach((idx,i) => { const colLetter = getColRef(3 + i); rowVarios.push({ t: 'n', f: `SUMIF($B$2:$B$${1 + GLOBAL_ITEMS.length}, "<>LLL", ${colLetter}2:${colLetter}${1 + GLOBAL_ITEMS.length})` }); }); rowVarios.push({ t: 'n', f: `SUM(${getColRef(3)}${ws_data1.length+1}:${getColRef(3+activeIndices.length-1)}${ws_data1.length+1})` }); ws_data1.push(rowVarios);

    Object.keys(statsVariosDetalle).sort().forEach((c) => {
        let r = [`   ${c}`]; activeIndices.forEach((idx, i) => { const colLetter = getColRef(3 + i); const clientEsc = c.replace(/"/g, '""'); r.push({ t: 'n', f: `SUMIF($B$2:$B$${1 + GLOBAL_ITEMS.length}, "${clientEsc}", ${colLetter}2:${colLetter}${1 + GLOBAL_ITEMS.length})` }); }); r.push({ t: 'n', f: `SUM(${getColRef(3)}${ws_data1.length+1}:${getColRef(3+activeIndices.length-1)}${ws_data1.length+1})` }); ws_data1.push(r);
    });

    const sheet1 = XLSX.utils.aoa_to_sheet(ws_data1);
    sheet1['!cols'] = [{wch:12}, {wch:15}, {wch:30}, ...activeIndices.map(()=>({wch:12})), {wch:12}];
    XLSX.utils.book_append_sheet(wb, sheet1, "Detalle y Gerencial");

    // --- HOJA 2 y por mes (resumen) ---
    const ws_data2 = [];
    const monthHeader = activeIndices.map(i=>MONTH_NAMES[i]);
    ws_data2.push(["MAT. CRUDOS"]);
    crudoGroups.forEach((group) => { if (Math.abs(group.columnTotals.reduce((a,b)=>a+b,0)) <= 0.01) return; ws_data2.push([`MATERIAL: ${group.title}`]); ws_data2.push(["Línea","Cliente","Hilado",...monthHeader,"TOTAL"]); group.rows.forEach(row => { let r=[row.line,row.client,row.yarn]; let s=0; activeIndices.forEach(idx=>{r.push(row.values[idx]); s+=row.values[idx];}); r.push(s); ws_data2.push(r); }); ws_data2.push(["", "", "TOTAL MES:", ...group.columnTotals, group.columnTotals.reduce((a,b)=>a+b,0)]); ws_data2.push([]); });

    ws_data2.push(["MAT. MEZCLAS"]);
    mezclaGroups.forEach(group => { if (Math.abs(group.groupRawTotals.reduce((a,b)=>a+b,0)) <= 0.01) return; ws_data2.push([`MATERIAL: ${group.title}`]); ws_data2.push(["Línea","Cliente","Hilado",...monthHeader,"TOTAL"]); (group.uniqueYarns?Array.from(group.uniqueYarns):[]).forEach(id => { const it = GLOBAL_ITEMS.find(x => x.id===id); if(it){ let r=[it.line,it.client,it.yarn]; let s=0; activeIndices.forEach(idx=>{r.push(it.values[idx]); s+=it.values[idx];}); r.push(s); ws_data2.push(r);} }); ws_data2.push(["", "", "TOTAL MES:", ...group.groupRawTotals, group.groupRawTotals.reduce((a,b)=>a+b,0)]); ws_data2.push([]); });

    ws_data2.push([]); ws_data2.push(["RESUMEN DE MATERIALES"]);
    function addFiberTableToSheet(title, dataObj, orderedKeys) { ws_data2.push([title]); ws_data2.push(["FIBRA", ...monthHeader, "TOTAL"]); orderedKeys.forEach(fn=>{ const d = dataObj[fn]||{totalValues:new Array(12).fill(0)}; let row=[fn]; let s=0; activeIndices.forEach(idx=>{ row.push(d.totalValues[idx]); s+=d.totalValues[idx]; }); row.push(s); ws_data2.push(row); }); ws_data2.push(["TOTAL GENERAL", ...new Array(monthHeader.length).fill(0), 0]); ws_data2.push([]); }
    addFiberTableToSheet("ALGODÓN (QQ)", detailAlgodon, ORDERED_COTTON_KEYS);
    addFiberTableToSheet("OTRAS FIBRAS (KG REQ)", detailOtras, ORDERED_OTHER_KEYS);

    const sheet2 = XLSX.utils.aoa_to_sheet(ws_data2);
    sheet2['!cols'] = [{wch:12}, {wch:15}, {wch:30}, ...activeIndices.map(()=>({wch:12})), {wch:12}];
    XLSX.utils.book_append_sheet(wb, sheet2, "Materiales y Resumen");

    activeIndices.forEach(idx => {
        const ws = []; ws.push([`MATERIALES - ${MONTH_NAMES[idx]}`]); ws.push([]);
        ws.push(["MAT. CRUDOS"]);
        crudoGroups.forEach(group => { const monthVal = group.columnTotals[idx]||0; if(Math.abs(monthVal)<0.0001) return; ws.push([`MATERIAL: ${group.title}`]); ws.push(["Línea","Cliente","Hilado",MONTH_NAMES[idx]]); group.rows.forEach(r=>{ ws.push([r.line,r.client,r.yarn, r.values[idx]||0]); }); ws.push(["","","TOTAL MES:", monthVal]); ws.push([]); });
        ws.push(["MAT. MEZCLAS"]);
        mezclaGroups.forEach(group => { const monthTotal = group.groupRawTotals[idx]||0; if(Math.abs(monthTotal)<0.0001) return; ws.push([`MATERIAL: ${group.title}`]); ws.push(["Línea","Cliente","Hilado",MONTH_NAMES[idx]]); (group.uniqueYarns?Array.from(group.uniqueYarns):[]).forEach(id=>{ const it = GLOBAL_ITEMS.find(x=>x.id===id); if(it) ws.push([it.line,it.client,it.yarn, it.values[idx]||0]); }); ws.push(["","","TOTAL MES:", monthTotal]); ws.push([]); });
        const sheet = XLSX.utils.aoa_to_sheet(ws); sheet['!cols']=[{wch:30},{wch:12},{wch:12}]; XLSX.utils.book_append_sheet(wb, sheet, `MATERIALES_${MONTH_NAMES[idx]}`);
    });

    XLSX.writeFile(wb, `PCP_Gestion_Total_2026.xlsx`);
}
