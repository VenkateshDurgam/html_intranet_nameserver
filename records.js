// Records Manager

class RecordsManager {
    constructor() {
        this.records = [];
        this.currentRecord = null;
        this.editMode = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Create record button
        document.getElementById('create-record-btn')?.addEventListener('click', () => {
            this.openModal();
        });

        // Retry load button
        document.getElementById('retry-load-btn')?.addEventListener('click', () => {
            this.loadRecords();
        });

        // Close modal buttons
        document.getElementById('close-modal')?.addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('cancel-btn')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Access type change
        document.getElementById('access-type')?.addEventListener('change', (e) => {
            this.handleAccessTypeChange(e.target.value);
        });

        // Form submit
        document.getElementById('record-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Success modal
        document.getElementById('close-success-btn')?.addEventListener('click', () => {
            document.getElementById('success-modal').classList.add('hidden');
            this.loadRecords();
        });

        // Copy UUID buttons
        document.getElementById('copy-uuid-btn')?.addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('generated-uuid').textContent);
        });
        document.getElementById('copy-view-uuid-btn')?.addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('view-uuid').textContent);
        });

        // View modal
        document.getElementById('close-view-modal')?.addEventListener('click', () => {
            document.getElementById('view-modal').classList.add('hidden');
        });
        document.getElementById('close-view-btn')?.addEventListener('click', () => {
            document.getElementById('view-modal').classList.add('hidden');
        });
        document.getElementById('delete-record-btn')?.addEventListener('click', () => {
            this.deleteRecord();
        });
        document.getElementById('edit-record-btn')?.addEventListener('click', () => {
            this.editRecord();
        });
    }

    // Open create/edit modal
    openModal(record = null) {
        const modal = document.getElementById('record-modal');
        const title = document.getElementById('modal-title');
        const submitBtn = document.getElementById('submit-btn');

        this.editMode = record !== null;
        this.currentRecord = record;

        if (this.editMode) {
            title.textContent = 'Edit Record';
            submitBtn.textContent = 'Update Record';
            this.populateForm(record);
        } else {
            title.textContent = 'Create New Record';
            submitBtn.textContent = 'Create Record';
            this.resetForm();
        }

        captchaManager.refreshCaptcha();
        modal.classList.remove('hidden');
    }

    // Close modal
    closeModal() {
        document.getElementById('record-modal').classList.add('hidden');
        this.resetForm();
    }

    // Reset form
    resetForm() {
        document.getElementById('record-form').reset();
        document.getElementById('pin-fields').classList.add('hidden');
        document.getElementById('expiry-fields').classList.add('hidden');
        document.getElementById('captcha-input').value = '';
    }

    // Populate form for editing
    populateForm(record) {
        document.getElementById('record-name').value = record.name;
        document.getElementById('config-json').value = JSON.stringify(record.config, null, 2);
        document.getElementById('access-type').value = record.accessType;
        
        this.handleAccessTypeChange(record.accessType);

        if (record.pin) {
            document.getElementById('pin-code').value = record.pin;
        }
        if (record.expiresAt) {
            const date = new Date(record.expiresAt.seconds * 1000);
            document.getElementById('expiry-date').value = this.formatDateTimeLocal(date);
        }
    }

    // Handle access type change
    handleAccessTypeChange(type) {
        const pinFields = document.getElementById('pin-fields');
        const expiryFields = document.getElementById('expiry-fields');
        const pinInput = document.getElementById('pin-code');
        const expiryInput = document.getElementById('expiry-date');

        // Reset required attributes
        pinInput.removeAttribute('required');
        expiryInput.removeAttribute('required');

        // Hide all fields first
        pinFields.classList.add('hidden');
        expiryFields.classList.add('hidden');

        // Show relevant fields based on type
        switch (type) {
            case 'fixed-pin-expiry':
                pinFields.classList.remove('hidden');
                expiryFields.classList.remove('hidden');
                pinInput.setAttribute('required', 'required');
                expiryInput.setAttribute('required', 'required');
                break;
            case 'fixed-pin-no-expiry':
                pinFields.classList.remove('hidden');
                pinInput.setAttribute('required', 'required');
                break;
            case 'otp-expiry':
                expiryFields.classList.remove('hidden');
                expiryInput.setAttribute('required', 'required');
                break;
        }
    }

    // Handle form submit
    async handleSubmit() {
        const captchaInput = document.getElementById('captcha-input').value;
        
        // Validate CAPTCHA
        if (!captchaManager.validate(captchaInput)) {
            alert('Invalid CAPTCHA. Please try again.');
            captchaManager.refreshCaptcha();
            return;
        }

        // Get form data
        const name = document.getElementById('record-name').value.trim();
        const configJson = document.getElementById('config-json').value.trim();
        const accessType = document.getElementById('access-type').value;
        const pin = document.getElementById('pin-code').value.trim();
        const expiryDate = document.getElementById('expiry-date').value;

        // Validate JSON
        let config;
        try {
            // Trim and clean the JSON string
            const cleanJson = configJson.trim();
            config = JSON.parse(cleanJson);
            
            // Validate it's an object
            if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                throw new Error('Configuration must be a JSON object');
            }
        } catch (error) {
            alert('Invalid JSON format.\n\nError: ' + error.message + '\n\nPlease check your configuration and try again.');
            return;
        }

        // Validate PIN if required
        if ((accessType === 'fixed-pin-expiry' || accessType === 'fixed-pin-no-expiry') && !/^\d{6}$/.test(pin)) {
            alert('PIN must be exactly 6 digits.');
            return;
        }

        // Prepare record data
        const recordData = {
            name,
            config,
            accessType,
            userId: authManager.getUserId(),
            userEmail: authManager.getUserEmail(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Add PIN if applicable
        if (accessType === 'fixed-pin-expiry' || accessType === 'fixed-pin-no-expiry') {
            recordData.pin = pin;
        }

        // Add expiry if applicable
        if (accessType === 'fixed-pin-expiry' || accessType === 'otp-expiry') {
            recordData.expiresAt = firebase.firestore.Timestamp.fromDate(new Date(expiryDate));
        }

        // Generate OTP if needed
        if (accessType === 'otp-expiry') {
            recordData.otp = this.generateOTP();
            recordData.otpUsed = false;
        }

        try {
            if (this.editMode && this.currentRecord) {
                // Update existing record
                await db.collection('configs').doc(this.currentRecord.id).update(recordData);
                alert('Record updated successfully!');
                this.closeModal();
                this.loadRecords();
            } else {
                // Create new record
                const docRef = await db.collection('configs').add(recordData);
                
                // Show success modal with UUID
                this.showSuccessModal(docRef.id, recordData);
                this.closeModal();
            }
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Failed to save record: ' + error.message);
        }
    }

    // Generate OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    document
  .getElementById("regenerateOtpBtn")
  .addEventListener("click", async () => {
    let newOtp = generateOTP(6); // create new code
    // update the record in the database
    await updateRecord(recordId, { otp: newOtp });
    alert("New OTP generated: " + newOtp);
});

    // Show success modal
    showSuccessModal(uuid, recordData) {
        const modal = document.getElementById('success-modal');
        const uuidDisplay = document.getElementById('generated-uuid');
        const pinDisplay = document.getElementById('pin-display');
        const pinValue = document.getElementById('generated-pin');
        const configDisplay = document.getElementById('success-config');

        uuidDisplay.textContent = uuid;

        // Show PIN/OTP if applicable
        if (recordData.pin) {
            pinDisplay.classList.remove('hidden');
            pinValue.textContent = recordData.pin;
        } else if (recordData.otp) {
            pinDisplay.classList.remove('hidden');
            pinValue.textContent = recordData.otp;
        } else {
            pinDisplay.classList.add('hidden');
        }

        // Display configuration JSON
        configDisplay.textContent = JSON.stringify(recordData.config, null, 2);

        modal.classList.remove('hidden');
    }

    // Load records
    async loadRecords() {
        const userId = authManager.getUserId();
        if (!userId) {
            console.log('No user ID found, cannot load records');
            return;
        }

        console.log('Loading records for user:', userId);

        // Show loading state
        this.showLoadingState();

        try {
            // Try the optimized query with orderBy
            const snapshot = await db.collection('configs')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            console.log('Records loaded:', snapshot.size);

            this.records = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.renderRecords();
        } catch (error) {
            console.error('Error loading records:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            // If index doesn't exist, try without orderBy
            if (error.code === 'failed-precondition' || error.message.includes('index')) {
                console.log('Index not available, trying query without orderBy...');
                try {
                    const snapshot = await db.collection('configs')
                        .where('userId', '==', userId)
                        .get();
                    
                    console.log('Records loaded (unordered):', snapshot.size);
                    
                    // Sort manually in JavaScript
                    this.records = snapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }))
                        .sort((a, b) => {
                            const aTime = a.createdAt?.seconds || 0;
                            const bTime = b.createdAt?.seconds || 0;
                            return bTime - aTime; // Descending order
                        });
                    
                    this.renderRecords();
                    
                    // Show info message about index
                    console.warn('⚠️ Records loaded but not sorted by Firestore. Create the index for better performance.');
                    return;
                } catch (fallbackError) {
                    console.error('Fallback query also failed:', fallbackError);
                    error = fallbackError; // Use this error for the error state
                }
            }
            
            // Show error state with specific message
            let errorMessage = 'An error occurred while loading records.';
            
            if (error.code === 'failed-precondition' || error.message.includes('index')) {
                errorMessage = 'Database index not configured. Please follow the setup guide (FIRESTORE_QUICKSTART.md) to create the required index.';
            } else if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. Please follow the setup guide (FIRESTORE_QUICKSTART.md) to deploy Firestore security rules.';
            } else {
                errorMessage = error.message;
            }
            
            this.showErrorState(errorMessage);
        }
    }

    // Show loading state
    showLoadingState() {
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('records-list').innerHTML = '';
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('error-state').classList.add('hidden');
    }

    // Show error state
    showErrorState(message) {
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('records-list').innerHTML = '';
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }

    // Render records
    renderRecords() {
        const container = document.getElementById('records-list');
        const emptyState = document.getElementById('empty-state');
        const loadingState = document.getElementById('loading-state');
        const errorState = document.getElementById('error-state');

        // Hide loading and error states
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');

        if (this.records.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.innerHTML = this.records.map(record => this.renderRecordCard(record)).join('');

        // Add click listeners
        container.querySelectorAll('.record-card').forEach((card, index) => {
            card.addEventListener('click', () => {
                this.viewRecord(this.records[index]);
            });
        });
    }

    // Render single record card
    renderRecordCard(record) {
        const accessTypeLabels = {
            'no-pin': 'Public',
            'fixed-pin-expiry': 'PIN + Expiry',
            'fixed-pin-no-expiry': 'PIN',
            'otp-expiry': 'OTP'
        };

        const badgeClasses = {
            'no-pin': 'badge-public',
            'fixed-pin-expiry': 'badge-pin',
            'fixed-pin-no-expiry': 'badge-pin',
            'otp-expiry': 'badge-otp'
        };

        const createdAt = record.createdAt ? new Date(record.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const expiresAt = record.expiresAt ? new Date(record.expiresAt.seconds * 1000).toLocaleDateString() : null;

        return `
            <div class="record-card">
                <div class="record-card-header">
                    <h3>${this.escapeHtml(record.name)}</h3>
                    <span class="record-badge ${badgeClasses[record.accessType]}">${accessTypeLabels[record.accessType]}</span>
                </div>
                <div class="record-uuid">${record.id}</div>
                <div class="record-meta">
                    <span>Created: ${createdAt}</span>
                    ${expiresAt ? `<span>Expires: ${expiresAt}</span>` : ''}
                </div>
            </div>
        `;
    }

    // View record details
    viewRecord(record) {
        const modal = document.getElementById('view-modal');
        
        document.getElementById('view-name').textContent = record.name;
        document.getElementById('view-uuid').textContent = record.id;
        document.getElementById('view-access-type').textContent = this.getAccessTypeLabel(record.accessType);
        document.getElementById('view-config').textContent = JSON.stringify(record.config, null, 2);
        
        const createdAt = record.createdAt ? new Date(record.createdAt.seconds * 1000).toLocaleString() : 'N/A';
        document.getElementById('view-created').textContent = createdAt;

        // Show/hide PIN
        const pinRow = document.getElementById('view-pin-row');
        if (record.pin) {
            pinRow.classList.remove('hidden');
            document.getElementById('view-pin').textContent = record.pin;
        } else {
            pinRow.classList.add('hidden');
        }

        // Show/hide expiry
        const expiryRow = document.getElementById('view-expiry-row');
        if (record.expiresAt) {
            expiryRow.classList.remove('hidden');
            const expiresAt = new Date(record.expiresAt.seconds * 1000).toLocaleString();
            document.getElementById('view-expiry').textContent = expiresAt;
        } else {
            expiryRow.classList.add('hidden');
        }

        this.currentRecord = record;
        modal.classList.remove('hidden');
    }

    // Edit record
    editRecord() {
        document.getElementById('view-modal').classList.add('hidden');
        this.openModal(this.currentRecord);
    }

    // Delete record
    async deleteRecord() {
        if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
            return;
        }

        try {
            await db.collection('configs').doc(this.currentRecord.id).delete();
            document.getElementById('view-modal').classList.add('hidden');
            this.loadRecords();
            alert('Record deleted successfully!');
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('Failed to delete record: ' + error.message);
        }
    }

    // Helper: Get access type label
    getAccessTypeLabel(type) {
        const labels = {
            'no-pin': 'No PIN (Public)',
            'fixed-pin-expiry': 'Fixed PIN with Expiration',
            'fixed-pin-no-expiry': 'Fixed PIN without Expiration',
            'otp-expiry': 'OTP with Expiration'
        };
        return labels[type] || type;
    }

    // Helper: Format datetime-local input
    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Helper: Copy to clipboard
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    // Helper: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance after Firebase is ready
if (typeof firebase !== 'undefined' && typeof db !== 'undefined') {
    window.recordsManager = new RecordsManager();
} else {
    window.addEventListener('firebase-ready', () => {
        window.recordsManager = new RecordsManager();
    });
}
