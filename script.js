/**
 * SPAMSHIELD // Professional Email Spam Predictor UI Controller
 * Faithful implementation of the Figma specification with live FastAPI integration.
 */

// Configuration

const API_URL =  "https://email-spam-classifier-iz02.onrender.com"

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
const verdictBadge = document.getElementById('verdictBadge');
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

const statusPing = document.getElementById('statusPing');
const statusLabel = document.getElementById('statusLabel');

// Developer Modal
const openDevModalBtn = document.getElementById('openDevModalBtn');
const closeDevModalBtn = document.getElementById('closeDevModalBtn');
const devModal = document.getElementById('devModal');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    checkEngineHealth();
    bindEvents();
    
    // Preload default sample to match Figma initial visual mockup
    loadSample('spam-walmart');
    analyzeEmail();
});

function bindEvents() {
    // Text counters
    bodyInput.addEventListener('input', updateTextMetrics);
    subjectInput.addEventListener('input', updateTextMetrics);

    // Sample dropdown toggle
    sampleDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sampleMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        sampleMenu.classList.remove('active');
    });

    // Sample menu items
    document.querySelectorAll('.sample-item').forEach(item => {
        item.addEventListener('click', () => {
            const key = item.getAttribute('data-sample');
            loadSample(key);
            sampleMenu.classList.remove('active');
            analyzeEmail();
        });
    });

    // Clear form
    clearFormBtn.addEventListener('click', resetForm);

    // Analyze button & Shortcut
    analyzeBtn.addEventListener('click', analyzeEmail);
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            analyzeEmail();
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

function resetForm() {
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

    triggerUrgency.className = 'trigger-row';
    urgencyDesc.textContent = 'No immediate urgency phrases detected';
    triggerFinancial.className = 'trigger-row';
    financialDesc.textContent = 'No prize or reward offers identified';
    triggerLink.className = 'trigger-row';
    linkDesc.textContent = 'No external hyperlink anomalies found';

    bodyInput.focus();
}

// ==========================================================================
// Backend Health Check
// ==========================================================================
async function checkEngineHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            statusPing.className = 'status-ping online';
            statusLabel.textContent = 'ML Engine Active';
        } else {
            throw new Error('Non-200 status');
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
    const subject = subjectInput.value.trim();
    const body = bodyInput.value.trim();

    if (!body && !subject) {
        showToast('Please enter an email body or subject line to analyze.');
        bodyInput.focus();
        return;
    }

    // Build classification text for the NLP pipeline
    const combinedText = subject ? `${subject}. ${body}` : body;

    // Loading State
    setLoadingState(true);

    try {
        let predictionResult = null;

        // Call FastAPI Backend
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const response = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: combinedText }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                predictionResult = await response.json();
                statusPing.className = 'status-ping online';
                statusLabel.textContent = 'ML Engine Active';
            }
        } catch (apiError) {
            console.warn('API server unreachable, fallback active:', apiError);
            statusPing.className = 'status-ping offline';
            statusLabel.textContent = 'Engine Offline (Standby)';
        }

        // If backend is offline, run intelligent heuristic simulation
        if (!predictionResult) {
            predictionResult = simulateModelFallback(combinedText);
            showToast('FastAPI offline: simulated using local rule engine.');
        }

        // Render Verdict
        renderVerdict(predictionResult, combinedText);

    } catch (err) {
        console.error('Classification error:', err);
        showToast('An unexpected error occurred during classification.');
    } finally {
        setLoadingState(false);
    }
}

function renderVerdict(result, text) {
    const isSpam = result.prediction.toLowerCase() === 'spam';
    const confScore = Math.round(result.confidence * 100);

    // Apply Panel State
    resultPanel.className = `panel-card result-panel ${isSpam ? 'state-spam' : 'state-ham'}`;

    // Verdict Badge
    verdictBadgeText.textContent = isSpam ? 'Spam detected' : 'Safe email (Ham)';

    // Risk Title
    riskTitle.textContent = isSpam ? 'High risk' : 'Low risk';

    // Confidence Score & Bar
    confPercent.textContent = `${confScore}%`;
    progressBar.style.width = `${confScore}%`;

    // Lexical Trigger Inspection
    evaluateTriggers(text, isSpam);
}

function evaluateTriggers(text, isSpam) {
    const lower = text.toLowerCase();

    // 1. Urgency & Deadlines
    const urgencyPatterns = ['24 hours', '12 hours', 'expires', 'immediately', 'urgent', 'deadline', 'act now', 'suspended', 'locked', 'limited time'];
    const foundUrgency = urgencyPatterns.filter(p => lower.includes(p));

    if (foundUrgency.length > 0) {
        triggerUrgency.className = 'trigger-row active-threat';
        urgencyDesc.textContent = `Phrases like "${foundUrgency.slice(0, 2).join('", "')}" detected.`;
    } else {
        triggerUrgency.className = isSpam ? 'trigger-row' : 'trigger-row active-safe';
        urgencyDesc.textContent = isSpam ? 'Moderate urgency distribution' : 'Normal tone; no coercive urgency patterns.';
    }

    // 2. Financial Incentives
    const financialPatterns = ['$1,000', '$1000', '$', 'dollar', 'gift card', 'reward', 'cash', 'prize', 'winner', 'claim your prize', 'bonus', 'free'];
    const foundFinancial = financialPatterns.filter(p => lower.includes(p));

    if (foundFinancial.length > 0) {
        triggerFinancial.className = 'trigger-row active-threat';
        financialDesc.textContent = `Mentions of "${foundFinancial.slice(0, 2).join('", "')}" detected.`;
    } else {
        triggerFinancial.className = isSpam ? 'trigger-row' : 'trigger-row active-safe';
        financialDesc.textContent = isSpam ? 'No explicit financial terms' : 'Standard message without promotional offers.';
    }

    // 3. Unverified Links
    const linkPatterns = ['http://', 'https://', '.com/', '.net/', 'click here', 'link below', 'verify-link'];
    const hasLinks = linkPatterns.some(p => lower.includes(p));

    if (hasLinks) {
        triggerLink.className = 'trigger-row active-threat';
        triggerLink.querySelector('.trigger-desc').textContent = lower.includes('http://')
            ? 'Insecure HTTP external hyperlink detected.'
            : 'Action-prompting external link identified.';
    } else {
        triggerLink.className = isSpam ? 'trigger-row' : 'trigger-row active-safe';
        triggerLink.querySelector('.trigger-desc').textContent = isSpam
            ? 'No direct links present'
            : 'No suspicious external hyperlinks detected.';
    }
}

function simulateModelFallback(text) {
    const lower = text.toLowerCase();
    let spamScore = 0;

    if (lower.includes('$') || lower.includes('prize') || lower.includes('winner') || lower.includes('reward')) spamScore += 0.35;
    if (lower.includes('urgent') || lower.includes('24 hours') || lower.includes('immediately') || lower.includes('suspended')) spamScore += 0.35;
    if (lower.includes('http://') || lower.includes('click') || lower.includes('claim')) spamScore += 0.25;

    const isSpam = spamScore >= 0.45;
    const confidence = isSpam ? Math.min(0.99, 0.70 + spamScore * 0.3) : 0.98;

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
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>${msg}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}
