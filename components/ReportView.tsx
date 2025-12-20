import React, { useState, useEffect } from 'react';
import { Report, Theme } from '../types';
import { Download, Share2, X, FileCode, ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { motion } from 'framer-motion';

interface ReportViewProps {
  report: Report | null;
  onClose: () => void;
  theme?: Theme;
}

export const ReportView: React.FC<ReportViewProps> = ({ report, onClose, theme }) => {
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [parsedReport, setParsedReport] = useState<any>(null);

  useEffect(() => {
    if (report) {
      try {
        let data = JSON.parse(report.content);
        
        // --- Backward Compatibility Migration ---
        // If report uses old schema (tableData/tableHeaders), convert to new 'tables' array
        if (!data.tables && data.tableData && data.tableHeaders) {
            data.tables = [{
                title: "Observation Table",
                headers: data.tableHeaders,
                rows: data.tableData
            }];
            // Cleanup old fields to avoid confusion
            delete data.tableData;
            delete data.tableHeaders;
        }
        
        setParsedReport(data);
        const html = generateInteractiveHTML(data, report.experimentCode);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setIframeSrc(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Failed to parse report JSON", e);
      }
    }
  }, [report]);

  if (!report) return null;

  const handleDownloadPDF = () => {
    if (!parsedReport) return;
    const doc = new jsPDF();
    let y = 10;
    
    const addText = (text: string, size = 11, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const splitText = doc.splitTextToSize(text, 180);
      if (y + splitText.length * 5 > 280) {
        doc.addPage();
        y = 10;
      }
      doc.text(splitText, 10, y);
      y += splitText.length * 5 + 2;
    };

    addText(`Lab Report: ${report.experimentCode}`, 18, true);
    y += 5;
    addText(parsedReport.title, 14, true);
    y += 5;

    // Check for diagram and add it to PDF
    if (parsedReport.diagram) {
        try {
            doc.addImage(parsedReport.diagram, 'JPEG', 10, y, 100, 75); // Aspect ratio 4:3 roughly
            y += 80;
            addText("Figure 1: Experiment Diagram from Manual", 9);
            y += 5;
        } catch (e) {
            console.error("Failed to add image to PDF", e);
        }
    }

    addText("Objectives:", 12, true);
    parsedReport.objectives.forEach((obj: string) => addText(`- ${obj}`));
    y += 5;

    addText("Apparatus:", 12, true);
    parsedReport.apparatus.forEach((app: string) => addText(`- ${app}`));
    y += 5;

    addText("Theory:", 12, true);
    addText(parsedReport.theory);
    y += 5;

    addText("Procedure:", 12, true);
    parsedReport.procedure.forEach((step: string, i: number) => addText(`${i+1}. ${step}`));
    y += 5;

    // Handle Multiple Tables
    parsedReport.tables.forEach((table: any, idx: number) => {
        const title = table.title || `Table ${idx + 1}`;
        addText(title, 12, true);
        
        const headers = table.headers.join(" | ");
        addText(headers, 10, true);
        
        table.rows.forEach((row: any[]) => {
            const rowText = row.map((cell: any) => (cell === null || cell === undefined) ? '' : cell).join(" | ");
            addText(rowText);
        });
        y += 5;
    });

    addText("Analysis:", 12, true);
    if (parsedReport.analysisTemplate) {
        // Strip placeholders for PDF
        addText(parsedReport.analysisTemplate.replace(/\{\{.*?\}\}/g, '[calculated]'));
    } else {
        addText("No automated analysis provided.");
    }
    y += 5;

    if (parsedReport.questions && parsedReport.questions.length > 0) {
      addText("Questions & Answers:", 12, true);
      parsedReport.questions.forEach((q: any, i: number) => {
        addText(`Q${i+1}: ${q.question}`, 11, true);
        addText(`A: ${q.answer}`);
        y += 2;
      });
      y += 5;
    }

    addText("Discussion:", 12, true);
    addText(parsedReport.discussion);
    y += 5;

    addText("Conclusion:", 12, true);
    addText(parsedReport.conclusion);

    doc.save(`${report.experimentCode}_Report.pdf`);
  };

  const handleDownloadHTML = () => {
    if (!parsedReport) return;
    const html = generateInteractiveHTML(parsedReport, report.experimentCode);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.experimentCode}_Interactive_Report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-6xl h-[90vh] bg-slate-900 rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl"
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-blue-600`}>
              <FileCode size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">{report.experimentCode} Interactive Report</h3>
              <p className="text-xs text-slate-400">Live Preview • Editable Data • Simulations</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* PDF Button */}
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors">
              <Download size={16} /> PDF
            </button>

            {/* HTML Button */}
            <button onClick={handleDownloadHTML} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition-colors">
              <Download size={16} /> HTML
            </button>

            <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors text-slate-400" title="Close Preview">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 bg-black relative">
          {iframeSrc ? (
            <iframe 
              src={iframeSrc} 
              className="w-full h-full border-none" 
              title="Report Preview"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">Loading Preview...</div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// This function generates the standalone HTML file string
function generateInteractiveHTML(data: any, code: string) {
  // CRITICAL: Escape script closing tags AND Unicode line separators to prevent JS SyntaxErrors
  const jsonString = JSON.stringify(data)
    .replace(/<\/script>/g, '<\\/script>')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  
  // Default to a simple speed control if AI forgets to generate controls
  const controls = data.controls && data.controls.length > 0 
    ? data.controls 
    : [{ id: 'speed', label: 'Sim Speed', min: 0, max: 5, val: 1, unit: 'x' }];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${code} - Galvaniy Labs Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; overflow-x: hidden; }
        .glass {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }
        
        /* STRICT TABLE STYLING */
        .data-table-container {
           border: 1px solid rgba(255,255,255,0.2);
           border-radius: 8px;
           overflow: hidden;
        }
        table {
          width: 100%;
          border-collapse: collapse; /* Ensure borders touch */
          background: rgba(0,0,0,0.4);
        }
        th {
          background-color: rgba(30, 41, 59, 0.9);
          color: #93c5fd;
          font-weight: 700;
          text-align: left;
          padding: 12px 16px;
          border-bottom: 2px solid rgba(255,255,255,0.2);
          border-right: 1px solid rgba(255,255,255,0.1);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        th:last-child { border-right: none; }
        td {
          padding: 0; /* Remove padding to let input fill cell */
          border-bottom: 1px solid rgba(255,255,255,0.1);
          border-right: 1px solid rgba(255,255,255,0.1);
          color: #e2e8f0;
          vertical-align: middle;
          position: relative;
        }
        td:last-child { border-right: none; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) { background-color: rgba(255,255,255,0.03); }
        tr:hover { background-color: rgba(255,255,255,0.08); }
        
        /* Input Styling */
        td input {
            background: transparent;
            color: white;
            width: 100%;
            height: 100%;
            border: none;
            padding: 10px 16px;
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            font-size: 0.9rem;
            outline: none;
        }
        td input:focus {
            background: rgba(59, 130, 246, 0.2); /* Blue highlight on focus */
            box-shadow: inset 0 0 0 2px #3b82f6;
        }
        
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">

    <div class="max-w-5xl mx-auto space-y-8">
        <!-- (a) CODE & TITLE, (b) DATE, (c) PARTNERS -->
        <header class="glass rounded-2xl p-8 text-center relative overflow-hidden">
            <div class="absolute inset-0 bg-blue-500/10 blur-3xl"></div>
            <p class="text-xs text-slate-500 uppercase tracking-wider relative z-10 mb-1">(a) CODE & TITLE</p>
            <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 relative z-10">${code}: ${data.title}</h1>
            
            <div class="mt-6 space-y-2 text-sm relative z-10">
                <p class="text-slate-400">
                    <span class="text-xs text-slate-500 uppercase tracking-wider">(b) Date: </span>
                    <span class="text-white font-mono">${data.date || '[Date: DD/MM/YYYY]'}</span>
                </p>
                <p class="text-slate-400">
                    <span class="text-xs text-slate-500 uppercase tracking-wider">(c) Partners: </span>
                    <span class="text-white">${data.partners || '[Partners: Student Names]'}</span>
                </p>
            </div>
        </header>

        <!-- Dynamic Diagram Section (if available from manual) -->
        ${data.diagram ? `
        <section class="glass rounded-2xl p-6 border-l-4 border-emerald-500">
             <h2 class="text-xl font-semibold text-emerald-400 mb-4">Experiment Diagram</h2>
             <div class="w-full bg-white/5 rounded-xl overflow-hidden flex justify-center p-4">
                 <img src="${data.diagram}" alt="Experiment Diagram from Manual" class="max-h-[400px] object-contain rounded-lg border border-white/10" />
             </div>
             <p class="text-xs text-center text-slate-500 mt-2">Figure derived from the uploaded lab manual.</p>
        </section>
        ` : ''}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- (d) OBJECTIVES -->
            <section class="glass rounded-2xl p-6">
                <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(d) Objectives</p>
                <h2 class="text-xl font-semibold text-blue-400 border-b border-white/10 pb-2 mb-4">Objectives</h2>
                <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
                    ${data.objectives.map((o: string) => `<li>${o}</li>`).join('')}
                </ul>
            </section>

            <!-- (f) APPARATUS -->
            <section class="glass rounded-2xl p-6">
                <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(f) List of Apparatus</p>
                <h2 class="text-xl font-semibold text-purple-400 border-b border-white/10 pb-2 mb-4">Apparatus</h2>
                <div class="flex flex-wrap gap-2">
                    ${data.apparatus.map((a: string) => `<span class="bg-white/5 px-3 py-1 rounded-full text-xs text-slate-300">${a}</span>`).join('')}
                </div>
            </section>
        </div>

        <!-- (e) THEORY -->
        <section class="glass rounded-2xl p-6">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(e) Theory / Introduction</p>
            <h2 class="text-xl font-semibold text-blue-400 border-b border-white/10 pb-2 mb-4">Theory</h2>
            <p class="text-slate-300 text-sm leading-relaxed">${data.theory}</p>
        </section>

        <!-- (g) METHOD / PROCEDURE -->
        <section class="glass rounded-2xl p-6">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(g) Method / Procedure</p>
            <h2 class="text-xl font-semibold text-purple-400 border-b border-white/10 pb-2 mb-4">Procedure</h2>
            <ol class="list-decimal list-inside text-slate-300 space-y-2 text-sm">
                ${data.procedure.map((p: string) => `<li>${p}</li>`).join('')}
            </ol>
        </section>

        <!-- INTERACTIVE SIMULATION (Experimental Enhancement) -->
        <section class="glass rounded-2xl p-6 overflow-hidden border-l-4 border-amber-500">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-semibold text-emerald-400">Virtual Apparatus <span class="text-xs text-amber-400 font-bold uppercase tracking-wider">(Experimental)</span></h2>
                    <p class="text-xs text-slate-500 mt-1">Interactive simulation - an enhancement to visualize the experimental setup</p>
                </div>
                <button onclick="simulation.toggle()" id="simBtn" class="bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-lg text-sm font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition">Start Simulation</button>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 relative bg-black/40 rounded-xl overflow-hidden border border-white/5 h-[300px] flex items-center justify-center">
                    <canvas id="simCanvas" width="800" height="300"></canvas>
                    <div id="simOverlay" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p class="text-white/20 font-bold text-4xl uppercase tracking-widest">Simulation Paused</p>
                    </div>
                </div>
                <!-- Controls -->
                <div class="space-y-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Controls</h3>
                    <div id="simControls" class="space-y-4">
                        ${controls.map((ctrl: any) => `
                            <div>
                                <div class="flex justify-between text-xs text-slate-300 mb-1">
                                    <label for="ctrl-${ctrl.id}">${ctrl.label}</label>
                                    <span id="val-${ctrl.id}">${ctrl.val} ${ctrl.unit}</span>
                                </div>
                                <input type="range" id="ctrl-${ctrl.id}" min="${ctrl.min}" max="${ctrl.max}" value="${ctrl.val}" oninput="updateSimParam('${ctrl.id}', this.value, '${ctrl.unit}')" class="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer">
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>

        <!-- (h) PRECAUTIONS -->
        ${(data.precautions && data.precautions.length > 0) ? `
        <section class="glass rounded-2xl p-6">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(h) Precautions</p>
            <h2 class="text-xl font-semibold text-yellow-400 border-b border-white/10 pb-2 mb-4">Precautions</h2>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
                ${data.precautions.map((p: string) => `<li>${p}</li>`).join('')}
            </ul>
        </section>` : ''}

        <!-- (i) RESULTS -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section class="glass rounded-2xl p-6">
                <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(i) Results</p>
                <h2 class="text-xl font-semibold text-orange-400 border-b border-white/10 pb-2 mb-4">Results</h2>
                <div id="tablesContainer" class="space-y-8">
                    <!-- Tables will be rendered here via JS -->
                </div>
            </section>
            
            ${data.graphConfig ? `
            <section class="glass rounded-2xl p-6">
                <h2 class="text-xl font-semibold text-pink-400 mb-4">Live Analysis Graph</h2>
                <div class="relative h-[300px] w-full"><canvas id="dataChart"></canvas></div>
            </section>` : ''}
        </div>

        <!-- (j) DATA ANALYSIS -->
        <section class="glass rounded-2xl p-6 border-l-4 border-cyan-500">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(j) Data Analysis</p>
            <h2 class="text-xl font-semibold text-cyan-400 border-b border-white/10 pb-2 mb-4">Data Analysis</h2>
            <div id="analysisContent" class="prose prose-invert max-w-none text-slate-300 text-sm font-mono p-4 bg-black/20 rounded-xl">
                ${data.analysisTemplate ? 'Loading analysis...' : 'No automated analysis available.'}
            </div>
        </section>

        <!-- (k) DISCUSSION -->
        ${data.discussion ? `
        <section class="glass rounded-2xl p-6">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(k) Discussion</p>
            <h2 class="text-xl font-semibold text-indigo-400 border-b border-white/10 pb-2 mb-4">Discussion</h2>
            <p class="text-slate-300 text-sm leading-relaxed mb-6">${data.discussion}</p>
            
            ${(data.sourcesOfError && data.sourcesOfError.length > 0) ? `
            <div class="mt-6 pt-6 border-t border-white/10">
                <h3 class="text-lg font-semibold text-red-300 mb-3">Sources of Error</h3>
                <ol class="list-decimal list-inside text-slate-300 space-y-2 text-sm">
                    ${data.sourcesOfError.map((err: string) => `<li>${err}</li>`).join('')}
                </ol>
            </div>` : ''}
        </section>` : ''}

        ${data.questions && data.questions.length > 0 ? `
        <section class="glass rounded-2xl p-6 border-l-4 border-yellow-500">
            <h2 class="text-xl font-semibold text-yellow-400 mb-4">Questions & Answers</h2>
            <div class="space-y-4">
                ${data.questions.map((q: any, i: number) => `
                    <div class="bg-white/5 p-4 rounded-xl">
                        <p class="font-bold text-slate-200 text-sm mb-1">Q${i+1}: ${q.question}</p>
                        <p class="text-slate-400 text-sm pl-4 border-l border-white/20">${q.answer}</p>
                    </div>
                `).join('')}
            </div>
        </section>` : ''}

        <!-- (l) CONCLUSION -->
        <section class="glass rounded-2xl p-6">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(l) Conclusion</p>
            <h2 class="text-xl font-semibold text-slate-200 border-b border-white/10 pb-2 mb-4">Conclusion</h2>
            <p class="text-slate-400 text-sm leading-relaxed">${data.conclusion}</p>
        </section>

        <!-- (m) REFERENCES -->
        ${(data.references && data.references.length > 0) ? `
        <section class="glass rounded-2xl p-6">
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">(m) References</p>
            <h2 class="text-xl font-semibold text-slate-400 border-b border-white/10 pb-2 mb-4">References</h2>
            <ol class="list-decimal list-inside text-slate-300 space-y-1 text-sm">
                ${data.references.map((ref: string) => `<li>${ref}</li>`).join('')}
            </ol>
        </section>` : ''}
    </div>

    <script>
        const reportData = ${jsonString};
        
        let chartInstance = null;
        const initialParams = {};
        ${JSON.stringify(controls)}.forEach(c => initialParams[c.id] = c.val);
        
        const tablesContainer = document.getElementById('tablesContainer');
        const analysisDiv = document.getElementById('analysisContent');
        const simCanvas = document.getElementById('simCanvas');
        const simCtx = simCanvas.getContext('2d');
        
        function init() {
            renderTables();
            if (reportData.graphConfig) initChart();
            updateAnalysis();
            simulation.init();
        }

        function renderTables() {
            tablesContainer.innerHTML = '';
            
            reportData.tables.forEach((table, tIdx) => {
                // Create a dedicated container for each table to ensure separation
                const tableBlock = document.createElement('div');
                tableBlock.className = "mb-8 last:mb-0";

                // Table Title
                if (reportData.tables.length > 0 || table.title) {
                    const titleText = table.title || \`Table \${tIdx + 1}\`;
                    const h3 = document.createElement('h3');
                    h3.className = "text-sm font-bold text-slate-300 mt-2 mb-3 uppercase tracking-wide flex items-center gap-2";
                    h3.innerHTML = \`<span class="w-2 h-2 rounded-full bg-orange-500"></span> \${titleText}\`;
                    tableBlock.appendChild(h3);
                }
                
                // Table Wrapper (for styling and scroll)
                const wrapper = document.createElement('div');
                wrapper.className = "data-table-container overflow-x-auto";
                
                const tbl = document.createElement('table');
                
                // Headers
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                table.headers.forEach(h => {
                    const th = document.createElement('th');
                    th.innerText = h;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                tbl.appendChild(thead);

                // Body
                const tbody = document.createElement('tbody');
                table.rows.forEach((row, rIdx) => {
                    const tr = document.createElement('tr');
                    row.forEach((cell, cIdx) => {
                        const td = document.createElement('td');
                        const input = document.createElement('input');
                        input.type = "text"; 
                        input.value = (cell === null || cell === undefined) ? '' : cell;
                        input.onchange = (e) => updateData(tIdx, rIdx, cIdx, e.target.value);
                        td.appendChild(input);
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
                tbl.appendChild(tbody);
                
                wrapper.appendChild(tbl);
                tableBlock.appendChild(wrapper);
                tablesContainer.appendChild(tableBlock);
            });
        }

        function updateData(tableIdx, row, col, value) {
            // Try parse number, fallback to string
            const num = parseFloat(value);
            const finalVal = isNaN(num) ? value : num;
            
            reportData.tables[tableIdx].rows[row][col] = finalVal;
            
            // If this is the table used for graphing, update chart
            if (reportData.graphConfig && (reportData.graphConfig.tableIndex || 0) === tableIdx) {
                updateChart();
            }
            updateAnalysis();
        }

        function initChart() {
            const ctx = document.getElementById('dataChart').getContext('2d');
            chartInstance = new Chart(ctx, {
                type: 'scatter',
                data: { datasets: [{ label: reportData.graphConfig.title, data: getChartData(), backgroundColor: '#f472b6', showLine: true }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' } }, y: { grid: { color: 'rgba(255,255,255,0.1)' } } } }
            });
        }

        function getChartData() {
            const tIdx = reportData.graphConfig.tableIndex || 0;
            if (!reportData.tables[tIdx]) return [];
            
            const x = reportData.graphConfig.xColumnIndex;
            const y = reportData.graphConfig.yColumnIndex;
            
            return reportData.tables[tIdx].rows.map(r => {
                const vx = parseFloat(r[x]);
                const vy = parseFloat(r[y]);
                return { x: isNaN(vx) ? 0 : vx, y: isNaN(vy) ? 0 : vy };
            });
        }

        function updateChart() {
            if(chartInstance) { chartInstance.data.datasets[0].data = getChartData(); chartInstance.update(); }
        }

        function updateAnalysis() {
            if (!reportData.calculationScript || !reportData.analysisTemplate) return;
            try {
                // Pass all tables to the calculation script
                const calcFunc = new Function('tables', reportData.calculationScript);
                const results = calcFunc(reportData.tables);
                
                let template = reportData.analysisTemplate;
                for (const [key, value] of Object.entries(results)) {
                    const regex = new RegExp(\`{{\${key}}}\`, 'g');
                    const displayVal = typeof value === 'number' ? value.toFixed(4) : value;
                    template = template.replace(regex, \`<span class="text-cyan-300 font-bold">\${displayVal}</span>\`);
                }
                analysisDiv.innerHTML = template.replace(/\\n/g, '<br>');
            } catch (e) { 
                console.error("Analysis Error", e);
                analysisDiv.innerHTML = \`<span class="text-red-400">Analysis Error: \${e.message}</span><br><span class="text-xs text-slate-500">Check console for details or edit data.</span>\`; 
            }
        }

        function updateSimParam(id, val, unit) {
            document.getElementById('val-'+id).innerText = val + ' ' + unit;
            simulation.params[id] = parseFloat(val);
        }

        // DYNAMIC SIMULATION ENGINE
        let drawFunc = null;
        try {
            if (reportData.simulationScript) {
                drawFunc = new Function('ctx', 'width', 'height', 'frame', 'params', reportData.simulationScript);
            }
        } catch (e) { console.error("Invalid Simulation Script", e); }

        const simulation = {
            active: false, frame: 0, params: initialParams,
            toggle: function() { this.active = !this.active; document.getElementById('simOverlay').style.opacity = this.active ? 0 : 1; if(this.active) this.loop(); },
            init: function() { this.draw(); },
            loop: function() { if(!this.active) return; this.frame++; this.draw(); requestAnimationFrame(() => this.loop()); },
            draw: function() {
                const w = 800; const h = 300;
                simCtx.clearRect(0,0,w,h);
                simCtx.fillStyle = '#1e293b'; simCtx.fillRect(0,0,w,h);
                
                if (drawFunc) {
                    try {
                        drawFunc(simCtx, w, h, this.frame, this.params);
                    } catch (e) {
                        simCtx.fillStyle = 'red';
                        simCtx.fillText("Sim Error: " + e.message, 10, 20);
                    }
                } else {
                    simCtx.fillStyle = '#64748b';
                    simCtx.font = "20px Inter";
                    simCtx.fillText("No visual simulation provided for this experiment.", 200, 150);
                }
            }
        };

        // Delay init slightly to ensure DOM is ready in all environments
        setTimeout(init, 100);
    </script>
</body>
</html>`;
}