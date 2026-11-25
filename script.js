/**
 * SPAMSHIELD // Professional Email Spam Predictor UI Controller
 * Faithful implementation of the Figma specification with live FastAPI integration.
 */

// Configuration: use same-origin when served by FastAPI/Render, else local backend.
const RENDER_API_URL = 'https://email-spam-classifier-iz02.onrender.com';
const API_URL = (() => {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:') {
        return 'http://127.0.0.1:8000';
    }
    if (port === '8000' || hostname.endsWith('.onrender.com')) {
        return origin;
    }
    if (['localhost', '127.0.0.1'].includes(hostname)) {
        return 'http://127.0.0.1:8000';
    }
    // Static hosts (e.g. GitHub Pages) point to the deployed Render backend.
    return RENDER_API_URL;
})();

const HEALTH_TIMEOUT_MS = 5000;
const PREDICT_TIMEOUT_MS = 15000;

// Sample Emails Library matching the Figma design
const EMAIL_SAMPLES = {
    'spam-walmart': {
        sender: 'promo-rewards@exclusive-giftcard-deals.com',
        subject: 'Claim your complimentary $1,000 Walmart Gift Card Now!',
        body: `Congratulations!\n\nYou have been selected to receive an exclusive $1,000 Walmart Reward. This offer is only available for the next 24 hours.\n\nClick the link below to enter your details and claim your prize. No purchase necessary.\n\nhttp://claim-your-reward-now.com/winner`
    },
    'spam-bank': {
        sender: 'security-notice@bank-verification-dept.net',
        subject: 'URGENT ACTION REQUIRED: Account suspended',
        body: `Dear Customer,\n\nWe detected unauthorized access attempts on your debit card profile. To protect your funds, your card access has been temporarily locked.\n\nPlease confirm your identity immediately within 12 hours:\nhttp://secure-bank-login-verify.com/restore-access\n\nFailure to verify will result in permanent suspension.`
    },
    'ham-meeting': {
        sender: 'alex.morgan@company.internal',
        subject: 'Q3 Product Review & Sprint Planning Sync',
        body: `Hi team,\n\nHere is the agenda for our upcoming product review meeting scheduled for tomorrow at 2:00 PM in Conference Room B.\n\nPlease take a look at the attached roadmap slides and let me know if you have any questions or agenda additions prior to the session.\n\nBest regards,\nAlex`
    },
    'ham-delivery': {
        sender: 'auto-confirm@amazon.com',
        subject: 'Your Amazon Order #402-9812492 has shipped',
        body: `Hello,\n\nYour package containing the requested items has shipped and is scheduled for delivery by 8:00 PM tomorrow.\n\nYou can track the shipment progress or manage your delivery preferences in the official Amazon mobile app.\n\nThank you for shopping with us.`
    }
};

// DOM References
const senderInput = document.getElementById('senderInput');
const subjectInput = document.getElementById('subjectInput');
const bodyInput = document.getElementById('bodyInput');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');

const sampleDropdownBtn = document.getElementById('sampleDropdownBtn');
const sampleMenu = document.getElementById('sampleMenu');
const clearFormBtn = document.getElementById('clearFormBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const resultPanel = document.getElementById('resultPanel');
const verdictBadgeText = document.getElementById('verdictBadgeText');
const riskTitle = document.getElementById('riskTitle');
const confPercent = document.getElementById('confPercent');
const progressBar = document.getElementById('progressBar');

const triggerUrgency = document.getElementById('triggerUrgency');
const urgencyDesc = document.getElementById('urgencyDesc');
const triggerFinancial = document.getElementById('triggerFinancial');
const financialDesc = document.getElementById('financialDesc');
const triggerLink = document.getElementById('triggerLink');
const linkDesc = document.getElementById('linkDesc');
const triggerSender = document.getElementById('triggerSender');
const senderDesc = document.getElementById('senderDesc');

const statusPing = document.getElementById('statusPing');
const statusLabel = document.getElementById('statusLabel');

// Developer Modal
const openDevModalBtn = document.getElementById('openDevModalBtn');
const closeDevModalBtn = document.getElementById('closeDevModalBtn');
const devModal = document.getElementById('devModal');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// In-flight request tracking to prevent stale UI updates on clear/re-run
let activeAnalyzeController = null;
let analysisGeneration = 0;

// Trigger SVG Icons
const ICON_ALERT_SVG = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`;

const ICON_SAFE_SVG = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="m9 12 2 2 4-4"/>
    </svg>`;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    syncDeveloperSnippets();
    checkEngineHealth();
    bindEvents();

    // Preload default sample to match Figma initial visual mockup
    loadSample('spam-walmart');
    analyzeEmail();
});

