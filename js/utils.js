// Utility functions

// Toast notifications
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Date formatting
export function formatDate(date, options = {}) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: options.weekday,
        year: options.year || 'numeric',
        month: options.month || 'short',
        day: options.day || 'numeric'
    });
}

export function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function formatDateTime(date) {
    return `${formatDate(date)} at ${formatTime(date)}`;
}

export function getRelativeDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(date);
}

// Date calculations
export function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getEndOfWeek(date = new Date()) {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}

export function getStartOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getEndOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() === d2.toDateString();
}

// Modal helper
export function showModal(title, content, actions = []) {
    const container = document.getElementById('modal-container');

    const actionsHtml = actions.map(action =>
        `<button class="btn ${action.class || 'btn-secondary'}" data-action="${action.id}">${action.label}</button>`
    ).join('');

    container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${actionsHtml ? `<div class="modal-footer">${actionsHtml}</div>` : ''}
            </div>
        </div>
    `;

    return new Promise(resolve => {
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                container.innerHTML = '';
                resolve(btn.dataset.action);
            });
        });
    });
}

export function closeModal() {
    document.getElementById('modal-container').innerHTML = '';
}

// Form helpers
export function getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
        // Handle numeric fields
        if (value === '') {
            data[key] = null;
        } else if (!isNaN(value) && value !== '') {
            data[key] = parseFloat(value);
        } else {
            data[key] = value;
        }
    }
    return data;
}

// Debounce
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Loading state
export function setLoading(element, isLoading) {
    if (isLoading) {
        element.dataset.originalText = element.textContent;
        element.textContent = 'Loading...';
        element.disabled = true;
    } else {
        element.textContent = element.dataset.originalText || element.textContent;
        element.disabled = false;
    }
}

// Escape HTML
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
