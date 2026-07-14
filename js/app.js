// Main application controller
class WeatherApp {
    constructor() {
        this.refreshInterval = null;
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        // Load API key and initialize API
        const apiKey = storage.getApiKey();
        weatherAPI.setApiKey(apiKey);

        // Load last location or set default
        const lastLocation = storage.getLastLocation();
        
        if (lastLocation) {
            ui.currentLocation = lastLocation;
            await ui.updateWeatherDisplay();
        } else {
            // Try to use geolocation as default
            this.useGeolocation();
        }

        // Display favorites
        ui.displayFavorites();

        // Set up auto-refresh
        this.startAutoRefresh();

        console.log('Weather Dashboard initialized successfully');
    }

    /**
     * Use geolocation to set initial location
     */
    async useGeolocation() {
        if (!navigator.geolocation) {
            this.setDefaultLocation();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const locationData = await weatherAPI.reverseGeocode(latitude, longitude);

                if (locationData) {
                    ui.currentLocation = {
                        name: locationData.name,
                        country: locationData.country,
                        state: locationData.state || '',
                        lat: latitude,
                        lon: longitude
                    };
                    storage.saveLastLocation(ui.currentLocation);
                    await ui.updateWeatherDisplay();
                } else {
                    this.setDefaultLocation();
                }
            },
            () => {
                this.setDefaultLocation();
            }
        );
    }

    /**
     * Set default location (London)
     */
    async setDefaultLocation() {
        ui.currentLocation = {
            name: 'London',
            country: 'GB',
            state: '',
            lat: 51.5085,
            lon: -0.1257
        };
        storage.saveLastLocation(ui.currentLocation);
        await ui.updateWeatherDisplay();
    }

    /**
     * Start auto-refresh of weather data
     */
    startAutoRefresh() {
        // Refresh every 10 minutes
        this.refreshInterval = setInterval(() => {
            if (ui.currentLocation) {
                ui.updateWeatherDisplay();
            }
        }, CONFIG.REFRESH_INTERVAL);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    /**
     * Add a favorite location
     */
    async addFavorite(location) {
        if (storage.addFavorite(location)) {
            ui.displayFavorites();
            return true;
        }
        return false;
    }

    /**
     * Remove a favorite location
     */
    removeFavorite(lat, lon) {
        storage.removeFavorite(lat, lon);
        ui.displayFavorites();
    }

    /**
     * Check if location is favorited
     */
    isFavorited(lat, lon) {
        return storage.isFavorited(lat, lon);
    }

    /**
     * Toggle favorite
     */
    async toggleFavorite() {
        if (!ui.currentLocation) return;

        const isFav = this.isFavorited(ui.currentLocation.lat, ui.currentLocation.lon);

        if (isFav) {
            this.removeFavorite(ui.currentLocation.lat, ui.currentLocation.lon);
        } else {
            await this.addFavorite(ui.currentLocation);
        }
    }

    /**
     * Get weather for a specific location
     */
    async getWeatherForLocation(lat, lon, name, country) {
        ui.currentLocation = {
            name,
            country,
            lat,
            lon
        };
        storage.saveLastLocation(ui.currentLocation);
        await ui.updateWeatherDisplay();
    }

    /**
     * Export settings and data
     */
    exportData() {
        const data = {
            settings: storage.getSettings(),
            favorites: storage.getFavorites(),
            lastLocation: storage.getLastLocation(),
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `weather-dashboard-backup-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import settings and data
     */
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.settings) storage.saveSettings(data.settings);
                    if (data.favorites) storage.saveFavorites(data.favorites);
                    if (data.lastLocation) storage.saveLastLocation(data.lastLocation);

                    ui.displayFavorites();
                    if (data.lastLocation) {
                        ui.currentLocation = data.lastLocation;
                        ui.updateWeatherDisplay();
                    }

                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure? This will clear all settings and favorites.')) {
            storage.clear();
            weatherAPI.clearCache();
            location.reload();
        }
    }
}

// Create global app instance
let app = new WeatherApp();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.stopAutoRefresh();
    }
});