function syncDeveloperSnippets() {
    const predictUrl = `${API_URL}/predict`;
    document.querySelectorAll('#devModal pre code').forEach(codeEl => {
        const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue.includes('http://127.0.0.1:8000/predict')) {
                node.nodeValue = node.nodeValue.replace(/http:\/\/127\.0\.0\.1:8000\/predict/g, predictUrl);
            }
        }
    });
}

function bindEvents() {
    // Body text counters (displays character/word counts for the email body textarea)
    bodyInput.addEventListener('input', updateTextMetrics);

    // Sample dropdown toggle
    sampleDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sampleMenu.classList.toggle('active');
        sampleDropdownBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', () => {
        sampleMenu.classList.remove('active');
        sampleDropdownBtn.setAttribute('aria-expanded', 'false');
    });

    // Sample menu items
    document.querySelectorAll('.sample-item').forEach(item => {
        item.addEventListener('click', () => {
            const key = item.getAttribute('data-sample');
            loadSample(key);
            sampleMenu.classList.remove('active');
            sampleDropdownBtn.setAttribute('aria-expanded', 'false');
            analyzeEmail();
        });
    });

    // Clear form
    clearFormBtn.addEventListener('click', resetForm);

    // Analyze button & Keyboard Shortcuts
    analyzeBtn.addEventListener('click', analyzeEmail);
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (devModal.classList.contains('active') || analyzeBtn.disabled) {
                return;
            }
            e.preventDefault();
            analyzeEmail();
        } else if (e.key === 'Escape') {
            sampleMenu.classList.remove('active');
            sampleDropdownBtn.setAttribute('aria-expanded', 'false');
            devModal.classList.remove('active');
        }
    });

    // Developer Modal
    openDevModalBtn.addEventListener('click', () => devModal.classList.add('active'));
    closeDevModalBtn.addEventListener('click', () => devModal.classList.remove('active'));
    devModal.addEventListener('click', (e) => {
        if (e.target === devModal) devModal.classList.remove('active');
    });

    // Modal Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.getAttribute('data-tab'));
            if (target) target.classList.add('active');
        });
    });
}

// ==========================================================================
// Form & Metrics Logic
// ==========================================================================
function loadSample(key) {
    const sample = EMAIL_SAMPLES[key];
    if (sample) {
        senderInput.value = sample.sender;
        subjectInput.value = sample.subject;
        bodyInput.value = sample.body;
        updateTextMetrics();
    }
}

function updateTextMetrics() {
    const text = bodyInput.value;
    charCount.textContent = text.length;

    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCount.textContent = words;
}

function setTriggerState(rowEl, descEl, state, description) {
    const iconEl = rowEl.querySelector('.trigger-icon');
    descEl.textContent = description;

    if (state === 'threat') {
        rowEl.className = 'trigger-row active-threat';
        iconEl.className = 'trigger-icon alert';
        iconEl.innerHTML = ICON_ALERT_SVG;
    } else if (state === 'safe') {
        rowEl.className = 'trigger-row active-safe';
        iconEl.className = 'trigger-icon safe';
        iconEl.innerHTML = ICON_SAFE_SVG;
    } else {
        rowEl.className = 'trigger-row';
        iconEl.className = 'trigger-icon neutral';
        iconEl.innerHTML = ICON_ALERT_SVG;
    }
}

