import React, { useState, useEffect } from 'react';
import { Report, Theme } from '../types';
import { Download, Share2, X, FileCode } from 'lucide-react';
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
        const data = JSON.parse(report.content);
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

    addText("Results (Data Table):", 12, true);
    const headers = parsedReport.tableHeaders.join(" | ");
    addText(headers, 10, true);
    parsedReport.tableData.forEach((row: number[]) => {
      addText(row.join(" | "));
    });
    y += 5;

    addText("Analysis:", 12, true);
    // Strip placeholders for PDF
    addText(parsedReport.analysisTemplate.replace(/\{\{.*?\}\}/g, '[calculated]'));
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
            {/* PDF Button with Tooltip */}
            <div className="group relative">
              <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors">
                <Download size={16} /> PDF
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-black/90 backdrop-blur text-xs text-center text-white rounded-lg border border-white/10 shadow-xl z-50 pointer-events-none">
                Download static PDF document suitable for printing
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90"></div>
              </div>
            </div>

            {/* HTML Button with Tooltip */}
            <div className="group relative">
              <button onClick={handleDownloadHTML} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition-colors">
                <Download size={16} /> HTML
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-black/90 backdrop-blur text-xs text-center text-white rounded-lg border border-white/10 shadow-xl z-50 pointer-events-none">
                Download interactive report with simulations & live graphs
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90"></div>
              </div>
            </div>

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
  const jsonString = JSON.stringify(data);
  
  // Define controls for each simulation type
  const simConfigs: Record<string, any[]> = {
    pendulum: [
      { id: 'length', label: 'Length (L)', min: 50, max: 280, val: 200, unit: 'cm' },
      { id: 'gravity', label: 'Gravity (g)', min: 1, max: 20, val: 9.8, unit: 'm/s²' }
    ],
    heating: [
      { id: 'heat', label: 'Heat Intensity', min: 0, max: 100, val: 50, unit: '%' },
      { id: 'ambient', label: 'Ambient Temp', min: 0, max: 40, val: 25, unit: '°C' }
    ],
    spring: [
      { id: 'mass', label: 'Mass Load', min: 10, max: 100, val: 50, unit: 'g' },
      { id: 'k', label: 'Spring Constant', min: 1, max: 10, val: 5, unit: 'N/m' }
    ],
    circuit: [
      { id: 'voltage', label: 'Voltage (V)', min: 0, max: 24, val: 12, unit: 'V' },
      { id: 'resistance', label: 'Resistance (R)', min: 10, max: 500, val: 100, unit: 'Ω' }
    ],
    wave: [
      { id: 'frequency', label: 'Frequency', min: 1, max: 20, val: 5, unit: 'Hz' },
      { id: 'amplitude', label: 'Amplitude', min: 10, max: 100, val: 50, unit: 'px' }
    ],
    general: [
      { id: 'speed', label: 'Sim Speed', min: 0, max: 5, val: 1, unit: 'x' }
    ]
  };

  const activeControls = simConfigs[data.simulationType] || simConfigs['general'];

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
        .input-glass {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
        }
        .input-glass:focus { outline: 2px solid #3b82f6; }
        
        /* Slider styling */
        input[type=range] {
            -webkit-appearance: none;
            width: 100%;
            background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: #38bdf8;
            cursor: pointer;
            margin-top: -6px;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
        }
        input[type=range]::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            cursor: pointer;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
        }

        /* Number input styling */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
        }
        input[type=number] {
            -moz-appearance: textfield;
        }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        canvas { max-width: 100%; }

        /* Splash Screen Overlay */
        #splash-screen {
            position: fixed;
            inset: 0;
            background: #0f172a;
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.8s ease-out;
        }
        .atom-spinner {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 4px solid rgba(56, 189, 248, 0.3);
            border-top-color: #38bdf8;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">

    <!-- SPLASH SCREEN -->
    <div id="splash-screen">
        <div class="atom-spinner mb-6"></div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Galvaniy <span class="text-sky-400">Labs</span></h1>
        <p class="text-slate-400 text-sm mt-2 uppercase tracking-widest">Your Smart Lab Companion</p>
    </div>

    <div class="max-w-5xl mx-auto space-y-8 opacity-0 transition-opacity duration-1000 delay-500" id="main-content">
        <!-- Header -->
        <header class="glass rounded-2xl p-8 text-center relative overflow-hidden">
            <div class="absolute inset-0 bg-blue-500/10 blur-3xl"></div>
            <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 relative z-10">${data.title}</h1>
            <p class="text-slate-400 mt-2 relative z-10">Experiment Code: <span class="text-white font-mono">${code}</span></p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Objectives & Theory -->
            <section class="glass rounded-2xl p-6 space-y-4">
                <h2 class="text-xl font-semibold text-blue-400 border-b border-white/10 pb-2">Objectives</h2>
                <ul class="list-disc list-inside text-slate-300 space-y-1">
                    ${data.objectives.map((o: string) => `<li>${o}</li>`).join('')}
                </ul>
                
                <h2 class="text-xl font-semibold text-blue-400 border-b border-white/10 pb-2 pt-4">Theory</h2>
                <p class="text-slate-300 text-sm leading-relaxed">${data.theory}</p>
            </section>

            <!-- Apparatus & Procedure -->
            <section class="glass rounded-2xl p-6 space-y-4">
                <h2 class="text-xl font-semibold text-purple-400 border-b border-white/10 pb-2">Apparatus</h2>
                <div class="flex flex-wrap gap-2">
                    ${data.apparatus.map((a: string) => `<span class="bg-white/5 px-3 py-1 rounded-full text-xs text-slate-300">${a}</span>`).join('')}
                </div>

                <h2 class="text-xl font-semibold text-purple-400 border-b border-white/10 pb-2 pt-4">Procedure</h2>
                <ol class="list-decimal list-inside text-slate-300 space-y-2 text-sm">
                    ${data.procedure.map((p: string) => `<li>${p}</li>`).join('')}
                </ol>
            </section>
        </div>

        <!-- Interactive Simulation -->
        <section class="glass rounded-2xl p-6 overflow-hidden">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold text-emerald-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                    Virtual Apparatus
                </h2>
                <button onclick="simulation.toggle()" id="simBtn" class="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-4 py-2 rounded-lg transition text-sm font-bold border border-emerald-500/30">Start Simulation</button>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 relative bg-black/40 rounded-xl overflow-hidden border border-white/5 h-[300px] flex items-center justify-center">
                    <canvas id="simCanvas" width="800" height="300"></canvas>
                    <div id="simOverlay" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p class="text-white/20 font-bold text-4xl uppercase tracking-widest">Simulation Paused</p>
                    </div>
                </div>

                <!-- Simulation Controls -->
                <div class="space-y-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Controls</h3>
                    <div id="simControls" class="space-y-4">
                        ${activeControls.map((ctrl: any) => `
                            <div>
                                <div class="flex justify-between text-xs text-slate-300 mb-1">
                                    <label for="ctrl-${ctrl.id}">${ctrl.label}</label>
                                    <span id="val-${ctrl.id}">${ctrl.val} ${ctrl.unit}</span>
                                </div>
                                <input 
                                    type="range" 
                                    id="ctrl-${ctrl.id}" 
                                    min="${ctrl.min}" 
                                    max="${ctrl.max}" 
                                    value="${ctrl.val}"
                                    oninput="updateSimParam('${ctrl.id}', this.value, '${ctrl.unit}')"
                                >
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <p class="text-xs text-slate-500 mt-2 text-center">Adjust parameters to see real-time physics updates.</p>
        </section>

        <!-- Dynamic Data Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            <!-- Editable Table -->
            <section class="glass rounded-2xl p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold text-orange-400">Observation Table</h2>
                    <span class="text-xs bg-orange-500/10 text-orange-300 px-2 py-1 rounded">Editable</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-slate-400 uppercase bg-white/5">
                            <tr>
                                ${data.tableHeaders.map((h: string) => `<th class="px-4 py-3">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody id="dataTableBody">
                            <!-- JS will populate this -->
                        </tbody>
                    </table>
                </div>
                <button onclick="addRow()" class="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 text-xs font-bold transition dashed border border-white/10">+ Add Row</button>
            </section>

            <!-- Live Graph (Conditional) -->
            ${data.graphConfig ? `
            <section class="glass rounded-2xl p-6">
                <h2 class="text-xl font-semibold text-pink-400 mb-4">Live Analysis Graph</h2>
                <div class="relative h-[300px] w-full">
                    <canvas id="dataChart"></canvas>
                </div>
            </section>
            ` : ''}
        </div>

        <!-- Analysis & Logic -->
        <section class="glass rounded-2xl p-6 border-l-4 border-cyan-500">
            <h2 class="text-xl font-semibold text-cyan-400 mb-4">Data Analysis</h2>
            <div id="analysisContent" class="prose prose-invert max-w-none text-slate-300">
                Loading analysis...
            </div>
        </section>

        <!-- Questions (Conditional) -->
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
        </section>
        ` : ''}

        <!-- Conclusion -->
        <section class="glass rounded-2xl p-6">
            <h2 class="text-xl font-semibold text-slate-200 mb-2">Conclusion</h2>
            <p class="text-slate-400">${data.conclusion}</p>
        </section>

        <footer class="text-center text-slate-600 text-sm py-8">
            Generated by Galvaniy Labs - Your Smart Lab Companion
        </footer>
    </div>

    <script>
        // --- APP STATE ---
        const reportData = ${jsonString};
        let chartInstance = null;
        
        // Initial params mapping
        const initialParams = {};
        ${JSON.stringify(activeControls)}.forEach(c => initialParams[c.id] = c.val);

        // --- DOM ELEMENTS ---
        const tableBody = document.getElementById('dataTableBody');
        const analysisDiv = document.getElementById('analysisContent');
        const simCanvas = document.getElementById('simCanvas');
        const simCtx = simCanvas.getContext('2d');

        // --- INITIALIZATION ---
        function init() {
            renderTable();
            if (reportData.graphConfig) {
                initChart();
            }
            updateAnalysis();
            simulation.init();
            
            // Remove splash screen logic
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                const main = document.getElementById('main-content');
                if (splash && main) {
                    splash.style.opacity = '0';
                    main.style.opacity = '1';
                    setTimeout(() => splash.remove(), 800);
                }
            }, 2000);
        }

        // --- TABLE LOGIC ---
        function renderTable() {
            tableBody.innerHTML = '';
            reportData.tableData.forEach((row, rIndex) => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-white/5 hover:bg-white/5 transition";
                row.forEach((cell, cIndex) => {
                    const td = document.createElement('td');
                    td.className = "p-1";
                    
                    const input = document.createElement('input');
                    input.type = "number";
                    input.step = "any";
                    input.value = cell;
                    input.className = "w-full bg-transparent p-2 text-right font-mono text-sm border rounded outline-none transition-colors border-white/10 focus:bg-white/5";
                    
                    // Input Validation & Visual Feedback
                    input.oninput = (e) => {
                        const val = e.target.value;
                        if (val === '' || isNaN(parseFloat(val))) {
                            input.classList.add('border-red-500/50', 'text-red-300');
                            input.classList.remove('border-green-500/50', 'text-green-300', 'border-white/10');
                        } else {
                            input.classList.add('border-green-500/50', 'text-green-300');
                            input.classList.remove('border-red-500/50', 'text-red-300', 'border-white/10');
                        }
                    };

                    input.onchange = (e) => updateData(rIndex, cIndex, e.target.value);
                    
                    td.appendChild(input);
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });
        }

        function updateData(row, col, value) {
            reportData.tableData[row][col] = parseFloat(value) || 0;
            if (reportData.graphConfig) {
                updateChart();
            }
            updateAnalysis();
        }

        function addRow() {
            const newRow = new Array(reportData.tableHeaders.length).fill(0);
            reportData.tableData.push(newRow);
            renderTable();
            if (reportData.graphConfig) {
                updateChart();
            }
            updateAnalysis();
        }

        // --- CHART LOGIC ---
        function initChart() {
            const ctxElem = document.getElementById('dataChart');
            if (!ctxElem) return;
            
            const ctx = ctxElem.getContext('2d');
            const config = reportData.graphConfig;
            
            chartInstance = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: config.title,
                        data: getChartData(),
                        backgroundColor: '#f472b6',
                        borderColor: '#f472b6',
                        showLine: true,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: config.xLabel, color: '#94a3b8' },
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#cbd5e1' }
                        },
                        y: {
                            title: { display: true, text: config.yLabel, color: '#94a3b8' },
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#cbd5e1' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5e1' } }
                    }
                }
            });
        }

        function getChartData() {
            if (!reportData.graphConfig) return [];
            const xIdx = reportData.graphConfig.xColumnIndex;
            const yIdx = reportData.graphConfig.yColumnIndex;
            return reportData.tableData.map(row => ({ x: row[xIdx], y: row[yIdx] }));
        }

        function updateChart() {
            if(chartInstance) {
                chartInstance.data.datasets[0].data = getChartData();
                chartInstance.update();
            }
        }

        // --- DYNAMIC ANALYSIS ---
        function updateAnalysis() {
            try {
                // Dynamically create a function from the string provided by AI
                const calcFunc = new Function('rows', reportData.calculationScript);
                const results = calcFunc(reportData.tableData);
                
                let template = reportData.analysisTemplate;
                
                // Replace placeholders with calculated values
                for (const [key, value] of Object.entries(results)) {
                    const regex = new RegExp(\`{{\${key}}}\`, 'g');
                    const valStr = typeof value === 'number' ? value.toFixed(4) : value;
                    template = template.replace(regex, \`<span class="text-cyan-300 font-bold">\${valStr}</span>\`);
                }
                
                analysisDiv.innerHTML = template.replace(/\\n/g, '<br>');
            } catch (e) {
                console.error("Analysis Error", e);
                analysisDiv.innerHTML = "<span class='text-red-400'>Error calculating analysis data. Check table inputs.</span>";
            }
        }

        // --- SIMULATION PARAMETERS UPDATE ---
        function updateSimParam(id, value, unit) {
            document.getElementById('val-'+id).innerText = value + ' ' + unit;
            simulation.params[id] = parseFloat(value);
        }

        // --- SIMULATION ENGINE ---
        const simulation = {
            active: false,
            frame: 0,
            type: reportData.simulationType || 'general',
            params: initialParams, 
            
            toggle: function() {
                this.active = !this.active;
                document.getElementById('simOverlay').style.opacity = this.active ? 0 : 1;
                document.getElementById('simBtn').innerText = this.active ? "Pause" : "Resume";
                if(this.active) this.loop();
            },

            init: function() {
                this.draw();
            },

            loop: function() {
                if(!this.active) return;
                this.frame++;
                this.draw();
                requestAnimationFrame(() => this.loop());
            },

            draw: function() {
                simCtx.clearRect(0, 0, 800, 300);
                simCtx.save();
                
                // Background
                simCtx.fillStyle = '#1e293b';
                simCtx.fillRect(0,0,800,300);

                switch(this.type) {
                    case 'pendulum': this.drawPendulum(); break;
                    case 'heating': this.drawHeating(); break;
                    case 'spring': this.drawSpring(); break;
                    case 'circuit': this.drawCircuit(); break;
                    case 'wave': this.drawWave(); break;
                    default: this.drawGeneral();
                }
                
                simCtx.restore();
            },

            drawPendulum: function() {
                const cx = 400, cy = 0;
                // Use dynamic length from slider (default 200)
                const len = this.params.length || 200;
                // Gravity affects speed (T = 2pi sqrt(L/g)) -> speed prop sqrt(g/L)
                const g = this.params.gravity || 9.8;
                
                // Physics-ish speed scaling
                const speedFactor = Math.sqrt(g) / Math.sqrt(len) * 2; 
                
                const angle = Math.sin(this.frame * 0.05 * speedFactor) * 0.5;
                const x = cx + Math.sin(angle) * len;
                const y = cy + Math.cos(angle) * len;

                // String
                simCtx.strokeStyle = '#94a3b8';
                simCtx.lineWidth = 2;
                simCtx.beginPath();
                simCtx.moveTo(cx, cy);
                simCtx.lineTo(x, y);
                simCtx.stroke();

                // Bob
                simCtx.fillStyle = '#38bdf8';
                simCtx.beginPath();
                simCtx.arc(x, y, 15, 0, Math.PI*2);
                simCtx.fill();
                
                // Text overlay
                simCtx.fillStyle = '#fff';
                simCtx.font = "12px monospace";
                simCtx.fillText(\`L: \${len}cm, g: \${g}m/s²\`, 10, 290);
            },

            drawHeating: function() {
                // Beaker
                simCtx.fillStyle = 'rgba(255,255,255,0.1)';
                simCtx.strokeStyle = '#fff';
                simCtx.fillRect(350, 150, 100, 120);
                simCtx.strokeRect(350, 150, 100, 120);
                
                // Liquid
                simCtx.fillStyle = 'rgba(6, 182, 212, 0.5)';
                simCtx.fillRect(355, 180, 90, 85);

                const heatLevel = this.params.heat || 50;

                // Bubbles (amount and speed depends on heat)
                if(this.active) {
                    simCtx.fillStyle = 'rgba(255,255,255,0.6)';
                    const bubbleCount = Math.floor(heatLevel / 10) + 1;
                    
                    for(let i=0; i < bubbleCount; i++) {
                        const bx = 360 + ((this.frame * (i+1)*10 + i*20) % 80);
                        const speed = 1 + (heatLevel / 20);
                        const by = 260 - ((this.frame * speed + i*30) % 80);
                        
                        simCtx.beginPath();
                        simCtx.arc(bx, by, 2 + (heatLevel/30), 0, Math.PI*2);
                        simCtx.fill();
                    }
                }

                // Flame (Height depends on heat)
                if(this.active && heatLevel > 0) {
                    const flameHeight = heatLevel / 2;
                    simCtx.fillStyle = '#f59e0b';
                    simCtx.beginPath();
                    simCtx.moveTo(380, 300);
                    simCtx.lineTo(400, 300 - flameHeight - Math.random()*5);
                    simCtx.lineTo(420, 300);
                    simCtx.fill();
                }
                
                // Thermometer simulation
                const temp = Math.min(100, (this.params.ambient || 25) + (this.frame * 0.1 * (heatLevel/50)));
                simCtx.fillStyle = '#fff';
                simCtx.fillText(\`Temp: \${temp.toFixed(1)}°C\`, 10, 290);
            },

            drawSpring: function() {
                const mass = this.params.mass || 50;
                const k = this.params.k || 5;
                
                // Extension x = mg/k. 
                const extension = (mass * 9.8) / k; 
                // Scaling for canvas (arbitrary factor)
                const yBase = 50 + (extension * 2); 
                
                // Oscillation (omega = sqrt(k/m))
                const omega = Math.sqrt(k / (mass/100)); // mass in grams roughly scaled
                const oscillation = Math.sin(this.frame * 0.05 * omega) * 20;
                
                const y = yBase + (this.active ? oscillation : 0);
                
                simCtx.strokeStyle = '#cbd5e1';
                simCtx.lineWidth = 4;
                simCtx.beginPath();
                simCtx.moveTo(400, 0);
                
                // Draw coiled spring
                const coils = 10;
                const coilSpacing = y / coils;
                
                for(let i=0; i<=coils; i++) {
                    const cx = 400 + (i%2 === 0 ? 10 : -10);
                    const cy = i * coilSpacing;
                    simCtx.lineTo(cx, cy);
                }
                simCtx.stroke();

                // Mass block (size based on mass)
                const size = 20 + (mass / 5);
                simCtx.fillStyle = '#f472b6';
                simCtx.fillRect(400 - size/2, y, size, size);
                
                simCtx.fillStyle = '#fff';
                simCtx.fillText(\`Ext: \${extension.toFixed(1)}mm\`, 10, 290);
            },

            drawCircuit: function() {
                const volt = this.params.voltage || 12;
                const res = this.params.resistance || 100;
                
                // Current I = V/R
                const current = volt / res;
                // Electron speed prop to Current
                const speed = current * 20; 

                simCtx.strokeStyle = '#facc15';
                simCtx.lineWidth = 4;
                simCtx.strokeRect(250, 100, 300, 150);
                
                // Battery
                simCtx.fillStyle = '#ef4444';
                simCtx.fillRect(230, 160, 10, 30);
                simCtx.fillStyle = '#22c55e';
                simCtx.fillRect(260, 150, 10, 50);
                
                // Resistor visual
                simCtx.fillStyle = '#94a3b8';
                simCtx.fillRect(540, 160, 20, 30);

                // Electrons
                if(this.active && speed > 0.1) {
                    const pathLen = 900; // perimeter
                    const pos = (this.frame * speed) % pathLen;
                    
                    let ex = 250, ey = 100;
                    if(pos < 300) { ex = 250 + pos; ey = 100; }
                    else if (pos < 450) { ex = 550; ey = 100 + (pos-300); }
                    else if (pos < 750) { ex = 550 - (pos-450); ey = 250; }
                    else { ex = 250; ey = 250 - (pos-750); }

                    simCtx.fillStyle = '#38bdf8';
                    simCtx.beginPath();
                    simCtx.arc(ex, ey, 6, 0, Math.PI*2);
                    simCtx.fill();
                }
                
                simCtx.fillStyle = '#fff';
                simCtx.fillText(\`I = \${current.toFixed(3)} A\`, 10, 290);
            },

            drawWave: function() {
                const freq = this.params.frequency || 5;
                const amp = this.params.amplitude || 50;
                
                simCtx.strokeStyle = '#818cf8';
                simCtx.lineWidth = 3;
                simCtx.beginPath();
                for(let x=0; x<800; x+=5) {
                    // y = A sin(kx - wt)
                    const y = 150 + Math.sin((x * 0.01 * freq) + (this.frame * 0.05 * freq)) * amp;
                    if(x===0) simCtx.moveTo(x,y);
                    else simCtx.lineTo(x,y);
                }
                simCtx.stroke();
            },

            drawGeneral: function() {
                const speed = this.params.speed || 1;
                
                simCtx.fillStyle = '#fff';
                simCtx.font = "20px Inter";
                simCtx.fillText("Standard Laboratory Environment", 280, 150);
                
                // Random floating particles
                simCtx.fillStyle = 'rgba(255,255,255,0.2)';
                for(let i=0; i<10; i++) {
                    const x = (this.frame * speed * (i+1)) % 800;
                    const y = (Math.sin(this.frame*0.01*speed + i)*100) + 150;
                    simCtx.beginPath();
                    simCtx.arc(x, y, 2 + i%3, 0, Math.PI*2);
                    simCtx.fill();
                }
            }
        };

        // Start
        init();
    </script>
</body>
</html>`;
}
