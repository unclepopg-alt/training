/**
 * Room Booking System Logic
 * Features: LocalStorage persistence, FullCalendar integration, Chart.js analysis, PDF Export
 */

let calendar;
let bookings = [];
let roomChartInstance = null;
let usageChartInstance = null;

// Selectors
const bookingModal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const closeBtn = document.querySelector('.close-modal');
const cancelBtn = document.querySelector('.cancel-modal');
const addBookingBtn = document.getElementById('addBookingBtn');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadBookings();
    initCalendar();
    updateCharts();
    setupEventListeners();
    updateDashboard();
    initNavigation();
});

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            if (targetId) {
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });

                    // Update active state
                    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    });
}

function setupEventListeners() {
    addBookingBtn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());

    window.onclick = (event) => {
        if (event.target == bookingModal) closeModal();
    };

    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveBooking();
    });
}

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'th',
        selectable: true,
        editable: true,
        height: 'auto',
        events: getCalendarEvents(),
        select: function (info) {
            openModal(info.startStr, info.endStr);
        },
        eventClick: function (info) {
            if (confirm(`คุณต้องการลบการจอง "${info.event.title}" ใช่หรือไม่?`)) {
                deleteBooking(info.event.id);
            }
        },
        eventDrop: function (info) {
            updateBookingDate(info.event);
        },
        eventResize: function (info) {
            updateBookingDate(info.event);
        }
    });
    calendar.render();
}

function updateBookingDate(event) {
    const id = event.id;
    const booking = bookings.find(b => b.id === id);
    if (booking) {
        booking.startDate = event.startStr.split('T')[0];
        booking.endDate = (event.endStr || event.startStr).split('T')[0];
        if (event.start && (event.start.getHours() || event.start.getMinutes())) {
            booking.startTime = event.start.toTimeString().slice(0, 5);
        }
        if (event.end && (event.end.getHours() || event.end.getMinutes())) {
            booking.endTime = event.end.toTimeString().slice(0, 5);
        }
        localStorage.setItem('room_bookings', JSON.stringify(bookings));
        updateDashboard();
    }
}

function openModal(startStr = '', endStr = '') {
    bookingForm.reset();
    if (startStr) {
        let start = new Date(startStr);
        let end = new Date(endStr);

        document.getElementById('startDate').value = startStr.split('T')[0];

        if (endStr && end > start) {
            let adjustedEnd = new Date(end);
            adjustedEnd.setDate(adjustedEnd.getDate() - 1);
            document.getElementById('endDate').value = adjustedEnd.toISOString().split('T')[0];
        } else {
            document.getElementById('endDate').value = startStr.split('T')[0];
        }
    }
    bookingModal.classList.add('show');
}

function closeModal() {
    bookingModal.classList.remove('show');
}

function saveBooking() {
    const booking = {
        id: Date.now().toString(),
        room: document.getElementById('roomSelect').value,
        user: document.getElementById('userName').value,
        department: document.getElementById('department').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        purpose: document.getElementById('purpose').value,
        timestamp: new Date().toISOString()
    };

    bookings.push(booking);
    localStorage.setItem('room_bookings', JSON.stringify(bookings));

    calendar.addEvent({
        id: booking.id,
        title: `${booking.room}: ${booking.user}`,
        start: `${booking.startDate}T${booking.startTime}`,
        end: `${booking.endDate}T${booking.endTime}`,
        backgroundColor: getRoomColor(booking.room)
    });

    closeModal();
    updateDashboard();
}

function deleteBooking(id) {
    bookings = bookings.filter(b => b.id !== id);
    localStorage.setItem('room_bookings', JSON.stringify(bookings));
    calendar.getEventById(id).remove();
    updateDashboard();
}

function loadBookings() {
    const saved = localStorage.getItem('room_bookings');
    if (saved) {
        bookings = JSON.parse(saved);
    }
}

function getCalendarEvents() {
    return bookings.map(b => ({
        id: b.id,
        title: `${b.startTime}-${b.endTime} | ${b.user}`, // Show time and name
        start: `${b.startDate}T${b.startTime}`,
        end: `${b.endDate}T${b.endTime}`,
        backgroundColor: getRoomColor(b.room)
    }));
}

function updateDashboard() {
    // Stats
    document.getElementById('totalBookings').innerText = bookings.length;

    // Monthly stats
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const monthlyCount = bookings.filter(b => b.startDate.startsWith(thisMonth)).length;
    document.getElementById('monthlyBookings').innerText = monthlyCount;

    // Top Room
    const roomCounts = {};
    bookings.forEach(b => roomCounts[b.room] = (roomCounts[b.room] || 0) + 1);
    const sortedRooms = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]);
    const topRoom = sortedRooms[0];
    document.getElementById('topRoom').innerText = topRoom ? topRoom[0] : '0';

    updateCharts();
}

