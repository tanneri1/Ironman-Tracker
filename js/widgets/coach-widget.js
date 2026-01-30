// AI Coach Floating Widget
import { authService } from '../services/auth.js';
import { coachService } from '../services/coach.js';
import { escapeHtml } from '../utils.js';

let initialized = false;
let panelOpen = false;

export function initWidget() {
    if (initialized) return;
    initialized = true;

    // Inject widget DOM
    const widget = document.createElement('div');
    widget.id = 'coach-widget';
    widget.innerHTML = `
        <button class="coach-bubble" aria-label="Open AI Coach">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
        </button>
        <div class="coach-panel">
            <div class="coach-panel-header">
                <span class="coach-panel-title">AI Coach</span>
                <button class="coach-panel-close" aria-label="Close">&times;</button>
            </div>
            <div class="coach-panel-body">
                <div id="coach-messages" class="chat-messages">
                    <div class="chat-message assistant">
                        Hi! I'm your AI triathlon coach. Ask me anything about your Ironman preparation!
                    </div>
                </div>
                <div class="coach-quick-questions">
                    <button class="btn btn-secondary btn-sm quick-question" data-question="How am I doing this week?">This week?</button>
                    <button class="btn btn-secondary btn-sm quick-question" data-question="Am I eating enough for my training load?">Eating enough?</button>
                    <button class="btn btn-secondary btn-sm quick-question" data-question="What should I focus on in my next training block?">Focus next?</button>
                    <button class="btn btn-secondary btn-sm quick-question" data-question="How should I structure my taper before race day?">Taper advice</button>
                </div>
                <form id="coach-form" class="chat-input-container">
                    <input type="text" id="coach-input" class="form-input chat-input" placeholder="Ask your coach..." autocomplete="off">
                    <button type="submit" class="btn btn-primary btn-sm">Send</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    // Wire up events
    widget.querySelector('.coach-bubble').addEventListener('click', togglePanel);
    widget.querySelector('.coach-panel-close').addEventListener('click', togglePanel);
    document.getElementById('coach-form').addEventListener('submit', handleSendMessage);

    widget.querySelectorAll('.quick-question').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('coach-input').value = btn.dataset.question;
            document.getElementById('coach-form').dispatchEvent(new Event('submit'));
        });
    });

    // Load existing session
    loadSession();
}

async function loadSession() {
    const userId = authService.getUserId();
    try {
        await coachService.getOrCreateSession(userId);
        renderMessages();
    } catch (error) {
        console.error('Failed to load coaching session:', error);
    }
}

function togglePanel() {
    panelOpen = !panelOpen;
    const panel = document.querySelector('.coach-panel');
    const bubble = document.querySelector('.coach-bubble');
    panel.classList.toggle('open', panelOpen);
    bubble.classList.toggle('active', panelOpen);

    if (panelOpen) {
        const container = document.getElementById('coach-messages');
        container.scrollTop = container.scrollHeight;
    }
}

function renderMessages() {
    const messages = coachService.getMessages();
    const container = document.getElementById('coach-messages');

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-message assistant">
                Hi! I'm your AI triathlon coach. Ask me anything about your Ironman preparation!
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.role}">
            ${formatMessage(msg.content)}
        </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
}

function formatMessage(content) {
    return escapeHtml(content)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

async function handleSendMessage(e) {
    e.preventDefault();

    const input = document.getElementById('coach-input');
    const message = input.value.trim();
    if (!message) return;

    const userId = authService.getUserId();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const messagesContainer = document.getElementById('coach-messages');

    messagesContainer.innerHTML += `
        <div class="chat-message user">${escapeHtml(message)}</div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    messagesContainer.innerHTML += `
        <div class="chat-message assistant" id="coach-typing">
            <em>Coach is thinking...</em>
        </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    input.value = '';
    input.disabled = true;
    submitBtn.disabled = true;

    try {
        const response = await coachService.sendMessage(userId, message);
        document.getElementById('coach-typing')?.remove();
        messagesContainer.innerHTML += `
            <div class="chat-message assistant">${formatMessage(response)}</div>
        `;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        document.getElementById('coach-typing')?.remove();
        messagesContainer.innerHTML += `
            <div class="chat-message assistant text-error">
                Sorry, I couldn't process that. Please try again.
            </div>
        `;
    } finally {
        input.disabled = false;
        submitBtn.disabled = false;
        input.focus();
    }
}
