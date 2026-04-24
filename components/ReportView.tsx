import React, { useState, useEffect } from 'react';
import { Report, Theme } from '../types';
import { Download, Share2, X, FileCode, ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { logService } from '../services/logService';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface ReportViewProps {
  report: Report | null;
  onClose: () => void;
  theme?: Theme;
  onOpenLab?: (experimentCode: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ report, onClose, theme, onOpenLab }) => {
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
        logService.error("Failed to parse report JSON", e);
      }
    }
  }, [report]);

  // Listen for "open virtual lab" messages from the report iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'openVirtualLab' && event.data?.experimentCode && onOpenLab) {
        onClose();
        onOpenLab(event.data.experimentCode);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onOpenLab, onClose]);

  if (!report) return null;

  const handleDownloadPDF = async () => {
    if (!parsedReport) return;
    
    // Show loading toast
    const loadingToastId = toast.loading('Generating high-quality PDF...', {
      duration: Infinity,
      position: 'bottom-center'
    });
    
    try {
      // Get the iframe element
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe || !iframe.contentDocument) {
        throw new Error('Report preview not loaded. Please wait for the report to fully render.');
      }
      
      const reportBody = iframe.contentDocument.body;
      
      // Ensure all images and resources are loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture the entire report as high-resolution canvas
      const canvas = await html2canvas(reportBody, {
        scale: 2, // High resolution for quality
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
        windowWidth: reportBody.scrollWidth,
        windowHeight: reportBody.scrollHeight,
        onclone: (clonedDoc) => {
          // Ensure the cloned document is fully styled
          const clonedBody = clonedDoc.body;
          clonedBody.style.width = reportBody.scrollWidth + 'px';
          clonedBody.style.height = reportBody.scrollHeight + 'px';
        }
      });
      
      // Create PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate dimensions
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Handle multi-page PDFs
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      // Download with descriptive filename
      const filename = `${report.experimentCode}_Lab_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      // Success feedback
      toast.success('PDF downloaded successfully!', {
        id: loadingToastId,
        duration: 3000
      });
      
    } catch (error) {
      logService.error('PDF generation failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.',
        {
          id: loadingToastId,
          duration: 5000
        }
      );
    }

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
      <Toaster />
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="format-detection" content="telephone=no">
    <meta name="description" content="Interactive lab report generated by Chiromo Labs - ${data.title}">
    <meta name="author" content="Chiromo Labs">
    <title>${data.title} - Lab Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-start: #a855f7;
            --primary-end: #3b82f6;
            --accent: #3b82f6;
            --bg-gradient-via: #581c87;
        }
        
        body { 
            font-family: 'Inter', sans-serif; 
            background: linear-gradient(to bottom right, #0f172a 0%, var(--bg-gradient-via) 50%, #0f172a 100%);
            color: #f8fafc; 
            overflow-x: hidden;
            transition: background 1s ease;
            position: relative;
        }
        
        /* SCROLL PROGRESS BAR */
        #scroll-progress {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(to right, var(--primary-start), var(--primary-end));
            width: 0%;
            z-index: 9999;
            transition: width 0.1s ease;
            box-shadow: 0 0 10px var(--accent);
        }
        
        .glass {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }
        
        /* ENHANCED GLASSMORPHISM */
        .glass-enhanced {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            transition: all 0.3s ease;
        }
        
        .glass-enhanced:hover {
            background: rgba(30, 41, 59, 0.7);
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 20px var(--accent);
        }
        
        /* ANIMATED SECTION REVEALS */
        .reveal-section {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .reveal-section.revealed {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* FLOATING PARTICLES BACKGROUND */
        .particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: -1;
            pointer-events: none;
        }
        
        .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, var(--accent), transparent);
            border-radius: 50%;
            opacity: 0.3;
            animation: float linear infinite;
        }
        
        @keyframes float {
            0% {
                transform: translateY(100vh) translateX(0);
                opacity: 0;
            }
            50% {
                opacity: 0.3;
            }
            100% {
                transform: translateY(-100vh) translateX(100px);
                opacity: 0;
            }
        }
        
        /* IMPROVED TYPOGRAPHY */
        h1 { 
            font-weight: 800; 
            letter-spacing: -0.02em; 
            line-height: 1.1;
        }
        
        h2 { 
            font-weight: 700; 
            letter-spacing: -0.01em; 
            line-height: 1.2;
        }
        
        h3 { 
            font-weight: 600; 
            letter-spacing: 0; 
            line-height: 1.3;
        }
        
        p { 
            line-height: 1.7; 
            letter-spacing: 0.01em; 
        }
        
        /* MICRO-INTERACTIONS FOR BUTTONS */
        button, .button-like {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
        }
        
        button:hover, .button-like:hover {
            transform: translateY(-1px);
        }
        
        button:active, .button-like:active {
            transform: scale(0.98);
        }
        
        input[type="range"]::-webkit-slider-thumb {
            transition: all 0.2s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.2);
        }
        
        /* QUICK STATS CARD */
        .stats-card {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .stat-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 16px;
            border-radius: 12px;
            border-left: 3px solid var(--accent);
            transition: all 0.3s ease;
        }
        
        .stat-item:hover {
            background: rgba(255, 255, 255, 0.08);
            transform: translateY(-2px);
        }
        
        .stat-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            margin-bottom: 4px;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--primary-start), var(--primary-end));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        /* MOBILE OPTIMIZATIONS */
        @media (max-width: 768px) {
            /* Reduce particles for performance */
            .particle {
                display: none;
            }
            
            /* Reduce particles count - show only 10 on mobile */
            .particle:nth-child(-n+10) {
                display: block;
            }
            
            /* Better mobile typography */
            body {
                font-size: 15px;
            }
            
            h1 {
                font-size: 2rem !important;
                line-height: 1.2;
            }
            
            h2 {
                font-size: 1.25rem !important;
            }
            
            h3 {
                font-size: 1.1rem;
            }
            
            /* Larger tap targets for mobile (minimum 44px) */
            button, input[type="range"], input[type="checkbox"] {
                min-height: 44px;
                min-width: 44px;
            }
            
            /* Better spacing on mobile */
            .max-w-5xl {
                padding-left: 12px;
                padding-right: 12px;
            }
            
            .glass, .glass-enhanced {
                padding: 16px !important;
            }
            
            /* Horizontal scroll for tables on mobile */
            .data-table-container {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                margin-left: -12px;
                margin-right: -12px;
                padding-left: 12px;
                padding-right: 12px;
            }
            
            table {
                min-width: 500px;
            }
            
            /* Reduce animations on mobile for performance */
            .reveal-section {
                animation: none;
                opacity: 1;
                transform: none;
            }
            
            /* Stack stats vertically on mobile */
            .stats-card {
                grid-template-columns: 1fr;
            }
            
            /* Make simulation canvas smaller */
            canvas {
                max-height: 250px !important;
            }
            
            /* Better touch scrolling for simulation controls */
            .overflow-y-auto {
                -webkit-overflow-scrolling: touch;
            }
            
            /* Reduce blur for better performance */
            .glass, .glass-enhanced {
                backdrop-filter: blur(8px);
            }
            
            /* Make instruction popup full width on mobile */
            .popup-card {
                max-width: calc(100vw - 32px) !important;
            }
            
            /* Hide scroll progress on very small screens - takes up space */
            #scroll-progress {
                height: 2px;
            }
            
            /* Better mobile padding for sections */
            section {
                margin-bottom: 16px;
            }
            
            /* Touch-friendly chart */
            #dataChart {
                touch-action: pan-y pinch-zoom;
            }
        }
        
        /* Extra small devices (phones in portrait) */
        @media (max-width: 480px) {
            /* Even smaller text for tiny screens */
            body {
                font-size: 14px;
            }
            
            h1 {
                font-size: 1.75rem !important;
            }
            
            /* Single column for everything */
            .grid,  [class*="grid-cols"] {
                grid-template-columns: 1fr !important;
            }
            
            /* Reduce padding further */
            .glass, .glass-enhanced {
                padding: 12px !important;
            }
            
            /* Smaller stats */
            .stat-value {
                font-size: 1.25rem;
            }
        }
        
        /* Tablet optimization */
        @media (min-width: 769px) and (max-width: 1024px) {
            /* 2-column stats on tablets */
            .stats-card {
                grid-template-columns: repeat(2, 1fr);
            }
            
            /* Slightly larger touch targets */
            button {
                min-height: 40px;
            }
        }
        
        /* PRINT OPTIMIZATIONS */
        @media print {
            /* Hide UI elements on print */
            #scroll-progress,
            #instruction-popup,
            .particles,
            canvas,
            input[type="range"] {
                display: none !important;
            }
            
            /* Reset colors for print */
            body {
                background: white;
                color: black;
            }
            
            .glass, .glass-enhanced {
                background: white;
                border: 1px solid #ccc;
            }
            
            /* Page breaks */
            section {
                page-break-inside: avoid;
            }
            
            /* Black text for print */
            h1, h2, h3, p {
                color: black !important;
            }
        }
        
        /* COLLAPSIBLE SECTIONS */
        .collapsible-header {
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .collapsible-icon {
            transition: transform 0.3s ease;
        }
        
        .collapsible-header.collapsed .collapsible-icon {
            transform: rotate(-90deg);
        }
        
        .collapsible-content {
            max-height: 5000px;
            overflow: hidden;
            transition: max-height 0.5s ease, opacity 0.3s ease;
        }
        
        .collapsible-content.collapsed {
            max-height: 0;
            opacity: 0;
        }
        
        /* ENHANCED TABLE INTERACTIONS */
        table tbody tr {
            transition: background-color 0.2s ease;
        }
        
        table tbody tr:hover {
            background-color: rgba(59, 130, 246, 0.1);
        }
        
        table th {
            position: sticky;
            top: 0;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            z-index: 10;
        }
        
        /* COPY BUTTON STYLES */
        .copy-button {
            padding: 6px 12px;
            font-size: 0.75rem;
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 6px;
            color: #60a5fa;
            transition: all 0.2s ease;
            cursor: pointer;
        }
        
        .copy-button:hover {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(59, 130, 246, 0.5);
        }
        
        .copy-button.copied {
            background: rgba(16, 185, 129, 0.2);
            border-color: rgba(16, 185, 129, 0.5);
            color: #10b981;
        }
        
        /* FORMULA & TECHNICAL CONTENT STYLING */
        /* Mathematical formulas */
        .formula, [data-formula], code.formula {
            font-family: 'Courier New', 'Menlo', monospace;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-radius: 6px;
            padding: 8px 12px;
            color: #c7d2fe;
            display: inline-block;
            margin: 4px 0;
            font-size: 0.95em;
            line-height: 1.6;
        }
        
        /* Variables in formulas (e.g., x, y, V, I) */
        .variable, var, i:not([class]) {
            font-family: 'Times New Roman', serif;
            font-style: italic;
            color: #fbbf24;
            font-weight: 500;
        }
        
        /* Numbers in formulas */
        .number, .numeric-value {
            color: #34d399;
            font-family: 'Courier New', monospace;
            font-weight: 600;
        }
        
        /* Units (e.g., m, kg, N, J) */
        .unit, [data-unit] {
            color: #f472b6;
            font-family: 'Courier New', monospace;
            margin-left: 2px;
            font-size: 0.9em;
        }
        
        /* Operators (+, -, ×, ÷, =) */
        .operator {
            color: #60a5fa;
            font-weight: bold;
            margin: 0 4px;
        }
        
        /* Greek letters (α, β, θ, etc.) */
        .greek {
            font-family: 'Times New Roman', serif;
            color: #a78bfa;
            font-style: normal;
        }
        
        /* Code blocks */
        pre code, .code-block {
            display: block;
            background: rgba(0, 0, 0, 0.4);
            border-left: 3px solid var(--accent);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: 'Courier New', 'Menlo', monospace;
            font-size: 0.9em;
            line-height: 1.6;
            color: #e2e8f0;
        }
        
        /* Inline code */
        code:not(pre code):not(.formula) {
            background: rgba(59, 130, 246, 0.15);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #93c5fd;
        }
        
        /* Subscripts and superscripts */
        sub, sup {
            font-size: 0.75em;
            line-height: 0;
        }
        
        sub {
            color: #fdba74;
        }
        
        sup {
            color: #86efac;
        }
        
        /* Equations */
        .equation {
            background: rgba(15, 23, 42, 0.6);
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            border-left: 4px solid var(--accent);
            font-family: 'Courier New', monospace;
            overflow-x: auto;
        }
        
        .equation-label {
            color: #94a3b8;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
        }
        
        /* Highlighted text */
        mark, .highlight {
            background: rgba(251, 191, 36, 0.2);
            color: #fbbf24;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        /* Important notes/warnings */
        .note, .important {
            background: rgba(34, 211, 238, 0.1);
            border-left: 3px solid #22d3ee;
            padding: 12px;
            border-radius: 6px;
            margin: 12px 0;
            color: #cffafe;
        }
        
        .warning {
            background: rgba(251, 191, 36, 0.1);
            border-left: 3px solid #fbbf24;
            padding: 12px;
            border-radius: 6px;
            margin: 12px 0;
            color: #fef3c7;
        }
        
        /* Scientific notation */
        .sci-notation {
            font-family: 'Courier New', monospace;
            color: #34d399;
        }
        
        /* Fractions */
        .fraction {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            vertical-align: middle;
            margin: 0 2px;
        }
        
        .fraction-top {
            border-bottom: 1px solid currentColor;
            padding-bottom: 2px;
        }
        
        .fraction-bottom {
            padding-top: 2px;
        }
        
        /* Better list styling for procedures/steps */
        ol li, ul li {
            margin-bottom: 8px;
            line-height: 1.6;
        }
        
        ol li::marker {
            color: var(--accent);
            font-weight: 700;
        }
        
        ul li::marker {
            color: var(--accent);
        }
        
        /* Definition terms */
        dt {
            color: #60a5fa;
            font-weight: 600;
            margin-top: 12px;
        }
        
        dd {
            margin-left: 20px;
            color: #cbd5e1;
        }
        
        /* Emphasis in technical context */
        strong, b {
            color: #fbbf24;
            font-weight: 700;
        }
        
        em {
            color: #a78bfa;
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
        
        /* CINEMATIC SPLASH SCREEN STYLES */
        #splash-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a0f1e 0%, #1a1f2e 50%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            transition: opacity 1s ease-out;
            overflow: hidden;
        }
        
        #splash-screen::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
            animation: pulse 3s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.1); opacity: 0.6; }
        }
        
        #splash-screen.hidden {
            opacity: 0;
            pointer-events: none;
        }
        
        .splash-content {
            text-align: center;
            position: relative;
            width: 100%;
            height: 200px;
        }
        
        .splash-text {
            font-size: 4rem;
            font-weight: 700;
            color: #fff;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            white-space: nowrap;
            letter-spacing: 0.1em;
            text-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
        }
        
        /* "Galvaniy Technologies" animation */
        .splash-text.galvaniy {
            opacity: 0;
            font-size: 2.5rem;
            background: linear-gradient(135deg, #b6aeaeff 0%, #3b82f6 50%, #8b5cf6 100%);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: fadeInGalvaniy 3s ease-out, shimmer 4s ease-in-out infinite;
            animation-fill-mode: forwards;
            letter-spacing: 0.15em;
        }
        
        /* Galvaniy fade in */
        @keyframes fadeInGalvaniy {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.9);
            }
            20% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.05);
            }
            80% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.95);
            }
        }
        
        /* Shimmer effect for gradients */
        @keyframes shimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .report-content {
            opacity: 0;
            transition: opacity 1s ease-in;
        }
        
        .report-content.visible {
            opacity: 1;
        }
        
        /* INSTRUCTION POPUP OVERLAY */
        #instruction-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
            animation: fadeIn 0.3s ease-out;
        }
        
        #instruction-popup.hidden {
            display: none;
        }
        
        .popup-card {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 16px;
            padding: 24px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: slideUp 0.4s ease-out;
            position: relative;
        }
        
        .popup-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #94a3b8;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: all 0.2s;
        }
        
        .popup-close:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            transform: scale(1.1);
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8" style="background-color: #0f172a; background-image: radial-gradient(circle at 25px 25px, rgba(255,255,255,0.02) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255,255,255,0.02) 2%, transparent 0%); background-size: 100px 100px;">

    <!-- SPLASH SCREEN -->
    <div id="splash-screen">
        <div class="splash-content">
            <div class="splash-text galvaniy">Chiromo Labs</div>
        </div>
    </div>

    <!-- INSTRUCTION POPUP -->
    <div id="instruction-popup" class="hidden">
        <div class="popup-card">
            <button class="popup-close" onclick="closeInstructionPopup()">×</button>
            
            <div style="margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                    <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                </div>
                <h3 style="color: #fff; font-size: 20px; font-weight: 700; margin-bottom: 8px;">📥 How to View This Report</h3>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                    For the best experience with interactive features, follow these steps:
                </p>
            </div>

            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                    <div style="color: #3b82f6; font-weight: 700; font-size: 16px;">1.</div>
                    <div>
                        <span style="color: #e2e8f0; font-weight: 600;">Download this file</span>
                        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Save it to your device if shared via WhatsApp/Email</p>
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                    <div style="color: #3b82f6; font-weight: 700; font-size: 16px;">2.</div>
                    <div>
                        <span style="color: #e2e8f0; font-weight: 600;">Open with a browser</span>
                        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Use Chrome, Safari, Firefox, or Edge</p>
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <div style="color: #3b82f6; font-weight: 700; font-size: 16px;">3.</div>
                    <div>
                        <span style="color: #e2e8f0; font-weight: 600;">Enjoy interactive features!</span>
                        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Edit tables, view simulations, and download PDF</p>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;">
                <input type="checkbox" id="dont-show-again" style="width: 16px; height: 16px; cursor: pointer;">
                <label for="dont-show-again" style="color: #94a3b8; font-size: 13px; cursor: pointer;">Don't show this again</label>
            </div>

            <div style="display: flex; gap: 8px;">
                <button onclick="shareReport()" style="flex: 1; background: linear-gradient(135deg, #10b981, #06b6d4); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share
                </button>
                <button onclick="closeInstructionPopup()" style="flex: 1; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.2s;">
                    Got it!
                </button>
            </div>
        </div>
    </div>

    <!-- SCROLL PROGRESS BAR -->
    <div id="scroll-progress"></div>

    <!-- FLOATING PARTICLES -->
    <div class="particles" id="particles"></div>

    <!-- REPORT CONTENT -->
    <div class="report-content" id="report-content">
    <div class="max-w-5xl mx-auto space-y-8">
        
        <!-- QUICK STATS CARD -->
        <div class="stats-card glass-enhanced reveal-section rounded-2xl p-6">
            <div class="stat-item">
                <div class="stat-label">Experiment</div>
                <div class="stat-value">${code}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Data Tables</div>
                <div class="stat-value">${data.tables.length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Has Graph</div>
                <div class="stat-value">${data.graphConfig ? 'Yes' : 'No'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">${data.enginePowered ? 'Engine' : 'Simulation'}</div>
                <div class="stat-value">${data.enginePowered ? '<span style="color:#22d3ee">⚡ Powered</span>' : (data.simulationScript ? 'Active' : 'N/A')}</div>
            </div>
        </div>
        ${data.enginePowered ? `
        <div class="glass-enhanced reveal-section rounded-2xl p-4 text-center" style="background: linear-gradient(135deg, rgba(34,211,238,0.05), rgba(168,85,247,0.05)); border: 1px solid rgba(34,211,238,0.15);">
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                <span style="font-size:18px;">⚡</span>
                <span style="color:#22d3ee; font-weight:700; font-size:13px; letter-spacing:0.05em; text-transform:uppercase;">Galvaniy Physics Engine</span>
            </div>
            <p style="color:#94a3b8; font-size:12px; margin-top:4px;">Data generated by deterministic physics simulation — ${data.engineKit || code}</p>
        </div>` : ''}
        <!-- (a) CODE & TITLE, (b) DATE, (c) PARTNERS -->
        <header class="glass rounded-2xl p-8 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-10 blur-3xl" style="background: var(--accent);"></div>
            <p class="text-xs text-slate-500 uppercase tracking-wider relative z-10 mb-1"></p>
            <h1 class="text-4xl font-bold text-transparent bg-clip-text relative z-10" style="background: linear-gradient(to right, var(--primary-start), var(--primary-end)); -webkit-background-clip: text; background-clip: text;">${data.title}</h1>
            
            <div class="mt-6 space-y-2 text-sm relative z-10">
                <p class="text-slate-400">
                    <span class="text-xs text-slate-500 uppercase tracking-wider"> </span>
                    <span class="text-white font-mono">${data.date || '[Date: DD/MM/YYYY]'}</span>
                </p>
                <p class="text-slate-400">
                    <span class="text-xs text-slate-500 uppercase tracking-wider">(c) </span>
                    <span class="text-white">${data.partners || '[Partners: Student Names]'}</span>
                </p>
            </div>
        </header>

        <!-- Dynamic Diagram Section (if available from manual) -->
        ${data.diagram ? `
        <section class="glass-enhanced reveal-section rounded-2xl p-6 border-l-4 border-emerald-500">
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
        <section class="glass-enhanced reveal-section rounded-2xl p-6">
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

        <!-- INTERACTIVE SIMULATION -->
        ${data.enginePowered ? `
        <section class="glass-enhanced reveal-section rounded-2xl p-6 overflow-hidden border-l-4" style="border-left-color: #22d3ee;">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-semibold" style="color:#22d3ee;">Virtual Apparatus <span class="text-xs font-bold uppercase tracking-wider" style="color:#a855f7;">⚡ Engine Powered</span></h2>
                    <p class="text-xs text-slate-500 mt-1">Powered by the Galvaniy Physics Engine — ${data.engineKit || 'Built-in Kit'}</p>
                </div>
                <button onclick="window.parent.postMessage({type:'openVirtualLab',experimentCode:'${code}'},'*')" style="background:linear-gradient(135deg,rgba(34,211,238,0.15),rgba(168,85,247,0.15)); color:#22d3ee; padding:8px 20px; border-radius:10px; font-size:13px; font-weight:700; border:1px solid rgba(34,211,238,0.25); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.boxShadow='0 0 20px rgba(34,211,238,0.2)'" onmouseout="this.style.boxShadow='none'">🧪 Open Virtual Lab</button>
            </div>
            <div style="background:rgba(15,23,42,0.6); border-radius:12px; padding:40px 20px; text-align:center; border:1px solid rgba(148,163,184,0.08);">
                <div style="font-size:48px; margin-bottom:12px;">🔬</div>
                <p style="color:#e2e8f0; font-weight:600; font-size:16px;">Interactive Simulation Available</p>
                <p style="color:#64748b; font-size:13px; margin-top:8px; max-width:400px; margin-left:auto; margin-right:auto;">This experiment has a full interactive virtual lab powered by the Galvaniy Physics Engine. Click "Open Virtual Lab" to interact with the apparatus, adjust controls, and collect data in real-time.</p>
                <div style="margin-top:20px; display:flex; justify-content:center; gap:16px; flex-wrap:wrap;">
                    <div style="background:rgba(34,211,238,0.1); border:1px solid rgba(34,211,238,0.15); border-radius:8px; padding:8px 16px;">
                        <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Controls</div>
                        <div style="color:#22d3ee; font-weight:700; font-size:18px;">${controls.length}</div>
                    </div>
                    <div style="background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.15); border-radius:8px; padding:8px 16px;">
                        <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Data Points</div>
                        <div style="color:#a855f7; font-weight:700; font-size:18px;">${data.tables?.[0]?.rows?.length || '—'}</div>
                    </div>
                    <div style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.15); border-radius:8px; padding:8px 16px;">
                        <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Category</div>
                        <div style="color:#4ade80; font-weight:700; font-size:14px; text-transform:capitalize;">${data.engineCategory || 'physics'}</div>
                    </div>
                </div>
            </div>
        </section>
        ` : `
        <section class="glass-enhanced reveal-section rounded-2xl p-6 overflow-hidden border-l-4 border-amber-500">
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
        `}

        <!-- (h) PRECAUTIONS -->
        ${(data.precautions && data.precautions.length > 0) ? `
        <section class="glass-enhanced reveal-section rounded-2xl p-6">
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
        <section class="glass-enhanced reveal-section rounded-2xl p-6 border-l-4 border-cyan-500">
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
        
        // Dynamic Color Palette System
        const COLOR_PALETTES = [
            { name: 'Nebula', primary: ['#a855f7', '#3b82f6'], accent: '#3b82f6', via: '#581c87' },
            { name: 'Emerald', primary: ['#34d399', '#06b6d4'], accent: '#34d399', via: '#065f46' },
            { name: 'Sunset', primary: ['#f97316', '#ec4899'], accent: '#f97316', via: '#9a3412' },
            { name: 'Oceanic', primary: ['#06b6d4', '#2563eb'], accent: '#06b6d4', via: '#1e3a8a' },
            { name: 'Crimson', primary: ['#ef4444', '#f43f5e'], accent: '#ef4444', via: '#991b1b' },
            { name: 'Royal', primary: ['#6366f1', '#8b5cf6'], accent: '#6366f1', via: '#4c1d95' },
            { name: 'Amber', primary: ['#f59e0b', '#f97316'], accent: '#f59e0b', via: '#92400e' },
            { name: 'Graphite', primary: ['#64748b', '#6b7280'], accent: '#64748b', via: '#1e293b' }
        ];
        
        function initColorPalette() {
            // Pick random palette on page load
            const palette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
            
            // Set CSS custom properties
            document.documentElement.style.setProperty('--primary-start', palette.primary[0]);
            document.documentElement.style.setProperty('--primary-end', palette.primary[1]);
            document.documentElement.style.setProperty('--accent', palette.accent);
            document.documentElement.style.setProperty('--bg-gradient-via', palette.via);
            
            console.log('Applied color palette:', palette.name);
        }
        
        // Initialize palette immediately
        initColorPalette();
        
        // Generate Floating Particles
        function createParticles() {
            const container = document.getElementById('particles');
            const particleCount = 30;
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                // Random position
                particle.style.left = Math.random() * 100 + '%';
                
                // Random animation duration (20-40s)
                const duration = 20 + Math.random() * 20;
                particle.style.animationDuration = duration + 's';
                
                // Random delay
                particle.style.animationDelay = -Math.random() * duration + 's';
                
                // Random size variation
                const size = 3 + Math.random() * 3;
                particle.style.width = size + 'px';
                particle.style.height = size + 'px';
                
                container.appendChild(particle);
            }
        }
        
        // Create particles after color palette is set
        setTimeout(createParticles, 100);
        
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

        // Splash screen control
        function initSplashScreen() {
            const splashScreen = document.getElementById('splash-screen');
            const reportContent = document.getElementById('report-content');
            
            // Galvaniy Technologies animation: 3s
            // Add 0.5s buffer = 3.5s total
            
            setTimeout(() => {
                // Hide splash screen
                splashScreen.classList.add('hidden');
                // Show report content
                reportContent.classList.add('visible');
                
                // Remove splash screen from DOM after fade out
                setTimeout(() => {
                    splashScreen.remove();
                }, 1000);
            }, 3500); // 3.5 seconds total
        }
        
        // Initialize splash screen first
        initSplashScreen();
        
        // Instruction Popup Control
        function closeInstructionPopup() {
            const popup = document.getElementById('instruction-popup');
            const dontShowAgain = document.getElementById('dont-show-again');
            
            // Save preference if checkbox is checked
            if (dontShowAgain.checked) {
                localStorage.setItem('hideInstructionPopup', 'true');
            }
            
            // Hide popup
            popup.classList.add('hidden');
        }
        
        function showInstructionPopup() {
            // Check if user has chosen to hide this
            const hidePopup = localStorage.getItem('hideInstructionPopup');
            
            if (hidePopup !== 'true') {
                const popup = document.getElementById('instruction-popup');
                // Show popup well after splash screen completes (3.5s) + report loads
                setTimeout(() => {
                    popup.classList.remove('hidden');
                }, 8000); // 8 seconds to ensure splash completes
            }
        }
        
        function shareReport() {
            const reportTitle = '${data.title} - Lab Report';
            const reportText = 'Check out this interactive lab report from Chiromo Labs!';
            
            // Check if Web Share API is supported
            if (navigator.share) {
                navigator.share({
                    title: reportTitle,
                    text: reportText,
                    url: window.location.href
                })
                .then(() => logService.log('Shared successfully'))
                .catch((error) => logService.log('Error sharing:', error));
            } else {
                // Fallback: Copy link to clipboard
                const url = window.location.href;
                navigator.clipboard.writeText(url)
                    .then(() => {
                        alert('📋 Link copied to clipboard!\\n\\nYou can now paste and share it.');
                    })
                    .catch(() => {
                        // Fallback for older browsers
                        const textarea = document.createElement('textarea');
                        textarea.value = url;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        alert('📋 Link copied to clipboard!');
                    });
            }
        }
        
        // Scroll Progress Bar
        function updateScrollProgress() {
            const scrollProgress = document.getElementById('scroll-progress');
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercent = (scrollTop / scrollHeight) * 100;
            scrollProgress.style.width = scrollPercent + '%';
        }
        
        // Animated Section Reveals
        function revealSections() {
            const sections = document.querySelectorAll('.reveal-section');
            const windowHeight = window.innerHeight;
            
            sections.forEach(section => {
                const sectionTop = section.getBoundingClientRect().top;
                const revealPoint = 150;
                
                if (sectionTop < windowHeight - revealPoint) {
                    section.classList.add('revealed');
                }
            });
        }
        
        // Scroll to Top
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        
        // Toggle Font Size
        let currentFontSize = 1; // 0 = small, 1 = normal, 2 = large
        function toggleFontSize() {
            currentFontSize = (currentFontSize + 1) % 3;
            const sizes = ['14px', '16px', '18px'];
            document.body.style.fontSize = sizes[currentFontSize];
            localStorage.setItem('reportFontSize', currentFontSize);
        }
        
        // Load saved font size
        const savedFontSize = localStorage.getItem('reportFontSize');
        if (savedFontSize) {
            currentFontSize = parseInt(savedFontSize);
            const sizes = ['14px', '16px', '18px'];
            document.body.style.fontSize = sizes[currentFontSize];
        }
        
        // Attach scroll listeners
        window.addEventListener('scroll', () => {
            updateScrollProgress();
            revealSections();
        });
        
        // Initial reveal check
        setTimeout(revealSections, 100);
        
        // Initialize instruction popup
        showInstructionPopup();

        // Delay init slightly to ensure DOM is ready in all environments
        setTimeout(init, 100);
    </script>
    </div> <!-- Close report-content -->
</body>
</html>`;
}