// AI Coach Page
import { authService } from '../services/auth.js';
import { coachService } from '../services/coach.js';
import { escapeHtml } from '../utils.js';

export async function render() {
    return `
        <h1 class="page-title">AI Coach</h1>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Your Personal Triathlon Coach</h2>
                <button id="clear-chat" class="btn btn-secondary btn-sm">Clear Chat</button>
            </div>
            <p class="text-muted mb-md">
                Ask questions about your training, nutrition, race preparation, or get feedback on your progress.
                The coach has access to your recent workout and nutrition data.
            </p>

            <div class="chat-container">
                <div id="chat-messages" class="chat-messages">
                    <div class="chat-message assistant">
                        Hi! I'm your AI triathlon coach. I can see your recent training and nutrition data.
                        Ask me anything about your Ironman preparation - training advice, nutrition tips,
                        recovery strategies, or feedback on your progress!
                    </div>
                </div>
                <form id="chat-form" class="chat-input-container">
                    <input
                        type="text"
                        id="chat-input"
                        class="form-input chat-input"
                        placeholder="Ask your coach a question..."
                        autocomplete="off"
                    >
                    <button type="submit" class="btn btn-primary">Send</button>
                </form>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Quick Questions</h2>
            </div>
            <div class="flex gap-sm" style="flex-wrap: wrap;">
                <button class="btn btn-secondary quick-question" data-question="How am I doing this week?">
                    How am I doing this week?
                </button>
                <button class="btn btn-secondary quick-question" data-question="Am I eating enough for my training load?">
                    Am I eating enough?
                </button>
                <button class="btn btn-secondary quick-question" data-question="What should I focus on in my next training block?">
                    What should I focus on next?
                </button>
                <button class="btn btn-secondary quick-question" data-question="How should I structure my taper before race day?">
                    Taper advice
                </button>
                <button class="btn btn-secondary quick-question" data-question="What's a good race day nutrition strategy for an Ironman?">
                    Race nutrition tips
                </button>
            </div>
        </div>
    `;
}

export async function init() {
    const userId = authService.getUserId();

    // Load existing session
    try {
        await coachService.getOrCreateSession(userId);
        renderMessages();
    } catch (error) {
        console.error('Failed to load coaching session:', error);
    }

    // Chat form submission
    document.getElementById('chat-form').addEventListener('submit', handleSendMessage);

    // Clear chat button
    document.getElementById('clear-chat').addEventListener('click', handleClearChat);

    // Quick question buttons
    document.querySelectorAll('.quick-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.dataset.question;
            document.getElementById('chat-input').value = question;
            document.getElementById('chat-form').dispatchEvent(new Event('submit'));
        });
    });
}

function renderMessages() {
    const messages = coachService.getMessages();
    const container = document.getElementById('chat-messages');

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-message assistant">
                Hi! I'm your AI triathlon coach. I can see your recent training and nutrition data.
                Ask me anything about your Ironman preparation - training advice, nutrition tips,
                recovery strategies, or feedback on your progress!
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.role}">
            ${formatMessage(msg.content)}
        </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function formatMessage(content) {
    // Simple markdown-like formatting
    return escapeHtml(content)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

async function handleSendMessage(e) {
    e.preventDefault();

    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    const userId = authService.getUserId();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const messagesContainer = document.getElementById('chat-messages');

    // Add user message to UI immediately
    messagesContainer.innerHTML += `
        <div class="chat-message user">${escapeHtml(message)}</div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show typing indicator
    messagesContainer.innerHTML += `
        <div class="chat-message assistant" id="typing-indicator">
            <em>Coach is thinking...</em>
        </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    input.value = '';
    input.disabled = true;
    submitBtn.disabled = true;

    try {
        const response = await coachService.sendMessage(userId, message);

        // Remove typing indicator and add response
        document.getElementById('typing-indicator')?.remove();
        messagesContainer.innerHTML += `
            <div class="chat-message assistant">${formatMessage(response)}</div>
        `;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        document.getElementById('typing-indicator')?.remove();
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

async function handleClearChat() {
    const userId = authService.getUserId();

    try {
        await coachService.clearChat(userId);
        renderMessages();
    } catch (error) {
        console.error('Failed to clear chat:', error);
    }
}