function updateCharts() {
    const roomCtx = document.getElementById('roomChart').getContext('2d');
    const usageCtx = document.getElementById('usageChart').getContext('2d');

    if (roomChartInstance) roomChartInstance.destroy();
    if (usageChartInstance) usageChartInstance.destroy();

    const roomData = {};
    const usageData = {};

    const standardRooms = ['ห้องอบรมคอมพิวเตอร์ กรมเทคโนโลยีสารสนเทศและอวกาศกลาโหม', 'ห้องอบรม 2', 'ห้องประชุมใหญ่', 'ห้องปฏิบัติการ'];
    standardRooms.forEach(r => roomData[r] = 0);

    bookings.forEach(b => {
        roomData[b.room] = (roomData[b.room] || 0) + 1;
        const month = b.startDate.slice(0, 7);
        usageData[month] = (usageData[month] || 0) + 1;
    });

    roomChartInstance = new Chart(roomCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(roomData),
            datasets: [{
                data: Object.values(roomData),
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'],
                hoverOffset: 15,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, font: { family: 'Kanit', size: 12 } } }
            }
        }
    });

    const sortedUsageMonths = Object.keys(usageData).sort();
    const sortedUsageValues = sortedUsageMonths.map(m => usageData[m]);

    usageChartInstance = new Chart(usageCtx, {
        type: 'bar',
        data: {
            labels: sortedUsageMonths.map(m => {
                const [y, mm] = m.split('-');
                const date = new Date(y, mm - 1);
                return date.toLocaleDateString('th-TH', { month: 'short' }) + ' ' + (parseInt(y) + 543).toString().slice(2);
            }),
            datasets: [{
                label: 'จำนวนการจอง',
                data: sortedUsageValues,
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 8,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#94a3b8', stepSize: 1, font: { family: 'Kanit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Kanit' } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function getRoomColor(room) {
    const colors = {
        'ห้องอบรมคอมพิวเตอร์ กรมเทคโนโลยีสารสนเทศและอวกาศกลาโหม': '#6366f1',
        'ห้องอบรม 2': '#10b981',
        'ห้องประชุมใหญ่': '#f59e0b',
        'ห้องปฏิบัติการ': '#8b5cf6'
    };
    return colors[room] || '#64748b';
}

function formatThaiDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * PDF Export Functionality - Focused on Guest Names
 */
function exportBookingData() {
    if (bookings.length === 0) {
        alert('ไม่มีข้อมูลการจองเพื่อส่งออก');
        return;
    }

    const reportContainer = document.createElement('div');
    reportContainer.style.padding = '40px';
    reportContainer.style.background = '#ffffff';
    reportContainer.style.color = '#1e293b';
    reportContainer.style.fontFamily = 'Kanit, sans-serif';

    const header = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px;">
            <h1 style="color: #4f46e5; margin-bottom: 5px;">รายชื่อผู้จองห้องอบรม</h1>
            <p style="color: #64748b; font-size: 14px;">กรมเทคโนโลยีสารสนเทศและอวกาศกลาโหม</p>
        </div>
    `;

    let tableRows = bookings.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).map((b, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; text-align: center;">${i + 1}</td>
            <td style="padding: 12px; font-weight: 500;">${b.user}</td>
            <td style="padding: 12px;">${b.department || '-'}</td>
            <td style="padding: 12px; text-align: center;">${formatThaiDate(b.startDate)}</td>
            <td style="padding: 12px; text-align: center;">${b.startTime} - ${b.endTime}</td>
            <td style="padding: 12px; color: #64748b;">${b.room}</td>
        </tr>
    `).join('');

    const content = `
        ${header}
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; width: 60px;">ลำดับ</th>
                    <th style="padding: 12px; text-align: left;">ชื่อผู้จอง</th>
                    <th style="padding: 12px; text-align: left;">หน่วยงาน</th>
                    <th style="padding: 12px;">วันที่จอง</th>
                    <th style="padding: 12px;">เวลาจอง</th>
                    <th style="padding: 12px; text-align: left;">ห้องอบรม</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <div style="margin-top: 40px; text-align: right; color: #94a3b8; font-size: 12px;">
            ออกรายงานเมื่อ: ${new Date().toLocaleString('th-TH')}
        </div>
    `;

    reportContainer.innerHTML = content;
    document.body.appendChild(reportContainer);

    const opt = {
        margin: [10, 10],
        filename: `Booking_Guest_List_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const exportBtn = document.querySelector('button[onclick="exportBookingData()"]');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้าง PDF...';
    exportBtn.disabled = true;

    html2pdf().set(opt).from(reportContainer).save().then(() => {
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
        document.body.removeChild(reportContainer);
    }).catch(err => {
        console.error('PDF Export Error:', err);
        alert('เกิดข้อผิดพลาดในการสร้าง PDF');
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
        if (reportContainer.parentNode) document.body.removeChild(reportContainer);
    });
}

function clearAllBookings() {
    if (confirm('คุณต้องการลบข้อมูลการจองทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
        bookings = [];
        localStorage.removeItem('room_bookings');
        calendar.removeAllEvents();
        updateDashboard();
    }
}
