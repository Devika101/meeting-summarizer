/**
 * Meeting Summarizer — Frontend Application
 *
 * Handles file upload (drag-and-drop + click), SSE progress streaming,
 * VU-meter animation, results rendering, and export functionality.
 */

(function () {
    'use strict';

    // ── DOM References ──
    const $ = (id) => document.getElementById(id);

    const heroWaveform   = $('heroWaveform');
    const dropZone       = $('dropZone');
    const fileInput      = $('fileInput');
    const fileInfo       = $('fileInfo');
    const processBtn     = $('processBtn');
    const uploadSection  = $('uploadSection');
    const progressSection = $('progressSection');
    const vuMeter        = $('vuMeter');
    const progressStage  = $('progressStage');
    const errorSection   = $('errorSection');
    const errorMessage   = $('errorMessage');
    const retryBtn       = $('retryBtn');
    const resultsSection = $('resultsSection');
    const summaryBody    = $('summaryBody');
    const decisionsBody  = $('decisionsBody');
    const actionItemsBody = $('actionItemsBody');
    const transcriptBody = $('transcriptBody');
    const copySlackBtn   = $('copySlackBtn');
    const downloadMdBtn  = $('downloadMdBtn');
    const newUploadBtn   = $('newUploadBtn');

    let selectedFile = null;
    let lastResult = null;

    // ── Hero Waveform ──
    function initHeroWaveform() {
        const count = 80;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            const h = 20 + Math.random() * 80;
            bar.style.height = h + 'px';
            bar.style.animationDelay = (Math.random() * 2.5).toFixed(2) + 's';
            bar.style.animationDuration = (1.8 + Math.random() * 1.5).toFixed(2) + 's';
            fragment.appendChild(bar);
        }
        heroWaveform.appendChild(fragment);
    }

    // ── VU Meter ──
    function initVuMeter() {
        vuMeter.innerHTML = '';
        const count = 32;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const bar = document.createElement('div');
            bar.className = 'vu-bar';
            bar.style.height = '100%';
            bar.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
            bar.style.animationDuration = (0.3 + Math.random() * 0.5).toFixed(2) + 's';
            fragment.appendChild(bar);
        }
        vuMeter.appendChild(fragment);
    }

    // ── File Selection ──
    function handleFileSelect(file) {
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        const allowed = ['mp3', 'wav', 'm4a'];

        if (!allowed.includes(ext)) {
            fileInfo.textContent = `Unsupported format: .${ext}. Use MP3, WAV, or M4A.`;
            fileInfo.style.color = 'var(--accent-red)';
            selectedFile = null;
            processBtn.disabled = true;
            return;
        }

        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (file.size > 25 * 1024 * 1024) {
            fileInfo.textContent = `File too large (${sizeMB} MB). Maximum is 25 MB.`;
            fileInfo.style.color = 'var(--accent-red)';
            selectedFile = null;
            processBtn.disabled = true;
            return;
        }

        selectedFile = file;
        fileInfo.textContent = `${file.name} (${sizeMB} MB)`;
        fileInfo.style.color = 'var(--accent-signal)';
        processBtn.disabled = false;
    }

    // ── Drag and Drop ──
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });

    // ── UI State Management ──
    function showSection(section) {
        [uploadSection, progressSection, errorSection, resultsSection].forEach(s => {
            s.classList.add('hidden');
        });
        section.classList.remove('hidden');
    }

    // ── Processing ──
    processBtn.addEventListener('click', () => {
        if (!selectedFile) return;
        startProcessing(selectedFile);
    });

    function startProcessing(file) {
        showSection(progressSection);
        initVuMeter();
        progressStage.textContent = 'Preparing...';

        const formData = new FormData();
        formData.append('file', file);

        fetch('/api/process', {
            method: 'POST',
            body: formData,
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.detail || `Server error (${response.status})`);
                });
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function readStream() {
                reader.read().then(({ done, value }) => {
                    if (done) return;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    let eventType = null;

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ') && eventType) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                handleSSEEvent(eventType, data);
                            } catch (e) {
                                // Skip malformed SSE data
                            }
                            eventType = null;
                        }
                    }

                    readStream();
                }).catch(err => {
                    showError('Connection lost during processing. Please try again.');
                });
            }

            readStream();
        })
        .catch(err => {
            showError(err.message);
        });
    }

    const STAGE_MESSAGES = {
        uploading: 'Receiving audio...',
        transcribing: 'Listening...',
        summarizing: 'Finding the decisions...',
        finalizing: 'Writing the tasks...',
    };

    function handleSSEEvent(event, data) {
        if (event === 'progress') {
            progressStage.textContent = data.message || STAGE_MESSAGES[data.stage] || 'Processing...';
        } else if (event === 'complete') {
            lastResult = data;
            renderResults(data);
            showSection(resultsSection);
        } else if (event === 'error') {
            showError(data.message);
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        showSection(errorSection);
    }

    retryBtn.addEventListener('click', resetToUpload);
    newUploadBtn.addEventListener('click', resetToUpload);

    function resetToUpload() {
        selectedFile = null;
        lastResult = null;
        fileInput.value = '';
        fileInfo.textContent = '';
        processBtn.disabled = true;
        showSection(uploadSection);
    }

    // ── Render Results ──
    function renderResults(data) {
        // Summary
        summaryBody.textContent = data.summary || 'No summary generated.';

        // Decisions
        if (data.decisions && data.decisions.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'decision-list';
            data.decisions.forEach(d => {
                const li = document.createElement('li');
                li.className = 'decision-item';
                li.innerHTML = `<span class="decision-bullet"></span><span>${escapeHtml(d)}</span>`;
                ul.appendChild(li);
            });
            decisionsBody.innerHTML = '';
            decisionsBody.appendChild(ul);
        } else {
            decisionsBody.innerHTML = '<p class="panel-empty">No key decisions identified.</p>';
        }

        // Action Items
        if (data.action_items && data.action_items.length > 0) {
            actionItemsBody.innerHTML = '';
            data.action_items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'action-card';

                const priorityClass = `priority-${item.priority || 'medium'}`;

                card.innerHTML = `
                    <div class="action-card-header">
                        <span class="action-task">${escapeHtml(item.task)}</span>
                        <span class="priority-badge ${priorityClass}">${escapeHtml(item.priority || 'medium')}</span>
                    </div>
                    <div class="action-meta">
                        <span class="action-meta-item">
                            <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" stroke-width="1.5"/></svg>
                            ${escapeHtml(item.owner || 'Unassigned')}
                        </span>
                        ${item.deadline ? `
                        <span class="action-meta-item">
                            <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" stroke-width="1.5"/></svg>
                            ${escapeHtml(item.deadline)}
                        </span>` : ''}
                    </div>
                `;
                actionItemsBody.appendChild(card);
            });
        } else {
            actionItemsBody.innerHTML = '<p class="panel-empty">No action items identified.</p>';
        }

        // Transcript
        transcriptBody.innerHTML = '';
        const segments = data.transcript?.segments;
        if (segments && segments.length > 0) {
            segments.forEach(seg => {
                const div = document.createElement('div');
                div.className = 'transcript-segment';
                div.innerHTML = `
                    <span class="transcript-time" title="Jump to ${formatTime(seg.start)}">${formatTime(seg.start)}</span>
                    <span class="transcript-text">${escapeHtml(seg.text)}</span>
                `;
                transcriptBody.appendChild(div);
            });
        } else if (data.transcript?.text) {
            const div = document.createElement('div');
            div.className = 'transcript-segment';
            div.innerHTML = `<span class="transcript-text">${escapeHtml(data.transcript.text)}</span>`;
            transcriptBody.appendChild(div);
        }
    }

    // ── Export: Slack Copy ──
    copySlackBtn.addEventListener('click', () => {
        if (!lastResult) return;

        let text = '';
        text += `*📋 Meeting Summary*\n${lastResult.summary}\n\n`;

        if (lastResult.decisions?.length) {
            text += `*✅ Key Decisions*\n`;
            lastResult.decisions.forEach(d => {
                text += `• ${d}\n`;
            });
            text += '\n';
        }

        if (lastResult.action_items?.length) {
            text += `*🎯 Action Items*\n`;
            lastResult.action_items.forEach(item => {
                let line = `• *${item.task}*`;
                line += ` → ${item.owner || 'Unassigned'}`;
                if (item.deadline) line += ` (by ${item.deadline})`;
                line += ` [${(item.priority || 'medium').toUpperCase()}]`;
                text += line + '\n';
            });
        }

        navigator.clipboard.writeText(text).then(() => {
            flashConfirm(copySlackBtn, 'Copied ✓');
        }).catch(() => {
            flashConfirm(copySlackBtn, 'Copy failed');
        });
    });

    // ── Export: Download .md ──
    downloadMdBtn.addEventListener('click', () => {
        if (!lastResult) return;

        let md = '# Meeting Summary\n\n';
        md += lastResult.summary + '\n\n';

        if (lastResult.decisions?.length) {
            md += '## Key Decisions\n\n';
            lastResult.decisions.forEach(d => {
                md += `- ${d}\n`;
            });
            md += '\n';
        }

        if (lastResult.action_items?.length) {
            md += '## Action Items\n\n';
            md += '| Task | Owner | Deadline | Priority |\n';
            md += '|------|-------|----------|----------|\n';
            lastResult.action_items.forEach(item => {
                md += `| ${item.task} | ${item.owner || 'Unassigned'} | ${item.deadline || '—'} | ${(item.priority || 'medium').toUpperCase()} |\n`;
            });
            md += '\n';
        }

        if (lastResult.transcript?.text) {
            md += '## Transcript\n\n';
            const segs = lastResult.transcript.segments;
            if (segs?.length) {
                segs.forEach(seg => {
                    md += `**[${formatTime(seg.start)}]** ${seg.text}\n\n`;
                });
            } else {
                md += lastResult.transcript.text + '\n';
            }
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meeting-summary.md';
        a.click();
        URL.revokeObjectURL(url);

        flashConfirm(downloadMdBtn, 'Downloaded ✓');
    });

    // ── Helpers ──
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function flashConfirm(btn, text) {
        const flash = document.createElement('span');
        flash.className = 'confirm-flash';
        flash.textContent = text;
        btn.appendChild(flash);
        setTimeout(() => flash.remove(), 1500);
    }

    // ── Init ──
    initHeroWaveform();

})();
