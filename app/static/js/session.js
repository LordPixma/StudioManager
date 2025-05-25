/**
 * StudioManager - Session Management Module
 * Handles session timeout, warnings, and automatic logout
 */

const SessionManager = {
    // Session configuration
    config: {
        warningTime: 5 * 60 * 1000, // 5 minutes in milliseconds
        updateInterval: 1000, // 1 second
        checkInterval: 30 * 1000 // 30 seconds
    },

    // Internal state
    sessionTimeout: null,
    warningShown: false,
    timers: {
        warning: null,
        countdown: null,
        check: null
    },

    /**
     * Start session monitoring
     * @param {string} timeoutISO - Session timeout in ISO format
     */
    startSessionMonitoring(timeoutISO) {
        this.updateSessionTimeout(timeoutISO);
        this.startPeriodicSessionCheck();
        console.log('Session monitoring started');
    },

    /**
     * Stop session monitoring
     */
    stopSessionMonitoring() {
        // Clear all timers
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        
        this.timers = { warning: null, countdown: null, check: null };
        this.sessionTimeout = null;
        this.warningShown = false;
        
        // Hide session info and modal
        this.hideSessionInfo();
        this.hideSessionModal();
        
        console.log('Session monitoring stopped');
    },

    /**
     * Update session timeout
     * @param {string} timeoutISO - Session timeout in ISO format
     */
    updateSessionTimeout(timeoutISO) {
        this.sessionTimeout = new Date(timeoutISO);
        this.warningShown = false;
        
        // Clear existing timers
        if (this.timers.warning) {
            clearTimeout(this.timers.warning);
        }
        
        // Calculate time until warning
        const now = new Date();
        const timeUntilWarning = this.sessionTimeout.getTime() - now.getTime() - this.config.warningTime;
        
        if (timeUntilWarning > 0) {
            // Set warning timer
            this.timers.warning = setTimeout(() => {
                this.showSessionWarning();
            }, timeUntilWarning);
            
            // Update session info display
            this.updateSessionInfo();
        } else {
            // Session has already expired or will expire very soon
            this.handleSessionExpiry();
        }
    },

    /**
     * Start periodic session checking
     */
    startPeriodicSessionCheck() {
        if (this.timers.check) {
            clearInterval(this.timers.check);
        }
        
        this.timers.check = setInterval(() => {
            this.checkSessionStatus();
        }, this.config.checkInterval);
    },

    /**
     * Check session status with server
     */
    async checkSessionStatus() {
        try {
            const response = await fetch('/api/session', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401) {
                // Session has expired
                this.handleSessionExpiry();
                return;
            }
            
            const data = await response.json();
            if (data.success && data.data.session_timeout) {
                // Update session timeout if it has changed
                const newTimeout = new Date(data.data.session_timeout);
                if (!this.sessionTimeout || newTimeout.getTime() !== this.sessionTimeout.getTime()) {
                    this.updateSessionTimeout(data.data.session_timeout);
                }
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    },

    /**
     * Show session timeout warning modal
     */
    showSessionWarning() {
        if (this.warningShown) return;
        
        this.warningShown = true;
        const modal = document.getElementById('session-modal');
        const countdownElement = document.getElementById('countdown-timer');
        
        if (!modal) {
            console.error('Session modal not found');
            return;
        }
        
        // Show modal
        modal.style.display = 'block';
        modal.classList.add('fade-in');
        
        // Start countdown
        this.startCountdown(countdownElement);
        
        // Set up modal button handlers
        this.setupModalHandlers();
        
        console.log('Session warning displayed');
    },

    /**
     * Hide session warning modal
     */
    hideSessionModal() {
        const modal = document.getElementById('session-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('fade-in');
        }
        
        // Clear countdown timer
        if (this.timers.countdown) {
            clearInterval(this.timers.countdown);
            this.timers.countdown = null;
        }
        
        this.warningShown = false;
    },

    /**
     * Start countdown timer in modal
     * @param {HTMLElement} countdownElement - Countdown display element
     */
    startCountdown(countdownElement) {
        if (!countdownElement || !this.sessionTimeout) return;
        
        const updateCountdown = () => {
            const now = new Date();
            const timeLeft = this.sessionTimeout.getTime() - now.getTime();
            
            if (timeLeft <= 0) {
                // Time's up - logout
                this.handleSessionExpiry();
                return;
            }
            
            // Format time as MM:SS
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            countdownElement.textContent = formattedTime;
            
            // Change styling based on time left
            countdownElement.className = 'countdown-timer';
            if (timeLeft <= 30000) { // 30 seconds
                countdownElement.classList.add('critical');
            } else if (timeLeft <= 120000) { // 2 minutes
                countdownElement.classList.add('warning');
            }
        };
        
        // Update immediately
        updateCountdown();
        
        // Update every second
        this.timers.countdown = setInterval(updateCountdown, this.config.updateInterval);
    },

    /**
     * Setup modal button event handlers
     */
    setupModalHandlers() {
        const stayLoggedInBtn = document.getElementById('stay-logged-in');
        const logoutNowBtn = document.getElementById('logout-now');
        
        if (stayLoggedInBtn) {
            stayLoggedInBtn.onclick = () => {
                this.extendSession();
            };
        }
        
        if (logoutNowBtn) {
            logoutNowBtn.onclick = () => {
                this.logoutNow();
            };
        }
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', this.handleModalKeyboard.bind(this));
    },

    /**
     * Handle keyboard shortcuts in modal
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleModalKeyboard(e) {
        if (!this.warningShown) return;
        
        if (e.key === 'Enter') {
            e.preventDefault();
            this.extendSession();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.logoutNow();
        }
    },

    /**
     * Extend session by making an authenticated request
     */
    async extendSession() {
        try {
            // Make any authenticated API call to refresh session
            const response = await fetch('/api/session', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.session_timeout) {
                    // Update session timeout
                    this.updateSessionTimeout(data.data.session_timeout);
                    this.hideSessionModal();
                    
                    // Show success message
                    if (window.Utils) {
                        window.Utils.showFlashMessage('Session extended successfully', 'success', 3000);
                    }
                    
                    console.log('Session extended');
                }
            } else {
                throw new Error('Session extension failed');
            }
        } catch (error) {
            console.error('Failed to extend session:', error);
            this.handleSessionExpiry();
        }
    },

    /**
     * Logout immediately
     */
    logoutNow() {
        this.hideSessionModal();
        if (window.Auth) {
            window.Auth.logout();
        } else {
            // Fallback - redirect to login
            window.location.href = '/login';
        }
    },

    /**
     * Handle session expiry
     */
    handleSessionExpiry() {
        this.stopSessionMonitoring();
        
        if (window.Auth) {
            window.Auth.currentUser = null;
            window.Auth.updateUI();
        }
        
        if (window.Utils) {
            window.Utils.showFlashMessage('Your session has expired. Please log in again.', 'warning');
        }
        
        // Redirect to login after a short delay
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    },

    /**
     * Update session info display in header
     */
    updateSessionInfo() {
        if (!this.sessionTimeout) return;
        
        const sessionInfo = document.getElementById('session-info');
        const timeoutDisplay = document.getElementById('session-timeout-display');
        
        if (!sessionInfo || !timeoutDisplay) return;
        
        const now = new Date();
        const timeLeft = this.sessionTimeout.getTime() - now.getTime();
        
        // Show session info only when less than 10 minutes remain
        if (timeLeft <= 10 * 60 * 1000 && timeLeft > 0) {
            const minutes = Math.floor(timeLeft / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            
            timeoutDisplay.textContent = `Session expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
            timeoutDisplay.className = 'session-timeout';
            
            if (timeLeft <= 2 * 60 * 1000) { // 2 minutes
                timeoutDisplay.classList.add('critical');
            } else if (timeLeft <= 5 * 60 * 1000) { // 5 minutes
                timeoutDisplay.classList.add('warning');
            }
            
            sessionInfo.style.display = 'flex';
            
            // Schedule next update
            setTimeout(() => this.updateSessionInfo(), this.config.updateInterval);
        } else {
            sessionInfo.style.display = 'none';
        }
    },

    /**
     * Hide session info display
     */
    hideSessionInfo() {
        const sessionInfo = document.getElementById('session-info');
        if (sessionInfo) {
            sessionInfo.style.display = 'none';
        }
    },

    /**
     * Get time remaining until session expires
     * @returns {number} Time remaining in milliseconds
     */
    getTimeRemaining() {
        if (!this.sessionTimeout) return 0;
        
        const now = new Date();
        return Math.max(0, this.sessionTimeout.getTime() - now.getTime());
    },

    /**
     * Check if session warning should be shown
     * @returns {boolean} Whether warning should be shown
     */
    shouldShowWarning() {
        const timeLeft = this.getTimeRemaining();
        return timeLeft > 0 && timeLeft <= this.config.warningTime && !this.warningShown;
    },

    /**
     * Format time duration for display
     * @param {number} milliseconds - Time in milliseconds
     * @returns {string} Formatted time string
     */
    formatTime(milliseconds) {
        const minutes = Math.floor(milliseconds / (60 * 1000));
        const seconds = Math.floor((milliseconds % (60 * 1000)) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
};

// Initialize session management when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Export for global access
    window.SessionManager = SessionManager;
    
    console.log('Session management initialized');
});

// Handle page visibility changes (user switches tabs)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && SessionManager.sessionTimeout) {
        // User returned to tab - check session status
        SessionManager.checkSessionStatus();
    }
});

// Handle before page unload
window.addEventListener('beforeunload', function() {
    SessionManager.stopSessionMonitoring();
});