/**
 * StudioManager - Main JavaScript Module
 * Core functionality and utilities for the StudioManager application
 */

// ============================================================================
// GLOBAL UTILITIES & HELPERS
// ============================================================================

const Utils = {
    /**
     * Get CSRF token from meta tag
     * @returns {string} CSRF token
     */
    getCSRFToken() {
        const token = document.querySelector('meta[name="csrf-token"]');
        return token ? token.getAttribute('content') : '';
    },

    /**
     * Format date for display
     * @param {string|Date} date - Date to format
     * @param {string} format - Format type ('short', 'long', 'time')
     * @returns {string} Formatted date
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = {
            short: { year: 'numeric', month: 'short', day: 'numeric' },
            long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
            time: { hour: '2-digit', minute: '2-digit' },
            datetime: { 
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }
        };
        
        return d.toLocaleDateString('en-US', options[format] || options.short);
    },

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Show/hide loading spinner
     * @param {boolean} show - Whether to show or hide spinner
     */
    showLoading(show = true) {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Show flash message
     * @param {string} message - Message text
     * @param {string} type - Message type ('success', 'error', 'warning', 'info')
     * @param {number} duration - Auto-hide duration in ms (0 = no auto-hide)
     */
    showFlashMessage(message, type = 'info', duration = 5000) {
        const container = document.getElementById('flash-messages');
        if (!container) return;

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} fade-in`;
        alertDiv.setAttribute('data-alert', '');
        
        alertDiv.innerHTML = `
            <span class="alert-message">${message}</span>
            <button class="alert-close" data-alert-close>&times;</button>
        `;

        container.appendChild(alertDiv);

        // Add close functionality
        const closeBtn = alertDiv.querySelector('[data-alert-close]');
        closeBtn.addEventListener('click', () => {
            this.hideFlashMessage(alertDiv);
        });

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hideFlashMessage(alertDiv);
            }, duration);
        }
    },

    /**
     * Hide specific flash message
     * @param {HTMLElement} alertElement - Alert element to hide
     */
    hideFlashMessage(alertElement) {
        if (alertElement && alertElement.parentNode) {
            alertElement.style.opacity = '0';
            alertElement.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                alertElement.remove();
            }, 150);
        }
    },

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Whether email is valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Generate password strength score
     * @param {string} password - Password to check
     * @returns {Object} Strength info with score and feedback
     */
    checkPasswordStrength(password) {
        let score = 0;
        const feedback = [];

        if (password.length >= 8) score++;
        else feedback.push('At least 8 characters');

        if (/[a-z]/.test(password)) score++;
        else feedback.push('Include lowercase letters');

        if (/[A-Z]/.test(password)) score++;
        else feedback.push('Include uppercase letters');

        if (/\d/.test(password)) score++;
        else feedback.push('Include numbers');

        if (/[^a-zA-Z\d]/.test(password)) score++;
        else feedback.push('Include special characters');

        const strength = ['weak', 'weak', 'fair', 'good', 'strong'][score] || 'weak';
        
        return { score, strength, feedback };
    },

    /**
     * Sanitize HTML to prevent XSS
     * @param {string} str - String to sanitize
     * @returns {string} Sanitized string
     */
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};

// ============================================================================
// API HANDLER
// ============================================================================

const API = {
    /**
     * Base API request method
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async request(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': Utils.getCSRFToken(),
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(endpoint, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise} Response promise
     */
    async get(endpoint, params = {}) {
        const url = new URL(endpoint, window.location.origin);
        Object.keys(params).forEach(key => 
            url.searchParams.append(key, params[key])
        );
        
        return this.request(url.toString(), { method: 'GET' });
    },

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise} Response promise
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise} Response promise
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @returns {Promise} Response promise
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    /**
     * Submit form data (multipart/form-data)
     * @param {string} endpoint - API endpoint
     * @param {FormData} formData - Form data
     * @returns {Promise} Response promise
     */
    async submitForm(endpoint, formData) {
        return fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': Utils.getCSRFToken()
            }
        }).then(response => response.json());
    }
};

// ============================================================================
// FORM VALIDATION UTILITIES
// ============================================================================

const FormValidator = {
    /**
     * Show field error
     * @param {string} fieldId - Field ID
     * @param {string} message - Error message
     */
    showError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}-error`);
        
        if (field) {
            field.classList.add('error');
            field.classList.remove('success');
        }
        
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
        }
    },

    /**
     * Show field success
     * @param {string} fieldId - Field ID
     * @param {string} message - Success message (optional)
     */
    showSuccess(fieldId, message = '') {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}-error`);
        const successDiv = document.getElementById(`${fieldId}-success`);
        
        if (field) {
            field.classList.remove('error');
            field.classList.add('success');
        }
        
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
        
        if (successDiv && message) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
    },

    /**
     * Clear field validation state
     * @param {string} fieldId - Field ID
     */
    clearValidation(fieldId) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}-error`);
        const successDiv = document.getElementById(`${fieldId}-success`);
        
        if (field) {
            field.classList.remove('error', 'success');
        }
        
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
        
        if (successDiv) {
            successDiv.style.display = 'none';
        }
    },

    /**
     * Validate required field
     * @param {string} fieldId - Field ID
     * @param {string} fieldName - Human-readable field name
     * @returns {boolean} Whether field is valid
     */
    validateRequired(fieldId, fieldName) {
        const field = document.getElementById(fieldId);
        const value = field ? field.value.trim() : '';
        
        if (!value) {
            this.showError(fieldId, `${fieldName} is required`);
            return false;
        }
        
        this.clearValidation(fieldId);
        return true;
    },

    /**
     * Validate email field
     * @param {string} fieldId - Field ID
     * @returns {boolean} Whether email is valid
     */
    validateEmail(fieldId) {
        const field = document.getElementById(fieldId);
        const value = field ? field.value.trim() : '';
        
        if (!value) {
            this.showError(fieldId, 'Email is required');
            return false;
        }
        
        if (!Utils.isValidEmail(value)) {
            this.showError(fieldId, 'Please enter a valid email address');
            return false;
        }
        
        this.clearValidation(fieldId);
        return true;
    },

    /**
     * Validate password strength
     * @param {string} fieldId - Field ID
     * @param {number} minLength - Minimum password length
     * @returns {boolean} Whether password meets requirements
     */
    validatePassword(fieldId, minLength = 8) {
        const field = document.getElementById(fieldId);
        const value = field ? field.value : '';
        
        if (!value) {
            this.showError(fieldId, 'Password is required');
            return false;
        }
        
        if (value.length < minLength) {
            this.showError(fieldId, `Password must be at least ${minLength} characters`);
            return false;
        }
        
        const strength = Utils.checkPasswordStrength(value);
        if (strength.score < 3) {
            this.showError(fieldId, 'Password is too weak. ' + strength.feedback.join(', '));
            return false;
        }
        
        this.clearValidation(fieldId);
        return true;
    }
};