function resetForm() {
    // Cancel any in-flight prediction so it cannot overwrite the reset UI
    analysisGeneration += 1;
    if (activeAnalyzeController) {
        activeAnalyzeController.abort();
        activeAnalyzeController = null;
    }
    setLoadingState(false);

    senderInput.value = '';
    subjectInput.value = '';
    bodyInput.value = '';
    updateTextMetrics();

    // Reset Result Panel to Idle State
    resultPanel.className = 'panel-card result-panel';
    verdictBadgeText.textContent = 'Awaiting input';
    riskTitle.textContent = 'Ready to evaluate';
    confPercent.textContent = '--%';
    progressBar.style.width = '0%';
    progressBar.style.opacity = '1';

    setTriggerState(triggerUrgency, urgencyDesc, 'neutral', 'No immediate urgency phrases detected');
    setTriggerState(triggerFinancial, financialDesc, 'neutral', 'No prize or reward offers identified');
    setTriggerState(triggerLink, linkDesc, 'neutral', 'No external hyperlink anomalies found');
    setTriggerState(triggerSender, senderDesc, 'neutral', 'No sender address provided');

    bodyInput.focus();
}

// ==========================================================================
// Backend Health Check
// ==========================================================================
async function checkEngineHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

        const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            statusPing.className = 'status-ping online';
            statusLabel.textContent = 'ML Engine Active';
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (e) {
        statusPing.className = 'status-ping offline';
        statusLabel.textContent = 'Engine Offline (Standby)';
    }
}

setInterval(checkEngineHealth, 15000);

// ==========================================================================
// Prediction & Trigger Analysis
// ==========================================================================
async function analyzeEmail() {
    const sender = senderInput.value.trim();
    const subject = subjectInput.value.trim();
    const body = bodyInput.value.trim();

    if (!body && !subject) {
        showToast('Please enter an email body or subject line to analyze.');
        bodyInput.focus();
        return;
    }

    // Build classification text for the NLP pipeline
    const combinedText = subject && body ? `${subject}. ${body}` : (subject || body);

    // Abort any earlier request and track this request's generation
    if (activeAnalyzeController) {
        activeAnalyzeController.abort();
    }
    const currentGen = ++analysisGeneration;
    const controller = new AbortController();
    activeAnalyzeController = controller;

    setLoadingState(true);

    try {
        let predictionResult = null;
        let timeoutId = null;

        // Call FastAPI Backend
        try {
            timeoutId = setTimeout(() => controller.abort(), PREDICT_TIMEOUT_MS);

            const response = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: combinedText }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                predictionResult = await response.json();
                if (currentGen === analysisGeneration) {
                    statusPing.className = 'status-ping online';
                    statusLabel.textContent = 'ML Engine Active';
                }
            }
        } catch (apiError) {
            if (timeoutId) clearTimeout(timeoutId);
            if (currentGen !== analysisGeneration) {
                return; // Form was cleared or a newer request superseded this one
            }
            console.warn('API server unreachable, fallback active:', apiError);
            statusPing.className = 'status-ping offline';
            statusLabel.textContent = 'Engine Offline (Standby)';
        }

        if (currentGen !== analysisGeneration) {
            return;
        }

        // If backend is offline, run intelligent heuristic simulation
        if (!predictionResult) {
            predictionResult = simulateModelFallback(combinedText, sender);
            showToast('FastAPI offline: simulated using local rule engine.');
        }

        // Render Verdict
        renderVerdict(predictionResult, combinedText, sender);

    } catch (err) {
        if (currentGen !== analysisGeneration) {
            return;
        }
        console.error('Classification error:', err);
        if (!resultPanel.classList.contains('state-spam') && !resultPanel.classList.contains('state-ham')) {
            progressBar.style.width = '0%';
        }
        showToast('An unexpected error occurred during classification.');
    } finally {
        if (currentGen === analysisGeneration) {
            activeAnalyzeController = null;
            setLoadingState(false);
        }
    }
}

