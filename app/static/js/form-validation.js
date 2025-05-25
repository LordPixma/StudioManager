/**
 * StudioManager - Form Validation Module
 * Advanced form validation utilities and real-time validation
 */

const FormValidation = {
    // Validation rules
    rules: {
        required: {
            test: (value) => value && value.trim().length > 0,
            message: (fieldName) => `${fieldName} is required`
        },
        
        email: {
            test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: () => 'Please enter a valid email address'
        },
        
        minLength: {
            test: (value, min) => value.length >= min,
            message: (fieldName, min) => `${fieldName} must be at least ${min} characters`
        },
        
        maxLength: {
            test: (value, max) => value.length <= max,
            message: (fieldName, max) => `${fieldName} must be no more than ${max} characters`
        },
        
        password: {
            test: (value) => {
                const strength = Utils.checkPasswordStrength(value);
                return strength.score >= 3;
            },
            message: () => 'Password must be stronger (include uppercase, lowercase, numbers, and special characters)'
        },
        
        phone: {
            test: (value) => /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, '')),
            message: () => 'Please enter a valid phone number'
        },
        
        match: {
            test: (value, matchValue) => value === matchValue,
            message: (fieldName) => `${fieldName} must match`
        },
        
        numeric: {
            test: (value) => /^\d+$/.test(value),
            message: (fieldName) => `${fieldName} must be a number`
        },
        
        decimal: {
            test: (value) => /^\d+(\.\d{1,2})?$/.test(value),
            message: (fieldName) => `${fieldName} must be a valid decimal number`
        },
        
        url: {
            test: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            message: () => 'Please enter a valid URL'
        }
    },

    // Form validators cache
    validators: new Map(),

    /**
     * Initialize form validation
     * @param {string} formSelector - CSS selector for form
     * @param {Object} options - Validation options
     */
    init(formSelector, options = {}) {
        const form = document.querySelector(formSelector);
        if (!form) return;

        const validator = {
            form,
            options: {
                validateOnBlur: true,
                validateOnInput: false,
                showSuccessStates: true,
                debounceTime: 300,
                ...options
            },
            fields: new Map()
        };

        this.validators.set(formSelector, validator);
        this.setupFormValidation(validator);
    },

    /**
     * Add validation rule to field
     * @param {string} formSelector - Form selector
     * @param {string} fieldName - Field name
     * @param {string} ruleName - Rule name
     * @param {*} ruleValue - Rule value/parameter
     * @param {string} customMessage - Custom error message
     */
    addRule(formSelector, fieldName, ruleName, ruleValue = true, customMessage = null) {
        const validator = this.validators.get(formSelector);
        if (!validator) return;

        if (!validator.fields.has(fieldName)) {
            validator.fields.set(fieldName, { rules: [] });
        }

        const field = validator.fields.get(fieldName);
        field.rules.push({
            name: ruleName,
            value: ruleValue,
            message: customMessage
        });
    },

    /**
     * Setup form validation event listeners
     * @param {Object} validator - Validator object
     */
    setupFormValidation(validator) {
        const { form, options } = validator;

        // Form submission validation
        form.addEventListener('submit', (e) => {
            if (!this.validateForm(validator)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Field-level validation
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const fieldName = input.name || input.id;
            if (!fieldName) return;

            // Blur validation
            if (options.validateOnBlur) {
                input.addEventListener('blur', Utils.debounce(() => {
                    this.validateField(validator, fieldName);
                }, options.debounceTime));
            }

            // Input validation (for real-time feedback)
            if (options.validateOnInput) {
                input.addEventListener('input', Utils.debounce(() => {
                    this.validateField(validator, fieldName);
                }, options.debounceTime));
            }

            // Special handling for password fields
            if (input.type === 'password') {
                input.addEventListener('input', Utils.debounce(() => {
                    this.updatePasswordStrength(input);
                }, 200));
            }

            // Special handling for email fields (async validation)
            if (input.type === 'email' && options.validateEmailUniqueness) {
                input.addEventListener('blur', Utils.debounce(() => {
                    this.validateEmailUniqueness(input);
                }, 500));
            }
        });
    },

    /**
     * Validate entire form
     * @param {Object} validator - Validator object
     * @returns {boolean} Whether form is valid
     */
    validateForm(validator) {
        let isValid = true;
        const { form } = validator;

        // Clear previous form-level errors
        this.clearFormError(form);

        // Validate all fields with rules
        for (const [fieldName] of validator.fields) {
            if (!this.validateField(validator, fieldName)) {
                isValid = false;
            }
        }

        // Additional custom validation
        if (isValid && validator.options.customValidator) {
            const customResult = validator.options.customValidator(form);
            if (customResult !== true) {
                this.showFormError(form, customResult || 'Form validation failed');
                isValid = false;
            }
        }

        return isValid;
    },

    /**
     * Validate specific field
     * @param {Object} validator - Validator object
     * @param {string} fieldName - Field name
     * @returns {boolean} Whether field is valid
     */
    validateField(validator, fieldName) {
        const { form, options } = validator;
        const fieldConfig = validator.fields.get(fieldName);
        const input = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
        
        if (!fieldConfig || !input) return true;

        const value = input.value;
        const displayName = this.getFieldDisplayName(input);

        // Clear previous validation state
        this.clearFieldValidation(fieldName);

        // Run validation rules
        for (const rule of fieldConfig.rules) {
            const ruleConfig = this.rules[rule.name];
            if (!ruleConfig) continue;

            let isValid = false;
            let errorMessage = rule.message;

            // Test the rule
            if (rule.name === 'match') {
                const matchField = form.querySelector(`[name="${rule.value}"], #${rule.value}`);
                const matchValue = matchField ? matchField.value : '';
                isValid = ruleConfig.test(value, matchValue);
                errorMessage = errorMessage || ruleConfig.message(displayName);
            } else if (typeof rule.value === 'boolean') {
                isValid = ruleConfig.test(value);
                errorMessage = errorMessage || ruleConfig.message(displayName);
            } else {
                isValid = ruleConfig.test(value, rule.value);
                errorMessage = errorMessage || ruleConfig.message(displayName, rule.value);
            }

            // Handle validation result
            if (!isValid && (value || rule.name === 'required')) {
                this.showFieldError(fieldName, errorMessage);
                return false;
            }
        }

        // Show success state if enabled
        if (options.showSuccessStates && value) {
            this.showFieldSuccess(fieldName);
        }

        return true;
    },

    /**
     * Get field display name
     * @param {HTMLElement} input - Input element
     * @returns {string} Display name
     */
    getFieldDisplayName(input) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) {
            return label.textContent.replace('*', '').trim();
        }
        
        return input.name || input.id || 'Field';
    },

    /**
     * Show field error
     * @param {string} fieldName - Field name
     * @param {string} message - Error message
     */
    showFieldError(fieldName, message) {
        const input = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
        const errorDiv = document.getElementById(`${fieldName}-error`);
        
        if (input) {
            input.classList.add('error');
            input.classList.remove('success');
        }
        
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
        }
    },

    /**
     * Show field success
     * @param {string} fieldName - Field name
     * @param {string} message - Success message
     */
    showFieldSuccess(fieldName, message = '') {
        const input = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
        const errorDiv = document.getElementById(`${fieldName}-error`);
        const successDiv = document.getElementById(`${fieldName}-success`);
        
        if (input) {
            input.classList.remove('error');
            input.classList.add('success');
        }
        
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
        
        if (successDiv) {
            if (message) {
                successDiv.textContent = message;
            }
            successDiv.style.display = 'block';
        }
    },

    /**
     * Clear field validation state
     * @param {string} fieldName - Field name
     */
    clearFieldValidation(fieldName) {
        const input = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
        const errorDiv = document.getElementById(`${fieldName}-error`);
        const successDiv = document.getElementById(`${fieldName}-success`);
        
        if (input) {
            input.classList.remove('error', 'success');
        }
        
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
        
        if (successDiv) {
            successDiv.style.display = 'none';
        }
    },

    /**
     * Show form-level error
     * @param {HTMLFormElement} form - Form element
     * @param {string} message - Error message
     */
    showFormError(form, message) {
        const errorDiv = form.querySelector('.form-error, #form-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    },

    /**
     * Clear form-level error
     * @param {HTMLFormElement} form - Form element
     */
    clearFormError(form) {
        const errorDiv = form.querySelector('.form-error, #form-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    },

    /**
     * Update password strength indicator
     * @param {HTMLInputElement} passwordInput - Password input element
     */
    updatePasswordStrength(passwordInput) {
        const password = passwordInput.value;
        const strengthContainer = passwordInput.closest('.form-group').querySelector('.password-strength');
        
        if (!strengthContainer) return;

        const strengthFill = strengthContainer.querySelector('.strength-fill');
        const strengthText = strengthContainer.querySelector('.strength-text');
        
        if (!strengthFill || !strengthText) return;

        if (password.length === 0) {
            strengthFill.className = 'strength-fill';
            strengthText.textContent = 'Password strength';
            return;
        }

        const strength = Utils.checkPasswordStrength(password);
        
        // Update progress bar
        strengthFill.className = `strength-fill ${strength.strength}`;
        
        // Update text
        const strengthLabels = {
            weak: 'Weak password',
            fair: 'Fair password', 
            good: 'Good password',
            strong: 'Strong password'
        };
        
        strengthText.textContent = strengthLabels[strength.strength];

        // Show feedback for weak passwords
        if (strength.strength === 'weak' && strength.feedback.length > 0) {
            strengthText.textContent += ` (${strength.feedback.slice(0, 2).join(', ')})`;
        }
    },

    /**
     * Validate email uniqueness (async)
     * @param {HTMLInputElement} emailInput - Email input element
     */
    async validateEmailUniqueness(emailInput) {
        const email = emailInput.value.trim();
        const fieldName = emailInput.name || emailInput.id;
        
        if (!email || !Utils.isValidEmail(email)) {
            return;
        }

        try {
            const response = await API.post('/api/validate/email', { email });
            
            if (response.success) {
                this.showFieldSuccess(fieldName, '✓ Email is available');
            } else if (response.errors && response.errors.email) {
                this.showFieldError(fieldName, response.errors.email[0]);
            }
        } catch (error) {
            console.error('Email validation failed:', error);
        }
    },

    /**
     * Setup real-time validation for common patterns
     * @param {string} formSelector - Form selector
     */
    setupCommonValidation(formSelector) {
        const form = document.querySelector(formSelector);
        if (!form) return;

        // Email fields
        form.querySelectorAll('input[type="email"]').forEach(input => {
            const fieldName = input.name || input.id;
            this.addRule(formSelector, fieldName, 'required');
            this.addRule(formSelector, fieldName, 'email');
        });

        // Password fields
        form.querySelectorAll('input[type="password"]').forEach(input => {
            const fieldName = input.name || input.id;
            if (fieldName.includes('password') && !fieldName.includes('confirm')) {
                this.addRule(formSelector, fieldName, 'required');
                this.addRule(formSelector, fieldName, 'minLength', 8);
                this.addRule(formSelector, fieldName, 'password');
            }
        });

        // Required fields
        form.querySelectorAll('[required]').forEach(input => {
            const fieldName = input.name || input.id;
            this.addRule(formSelector, fieldName, 'required');
        });

        // Phone fields
        form.querySelectorAll('input[type="tel"], input[name*="phone"]').forEach(input => {
            const fieldName = input.name || input.id;
            this.addRule(formSelector, fieldName, 'phone');
        });
    },

    /**
     * Validate booking time conflicts (custom validation)
     * @param {Object} bookingData - Booking data
     * @returns {Promise<boolean>} Whether booking is valid
     */
    async validateBookingConflict(bookingData) {
        try {
            const response = await API.post('/api/validate/booking', bookingData);
            return response.success;
        } catch (error) {
            console.error('Booking validation failed:', error);
            return false;
        }
    },

    /**
     * Remove validator
     * @param {string} formSelector - Form selector
     */
    destroy(formSelector) {
        this.validators.delete(formSelector);
    }
};

// Initialize common validation patterns when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    // Auto-initialize auth forms
    if (document.getElementById('login-form')) {
        FormValidation.init('#login-form', {
            validateOnBlur: true,
            showSuccessStates: false
        });
        FormValidation.setupCommonValidation('#login-form');
    }

    if (document.getElementById('register-form')) {
        FormValidation.init('#register-form', {
            validateOnBlur: true,
            showSuccessStates: true,
            validateEmailUniqueness: true
        });
        FormValidation.setupCommonValidation('#register-form');
        
        // Add password confirmation validation
        const form = document.getElementById('register-form');
        if (form) {
            FormValidation.addRule('#register-form', 'confirm_password', 'required');
            FormValidation.addRule('#register-form', 'confirm_password', 'match', 'password', 'Passwords do not match');
        }
    }
    
    console.log('Form validation initialized');
});

// Export for global access
window.FormValidation = FormValidation;