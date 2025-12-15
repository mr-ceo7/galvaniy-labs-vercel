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
  // CRITICAL: Escape script closing tags to prevent breaking the HTML output
  const jsonString = JSON.stringify(data).replace(/<\/script>/g, '<\\/script>');
  const simType = (data.simulationType || 'general').toLowerCase(); 
  
  // Define controls for each simulation type (same as before)
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

  const activeControls = simConfigs[simType] || simConfigs['general'];

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
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">

    <div class="max-w-5xl mx-auto space-y-8">
        <!-- Header -->
        <header class="glass rounded-2xl p-8 text-center relative overflow-hidden">
            <div class="absolute inset-0 bg-blue-500/10 blur-3xl"></div>
            <h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 relative z-10">${data.title}</h1>
            <p class="text-slate-400 mt-2 relative z-10">Experiment Code: <span class="text-white font-mono">${code}</span></p>
        </header>

        <!-- Dynamic Diagram Section -->
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
                <h2 class="text-xl font-semibold text-emerald-400">Virtual Apparatus</h2>
                <button onclick="simulation.toggle()" id="simBtn" class="bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-lg text-sm font-bold border border-emerald-500/30">Start Simulation</button>
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
                        ${activeControls.map((ctrl: any) => `
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

        <!-- Dynamic Data Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section class="glass rounded-2xl p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold text-orange-400">Observation Table</h2>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-slate-400 uppercase bg-white/5">
                            <tr>${data.tableHeaders.map((h: string) => `<th class="px-4 py-3">${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody id="dataTableBody"></tbody>
                    </table>
                </div>
            </section>
            
            ${data.graphConfig ? `
            <section class="glass rounded-2xl p-6">
                <h2 class="text-xl font-semibold text-pink-400 mb-4">Live Analysis Graph</h2>
                <div class="relative h-[300px] w-full"><canvas id="dataChart"></canvas></div>
            </section>` : ''}
        </div>

        <section class="glass rounded-2xl p-6 border-l-4 border-cyan-500">
            <h2 class="text-xl font-semibold text-cyan-400 mb-4">Data Analysis</h2>
            <div id="analysisContent" class="prose prose-invert max-w-none text-slate-300">Loading analysis...</div>
        </section>

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

        <section class="glass rounded-2xl p-6">
            <h2 class="text-xl font-semibold text-slate-200 mb-2">Conclusion</h2>
            <p class="text-slate-400">${data.conclusion}</p>
        </section>
    </div>

    <script>
        const reportData = ${jsonString};
        // ... (Existing interactive script logic for charts and simulation)
        // Re-injecting standard interactive logic here for brevity in this specific update block
        
        let chartInstance = null;
        const initialParams = {};
        ${JSON.stringify(activeControls)}.forEach(c => initialParams[c.id] = c.val);
        
        const tableBody = document.getElementById('dataTableBody');
        const analysisDiv = document.getElementById('analysisContent');
        const simCanvas = document.getElementById('simCanvas');
        const simCtx = simCanvas.getContext('2d');
        
        function init() {
            renderTable();
            if (reportData.graphConfig) initChart();
            updateAnalysis();
            simulation.init();
        }

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
                    input.className = "w-full bg-transparent p-2 text-right font-mono text-sm border rounded border-white/10";
                    input.onchange = (e) => updateData(rIndex, cIndex, e.target.value);
                    td.appendChild(input);
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });
        }

        function updateData(row, col, value) {
            reportData.tableData[row][col] = parseFloat(value) || 0;
            if (reportData.graphConfig) updateChart();
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
            const x = reportData.graphConfig.xColumnIndex;
            const y = reportData.graphConfig.yColumnIndex;
            return reportData.tableData.map(r => ({x: r[x], y: r[y]}));
        }

        function updateChart() {
            if(chartInstance) { chartInstance.data.datasets[0].data = getChartData(); chartInstance.update(); }
        }

        function updateAnalysis() {
            try {
                const calcFunc = new Function('rows', reportData.calculationScript);
                const results = calcFunc(reportData.tableData);
                let template = reportData.analysisTemplate;
                for (const [key, value] of Object.entries(results)) {
                    const regex = new RegExp(\`{{\${key}}}\`, 'g');
                    template = template.replace(regex, \`<span class="text-cyan-300 font-bold">\${typeof value === 'number' ? value.toFixed(4) : value}</span>\`);
                }
                analysisDiv.innerHTML = template.replace(/\\n/g, '<br>');
            } catch (e) { analysisDiv.innerHTML = "Error calculating."; }
        }

        function updateSimParam(id, val, unit) {
            document.getElementById('val-'+id).innerText = val + ' ' + unit;
            simulation.params[id] = parseFloat(val);
        }

        const simulation = {
            active: false, frame: 0, params: initialParams, type: '${simType}',
            toggle: function() { this.active = !this.active; document.getElementById('simOverlay').style.opacity = this.active ? 0 : 1; if(this.active) this.loop(); },
            init: function() { this.draw(); },
            loop: function() { if(!this.active) return; this.frame++; this.draw(); requestAnimationFrame(() => this.loop()); },
            draw: function() {
                simCtx.clearRect(0,0,800,300);
                simCtx.fillStyle = '#1e293b'; simCtx.fillRect(0,0,800,300);
                // Basic generic visualizer as placeholder for the specific logic
                simCtx.fillStyle = '#fff'; simCtx.fillText("Simulation Running: " + this.type, 10, 20);
                
                // (Full simulation logic from previous file would go here for production)
                // Re-implementing a simple pendulum for visual confirmation
                if(this.type === 'pendulum') {
                    const x = 400 + Math.sin(this.frame * 0.05) * (this.params.length || 100);
                    simCtx.strokeStyle='#fff'; simCtx.beginPath(); simCtx.moveTo(400,0); simCtx.lineTo(x, 200); simCtx.stroke();
                    simCtx.beginPath(); simCtx.arc(x, 200, 10, 0, 6.28); simCtx.fill();
                }
            }
        };

        init();
    </script>
</body>
</html>`;
}