function renderVerdict(result, text, sender = '') {
    const isSpam = String(result?.prediction || '').toLowerCase() === 'spam';
    const rawConf = Number(result?.confidence);
    const confScore = Number.isFinite(rawConf)
        ? Math.max(0, Math.min(100, Math.round(rawConf * 100)))
        : 0;

    // Apply Panel State
    resultPanel.className = `panel-card result-panel ${isSpam ? 'state-spam' : 'state-ham'}`;

    // Verdict Badge & Risk Title
    verdictBadgeText.textContent = isSpam ? 'Spam detected' : 'Safe email (Ham)';
    riskTitle.textContent = isSpam ? 'High risk' : 'Low risk';

    // Confidence Score & Bar
    confPercent.textContent = `${confScore}%`;
    progressBar.style.width = `${confScore}%`;

    // Lexical & Sender Trigger Inspection
    evaluateTriggers(text, isSpam, sender);
}

function evaluateTriggers(text, isSpam, sender = '') {
    // 1. Urgency & Deadlines (word-boundary matches to avoid false positives like "blocked")
    const urgencyRegexes = [
        { label: '24 hours', re: /\b24\s*hours?\b/i },
        { label: '12 hours', re: /\b12\s*hours?\b/i },
        { label: 'expires', re: /\bexpires?\b/i },
        { label: 'immediately', re: /\bimmediately\b/i },
        { label: 'urgent', re: /\burgent(?:ly)?\b/i },
        { label: 'deadline', re: /\bdeadline\b/i },
        { label: 'act now', re: /\bact now\b/i },
        { label: 'suspended', re: /\bsuspend(?:ed|sion)?\b/i },
        { label: 'account locked', re: /\b(?:account|card(?:\s+access)?)\s+(?:has been\s+)?(?:temporarily\s+)?locked\b/i },
        { label: 'limited time', re: /\blimited time\b/i }
    ];
    const foundUrgency = urgencyRegexes.filter(p => p.re.test(text)).map(p => p.label);

    if (foundUrgency.length > 0) {
        setTriggerState(
            triggerUrgency,
            urgencyDesc,
            'threat',
            `Phrases like "${foundUrgency.slice(0, 2).join('", "')}" detected.`
        );
    } else {
        setTriggerState(
            triggerUrgency,
            urgencyDesc,
            isSpam ? 'neutral' : 'safe',
            isSpam ? 'Moderate urgency distribution' : 'Normal tone; no coercive urgency patterns.'
        );
    }

    // 2. Financial Incentives
    const financialRegexes = [
        { label: 'cash amount', re: /\$\s*\d[\d,]*(?:\.\d{2})?/i },
        { label: 'gift card', re: /\bgift\s*card\b/i },
        { label: 'reward', re: /\brewards?\b/i },
        { label: 'cash bonus', re: /\bcash(?:\s+bonus)?\b/i },
        { label: 'prize', re: /\bprizes?\b/i },
        { label: 'winner', re: /\bwinner\b/i },
        { label: 'bonus', re: /\bbonus\b/i },
        { label: 'free offer', re: /\bfree\s+(?:gift|offer|trial|money|card|prize)\b/i },
        { label: 'complimentary', re: /\bcomplimentary\b/i }
    ];
    const foundFinancial = financialRegexes.filter(p => p.re.test(text)).map(p => p.label);

    if (foundFinancial.length > 0) {
        setTriggerState(
            triggerFinancial,
            financialDesc,
            'threat',
            `Mentions of "${foundFinancial.slice(0, 2).join('", "')}" detected.`
        );
    } else {
        setTriggerState(
            triggerFinancial,
            financialDesc,
            isSpam ? 'neutral' : 'safe',
            isSpam ? 'No explicit financial terms' : 'Standard message without promotional offers.'
        );
    }

    // 3. Unverified Links
    const hasInsecureHttp = /\bhttp:\/\/\S+/i.test(text);
    const hasHttpsLink = /\bhttps:\/\/\S+/i.test(text);
    const hasActionLinkPhrase = /\b(?:click\s+(?:here|the\s+link)|link\s+below|verify-link|restore-access)\b/i.test(text);

    if (hasInsecureHttp || hasActionLinkPhrase || (isSpam && hasHttpsLink)) {
        const msg = hasInsecureHttp
            ? 'Insecure HTTP external hyperlink detected.'
            : 'Action-prompting external link identified.';
        setTriggerState(triggerLink, linkDesc, 'threat', msg);
    } else if (hasHttpsLink) {
        setTriggerState(triggerLink, linkDesc, 'safe', 'HTTPS link present without phishing phrases.');
    } else {
        setTriggerState(
            triggerLink,
            linkDesc,
            isSpam ? 'neutral' : 'safe',
            isSpam ? 'No direct links present' : 'No suspicious external hyperlinks detected.'
        );
    }

    // 4. Sender Reputation
    if (!sender) {
        setTriggerState(triggerSender, senderDesc, 'neutral', 'No sender address provided');
    } else {
        const senderLower = sender.toLowerCase();
        const domain = senderLower.includes('@') ? senderLower.split('@').pop() : senderLower;
        const suspiciousSenderRe = /\b(reward|promo|giftcard|verify|verification|deals|winner|claim)\b/i;
        const hasManyHyphens = (domain.match(/-/g) || []).length >= 2;

        if (suspiciousSenderRe.test(senderLower) || hasManyHyphens) {
            setTriggerState(
                triggerSender,
                senderDesc,
                'threat',
                `Suspicious sender pattern in "${domain}".`
            );
        } else {
            setTriggerState(
                triggerSender,
                senderDesc,
                'safe',
                `Sender domain "${domain}" has no obvious spoofing indicators.`
            );
        }
    }
}

