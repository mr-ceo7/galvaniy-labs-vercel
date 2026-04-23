import json
import os

# Read the generated JSON report
json_path = os.path.join(os.path.dirname(__file__), "generated_report_A-3.json")
html_path = os.path.join(os.path.dirname(__file__), "generated_report_A-3.html")

with open(json_path, "r") as f:
    report = json.load(f)

# Build the HTML content
html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{report.get('title', 'Lab Report')}</title>
    <style>
        :root {{
            --primary: #2563eb;
            --surface: #ffffff;
            --background: #f8fafc;
            --text: #0f172a;
            --text-light: #64748b;
            --border: #e2e8f0;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--background);
            color: var(--text);
            line-height: 1.6;
            margin: 0;
            padding: 2rem;
        }}
        .container {{
            max-width: 800px;
            margin: 0 auto;
            background: var(--surface);
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }}
        header {{
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid var(--border);
        }}
        h1 {{
            color: var(--primary);
            margin: 0 0 1rem 0;
            font-size: 2.5rem;
        }}
        .meta-info {{
            color: var(--text-light);
            font-size: 1.1rem;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
        }}
        h2 {{
            color: var(--primary);
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.5rem;
            margin-top: 2rem;
        }}
        ul, ol {{
            padding-left: 1.5rem;
        }}
        li {{
            margin-bottom: 0.5rem;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
        }}
        th, td {{
            border: 1px solid var(--border);
            padding: 0.75rem;
            text-align: left;
        }}
        th {{
            background-color: #f1f5f9;
            font-weight: 600;
        }}
        .simulation-container {{
            background: #0f172a;
            border-radius: 8px;
            padding: 1rem;
            margin: 2rem 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        canvas {{
            background: white;
            border-radius: 4px;
            max-width: 100%;
        }}
        .controls {{
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
            color: white;
            flex-wrap: wrap;
            justify-content: center;
        }}
        .control-group {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>{report.get('title', '')}</h1>
            <div class="meta-info">
                <span><strong>Date:</strong> {report.get('date', '')}</span>
                <span><strong>Partners:</strong> {report.get('partners', '')}</span>
            </div>
        </header>

        <h2>Objectives</h2>
        <ul>
            {"".join(f"<li>{obj}</li>" for obj in report.get('objectives', []))}
        </ul>

        <h2>Theory</h2>
        <p>{report.get('theory', '')}</p>

        <h2>Apparatus</h2>
        <ul>
            {"".join(f"<li>{item}</li>" for item in report.get('apparatus', []))}
        </ul>

        <h2>Procedure</h2>
        <ol>
            {"".join(f"<li>{step}</li>" for step in report.get('procedure', []))}
        </ol>

        <h2>Precautions</h2>
        <ul>
            {"".join(f"<li>{item}</li>" for item in report.get('precautions', []))}
        </ul>
        
        <h2>Data Collection</h2>
"""

# Add tables
for table in report.get('tables', []):
    html_content += f"<h3>{table.get('title', 'Data Table')}</h3>\n<table>\n<thead>\n<tr>"
    for header in table.get('headers', []):
        html_content += f"<th>{header}</th>"
    html_content += "</tr>\n</thead>\n<tbody>"
    for row in table.get('rows', []):
        html_content += "<tr>"
        for cell in row:
            html_content += f"<td>{cell}</td>"
        html_content += "</tr>\n"
    html_content += "</tbody>\n</table>\n"

html_content += f"""
        <h2>Calculations & Analysis</h2>
        <div style="background: #f8fafc; padding: 1rem; border-left: 4px solid var(--primary); border-radius: 4px;">
            <p><strong>Script executed successfully.</strong></p>
            <p><em>(In the real app, this runs the calculation script securely and fills the template)</em></p>
            <p>{report.get('analysisTemplate', '')}</p>
        </div>

        <h2>Interactive Simulation</h2>
        <div class="simulation-container">
            <canvas id="simCanvas" width="600" height="400"></canvas>
            <div class="controls" id="simControls">
"""

# Add controls
controls = report.get('controls', [])
for i, ctrl in enumerate(controls):
    html_content += f"""
                <div class="control-group">
                    <label for="ctrl_{i}">{ctrl.get('label')} ({ctrl.get('unit', '')}): <span id="val_{i}">{ctrl.get('val')}</span></label>
                    <input type="range" id="ctrl_{i}" min="{ctrl.get('min')}" max="{ctrl.get('max')}" value="{ctrl.get('val')}" step="0.1">
                </div>
"""

html_content += f"""
            </div>
        </div>

        <h2>Discussion</h2>
        <p>{report.get('discussion', '')}</p>

        <h2>Sources of Error</h2>
        <ul>
            {"".join(f"<li>{err}</li>" for err in report.get('sourcesOfError', []))}
        </ul>

        <h2>Conclusion</h2>
        <p>{report.get('conclusion', '')}</p>

        <h2>References</h2>
        <ul>
            {"".join(f"<li>{ref}</li>" for ref in report.get('references', []))}
        </ul>
    </div>

    <script>
        // Setup Simulation
        const canvas = document.getElementById('simCanvas');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        let frame = 0;
        let params = {{
"""
for i, ctrl in enumerate(controls):
    html_content += f"            '{ctrl.get('id')}': {ctrl.get('val')},\n"

html_content += f"""        }};

        // Bind controls
"""
for i, ctrl in enumerate(controls):
    html_content += f"""
        document.getElementById('ctrl_{i}').addEventListener('input', function(e) {{
            params['{ctrl.get('id')}'] = parseFloat(e.target.value);
            document.getElementById('val_{i}').textContent = e.target.value;
        }});
"""

html_content += f"""
        // The AI generated script
        function renderSimulation(ctx, width, height, frame, params) {{
            {report.get('simulationScript', '')}
        }}

        function animate() {{
            renderSimulation(ctx, width, height, frame, params);
            frame++;
            requestAnimationFrame(animate);
        }}
        
        // Start animation
        animate();
    </script>
</body>
</html>
"""

with open(html_path, "w") as f:
    f.write(html_content)

print(f"HTML report successfully generated at: {html_path}")
