let timeChart = null;
        let docsChart = null;
        let previousStats = null;


        window.onload = () => {
            initEmptyChart();
        };

        function initEmptyChart() {
            const timeCanvas = document.getElementById('timeChart');
            const docsCanvas = document.getElementById('docsChart');
            if (!timeCanvas || !docsCanvas) return;

            if (timeChart) timeChart.destroy();
            if (docsChart) docsChart.destroy();

            timeChart = new Chart(timeCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Current', 'Simulated'],
                    datasets: [{
                        label: 'Execution Time (ms)',
                        data: [0, 0],
                        backgroundColor: ['#ff4d4f', '#00ed64'],
                        borderRadius: 12,
                        maxBarThickness: 56
                    }]
                },
                options: buildMiniChartOptions('Execution Time (ms)')
            });

            docsChart = new Chart(docsCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Current', 'Simulated'],
                    datasets: [{
                        label: 'Documents Examined',
                        data: [0, 0],
                        backgroundColor: ['#ff9f43', '#00ed64'],
                        borderRadius: 12,
                        maxBarThickness: 56
                    }]
                },
                options: buildMiniChartOptions('Docs Examined')
            });

            updateChartColors();
        }

        function buildMiniChartOptions(labelText) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: {
                            display: true,
                            text: labelText
                        }
                    },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false }
                }
            };
        }

        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        const themeText = document.getElementById('themeText');
        
        // Connection Mode Toggle Logic
        const localBtn = document.getElementById('localMode');
        const cloudBtn = document.getElementById('cloudMode');
        const mongoUriInput = document.getElementById('mongoUri');

        localBtn.addEventListener('click', () => {
            localBtn.classList.add('active');
            cloudBtn.classList.remove('active');
            mongoUriInput.value = "mongodb://localhost:27017";
            mongoUriInput.placeholder = "mongodb://localhost:27017";
        });

        cloudBtn.addEventListener('click', () => {
            cloudBtn.classList.add('active');
            localBtn.classList.remove('active');
            mongoUriInput.value = "";
            mongoUriInput.placeholder = "mongodb+srv://<user>:<password>@cluster.mongodb.net/";
        });

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const isDark = document.body.classList.contains('dark');
            // themeIcon.textContent = isDark ? 'Sun' : 'Moon';
            themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
            if (timeChart || docsChart) updateChartColors();
        });

        const updateChartColors = () => {
            const isDark = document.body.classList.contains('dark');
            const textColor = isDark ? '#f8f9fa' : '#001e2b';

            [timeChart, docsChart].forEach((activeChart) => {
                if (!activeChart) return;

                if (activeChart.options.scales) {
                    if (activeChart.options.scales.x) {
                        if (!activeChart.options.scales.x.ticks) activeChart.options.scales.x.ticks = {};
                        activeChart.options.scales.x.ticks.color = textColor;
                    }
                    if (activeChart.options.scales.y) {
                        if (!activeChart.options.scales.y.ticks) activeChart.options.scales.y.ticks = {};
                        activeChart.options.scales.y.ticks.color = textColor;
                    }
                }

                if (activeChart.options.scales?.y?.title) {
                    activeChart.options.scales.y.title.color = textColor;
                }

                activeChart.update('none');
            });
        };

        document.getElementById('optimizerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const overlay = document.getElementById('loading-overlay');
            overlay.classList.remove('hidden');

            try {
                const queryVal = document.getElementById('query').value;
                let query;
                try {
                    query = JSON.parse(queryVal);
                } catch (jsonErr) {
                    throw new Error("Invalid Query JSON format. Please check your syntax.");
                }

                const payload = {
                    mongoUri: document.getElementById('mongoUri').value,
                    database: document.getElementById('database').value,
                    collection: document.getElementById('collection').value,
                    query: query,
                    previousStats: previousStats
                };

                // Controller with timeout for the fetch request
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

                const response = await fetch('/api/optimize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error(`Server responded with non-JSON format: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (!response.ok) throw new Error(data.data?.message || 'Unknown server error');

                console.log('Analysis Data Received:', data);
                renderResults(data.data);
                previousStats = data.data.analysis; 
            } catch (err) {
                if (err.name === 'AbortError') {
                    alert('The analysis request timed out. The collection might be too large for real-time simulation.');
                } else {
                    alert('Error: ' + err.message);
                }
            } finally {
                overlay.classList.add('hidden');
            }
        });

        document.getElementById('resetBtn').addEventListener('click', async () => {
            if (!confirm('Are you sure you want to drop all indexes (except _id) for this collection?')) return;
            
            const payload = {
                mongoUri: document.getElementById('mongoUri').value,
                database: document.getElementById('database').value,
                collection: document.getElementById('collection').value
            };

            try {
                const response = await fetch('/api/reset-indexes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error(`Server responded with non-JSON format: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (!response.ok) throw new Error(data.data?.message || 'Unknown server error');
                alert(data.data.message);
                previousStats = null; // Clear history on reset
            } catch (err) {
                alert('Error resetting indexes: ' + err.message);
            }
        });

        function renderResults(data) {
            document.getElementById('welcomeMessage').classList.add('hidden');
            document.getElementById('resultsContent').classList.remove('hidden');
            document.getElementById('costCard').classList.remove('hidden');

            //  Score and Stats
            const badge = document.getElementById('scoreBadge');
            badge.textContent = data.cost.score;
            badge.className = 'score-badge score-' + data.cost.rating.toLowerCase();
            document.getElementById('scoreRating').textContent = data.cost.rating.toUpperCase();
            const ratingColorMap = {
                excellent: 'success',
                good: 'primary-dark',
                moderate: 'warning',
                poor: 'error'
            };
            document.getElementById('scoreRating').style.color = `var(--${ratingColorMap[data.cost.rating.toLowerCase()] || 'warning'})`; 

            const efficiency = Number(data.analysis.efficiency || 0);
            const selectivityRatio = Number(data.analysis.selectivityRatio || 0);
            document.getElementById('statEfficiency').textContent = efficiency.toFixed(2) + 'x';
            document.getElementById('statSelectivity').textContent = (selectivityRatio * 100).toFixed(1) + '%';

            // Execution Stats
            document.getElementById('valTime').textContent = data.analysis.executionTimeMillis + 'ms';
            document.getElementById('valScan').textContent = data.analysis.winningPlanStage;
            document.getElementById('valDocs').textContent = data.analysis.totalDocsExamined;
            document.getElementById('valReturned').textContent = data.analysis.nReturned;
            document.getElementById('valTotalDocs').textContent = data.totalCollectionDocs;
            document.getElementById('valKeys').textContent = data.analysis.totalKeysExamined;

            // Issues & Rewards
            const issuesList = document.getElementById('issuesList');
            let issuesHtml = '';
            
            if (data.cost.rewards && data.cost.rewards.length) {
                issuesHtml += data.cost.rewards.map(r => `<div class="issue-item" style="border-left-color: var(--success); background: rgba(82, 196, 26, 0.05); color: var(--success); font-weight: 600;">OK: ${r}</div>`).join('');
            }
            
            if (data.cost.issues && data.cost.issues.length) {
                issuesHtml += data.cost.issues.map(i => `<div class="issue-item">${i}</div>`).join('');
            }
            
            issuesList.innerHTML = issuesHtml || '<p style="color:var(--success); font-weight:600;">No critical issues detected.</p>'; 


            const suggCont = document.getElementById('suggestionContent');
            if (data.suggestions.length) {
                const s = data.suggestions[0];
                const indexAlreadyExists = data.simulation?.errorCode === 'DUPLICATE_INDEX';
                const applyButtonLabel = indexAlreadyExists ? 'INDEX ALREADY EXISTS' : 'APPLY THIS INDEX';
                const applyButtonState = indexAlreadyExists ? 'disabled' : '';
                suggCont.innerHTML = `
                    <p><strong>Type:</strong> ${s.type}</p>
                    <p><strong>Reason:</strong> ${s.reason}</p>
                    <div class="suggestion-box">db.${document.getElementById('collection').value}.createIndex(${JSON.stringify(s.index)})</div>
                `;
                
                if (data.simulation && data.simulation.status === 'success') {
                    const docsReduction = data.simulation.improvement?.docs?.percent ?? 0;
                    const timeReduction = data.simulation.improvement?.time?.percent ?? 0;
                    suggCont.innerHTML += `
                        <div style="margin-top:15px; font-size:14px; color:var(--text-muted)">
                            <strong>Simulated Impact:</strong> Execution Time: ${data.simulation.executionTimeMillis}ms, Docs Examined: ${data.simulation.totalDocsExamined}
                            <br>
                            <span style="color:var(--primary); font-size:12px;">
                                (${docsReduction}% docs reduction, ${timeReduction}% time reduction)
                            </span>
                        </div>
                    `;
                } else if (data.simulation && data.simulation.status !== 'success') {
                    suggCont.innerHTML += `
                        <div style="margin-top:15px; font-size:14px; color:var(--warning)">
                            <strong>Simulation Note:</strong> ${data.simulation.reason || 'Skipped for this query.'}
                        </div>
                    `;
                } else {
                    suggCont.innerHTML += `
                        <div style="margin-top:15px; font-size:14px; color:var(--warning)">
                            <strong>Note:</strong> Real-time simulation was skipped for this collection (too large or slow).
                        </div>
                    `;
                }
                
                suggCont.innerHTML += `
                    <button id="applyIndexBtn" class="btn-primary" style="margin-top: 15px; width: auto; padding: 10px 20px; ${indexAlreadyExists ? 'opacity:0.55; cursor:not-allowed; box-shadow:none;' : ''}" ${applyButtonState}>
                        ${applyButtonLabel}
                    </button>
                `;


                if (!indexAlreadyExists) {
                    document.getElementById('applyIndexBtn').onclick = async () => {
                    const btn = document.getElementById('applyIndexBtn');
                    btn.disabled = true;
                    btn.textContent = 'Applying...';
                    
                    try {
                        const apiUrl = window.location.origin + '/api/create-index';
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                mongoUri: document.getElementById('mongoUri').value,
                                database: document.getElementById('database').value,
                                collection: document.getElementById('collection').value,
                                index: s.index
                            })
                        });

                        const contentType = response.headers.get("content-type");
                        if (!contentType || !contentType.includes("application/json")) {
                            const text = await response.text();
                            console.error('Non-JSON response:', text);
                            throw new Error(`Server returned HTML instead of JSON. This usually means a routing error. Status: ${response.status}`);
                        }

                        const resData = await response.json();
                        if (!response.ok) throw new Error(resData.data?.message || 'Server error occurred.');
                        alert(resData.data.message);
                        btn.textContent = 'Index Applied!';
                    } catch (err) {
                        console.error('Error applying index:', err);
                        alert('Error applying index: ' + (err.message || 'Unexpected error.'));
                        btn.disabled = false;
                        btn.textContent = 'APPLY THIS INDEX';
                    }
                };
                }
            } else {
                suggCont.innerHTML = '<p>No further index suggestions.</p>';
            }

            // 5. Chart
            try {
                renderChart(data);
            } catch (chartErr) {
                console.error('Chart rendering failed:', chartErr);
            }

            // 6. Results Table
            try {
                renderTable(data.results);
            } catch (tableErr) {
                console.error('Table rendering failed:', tableErr);
            }
        }

        function renderChart(data) {
            if (!data.analysis) {
                console.warn('No analysis data available for chart.');
                return;
            }
            
            const timeVal = data.analysis.executionTimeMillis || 0;
            const docsVal = data.analysis.totalDocsExamined || 0;
            const simTimeVal = data.simulation ? (data.simulation.executionTimeMillis || 0) : 0;
            const simDocsVal = data.simulation ? (data.simulation.totalDocsExamined || 0) : 0;
            const timeDelta = data.simulation?.improvement?.time?.percent ?? 0;
            const docsDelta = data.simulation?.improvement?.docs?.percent ?? 0;
            const hasSuccessfulSimulation = data.simulation?.status === 'success';
            const chartSimTimeVal = hasSuccessfulSimulation
                ? (timeDelta === 0 ? timeVal : simTimeVal)
                : timeVal;
            const chartSimDocsVal = hasSuccessfulSimulation
                ? (docsDelta === 0 ? docsVal : simDocsVal)
                : docsVal;

            document.getElementById('timeMetricValue').textContent = `${timeVal}ms`;
            document.getElementById('docsMetricValue').textContent = docsVal.toLocaleString();
            document.getElementById('timeMetricTrend').textContent = hasSuccessfulSimulation
                ? `${timeDelta}% simulated reduction`
                : 'Simulation unavailable or unchanged';
            document.getElementById('docsMetricTrend').textContent = hasSuccessfulSimulation
                ? `${docsDelta}% fewer docs with suggested index`
                : 'Simulation unavailable or unchanged';

            if (timeChart) {
                timeChart.data.datasets[0].data = [timeVal, chartSimTimeVal];
                timeChart.options.scales.y.suggestedMax = Math.max(timeVal, chartSimTimeVal, 10);
                timeChart.update();
            }

            if (docsChart) {
                docsChart.data.datasets[0].data = [docsVal, chartSimDocsVal];
                docsChart.options.scales.y.suggestedMax = Math.max(docsVal, chartSimDocsVal, 10);
                docsChart.update();
            }

            updateChartColors();
        }

        function renderTable(results) {
            const head = document.getElementById('tableHead');
            const body = document.getElementById('tableBody');
            const countLabel = document.getElementById('resultsCount');
            head.innerHTML = '';
            body.innerHTML = '';
            countLabel.textContent = '';

            if (!results || results.length === 0) {
                countLabel.textContent = '0 records';
                body.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding: 40px; color: var(--text-muted);">No documents matched your query.</td></tr>';
                return;
            }

            countLabel.textContent = `${results.length} records`;
            const keys = Array.from(new Set(results.flatMap(row => Object.keys(row))));
            const headerRow = document.createElement('tr');
            keys.forEach(k => {
                const th = document.createElement('th');
                th.textContent = k;
                headerRow.appendChild(th);
            });
            head.appendChild(headerRow);

            results.forEach(row => {
                const tr = document.createElement('tr');
                keys.forEach(k => {
                    const td = document.createElement('td');
                    const content = document.createElement('span');
                    const val = row[k];
                    const formatted = formatCellValue(val);
                    content.className = 'cell' + (formatted.length > 60 ? ' compact' : '');
                    content.textContent = formatted;
                    content.title = formatted;
                    td.appendChild(content);
                    tr.appendChild(td);
                });
                body.appendChild(tr);
            });
        }

        function formatCellValue(value) {
            if (value === null || value === undefined) return '--';
            if (typeof value === 'string') {
                return value.length > 120 ? `${value.slice(0, 117)}...` : value;
            }
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (Array.isArray(value)) {
                const rendered = value.map(formatCellValue).join(', ');
                return rendered.length > 120 ? `${rendered.slice(0, 117)}...` : rendered;
            }
            if (value instanceof Date) return value.toISOString();

            try {
                const rendered = JSON.stringify(value, null, 2);
                return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
            } catch (error) {
                return String(value);
            }
        }