// ============================================================================
// UI COMPONENTS
// ============================================================================

const UI = {
    /**
     * Initialize dropdown toggles
     */
    initDropdowns() {
        document.addEventListener('click', (e) => {
            // Close all dropdowns when clicking outside
            if (!e.target.closest('.user-dropdown')) {
                document.querySelectorAll('.user-dropdown-toggle').forEach(toggle => {
                    toggle.classList.remove('active');
                });
            }
        });

        // User dropdown toggle
        const userDropdownToggle = document.getElementById('user-dropdown-toggle');
        if (userDropdownToggle) {
            userDropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdownToggle.classList.toggle('active');
            });
        }
    },

    /**
     * Initialize alert close buttons
     */
    initAlerts() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-alert-close]')) {
                const alert = e.target.closest('[data-alert]');
                if (alert) {
                    Utils.hideFlashMessage(alert);
                }
            }
        });
    },

    /**
     * Initialize mobile menu toggle
     */
    initMobileMenu() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const nav = document.getElementById('main-nav');
        
        if (mobileToggle && nav) {
            mobileToggle.addEventListener('click', () => {
                nav.classList.toggle('mobile-open');
                
                // Update button icon/text
                const isOpen = nav.classList.contains('mobile-open');
                mobileToggle.innerHTML = isOpen ? '✕' : '☰';
            });
        }
    },

    /**
     * Initialize form enhancements
     */
    initForms() {
        // Auto-focus first form field
        const firstInput = document.querySelector('.auth-form input:not([type="hidden"])');
        if (firstInput && document.activeElement === document.body) {
            firstInput.focus();
        }
        
        // Form submission handling
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.classList.contains('auth-form')) {
                this.handleFormSubmission(form);
            }
        });
    },

    /**
     * Handle form submission UI updates
     * @param {HTMLFormElement} form - Form element
     */
    handleFormSubmission(form) {
        const submitBtn = form.querySelector('[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');
        
        if (submitBtn && !submitBtn.disabled) {
            submitBtn.disabled = true;
            
            if (btnText) btnText.style.display = 'none';
            if (btnSpinner) btnSpinner.style.display = 'flex';
            
            // Re-enable after 5 seconds as failsafe
            setTimeout(() => {
                submitBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline';
                if (btnSpinner) btnSpinner.style.display = 'none';
            }, 5000);
        }
    },

    /**
     * Reset form submission state
     * @param {HTMLFormElement} form - Form element
     */
    resetFormSubmission(form) {
        const submitBtn = form.querySelector('[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');
        
        if (submitBtn) {
            submitBtn.disabled = false;
            
            if (btnText) btnText.style.display = 'inline';
            if (btnSpinner) btnSpinner.style.display = 'none';
        }
    }
};

