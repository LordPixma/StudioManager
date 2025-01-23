// app/static/js/manage_availability.js

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const roomSelect = document.getElementById('room-select');
    const customerSelect = document.getElementById('customer-select');
    const markAvailableBtn = document.getElementById('mark-available');
    const markUnavailableBtn = document.getElementById('mark-unavailable');
    const bookCustomerBtn = document.getElementById('book-customer');
    const statusMessage = document.getElementById('status-message');

    // Debugging: Check if buttons are found in the DOM
    console.log('markAvailableBtn:', markAvailableBtn);
    console.log('markUnavailableBtn:', markUnavailableBtn);
    console.log('bookCustomerBtn:', bookCustomerBtn);

    // Selected time slot state
    let selectedDate = null;
    let selectedTime = null;

    // Initialize calendar
    const calendar = $('#calendar').fullCalendar({
        defaultView: 'agendaWeek',
        selectable: true,
        selectHelper: true,
        editable: false,
        slotDuration: '01:00:00',
        header: {
            left: 'prev,next today',
            center: 'title',
            right: 'agendaWeek,agendaDay'
        },
        select: function(start, end) {
            selectedDate = start.format('YYYY-MM-DD');
            selectedTime = start.format('HH:mm');
            showMessage('Time slot selected: ' + start.format('MMMM D, YYYY HH:mm'), 'info');
        }
    });

    // Load room availability when room is selected
    roomSelect.addEventListener('change', loadRoomAvailability);

    // Mark as Available button
    markAvailableBtn.addEventListener('click', async () => {
        if (!selectedDate || !selectedTime) {
            showMessage('Please select a time slot first', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomSelect.value}/availability`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    availability: {
                        day: selectedDate,
                        time: selectedTime,
                        status: 'available'
                    }
                })
            });

            if (response.ok) {
                showMessage('Time slot marked as available', 'success');
                loadRoomAvailability();
            } else {
                const data = await response.json();
                showMessage(data.error || 'Failed to update availability', 'error');
            }
        } catch (error) {
            showMessage('Error updating availability', 'error');
        }
    });

    // Mark as Unavailable button
    markUnavailableBtn.addEventListener('click', async () => {
        if (!selectedDate || !selectedTime) {
            showMessage('Please select a time slot first', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomSelect.value}/availability`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    availability: {
                        day: selectedDate,
                        time: selectedTime,
                        status: 'unavailable'
                    }
                })
            });

            if (response.ok) {
                showMessage('Time slot marked as unavailable', 'success');
                loadRoomAvailability();
            } else {
                const data = await response.json();
                showMessage(data.error || 'Failed to update availability', 'error');
            }
        } catch (error) {
            showMessage('Error updating availability', 'error');
        }
    });

    // Book for Customer button
    bookCustomerBtn.addEventListener('click', async () => {
        if (!selectedDate || !selectedTime) {
            showMessage('Please select a time slot first', 'error');
            return;
        }

        if (!customerSelect.value) {
            showMessage('Please select a customer', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomSelect.value}/availability`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    availability: {
                        day: selectedDate,
                        time: selectedTime,
                        status: 'booked',
                        customer_id: customerSelect.value
                    }
                })
            });

            if (response.ok) {
                showMessage('Session booked successfully', 'success');
                loadRoomAvailability();
            } else {
                const data = await response.json();
                showMessage(data.error || 'Failed to book session', 'error');
            }
        } catch (error) {
            showMessage('Error booking session', 'error');
        }
    });

    // Load room availability
    async function loadRoomAvailability() {
        try {
            const response = await fetch(`/api/rooms/${roomSelect.value}/availability`);
            if (response.ok) {
                const data = await response.json();
                updateCalendar(data.availability);
            } else {
                showMessage('Failed to load room availability', 'error');
            }
        } catch (error) {
            showMessage('Error loading room availability', 'error');
        }
    }

    // Update calendar with availability data
    function updateCalendar(availability) {
        calendar.fullCalendar('removeEvents');
        
        for (const day in availability) {
            for (const time in availability[day]) {
                const slot = availability[day][time];
                const event = {
                    title: slot.status === 'booked' ? `Booked: ${slot.customer_name}` : slot.status,
                    start: `${day}T${time}`,
                    end: moment(`${day}T${time}`).add(1, 'hour').format(),
                    color: getEventColor(slot.status)
                };
                calendar.fullCalendar('renderEvent', event, true);
            }
        }
    }

    // Get color for calendar events based on status
    function getEventColor(status) {
        switch (status) {
            case 'available':
                return '#10B981'; // Green
            case 'unavailable':
                return '#EF4444'; // Red
            case 'booked':
                return '#3B82F6'; // Blue
            default:
                return '#6B7280'; // Gray
        }
    }

    // Show status message
    function showMessage(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `mt-4 p-4 rounded ${getMessageClass(type)}`;
        statusMessage.classList.remove('hidden');
        
        // Hide message after 3 seconds
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 3000);
    }

    // Get CSS class for message type
    function getMessageClass(type) {
        switch (type) {
            case 'success':
                return 'bg-green-100 text-green-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            case 'info':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    // Load initial availability for first room
    loadRoomAvailability();
});