function simulateModelFallback(text, sender = '') {
    let spamScore = 0;

    if (/\$\s*\d|\b(?:prize|winner|reward|gift\s*card|complimentary)\b/i.test(text)) spamScore += 0.35;
    if (/\b(?:urgent|24\s*hours|12\s*hours|immediately|suspended|locked)\b/i.test(text)) spamScore += 0.35;
    if (/\bhttp:\/\/|\b(?:click\s+(?:here|the\s+link)|claim\s+your)\b/i.test(text)) spamScore += 0.25;
    if (sender && /\b(reward|promo|giftcard|verification|deals)\b/i.test(sender)) spamScore += 0.15;

    const isSpam = spamScore >= 0.45;
    const confidence = isSpam ? Math.min(0.99, 0.70 + spamScore * 0.25) : 0.98;

    return {
        prediction: isSpam ? 'spam' : 'ham',
        confidence: Number(confidence.toFixed(4))
    };
}

function setLoadingState(loading) {
    if (loading) {
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing...';
        progressBar.style.width = '100%';
        progressBar.style.opacity = '0.5';
    } else {
        analyzeBtn.disabled = false;
        analyzeBtn.querySelector('.btn-text').textContent = 'Analyze email';
        progressBar.style.opacity = '1';
    }
}

// ==========================================================================
// Toast Utility
// ==========================================================================
function showToast(msg) {
    const container = document.getElementById('toastContainer');
    // Replace any existing identical toast so rapid retries do not stack
    container.querySelectorAll('.toast').forEach(existing => {
        if (existing.textContent.trim() === msg) {
            existing.remove();
        }
    });

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
    `;
    const span = document.createElement('span');
    span.textContent = msg;
    toast.appendChild(span);

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}
