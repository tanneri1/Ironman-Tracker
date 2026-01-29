// Simple client-side router

class Router {
    constructor() {
        this.routes = new Map();
        this.currentPage = null;

        window.addEventListener('hashchange', () => this.handleRoute());
    }

    register(path, pageModule) {
        this.routes.set(path, pageModule);
    }

    async handleRoute() {
        const hash = window.location.hash || '#/';
        const path = hash.replace('#', '') || '/';

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkPath = link.getAttribute('href').replace('#', '');
            link.classList.toggle('active', linkPath === path);
        });

        // Find matching route
        const pageModule = this.routes.get(path);

        if (pageModule) {
            try {
                // Cleanup current page if it has a cleanup method
                if (this.currentPage?.cleanup) {
                    this.currentPage.cleanup();
                }

                // Render new page
                const content = document.getElementById('page-content');
                if (pageModule.render) {
                    content.innerHTML = await pageModule.render();
                }
                if (pageModule.init) {
                    await pageModule.init();
                }

                this.currentPage = pageModule;
            } catch (error) {
                console.error('Error rendering page:', error);
                document.getElementById('page-content').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">&#9888;</div>
                        <h3 class="empty-state-title">Something went wrong</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        } else {
            // 404
            document.getElementById('page-content').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128269;</div>
                    <h3 class="empty-state-title">Page not found</h3>
                    <p>The page you're looking for doesn't exist.</p>
                    <a href="#/" class="btn btn-primary mt-md">Go to Dashboard</a>
                </div>
            `;
        }
    }

    navigate(path) {
        window.location.hash = path;
    }
}

export const router = new Router();
