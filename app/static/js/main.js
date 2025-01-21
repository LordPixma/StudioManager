// app/static/js/main.js

// General utility functions
function showAlert(message, type = 'info') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;

    document.body.appendChild(alertBox);

    setTimeout(() => {
        alertBox.remove();
    }, 3000);
}

// Confirm action utility
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// AJAX request utility
async function ajaxRequest(url, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    const options = { method, headers };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json();
            showAlert(error.message || 'An error occurred', 'danger');
            throw new Error(error.message || 'Request failed');
        }
        return await response.json();
    } catch (error) {
        console.error(error);
    }
}

// Example: Bind delete actions dynamically
document.addEventListener('DOMContentLoaded', () => {
    const deleteButtons = document.querySelectorAll('.delete-button');

    deleteButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const targetId = event.target.dataset.id;
            confirmAction('Are you sure you want to delete this item?', async () => {
                const url = `/delete/${targetId}`;
                const result = await ajaxRequest(url, 'DELETE');

                if (result && result.message) {
                    showAlert(result.message, 'success');
                    event.target.closest('.item-row').remove();
                }
            });
        });
    });
});
