// Main JavaScript for DisasterAlert System

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeHamburgerMenu();
    updateClockTime();
    setInterval(updateClockTime, 1000);
});

// Hamburger Menu Toggle
function initializeHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', function () {
            navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
            hamburger.classList.toggle('active');
        });
    }
}

// Update current time
function updateClockTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Alert Management Functions
function showAlert(title, message, type = 'info') {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;

    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;

    banner.classList.remove('hidden');
    banner.classList.remove('alert-success', 'alert-danger', 'alert-warning', 'alert-info');
    banner.classList.add(`alert-${type}`);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        banner.classList.add('hidden');
    }, 5000);
}

function closeAlertBanner() {
    const banner = document.getElementById('alert-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

// Fetch and display alerts
function fetchAlerts() {
    fetch('/api/alerts')
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const latestAlert = data[0];
                const alertType = latestAlert.severity === 'critical' ? 'danger' : 'warning';
                showAlert(
                    `${latestAlert.type.toUpperCase()} Alert`,
                    `${latestAlert.description}`,
                    alertType
                );
            }
        })
        .catch(err => console.log('Error fetching alerts:', err));
}

// Fetch weather data


// Fetch earthquake data


// Copy to clipboard
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showAlert('Copied', 'Text copied to clipboard', 'success');
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes + 'm ago';
    }

    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours + 'h ago';
    }

    // Return formatted date
    return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Get severity color
function getSeverityColor(severity) {
    const colors = {
        'critical': '#ef4444',
        'high': '#f59e0b',
        'medium': '#eab308',
        'low': '#3b82f6'
    };
    return colors[severity] || '#6b7280';
}

// Get alert icon
function getAlertIcon(type) {
    const icons = {
        'earthquake': 'fa-wave-square',
        'flood': 'fa-water',
        'fire': 'fa-fire',
        'cyclone': 'fa-wind',
        'landslide': 'fa-mountain',
        'storm': 'fa-cloud-bolt'
    };
    return icons[type] || 'fa-exclamation-triangle';
}

// Location Services
function getDeviceLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                error => {
                    console.log('Geolocation error:', error);
                    reject(error);
                }
            );
        } else {
            reject(new Error('Geolocation not supported'));
        }
    });
}

// Distance calculation (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Find nearest safe zone
function findNearestSafeZone(userLat, userLon, safeZones) {
    let nearest = null;
    let minDistance = Infinity;

    safeZones.forEach(zone => {
        const distance = calculateDistance(userLat, userLon, zone.latitude, zone.longitude);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = { ...zone, distance: distance };
        }
    });

    return nearest;
}

// Check if location is in danger zone
function isInDangerZone(latitude, longitude, dangerZones) {
    for (let zone of dangerZones) {
        const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
        if (distance * 1000 <= zone.radius) { // Convert km to meters
            return zone;
        }
    }
    return null;
}

// Local Storage Management
const storage = {
    setItem: function (key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.log('Storage error:', e);
            return false;
        }
    },

    getItem: function (key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.log('Storage error:', e);
            return null;
        }
    },

    removeItem: function (key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.log('Storage error:', e);
            return false;
        }
    },

    clear: function () {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.log('Storage error:', e);
            return false;
        }
    }
};

// Notification Service
const NotificationService = {
    supported: () => 'Notification' in window,

    requestPermission: async function () {
        if (this.supported() && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    send: function (title, options = {}) {
        if (this.supported() && Notification.permission === 'granted') {
            new Notification(title, {
                icon: '⚠️',
                ...options
            });
        }
    },

    sendAlert: function (type, message) {
        const titles = {
            'earthquake': '🌍 Earthquake Alert',
            'flood': '💧 Flood Alert',
            'fire': '🔥 Fire Alert',
            'cyclone': '🌪️ Cyclone Alert'
        };

        this.send(titles[type] || 'Disaster Alert', {
            body: message,
            tag: type,
            requireInteraction: true
        });
    }
};

// Error Handling
window.addEventListener('error', function (event) {
    console.error('Global error:', event.error);
});

// Responsive Menu
function toggleMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');

    if (navMenu) {
        navMenu.classList.toggle('active');
    }

    if (hamburger) {
        hamburger.classList.toggle('active');
    }
}

// Close menu when clicking on a link
document.addEventListener('click', function (event) {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');

    if (navMenu && event.target.classList.contains('nav-link')) {
        navMenu.style.display = 'none';
        if (hamburger) hamburger.classList.remove('active');
    }
});

// Scroll to Top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Add scroll-to-top button
window.addEventListener('scroll', function () {
    const scrollButton = document.getElementById('scroll-top-btn');
    if (scrollButton) {
        if (window.scrollY > 300) {
            scrollButton.style.display = 'block';
        } else {
            scrollButton.style.display = 'none';
        }
    }
});

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Request Helper
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Initialize tooltips
function initTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.title = element.getAttribute('data-tooltip');
    });
}

// Form Validation
function validateForm(formElement) {
    const inputs = formElement.querySelectorAll('input, textarea, select');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }

        if (input.type === 'email' && !isValidEmail(input.value)) {
            input.classList.add('error');
            isValid = false;
        }

        if (input.type === 'tel' && !isValidPhone(input.value)) {
            input.classList.add('error');
            isValid = false;
        }
    });

    return isValid;
}

// Email validation
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Phone validation
function isValidPhone(phone) {
    const re = /^[0-9]{10}$/;
    return re.test(phone.replace(/\D/g, ''));
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    initTooltips();
    NotificationService.requestPermission();

    // Fetch alerts every 30 seconds
    setInterval(fetchAlerts, 30000);


});

// Performance logging
function logPerformance() {
    if (window.performance && window.performance.timing) {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log('Page load time: ' + pageLoadTime + 'ms');
    }
}

// Log performance when page loads
window.addEventListener('load', logPerformance);