// ============================================================================
// NAVIGATION MANAGEMENT
// ============================================================================

const Navigation = {
    /**
     * Update navigation based on user role and authentication status
     * @param {Object} user - User object with role information
     */
    updateNavigation(user) {
        const nav = document.querySelector('.nav-list');
        if (!nav) return;

        // Clear existing navigation
        nav.innerHTML = '';

        if (!user) return;

        // Define navigation items based on role
        const navItems = this.getNavigationItems(user.role);
        
        navItems.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = item.href;
            a.textContent = item.text;
            a.className = item.className || '';
            
            // Mark active page
            if (window.location.pathname === item.href) {
                a.classList.add('active');
            }
            
            li.appendChild(a);
            nav.appendChild(li);
        });
    },

    /**
     * Get navigation items based on user role
     * @param {string} role - User role
     * @returns {Array} Array of navigation items
     */
    getNavigationItems(role) {
        const baseItems = [
            { href: '/dashboard', text: 'Dashboard' }
        ];

        const roleItems = {
            admin: [
                { href: '/studios', text: 'Studios' },
                { href: '/customers', text: 'Customers' },
                { href: '/rooms', text: 'Rooms' },
                { href: '/bookings', text: 'Bookings' },
                { href: '/staff', text: 'Staff' },
                { href: '/reports', text: 'Reports' },
                { href: '/users', text: 'Users' }
            ],
            manager: [
                { href: '/customers', text: 'Customers' },
                { href: '/rooms', text: 'Rooms' },
                { href: '/bookings', text: 'Bookings' },
                { href: '/staff', text: 'Staff' },
                { href: '/reports', text: 'Reports' }
            ],
            staff: [
                { href: '/schedule', text: 'My Schedule' },
                { href: '/customers', text: 'Customers' }
            ],
            receptionist: [
                { href: '/customers', text: 'Customers' },
                { href: '/bookings', text: 'Bookings' }
            ]
        };

        return [...baseItems, ...(roleItems[role] || [])];
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI components
    UI.initDropdowns();
    UI.initAlerts();
    UI.initMobileMenu();
    UI.initForms();
    
    // Set up global error handling
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
        Utils.showFlashMessage(
            'An unexpected error occurred. Please try again.',
            'error'
        );
    });
    
    // Set up unhandled promise rejection handling
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled promise rejection:', e.reason);
        Utils.showFlashMessage(
            'An error occurred while processing your request.',
            'error'
        );
    });
    
    console.log('StudioManager main.js initialized');
});

// Export for use in other modules
window.StudioManager = {
    Utils,
    API,
    FormValidator,
    UI,
    Navigation
};