/**
 * StudioManager - Authentication Module
 * Handles login, registration, and authentication state management
 */

const Auth = {
    // Current user data
    currentUser: null,
    
    // API endpoints
    endpoints: {
        login: '/api/login',
        register: '/api/register',
        logout: '/api/logout',
        session: '/api/session',
        validateEmail: '/api/validate/email',
        studios: '/api/studios'
    },

    /**
     * Initialize authentication system
     */
    init() {
        this.checkAuthState();
        this.updateUI();
    },

    /**
     * Check current authentication state
     */
    async checkAuthState() {
        try {
            const response = await API.get(this.endpoints.session);
            if (response.success && response.data.user) {
                this.currentUser = response.data.user;
                this.updateSessionTimeout(response.data.session_timeout);
            } else {
                this.currentUser = null;
            }
        } catch (error) {
            console.log('No active session');
            this.currentUser = null;
        }
        
        this.updateUI();
    },

    /**
     * Login user
     * @param {Object} credentials - Login credentials
     * @returns {Promise<Object>} Login response
     */
    async login(credentials) {
        try {
            const response = await API.post(this.endpoints.login, credentials);
            
            if (response.success) {
                this.currentUser = response.data.user;
                this.updateSessionTimeout(response.data.session_timeout);
                this.updateUI();
                
                // Start session management
                if (window.SessionManager) {
                    window.SessionManager.startSessionMonitoring(response.data.session_timeout);
                }
                
                Utils.showFlashMessage('Welcome back!', 'success');
                
                // Redirect to dashboard after short delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            }
            
            return response;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    },

    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Registration response
     */
    async register(userData) {
        try {
            const response = await API.post(this.endpoints.register, userData);
            
            if (response.success) {
                this.currentUser = response.data.user;
                this.updateSessionTimeout(response.data.session_timeout);
                this.updateUI();
                
                // Start session management
                if (window.SessionManager) {
                    window.SessionManager.startSessionMonitoring(response.data.session_timeout);
                }
                
                Utils.showFlashMessage('Account created successfully!', 'success');
                
                // Redirect based on user role
                setTimeout(() => {
                    const redirectUrl = this.currentUser.role === 'admin' ? '/admin/dashboard' : '/dashboard';
                    window.location.href = redirectUrl;
                }, 1000);
            }
            
            return response;
        } catch (error) {
            console.error('Registration failed:', error);
            throw error;
        }
    },

    /**
     * Logout user
     */
    async logout() {
        try {
            await API.post(this.endpoints.logout);
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            this.currentUser = null;
            this.updateUI();
            
            // Stop session monitoring
            if (window.SessionManager) {
                window.SessionManager.stopSessionMonitoring();
            }
            
            Utils.showFlashMessage('You have been logged out', 'info');
            
            // Redirect to login page
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
        }
    },

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return this.currentUser !== null;
    },

    /**
     * Get current user
     * @returns {Object|null} Current user object
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Check if user has specific role
     * @param {string} role - Role to check
     * @returns {boolean} Whether user has role
     */
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    },

    /**
     * Check if user has any of the specified roles
     * @param {Array<string>} roles - Roles to check
     * @returns {boolean} Whether user has any of the roles
     */
    hasAnyRole(roles) {
        return this.currentUser && roles.includes(this.currentUser.role);
    },

    /**
     * Update UI based on authentication state
     */
    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const mainNav = document.getElementById('main-nav');
        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');

        if (this.isAuthenticated()) {
            // Hide auth buttons, show user menu and navigation
            if (authButtons) authButtons.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            if (mainNav) mainNav.style.display = 'block';
            
            // Update user info
            if (userName) userName.textContent = this.currentUser.name;
            if (userRole) userRole.textContent = this.currentUser.role;
            
            // Update navigation based on role
            if (window.StudioManager && window.StudioManager.Navigation) {
                window.StudioManager.Navigation.updateNavigation(this.currentUser);
            }
        } else {
            // Show auth buttons, hide user menu and navigation
            if (authButtons) authButtons.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
            if (mainNav) mainNav.style.display = 'none';
        }
    },

    /**
     * Update session timeout information
     * @param {string} timeoutISO - Session timeout in ISO format
     */
    updateSessionTimeout(timeoutISO) {
        if (window.SessionManager) {
            window.SessionManager.updateSessionTimeout(timeoutISO);
        }
    },

    /**
     * Initialize login form
     */
    initLoginForm() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            this.clearFormErrors(form);
            
            // Collect form data
            const formData = new FormData(form);
            const credentials = {
                email: formData.get('email'),
                password: formData.get('password'),
                remember_me: formData.get('remember_me') === 'on'
            };
            
            // Validate form
            if (!this.validateLoginForm(credentials)) {
                UI.resetFormSubmission(form);
                return;
            }
            
            try {
                await this.login(credentials);
            } catch (error) {
                UI.resetFormSubmission(form);
                this.showFormError(form, error.message || 'Login failed. Please try again.');
            }
        });
    },

    /**
     * Initialize registration form
     */
    initRegistrationForm() {
        const form = document.getElementById('register-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            this.clearFormErrors(form);
            
            // Collect form data
            const formData = new FormData(form);
            const userData = {
                name: formData.get('name'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role'),
                studio_id: formData.get('studio_id') || null,
                terms: formData.get('terms') === 'on'
            };
            
            // Validate form
            if (!this.validateRegistrationForm(userData)) {
                UI.resetFormSubmission(form);
                return;
            }
            
            try {
                await this.register(userData);
            } catch (error) {
                UI.resetFormSubmission(form);
                this.handleRegistrationError(error, form);
            }
        });
    },

    /**
     * Initialize admin registration (when admin is creating users)
     */
    initAdminRegistration() {
        const adminFields = document.getElementById('admin-fields');
        const hiddenRole = document.getElementById('hidden_role');
        const studioSelect = document.getElementById('studio_id');
        
        if (adminFields) {
            adminFields.style.display = 'block';
        }
        
        if (hiddenRole) {
            hiddenRole.disabled = true; // Disable hidden field when admin fields are shown
        }
        
        // Load studios for admin
        if (studioSelect) {
            this.loadStudios(studioSelect);
        }
    },

    /**
     * Load studios for selection
     * @param {HTMLSelectElement} selectElement - Studio select element
     */
    async loadStudios(selectElement) {
        try {
            const response = await API.get(this.endpoints.studios);
            
            if (response.success && response.data) {
                // Clear existing options except first
                const firstOption = selectElement.querySelector('option[value=""]');
                selectElement.innerHTML = '';
                if (firstOption) {
                    selectElement.appendChild(firstOption);
                }
                
                // Add studio options
                response.data.forEach(studio => {
                    const option = document.createElement('option');
                    option.value = studio.id;
                    option.textContent = studio.name;
                    selectElement.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load studios:', error);
            Utils.showFleshMessage('Failed to load studios', 'error');
        }
    },

    /**
     * Validate login form
     * @param {Object} credentials - Login credentials
     * @returns {boolean} Whether form is valid
     */
    validateLoginForm(credentials) {
        let isValid = true;
        
        if (!FormValidator.validateRequired('email', 'Email')) {
            isValid = false;
        } else if (!FormValidator.validateEmail('email')) {
            isValid = false;
        }
        
        if (!FormValidator.validateRequired('password', 'Password')) {
            isValid = false;
        }
        
        return isValid;
    },

    /**
     * Validate registration form
     * @param {Object} userData - User data
     * @returns {boolean} Whether form is valid
     */
    validateRegistrationForm(userData) {
        let isValid = true;
        
        if (!FormValidator.validateRequired('name', 'Name')) {
            isValid = false;
        }
        
        if (!FormValidator.validateRequired('email', 'Email')) {
            isValid = false;
        } else if (!FormValidator.validateEmail('email')) {
            isValid = false;
        }
        
        if (!FormValidator.validatePassword('password')) {
            isValid = false;
        }
        
        // Validate password confirmation
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm_password').value;
        
        if (!confirmPassword) {
            FormValidator.showError('confirm_password', 'Please confirm your password');
            isValid = false;
        } else if (password !== confirmPassword) {
            FormValidator.showError('confirm_password', 'Passwords do not match');
            isValid = false;
        } else {
            FormValidator.showSuccess('confirm_password', '✓ Passwords match');
        }
        
        // Validate terms acceptance
        if (!userData.terms) {
            FormValidator.showError('terms', 'You must accept the terms and conditions');
            isValid = false;
        }
        
        return isValid;
    },

    /**
     * Validate email uniqueness
     * @param {string} email - Email to validate
     */
    async validateEmailUniqueness(email) {
        if (!email || !Utils.isValidEmail(email)) {
            return;
        }
        
        try {
            const response = await API.post(this.endpoints.validateEmail, { email });
            
            if (response.success) {
                FormValidator.showSuccess('email', '✓ Email is available');
            } else if (response.errors && response.errors.email) {
                FormValidator.showError('email', response.errors.email[0]);
            }
        } catch (error) {
            console.error('Email validation failed:', error);
        }
    },

    /**
     * Update password strength indicator
     * @param {string} password - Password to check
     */
    updatePasswordStrength(password) {
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');
        
        if (!strengthFill || !strengthText) return;
        
        const strength = Utils.checkPasswordStrength(password);
        
        // Update progress bar
        strengthFill.className = `strength-fill ${strength.strength}`;
        
        // Update text
        if (password.length === 0) {
            strengthText.textContent = 'Password strength';
        } else {
            const strengthLabels = {
                weak: 'Weak password',
                fair: 'Fair password',
                good: 'Good password',
                strong: 'Strong password'
            };
            strengthText.textContent = strengthLabels[strength.strength];
        }
    },

    /**
     * Validate password match
     * @param {string} password - Original password
     * @param {string} confirmPassword - Confirmation password
     */
    validatePasswordMatch(password, confirmPassword) {
        if (!confirmPassword) {
            FormValidator.clearValidation('confirm_password');
            return;
        }
        
        if (password === confirmPassword) {
            FormValidator.showSuccess('confirm_password', '✓ Passwords match');
        } else {
            FormValidator.showError('confirm_password', 'Passwords do not match');
        }
    },

    /**
     * Clear form errors
     * @param {HTMLFormElement} form - Form element
     */
    clearFormErrors(form) {
        const formError = form.querySelector('#form-error');
        if (formError) {
            formError.style.display = 'none';
        }
        
        // Clear field errors
        form.querySelectorAll('.field-error.show').forEach(error => {
            error.classList.remove('show');
        });
        
        form.querySelectorAll('.form-input.error, .form-select.error').forEach(field => {
            field.classList.remove('error');
        });
    },

    /**
     * Show form error message
     * @param {HTMLFormElement} form - Form element
     * @param {string} message - Error message
     */
    showFormError(form, message) {
        const formError = form.querySelector('#form-error');
        if (formError) {
            formError.textContent = message;
            formError.style.display = 'block';
        }
    },

    /**
     * Handle registration error response
     * @param {Error} error - Error object
     * @param {HTMLFormElement} form - Form element
     */
    handleRegistrationError(error, form) {
        if (error.message && error.message.includes('errors')) {
            try {
                const errorData = JSON.parse(error.message);
                if (errorData.errors) {
                    // Show field-specific errors
                    Object.keys(errorData.errors).forEach(field => {
                        const messages = errorData.errors[field];
                        if (messages && messages.length > 0) {
                            FormValidator.showError(field, messages[0]);
                        }
                    });
                    return;
                }
            } catch (parseError) {
                console.error('Error parsing registration errors:', parseError);
            }
        }
        
        // Fallback to generic error
        this.showFormError(form, error.message || 'Registration failed. Please try again.');
    }
};

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    Auth.init();
    
    // Set up logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }
});

// Export for global access
window.Auth = Auth;