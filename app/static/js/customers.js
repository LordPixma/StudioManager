/**
 * StudioManager - Customer Management Module
 * Handles customer list, detail view, and form management
 */

const CustomerManager = {
    // Configuration
    config: {
        apiEndpoints: {
            list: '/api/customers',
            detail: '/api/customers',
            create: '/api/customers',
            update: '/api/customers',
            delete: '/api/customers'
        },
        pagination: {
            perPage: 25,
            currentPage: 1,
            totalPages: 1,
            totalCount: 0
        },
        search: {
            query: '',
            sort: 'name',
            order: 'asc'
        }
    },

    // State
    state: {
        customers: [],
        currentCustomer: null,
        loading: false,
        currentView: 'table',
        modalMode: 'create' // 'create' or 'edit'
    },

    /**
     * Initialize customer management
     */
    init() {
        this.bindEvents();
        this.loadCustomers();
        console.log('Customer management initialized');
    },

    /**
     * Initialize customer detail view
     * @param {number} customerId - Customer ID
     */
    initDetailView(customerId) {
        this.bindDetailEvents();
        this.loadCustomerDetail(customerId);
        console.log('Customer detail view initialized for ID:', customerId);
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('customer-search');
        const searchBtn = document.getElementById('search-btn');
        
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.handleSearch(searchInput.value);
            }, 300));
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.handleSearch(searchInput.value);
            });
        }

        // Sort controls
        const sortSelect = document.getElementById('sort-select');
        const sortOrderBtn = document.getElementById('sort-order-btn');
        
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.handleSort(sortSelect.value, this.config.search.order);
            });
        }
        
        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                const newOrder = sortOrderBtn.dataset.order === 'asc' ? 'desc' : 'asc';
                sortOrderBtn.dataset.order = newOrder;
                this.handleSort(this.config.search.sort, newOrder);
            });
        }

        // View toggle
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleViewToggle(btn.dataset.view);
            });
        });

        // Add customer buttons
        const addCustomerBtn = document.getElementById('add-customer-btn');
        const addFirstCustomerBtn = document.getElementById('add-first-customer-btn');
        
        if (addCustomerBtn) {
            addCustomerBtn.addEventListener('click', () => this.showCustomerModal('create'));
        }
        
        if (addFirstCustomerBtn) {
            addFirstCustomerBtn.addEventListener('click', () => this.showCustomerModal('create'));
        }

        // Pagination
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.handlePagination('prev'));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.handlePagination('next'));
        }

        // Modal events
        this.bindModalEvents();

        // Table row clicks
        this.bindTableEvents();
    },

    /**
     * Bind detail view events
     */
    bindDetailEvents() {
        const editBtn = document.getElementById('edit-customer-btn');
        const deleteBtn = document.getElementById('delete-customer-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                if (this.state.currentCustomer) {
                    this.showCustomerModal('edit', this.state.currentCustomer);
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.showDeleteModal());
        }

        // Delete modal events
        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => this.hideDeleteModal());
        }
        
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.deleteCustomer());
        }
    },

    /**
     * Bind modal events
     */
    bindModalEvents() {
        const modal = document.getElementById('customer-modal');
        const closeBtn = document.getElementById('customer-modal-close');
        const cancelBtn = document.getElementById('customer-form-cancel');
        const form = document.getElementById('customer-form');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideCustomerModal());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideCustomerModal());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideCustomerModal();
                }
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        // Real-time validation
        this.bindFormValidation();
    },

    /**
     * Bind form validation events
     */
    bindFormValidation() {
        const nameInput = document.getElementById('customer-name-input');
        const emailInput = document.getElementById('customer-email-input');
        const phoneInput = document.getElementById('customer-phone-input');
        const notesInput = document.getElementById('customer-notes-input');
        
        if (nameInput) {
            nameInput.addEventListener('blur', () => this.validateField('name', nameInput.value));
        }
        
        if (emailInput) {
            emailInput.addEventListener('blur', () => this.validateField('email', emailInput.value));
        }
        
        if (phoneInput) {
            phoneInput.addEventListener('blur', () => this.validateField('phone', phoneInput.value));
        }
        
        if (notesInput) {
            notesInput.addEventListener('input', () => {
                this.updateCharacterCount();
            });
        }
    },

    /**
     * Bind table row events
     */
    bindTableEvents() {
        // Event delegation for dynamically created rows
        const tbody = document.getElementById('customers-tbody');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const row = e.target.closest('.customer-row');
                if (row && !e.target.closest('.customer-actions')) {
                    const customerId = row.dataset.customerId;
                    this.viewCustomerDetail(customerId);
                }
                
                // Handle action buttons
                if (e.target.closest('.edit-customer')) {
                    const customerId = e.target.closest('.customer-row').dataset.customerId;
                    this.loadCustomerForEdit(customerId);
                }
                
                if (e.target.closest('.delete-customer')) {
                    const customerId = e.target.closest('.customer-row').dataset.customerId;
                    this.confirmDeleteCustomer(customerId);
                }
            });
        }
    },

    /**
     * Load customers from API
     */
    async loadCustomers() {
        this.state.loading = true;
        this.showLoading();

        try {
            const params = {
                page: this.config.pagination.currentPage,
                per_page: this.config.pagination.perPage,
                search: this.config.search.query,
                sort: this.config.search.sort,
                order: this.config.search.order
            };

            const response = await API.get(this.config.apiEndpoints.list, params);
            
            if (response.success) {
                this.state.customers = response.data;
                this.updatePaginationConfig(response.meta);
                this.renderCustomers();
                this.updateStats();
            } else {
                this.showError(response.message || 'Failed to load customers');
            }
        } catch (error) {
            console.error('Error loading customers:', error);
            this.showError('Failed to load customers. Please try again.');
        } finally {
            this.state.loading = false;
            this.hideLoading();
        }
    },

    /**
     * Load customer detail
     * @param {number} customerId - Customer ID
     */
    async loadCustomerDetail(customerId) {
        this.showLoading();

        try {
            const response = await API.get(`${this.config.apiEndpoints.detail}/${customerId}`);
            
            if (response.success) {
                this.state.currentCustomer = response.data;
                this.renderCustomerDetail(response.data);
            } else {
                this.showError(response.message || 'Customer not found');
            }
        } catch (error) {
            console.error('Error loading customer detail:', error);
            this.showError('Failed to load customer details. Please try again.');
        } finally {
            this.hideLoading();
        }
    },

    /**
     * Handle search
     * @param {string} query - Search query
     */
    handleSearch(query) {
        this.config.search.query = query;
        this.config.pagination.currentPage = 1;
        this.loadCustomers();
    },

    /**
     * Handle sorting
     * @param {string} sort - Sort field
     * @param {string} order - Sort order
     */
    handleSort(sort, order) {
        this.config.search.sort = sort;
        this.config.search.order = order;
        this.config.pagination.currentPage = 1;
        this.loadCustomers();
    },

    /**
     * Handle view toggle
     * @param {string} view - View type ('table' or 'cards')
     */
    handleViewToggle(view) {
        this.state.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Show/hide views
        const tableView = document.getElementById('table-view');
        const cardsView = document.getElementById('cards-view');
        
        if (tableView && cardsView) {
            tableView.style.display = view === 'table' ? 'block' : 'none';
            cardsView.style.display = view === 'cards' ? 'block' : 'none';
        }
        
        this.renderCustomers();
    },

    /**
     * Handle pagination
     * @param {string} direction - 'prev', 'next', or page number
     */
    handlePagination(direction) {
        if (direction === 'prev' && this.config.pagination.currentPage > 1) {
            this.config.pagination.currentPage--;
        } else if (direction === 'next' && this.config.pagination.currentPage < this.config.pagination.totalPages) {
            this.config.pagination.currentPage++;
        } else if (typeof direction === 'number') {
            this.config.pagination.currentPage = direction;
        }
        
        this.loadCustomers();
    },

    /**
     * Show customer modal
     * @param {string} mode - 'create' or 'edit'
     * @param {Object} customer - Customer data (for edit mode)
     */
    showCustomerModal(mode, customer = null) {
        this.state.modalMode = mode;
        const modal = document.getElementById('customer-modal');
        const title = document.getElementById('customer-modal-title');
        const submitBtn = document.getElementById('submit-btn-text');
        
        if (mode === 'create') {
            title.textContent = 'Add Customer';
            submitBtn.textContent = 'Add Customer';
            this.clearForm();
        } else {
            title.textContent = 'Edit Customer';
            submitBtn.textContent = 'Update Customer';
            this.populateForm(customer);
        }
        
        modal.style.display = 'block';
        modal.classList.add('fade-in');
        
        // Focus first input
        const firstInput = document.getElementById('customer-name-input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    },

    /**
     * Hide customer modal
     */
    hideCustomerModal() {
        const modal = document.getElementById('customer-modal');
        modal.style.display = 'none';
        modal.classList.remove('fade-in');
        this.clearFormErrors();
    },

    /**
     * Handle form submission
     */
    async handleFormSubmit() {
        const form = document.getElementById('customer-form');
        const formData = new FormData(form);
        
        // Validate form
        if (!this.validateForm()) {
            return;
        }
        
        // Prepare data
        const customerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            notes: formData.get('notes')
        };
        
        // Show loading state
        this.setFormLoading(true);
        
        try {
            let response;
            
            if (this.state.modalMode === 'create') {
                response = await API.post(this.config.apiEndpoints.create, customerData);
            } else {
                const customerId = formData.get('customer_id');
                response = await API.put(`${this.config.apiEndpoints.update}/${customerId}`, customerData);
            }
            
            if (response.success) {
                Utils.showFlashMessage(response.message || 'Customer saved successfully', 'success');
                this.hideCustomerModal();
                
                // Refresh data
                if (window.location.pathname.includes('/customers/')) {
                    // Detail view - reload customer
                    this.loadCustomerDetail(response.data.id);
                } else {
                    // List view - reload customers
                    this.loadCustomers();
                }
            } else {
                this.handleFormErrors(response.errors);
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            this.showFormError('Failed to save customer. Please try again.');
        } finally {
            this.setFormLoading(false);
        }
    },

    /**
     * Show delete confirmation modal
     */
    showDeleteModal() {
        const modal = document.getElementById('delete-modal');
        const customerName = document.getElementById('delete-customer-name');
        
        if (this.state.currentCustomer) {
            customerName.textContent = this.state.currentCustomer.name;
        }
        
        modal.style.display = 'block';
        modal.classList.add('fade-in');
    },

    /**
     * Hide delete confirmation modal
     */
    hideDeleteModal() {
        const modal = document.getElementById('delete-modal');
        modal.style.display = 'none';
        modal.classList.remove('fade-in');
    },

    /**
     * Delete customer
     */
    async deleteCustomer() {
        if (!this.state.currentCustomer) return;
        
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const btnText = confirmBtn.querySelector('.btn-text');
        const btnSpinner = confirmBtn.querySelector('.btn-spinner');
        
        // Show loading state
        confirmBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'flex';
        
        try {
            const response = await API.delete(`${this.config.apiEndpoints.delete}/${this.state.currentCustomer.id}`);
            
            if (response.success) {
                Utils.showFlashMessage(response.message || 'Customer deleted successfully', 'success');
                this.hideDeleteModal();
                
                // Redirect to customer list
                setTimeout(() => {
                    window.location.href = '/customers';
                }, 1000);
            } else {
                Utils.showFlashMessage(response.message || 'Failed to delete customer', 'error');
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            Utils.showFlashMessage('Failed to delete customer. Please try again.', 'error');
        } finally {
            // Reset button state
            confirmBtn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    },

    /**
     * Render customers list
     */
    renderCustomers() {
        if (this.state.customers.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        
        if (this.state.currentView === 'table') {
            this.renderCustomersTable();
        } else {
            this.renderCustomersCards();
        }
        
        this.renderPagination();
    },

    /**
     * Render customers table
     */
    renderCustomersTable() {
        const tbody = document.getElementById('customers-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = this.state.customers.map(customer => `
            <tr class="customer-row" data-customer-id="${customer.id}">
                <td>
                    <div class="customer-name">${Utils.sanitizeHTML(customer.name)}</div>
                </td>
                <td>
                    <div class="customer-email">
                        ${customer.email ? `<a href="mailto:${customer.email}" class="email-link">${Utils.sanitizeHTML(customer.email)}</a>` : '-'}
                    </div>
                </td>
                <td>
                    <div class="customer-phone">
                        ${customer.phone ? `<a href="tel:${customer.phone}" class="phone-link">${Utils.sanitizeHTML(customer.phone)}</a>` : '-'}
                    </div>
                </td>
                <td>
                    <div class="customer-date">${Utils.formatDate(customer.created_at)}</div>
                </td>
                <td>
                    <div class="customer-actions">
                        <button class="btn btn-sm btn-outline edit-customer" title="Edit Customer">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L9.708 9H9a.5.5 0 0 1-.5-.5V8a.5.5 0 0 1 .146-.354l6-6z"/>
                                <path d="M5.707 9.707a.5.5 0 0 1-.707 0L1.146 5.854a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0L8.707 6H9a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.146.354L5.707 9.707z"/>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-danger delete-customer" title="Delete Customer">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    /**
     * Render customers cards
     */
    renderCustomersCards() {
        const container = document.getElementById('customer-cards');
        if (!container) return;
        
        container.innerHTML = this.state.customers.map(customer => `
            <div class="customer-card" data-customer-id="${customer.id}">
                <div class="customer-card-header">
                    <div class="customer-avatar">
                        ${customer.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 class="customer-card-name">${Utils.sanitizeHTML(customer.name)}</h3>
                </div>
                <div class="customer-card-details">
                    ${customer.email ? `
                        <div class="customer-card-detail">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2z"/>
                            </svg>
                            <span>${Utils.sanitizeHTML(customer.email)}</span>
                        </div>
                    ` : ''}
                    ${customer.phone ? `
                        <div class="customer-card-detail">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122L9.98 10.97a.678.678 0 0 1-.358-.063l-5.246-5.246a.678.678 0 0 1-.063-.358l.431-1.805a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
                            </svg>
                            <span>${Utils.sanitizeHTML(customer.phone)}</span>
                        </div>
                    ` : ''}
                    <div class="customer-card-detail">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5z"/>
                        </svg>
                        <span>${Utils.formatDate(customer.created_at)}</span>
                    </div>
                </div>
                <div class="customer-card-actions">
                    <button class="btn btn-outline edit-customer">Edit</button>
                    <button class="btn btn-primary" onclick="CustomerManager.viewCustomerDetail(${customer.id})">View</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render customer detail
     * @param {Object} customer - Customer data
     */
    renderCustomerDetail(customer) {
        // Update page title and breadcrumb
        const nameTitle = document.getElementById('customer-name-title');
        const nameBreadcrumb = document.getElementById('customer-name-breadcrumb');
        
        if (nameTitle) nameTitle.textContent = customer.name;
        if (nameBreadcrumb) nameBreadcrumb.textContent = customer.name;
        
        // Update customer info
        document.getElementById('customer-name').textContent = customer.name;
        
        const emailLink = document.getElementById('customer-email');
        if (customer.email) {
            emailLink.textContent = customer.email;
            emailLink.href = `mailto:${customer.email}`;
        } else {
            emailLink.textContent = '-';
            emailLink.removeAttribute('href');
        }
        
        const phoneLink = document.getElementById('customer-phone');
        if (customer.phone) {
            phoneLink.textContent = customer.phone;
            phoneLink.href = `tel:${customer.phone}`;
        } else {
            phoneLink.textContent = '-';
            phoneLink.removeAttribute('href');
        }
        
        document.getElementById('customer-created').textContent = Utils.formatDate(customer.created_at, 'long');
        
        // Update notes
        const notesContainer = document.getElementById('customer-notes');
        if (customer.notes && customer.notes.trim()) {
            notesContainer.innerHTML = `<p>${Utils.sanitizeHTML(customer.notes).replace(/\n/g, '<br>')}</p>`;
        } else {
            notesContainer.innerHTML = '<p class="no-notes">No notes available for this customer.</p>';
        }
        
        // Show customer details
        document.getElementById('customer-details').style.display = 'block';
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('error-state').style.display = 'none';
    },

    /**
     * Navigate to customer detail view
     * @param {number} customerId - Customer ID
     */
    viewCustomerDetail(customerId) {
        window.location.href = `/customers/${customerId}`;
    },

    /**
     * Update pagination configuration
     * @param {Object} meta - Pagination metadata
     */
    updatePaginationConfig(meta) {
        this.config.pagination.totalCount = meta.total_count;
        this.config.pagination.totalPages = Math.ceil(meta.total_count / this.config.pagination.perPage);
        this.config.pagination.currentPage = meta.page;
    },

    /**
     * Update customer stats display
     */
    updateStats() {
        const totalCustomers = document.getElementById('total-customers');
        const showingCustomers = document.getElementById('showing-customers');
        
        if (totalCustomers) {
            totalCustomers.textContent = this.config.pagination.totalCount;
        }
        
        if (showingCustomers) {
            const start = (this.config.pagination.currentPage - 1) * this.config.pagination.perPage + 1;
            const end = Math.min(start + this.state.customers.length - 1, this.config.pagination.totalCount);
            showingCustomers.textContent = `${start}-${end}`;
        }
    },

    /**
     * Render pagination controls
     */
    renderPagination() {
        const container = document.getElementById('pagination-container');
        const info = document.getElementById('pagination-info-text');
        const pageNumbers = document.getElementById('page-numbers');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        
        if (!container || this.config.pagination.totalPages <= 1) {
            if (container) container.style.display = 'none';
            return;
        }
        
        container.style.display = 'flex';
        
        // Update info text
        if (info) {
            const start = (this.config.pagination.currentPage - 1) * this.config.pagination.perPage + 1;
            const end = Math.min(start + this.state.customers.length - 1, this.config.pagination.totalCount);
            info.textContent = `Showing ${start}-${end} of ${this.config.pagination.totalCount} customers`;
        }
        
        // Update prev/next buttons
        if (prevBtn) {
            prevBtn.disabled = this.config.pagination.currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.config.pagination.currentPage === this.config.pagination.totalPages;
        }
        
        // Render page numbers
        if (pageNumbers) {
            pageNumbers.innerHTML = this.generatePageNumbers();
        }
    },

    /**
     * Generate page number HTML
     * @returns {string} Page numbers HTML
     */
    generatePageNumbers() {
        const current = this.config.pagination.currentPage;
        const total = this.config.pagination.totalPages;
        const delta = 2; // Number of pages to show on each side
        
        let pages = [];
        
        // Always include first page
        if (current - delta > 1) {
            pages.push(1);
            if (current - delta > 2) {
                pages.push('...');
            }
        }
        
        // Add pages around current
        for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
            pages.push(i);
        }
        
        // Always include last page
        if (current + delta < total) {
            if (current + delta < total - 1) {
                pages.push('...');
            }
            pages.push(total);
        }
        
        return pages.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            } else {
                const isActive = page === current;
                return `<a href="#" class="page-number ${isActive ? 'active' : ''}" data-page="${page}">${page}</a>`;
            }
        }).join('');
    },

    /**
     * Show loading state
     */
    showLoading() {
        const loadingState = document.getElementById('loading-state');
        const tableView = document.getElementById('table-view');
        const cardsView = document.getElementById('cards-view');
        const emptyState = document.getElementById('empty-state');
        
        if (loadingState) loadingState.style.display = 'block';
        if (tableView) tableView.style.display = 'none';
        if (cardsView) cardsView.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    },

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingState = document.getElementById('loading-state');
        if (loadingState) loadingState.style.display = 'none';
    },

    /**
     * Show empty state
     */
    showEmptyState() {
        const emptyState = document.getElementById('empty-state');
        const tableView = document.getElementById('table-view');
        const cardsView = document.getElementById('cards-view');
        const paginationContainer = document.getElementById('pagination-container');
        
        if (emptyState) emptyState.style.display = 'block';
        if (tableView) tableView.style.display = 'none';
        if (cardsView) cardsView.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
    },

    /**
     * Hide empty state
     */
    hideEmptyState() {
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.style.display = 'none';
    },

    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message) {
        const errorState = document.getElementById('error-state');
        const errorMessage = document.getElementById('error-message');
        const loadingState = document.getElementById('loading-state');
        const customerDetails = document.getElementById('customer-details');
        
        if (errorState) errorState.style.display = 'block';
        if (errorMessage) errorMessage.textContent = message;
        if (loadingState) loadingState.style.display = 'none';
        if (customerDetails) customerDetails.style.display = 'none';
    },

    /**
     * Validate form
     * @returns {boolean} Whether form is valid
     */
    validateForm() {
        let isValid = true;
        
        // Clear previous errors
        this.clearFormErrors();
        
        // Validate name (required)
        const name = document.getElementById('customer-name-input').value.trim();
        if (!name) {
            this.showFieldError('customer-name-input', 'Customer name is required');
            isValid = false;
        }
        
        // Validate email (optional but must be valid if provided)
        const email = document.getElementById('customer-email-input').value.trim();
        if (email && !Utils.isValidEmail(email)) {
            this.showFieldError('customer-email-input', 'Please enter a valid email address');
            isValid = false;
        }
        
        // Validate phone (optional but must be valid if provided)
        const phone = document.getElementById('customer-phone-input').value.trim();
        if (phone && !this.isValidPhone(phone)) {
            this.showFieldError('customer-phone-input', 'Please enter a valid phone number');
            isValid = false;
        }
        
        return isValid;
    },

    /**
     * Validate individual field
     * @param {string} field - Field name
     * @param {string} value - Field value
     */
    validateField(field, value) {
        this.clearFieldError(`customer-${field}-input`);
        
        switch (field) {
            case 'name':
                if (!value.trim()) {
                    this.showFieldError('customer-name-input', 'Customer name is required');
                    return false;
                }
                break;
            case 'email':
                if (value && !Utils.isValidEmail(value)) {
                    this.showFieldError('customer-email-input', 'Please enter a valid email address');
                    return false;
                } else if (value) {
                    this.showFieldSuccess('customer-email-input', '✓ Email format is valid');
                }
                break;
            case 'phone':
                if (value && !this.isValidPhone(value)) {
                    this.showFieldError('customer-phone-input', 'Please enter a valid phone number');
                    return false;
                } else if (value) {
                    this.showFieldSuccess('customer-phone-input', '✓ Phone format is valid');
                }
                break;
        }
        
        return true;
    },

    /**
     * Validate phone number
     * @param {string} phone - Phone number
     * @returns {boolean} Whether phone is valid
     */
    isValidPhone(phone) {
        // Basic phone validation - adjust regex as needed
        const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)]{8,}$/;
        return phoneRegex.test(phone);
    },

    /**
     * Show field error
     * @param {string} fieldId - Field ID
     * @param {string} message - Error message
     */
    showFieldError(fieldId, message) {
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
     * @param {string} message - Success message
     */
    showFieldSuccess(fieldId, message) {
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
        
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
    },

    /**
     * Clear field error
     * @param {string} fieldId - Field ID
     */
    clearFieldError(fieldId) {
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
     * Clear all form errors
     */
    clearFormErrors() {
        const formError = document.getElementById('customer-form-error');
        if (formError) {
            formError.style.display = 'none';
        }
        
        // Clear field errors
        ['customer-name-input', 'customer-email-input', 'customer-phone-input', 'customer-notes-input'].forEach(fieldId => {
            this.clearFieldError(fieldId);
        });
    },

    /**
     * Show form error
     * @param {string} message - Error message
     */
    showFormError(message) {
        const formError = document.getElementById('customer-form-error');
        if (formError) {
            formError.textContent = message;
            formError.style.display = 'block';
        }
    },

    /**
     * Handle form errors from API
     * @param {Object} errors - Error object from API
     */
    handleFormErrors(errors) {
        if (errors) {
            Object.keys(errors).forEach(field => {
                if (errors[field] && errors[field].length > 0) {
                    this.showFieldError(`customer-${field}-input`, errors[field][0]);
                }
            });
        }
    },

    /**
     * Set form loading state
     * @param {boolean} loading - Whether form is loading
     */
    setFormLoading(loading) {
        const submitBtn = document.getElementById('customer-form-submit');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');
        
        submitBtn.disabled = loading;
        
        if (loading) {
            btnText.style.display = 'none';
            btnSpinner.style.display = 'flex';
        } else {
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    },

    /**
     * Clear form
     */
    clearForm() {
        const form = document.getElementById('customer-form');
        if (form) {
            form.reset();
            document.getElementById('customer-id').value = '';
        }
        this.clearFormErrors();
        this.updateCharacterCount();
    },

    /**
     * Populate form with customer data
     * @param {Object} customer - Customer data
     */
    populateForm(customer) {
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-name-input').value = customer.name || '';
        document.getElementById('customer-email-input').value = customer.email || '';
        document.getElementById('customer-phone-input').value = customer.phone || '';
        document.getElementById('customer-notes-input').value = customer.notes || '';
        
        this.updateCharacterCount();
    },

    /**
     * Update character count for notes field
     */
    updateCharacterCount() {
        const notesInput = document.getElementById('customer-notes-input');
        const charCount = document.getElementById('notes-char-count');
        
        if (notesInput && charCount) {
            charCount.textContent = notesInput.value.length;
        }
    }
};

// Export for global access
window.CustomerManager = CustomerManager;