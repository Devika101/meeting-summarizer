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
            
            // Enable Chatbot
            chatInput.disabled = false;
            chatSubmit.disabled = false;
            addMessage("I've read the transcript. What would you like to know?", false);
            chatWidget.classList.remove('hidden');
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
    // Headline Letter Hover Ripple Effect
    const hl = document.querySelector('.hero-headline');
    if (hl) {
        const text = hl.innerText;
        hl.innerHTML = '';
        const allSpans = [];
        
        // Split by words first so they don't break across lines
        text.split(' ').forEach((word, wordIndex, array) => {
            const wordSpan = document.createElement('span');
            wordSpan.style.whiteSpace = 'nowrap';
            wordSpan.style.display = 'inline-block';
            
            word.split('').forEach((char) => {
                const charSpan = document.createElement('span');
                charSpan.className = 'char-span';
                charSpan.innerText = char;
                wordSpan.appendChild(charSpan);
                allSpans.push(charSpan);
            });
            
            hl.appendChild(wordSpan);
            if (wordIndex < array.length - 1) {
                hl.appendChild(document.createTextNode(' '));
            }
        });

        allSpans.forEach((span, index) => {
            span.addEventListener('mouseenter', () => {
                if (index > 0) allSpans[index - 1].classList.add('wave-neighbor');
                if (index < allSpans.length - 1) allSpans[index + 1].classList.add('wave-neighbor');
            });
            span.addEventListener('mouseleave', () => {
                if (index > 0) allSpans[index - 1].classList.remove('wave-neighbor');
                if (index < allSpans.length - 1) allSpans[index + 1].classList.remove('wave-neighbor');
            });
        });
    }
    
    // Chatbot Logic
    const chatToggleBtn = $('chatToggleBtn');
    const chatPanel = $('chatPanel');
    const chatCloseBtn = $('chatCloseBtn');
    const chatInput = $('chatInput');
    const chatSubmit = $('chatSubmit');
    const chatMessages = $('chatMessages');
    
    let isChatOpen = false;

    function toggleChat() {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatPanel.classList.add('active');
            chatInput.focus();
        } else {
            chatPanel.classList.remove('active');
        }
    }

    chatToggleBtn.addEventListener('click', toggleChat);
    chatCloseBtn.addEventListener('click', toggleChat);

    function addMessage(text, isUser) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg ' + (isUser ? 'msg-user' : 'msg-bot');
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendChatMessage() {
        const msg = chatInput.value.trim();
        if (!msg || !lastResult) return;
        
        chatInput.value = '';
        chatInput.disabled = true;
        chatSubmit.disabled = true;
        
        addMessage(msg, true);
        
        // Prepare context
        const contextString = `Summary: ${lastResult.summary}\nDecisions: ${lastResult.decisions?.join(',')}\nTranscript: ${lastResult.transcript?.text?.substring(0, 5000)}`;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: msg, context: contextString })
            });
            const data = await res.json();
            if (data.response) {
                addMessage(data.response, false);
            } else {
                addMessage("Oops, something went wrong.", false);
            }
        } catch (e) {
            addMessage("Error connecting to chat.", false);
        }
        
        chatInput.disabled = false;
        chatSubmit.disabled = false;
        chatInput.focus();
    }

    chatSubmit.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Original init calls
    initHeroWaveform();

    // ── Interactive Particle Background ──
    (function initParticles() {
        const canvas = document.getElementById('particleCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let W, H;
        let mouse = { x: null, y: null };
        const PARTICLE_COUNT = 70;
        const CONNECTION_DIST = 120;
        const MOUSE_RADIUS = 150;
        const particles = [];

        function resize() {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        // Track mouse
        document.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });
        document.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });

        // Particle class
        class Particle {
            constructor() {
                this.x = Math.random() * W;
                this.y = Math.random() * H;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = (Math.random() - 0.5) * 0.4;
                this.radius = Math.random() * 3 + 1.5;
                this.baseAlpha = Math.random() * 0.4 + 0.1;
            }
            update() {
                // Mouse repulsion
                if (mouse.x !== null && mouse.y !== null) {
                    const dx = this.x - mouse.x;
                    const dy = this.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MOUSE_RADIUS) {
                        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.02;
                        this.vx += (dx / dist) * force;
                        this.vy += (dy / dist) * force;
                    }
                }

                this.x += this.vx;
                this.y += this.vy;

                // Dampen velocity
                this.vx *= 0.999;
                this.vy *= 0.999;

                // Wrap edges
                if (this.x < 0) this.x = W;
                if (this.x > W) this.x = 0;
                if (this.y < 0) this.y = H;
                if (this.y > H) this.y = 0;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${this.baseAlpha})`;
                ctx.fill();
            }
        }

        // Create particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push(new Particle());
        }

        function drawConnections() {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
                        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
        }

        function animate() {
            ctx.clearRect(0, 0, W, H);
            particles.forEach(p => { p.update(); p.draw(); });
            drawConnections();
            requestAnimationFrame(animate);
        }

        animate();
    })();

})();
