/**
 * VISION AI — Live Real-Time Weather Service
 * Connects to Open-Meteo Meteorological API and Geocoding Service (zero API key required).
 * Provides live temperature, conditions, precipitation probability, humidity, wind speed,
 * and multi-day forecasts with intelligent 10-minute caching.
 */

const WMO_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  62: 'Rain showers',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

class WeatherService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 10 * 60 * 1000; // 10 minutes
    this.defaultCity = process.env.DEFAULT_CITY || 'Mumbai';
  }

  /**
   * Translates WMO weather interpretation code into natural English description
   */
  getWeatherDescription(code) {
    return WMO_CODE_MAP[code] || 'Clear conditions';
  }

  /**
   * Resolves city name to latitude and longitude coordinates
   */
  async geocodeCity(cityName) {
    const query = String(cityName || '').trim();
    if (!query) throw new Error('City name is required.');

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Geocoding HTTP error ${res.status}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        throw new Error(`Location "${query}" could not be found.`);
      }

      const match = data.results[0];
      return {
        name: match.name,
        country: match.country || '',
        admin1: match.admin1 || '',
        latitude: match.latitude,
        longitude: match.longitude,
        timezone: match.timezone || 'auto'
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetches real-time weather and forecast data for a specified location
   */
  async getWeather(targetCity = null) {
    const rawCity = String(targetCity || '').trim();
    const city = rawCity && !/^(here|local|my location|current|aaj)$/i.test(rawCity) ? rawCity : this.defaultCity;
    const cacheKey = city.toLowerCase();

    // Check memory cache with 10-minute TTL
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < this.cacheTtlMs) {
      return { ...cached.data, cached: true, ageSeconds: Math.round((now - cached.timestamp) / 1000) };
    }

    try {
      const geo = await this.geocodeCity(city);
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(weatherUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Weather service HTTP error ${res.status}`);
      const data = await res.json();

      const current = data.current || {};
      const daily = data.daily || {};

      const tempC = Math.round(current.temperature_2m !== undefined ? current.temperature_2m : 25);
      const feelsLikeC = Math.round(current.apparent_temperature !== undefined ? current.apparent_temperature : tempC);
      const tempF = Math.round((tempC * 9/5) + 32);
      const humidity = current.relative_humidity_2m !== undefined ? current.relative_humidity_2m : 50;
      const windKmh = Math.round(current.wind_speed_10m !== undefined ? current.wind_speed_10m : 10);
      const condition = this.getWeatherDescription(current.weather_code !== undefined ? current.weather_code : 0);
      
      const rainProb = (daily.precipitation_probability_max && daily.precipitation_probability_max.length > 0)
        ? daily.precipitation_probability_max[0]
        : (current.precipitation > 0 ? 90 : 10);
      
      const maxTempC = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[0]) : tempC;
      const minTempC = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[0]) : tempC - 4;

      const locationLabel = `${geo.name}${geo.country ? `, ${geo.country}` : ''}`;
      const retrievedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const summary = `In ${locationLabel}, it is currently ${condition} at ${tempC}°C (${tempF}°F), feels like ${feelsLikeC}°C. Humidity is ${humidity}%, wind speed is ${windKmh} km/h, and there is a ${rainProb}% chance of rain today. Highs will reach ${maxTempC}°C with lows near ${minTempC}°C.`;

      const weatherResult = {
        location: locationLabel,
        city: geo.name,
        country: geo.country,
        condition,
        temperatureC: tempC,
        temperatureF: tempF,
        feelsLikeC,
        humidityPercent: humidity,
        windSpeedKmh: windKmh,
        rainProbabilityPercent: rainProb,
        highTempC: maxTempC,
        lowTempC: minTempC,
        summary,
        retrievedAt,
        cached: false
      };

      this.cache.set(cacheKey, { timestamp: now, data: weatherResult });
      return weatherResult;
    } catch (err) {
      console.warn(`[WEATHER_SERVICE] Failed to fetch live weather for "${city}":`, err.message);
      return {
        status: 'error',
        city,
        error: err.message,
        summary: `I was unable to retrieve live weather data for ${city} at this moment: ${err.message}. Please verify the city name or network connection.`
      };
    }
  }
}

module.exports = {
  WeatherService,
  weatherServiceInstance: new WeatherService()
};
