(function () {
    // Map Management for DisasterAlert System
    // This file handles Leaflet.js map initialization and functionality

    // Map initialization variables
    // Note: 'map' may already be declared in map.html, so we reference it via window or use existing reference
    // Use window.map if available, otherwise create a reference
    var map = window.map || null; // scoped to this IIFE, won't conflict with global let
    // Also scope these arrays to avoid collision with map.html's let declarations
    var alertMarkers = window.alertMarkers || [];
    var safeZoneMarkers = window.safeZoneMarkers || [];
    var riskZoneLayers = window.riskZoneLayers || [];
    var userMarker = window.userMarker || null;

    // Initialize map on page load
    function initializeMap(centerLat, centerLon, zoomLevel = 16) {
        try {
            // Check if map already exists (from map.html)
            if (window.map) {
                map = window.map;
                console.log('Using existing map instance');
                return map;
            }

            // Create map container if it doesn't exist
            map = L.map('map', {
                center: [centerLat, centerLon],
                zoom: zoomLevel,
                dragging: true,
                touchZoom: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                tap: true
            });

            // Make map globally accessible
            window.map = map;

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                minZoom: 10,
                crossOrigin: true
            }).addTo(map);

            // Add campus center marker
            addCampusMarker(centerLat, centerLon);

            // Add controls
            addMapControls();

            console.log('Map initialized successfully');
            return map;
        } catch (error) {
            console.error('Map initialization error:', error);
            return null;
        }
    }

    // Add campus center marker
    function addCampusMarker(lat, lon) {
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for campus marker');
            return;
        }

        const campusIcon = L.icon({
            iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%233b82f6"><circle cx="12" cy="12" r="10"/></svg>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -15]
        });

        const marker = L.marker([lat, lon], {
            icon: campusIcon,
            zIndexOffset: 100,
            title: 'Campus Center'
        }).addTo(currentMap);

        marker.bindPopup(`
            <div class="map-popup">
                <h4>Campus Center</h4>
                <p>Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>
            </div>
        `);

        return marker;
    }

    // Add alerts as markers on map
    function addAlertMarkers(alerts) {
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for alert markers');
            return;
        }

        // Clear existing markers
        alertMarkers.forEach(marker => currentMap.removeLayer(marker));
        alertMarkers = [];

        alerts.forEach(alert => {
            const icon = getAlertMarkerIcon(alert.severity);

            const marker = L.marker(
                [alert.latitude, alert.longitude],
                {
                    icon: icon,
                    zIndexOffset: 200,
                    title: alert.type.toUpperCase()
                }
            ).addTo(currentMap);

            const popupContent = `
                <div class="map-popup">
                    <h4>${alert.type.toUpperCase()}</h4>
                    <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                    <p><strong>Location:</strong> ${alert.location}</p>
                    <p><strong>Description:</strong> ${alert.description}</p>
                    <p><small>Time: ${new Date(alert.timestamp).toLocaleString('en-IN')}</small></p>
                </div>
            `;

            marker.bindPopup(popupContent);
            alertMarkers.push(marker);
        });

        console.log(`Added ${alertMarkers.length} alert markers`);
    }

    // Get marker icon based on severity
    function getAlertMarkerIcon(severity) {
        const colors = {
            'critical': '#ef4444',
            'high': '#f59e0b',
            'medium': '#eab308',
            'low': '#3b82f6'
        };

        const color = colors[severity] || '#6b7280';

        return L.icon({
            iconUrl: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${encodeURIComponent(color)}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            shadowSize: [41, 41]
        });
    }

    // Add safe zone markers
    function addSafeZoneMarkers(safeZones) {
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for safe zone markers');
            return;
        }

        // Clear existing markers
        safeZoneMarkers.forEach(marker => currentMap.removeLayer(marker));
        safeZoneMarkers = [];

        safeZones.forEach(zone => {
            const icon = L.icon({
                iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -28]
            });

            const marker = L.marker(
                [zone.latitude, zone.longitude],
                {
                    icon: icon,
                    zIndexOffset: 150,
                    title: zone.name
                }
            ).addTo(currentMap);

            const popupContent = `
                <div class="map-popup">
                    <h4>${zone.name}</h4>
                    <p><strong>Type:</strong> ${zone.zone_type}</p>
                    <p><strong>Capacity:</strong> ${zone.capacity} people</p>
                    <p>${zone.description}</p>
                </div>
            `;

            marker.bindPopup(popupContent);
            safeZoneMarkers.push(marker);
        });

        console.log(`Added ${safeZoneMarkers.length} safe zone markers`);
    }

    // Draw risk zones as circles
    function drawRiskZones(zones) {
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for risk zones');
            return;
        }

        // Clear existing zone layers
        riskZoneLayers.forEach(layer => currentMap.removeLayer(layer));
        riskZoneLayers = [];

        zones.forEach(zone => {
            const color = zone.severity === 'critical' ? '#ef4444' : '#f59e0b';

            const circle = L.circle(
                [zone.latitude, zone.longitude],
                {
                    radius: zone.radius || 500,
                    color: color,
                    fillColor: color,
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.2,
                    dashArray: '5, 5'
                }
            ).addTo(currentMap);

            circle.bindPopup(`
                <div class="map-popup">
                    <h4>Risk Zone - ${zone.severity.toUpperCase()}</h4>
                    <p>Radius: ${(zone.radius / 1000).toFixed(2)} km</p>
                    <p>${zone.description || 'High risk area'}</p>
                </div>
            `);

            riskZoneLayers.push(circle);
        });

        console.log(`Drew ${riskZoneLayers.length} risk zone circles`);
    }

    // Add search functionality to map
    function addMapSearch() {
        // Create search control
        const searchControl = L.control({ position: 'topleft' });

        searchControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'map-search');
            div.innerHTML = `
                <input
                    type="text"
                    id="mapSearchInput"
                    placeholder="Search location..."
                    style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;"
                />
            `;
            return div;
        };

        searchControl.addTo(map);
    }

    // Add map controls
    function addMapControls() {
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for controls');
            return;
        }

        // Zoom control is added by default
        // Add custom controls

        // Fullscreen control
        L.control({ position: 'topright' }).onAdd = function (map) {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
            div.innerHTML = `<button onclick="window.mapFunctions.toggleMapFullscreen()" title="Fullscreen">
                <i class="fas fa-expand"></i>
            </button>`;
            return div;
        };

        // Refresh control
        const refreshControl = L.control({ position: 'topright' });
        refreshControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
            div.innerHTML = `<button onclick="window.mapFunctions.refreshMapData()" title="Refresh">
                <i class="fas fa-sync-alt"></i>
            </button>`;
            return div;
        };
        refreshControl.addTo(currentMap);
    }

    // Fullscreen toggle
    function toggleMapFullscreen() {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;

        if (mapElement.requestFullscreen) {
            mapElement.requestFullscreen();
        } else if (mapElement.mozRequestFullScreen) {
            mapElement.mozRequestFullScreen();
        } else if (mapElement.webkitRequestFullscreen) {
            mapElement.webkitRequestFullscreen();
        }
    }

    // Refresh map data
    function refreshMapData() {
        const currentMap = map || window.map;
        if (!currentMap) return;

        // Reload alerts
        fetch('/api/alerts')
            .then(response => response.json())
            .then(alerts => {
                addAlertMarkers(alerts);
                console.log('Map alerts refreshed');
            })
            .catch(err => console.log('Error refreshing alerts:', err));
    }

    // Add user location to map
    function addUserLocation(lat, lon, options = {}) {
        // Get current map reference (may be from window.map if declared in map.html)
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not initialized. Cannot add user location.');
            return;
        }

        // Use currentMap for all operations
        const mapInstance = currentMap;

        // Default options
        const {
            center = true,
            zoom = 15,
            popupText = 'You are here',
            openPopup = true
        } = options;

        // Create a more visible user location icon (blue circle with dot)
        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background-color: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); position: relative;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; width: 8px; height: 8px; border-radius: 50%;"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        // Remove existing user marker
        if (userMarker && mapInstance.hasLayer(userMarker)) {
            mapInstance.removeLayer(userMarker);
        }

        // Create and add marker
        userMarker = L.marker([lat, lon], {
            icon: userIcon,
            zIndexOffset: 1000, // Always on top
            title: 'Your Location'
        }).addTo(mapInstance);

        // Bind popup with user-friendly message
        userMarker.bindPopup(`
            <div class="map-popup">
                <h4>${popupText}</h4>
                <p><strong>Your Current Location</strong></p>
                <p>Latitude: ${lat.toFixed(6)}</p>
                <p>Longitude: ${lon.toFixed(6)}</p>
            </div>
        `);

        // Center and zoom to user location
        if (center) {
            mapInstance.setView([lat, lon], zoom);
        } else {
            mapInstance.panTo([lat, lon]);
        }

        // Update global references
        window.userMarker = userMarker;

        // Open popup if requested
        if (openPopup) {
            userMarker.openPopup();
        }

        console.log(`User location added: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        return userMarker;
    }

    // Get user location and add to map with error handling
    function getUserLocationAndAdd(options = {}) {
        // Get current map reference
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not initialized. Cannot get user location.');
            return;
        }

        // Update local reference if using window.map
        if (!map && window.map) {
            map = window.map;
        }

        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser');
            updateMapStatus('Geolocation not supported by your browser');
            return;
        }

        // Update status
        updateMapStatus('Getting your location...');

        // Geolocation options
        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds
            maximumAge: 60000 // Cache for 1 minute
        };

        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                addUserLocation(lat, lon, options);
                updateMapStatus('✓ Your location found');
                console.log('User location retrieved successfully');
            },
            error => {
                // Handle different error types gracefully
                let errorMessage = 'Unable to get your location';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
                        console.warn('User denied geolocation permission');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable.';
                        console.warn('Position unavailable');
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        console.warn('Geolocation timeout');
                        break;
                    default:
                        errorMessage = 'An unknown error occurred while getting your location.';
                        console.error('Geolocation error:', error);
                        break;
                }

                updateMapStatus(errorMessage);
                // Don't crash - just log the error
            },
            geoOptions
        );
    }

    // Helper function to update map status (if element exists)
    function updateMapStatus(message) {
        const statusEl = document.getElementById('mapStatus');
        if (statusEl) {
            statusEl.textContent = message;
        } else {
            console.log('Map Status:', message);
        }
    }

    // Automatically show user location when map is ready
    function autoShowUserLocation() {
        // Use window.map if our local map variable isn't set (for compatibility with map.html)
        const currentMap = map || window.map;

        if (!currentMap) {
            // Retry after a short delay if map isn't ready yet
            setTimeout(autoShowUserLocation, 200);
            return;
        }

        // Temporarily set our map reference if using window.map
        if (!map && window.map) {
            map = window.map;
        }

        // Get and show user location
        getUserLocationAndAdd({
            center: true,
            zoom: 15,
            popupText: 'You are here',
            openPopup: true
        });
    }

    // Draw evacuation route
    function drawEvacuationRoute(fromLat, fromLon, toLat, toLon) {
        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for evacuation route');
            return null;
        }

        const route = L.polyline(
            [[fromLat, fromLon], [toLat, toLon]],
            {
                color: '#10b981',
                weight: 3,
                opacity: 0.8,
                dashArray: '10, 5',
                zIndexOffset: 50
            }
        ).addTo(currentMap);

        return route;
    }

    // Find distance between two points
    function getDistanceBetween(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(2); // Distance in km
    }

    // Get bounds to fit all markers
    function fitBoundsToMarkers(markers) {
        if (!markers || markers.length === 0) return;

        const currentMap = map || window.map;
        if (!currentMap) {
            console.warn('Map not available for fit bounds');
            return;
        }

        const bounds = L.latLngBounds(
            markers.map(marker => marker.getLatLng())
        );

        currentMap.fitBounds(bounds, { padding: [50, 50] });
    }

    // Export for global use
    window.mapFunctions = {
        initializeMap,
        addAlertMarkers,
        addSafeZoneMarkers,
        drawRiskZones,
        addUserLocation,
        getUserLocationAndAdd,
        autoShowUserLocation,
        drawEvacuationRoute,
        refreshMapData,
        toggleMapFullscreen,
        getDistanceBetween,
        fitBoundsToMarkers
    };

    // Auto-initialize user location when DOM is ready and map exists
    // This will automatically show user location when the page loads
    document.addEventListener('DOMContentLoaded', function () {
        // Wait a bit for map to initialize, then show user location
        // Use a longer delay to ensure map.html has finished initializing
        setTimeout(function () {
            // Check if map is available (either from this module or window.map from map.html)
            const currentMap = map || window.map;
            if (currentMap) {
                console.log('Auto-showing user location...');
                autoShowUserLocation();
            } else {
                // Retry once more after a longer delay
                setTimeout(function () {
                    const retryMap = map || window.map;
                    if (retryMap) {
                        console.log('Auto-showing user location (retry)...');
                        autoShowUserLocation();
                    }
                }, 1500);
            }
        }, 1500); // Give map time to initialize (map.html needs time to load config and init)
    });

    console.log('Map module loaded - Auto-location enabled');

})();
