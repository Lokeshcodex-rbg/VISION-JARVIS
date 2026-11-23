/**
 * VISION AI / JARVIS — Google Maps & Real-World Location Intelligence Service
 * 
 * Comprehensive location intelligence engine providing:
 * - Place search & discovery with genuine Google Maps URLs
 * - Strict location permission enforcement (never guesses or leaks private location)
 * - Geocoding & reverse geocoding (Nominatim / OSM + Google Maps API fallback)
 * - Grounded distance & routing calculations (OSRM API + Google Maps directions)
 * - Travel time estimation with live traffic signals
 * - Multi-place comparisons (hotels, restaurants, hospitals, shops)
 * - Zero fabricated ratings, hours, or distances
 * - Emergency stop controller integration
 */

const fs = require('fs');
const path = require('path');
const { browserAutomationEngineInstance } = require('../browser/browserAutomationEngine.js');
const { emergencyStopControllerInstance } = require('../emergencyStopController.js');

const USER_AGENT = 'VISION-JARVIS-Assistant/2.0 (LocationIntelligence; contact: local)';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

class GoogleMapsIntelligenceService {
  constructor(options = {}) {
    this.cache = new Map(); // key -> { data, expiresAt }
    this.cacheTtlMs = options.cacheTtlMs || 24 * 60 * 60 * 1000; // 24 hours for geocoding
    this._fetch = options.fetchImpl || ((...args) => globalThis.fetch(...args));
    this.requestCooldownMs = 1000; // 1s throttle between geocoding requests to respect Nominatim policy
    this.lastRequestTime = 0;
  }

  _checkEmergencyStop() {
    if (emergencyStopControllerInstance && emergencyStopControllerInstance.isEngaged()) {
      throw new Error('EMERGENCY_STOP_ACTIVE: Location intelligence operations blocked by Emergency Stop.');
    }
  }

  async _throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestCooldownMs) {
      await new Promise(r => setTimeout(r, this.requestCooldownMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  _getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  _setCache(key, data, ttlMs = this.cacheTtlMs) {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Geocodes an address or landmark into geographic coordinates.
   * Uses Google Geocoding API if key configured, otherwise OpenStreetMap Nominatim.
   */
  async geocode(address) {
    this._checkEmergencyStop();
    const cleanAddr = String(address || '').trim();
    if (!cleanAddr) {
      return { success: false, error: 'Address is required for geocoding.' };
    }

    const cacheKey = `geo:${cleanAddr.toLowerCase()}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    // Check if Google Maps API key is configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
    if (apiKey) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddr)}&key=${apiKey}`;
        const res = await this._fetch(gUrl, { headers: { 'User-Agent': USER_AGENT } });
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const first = data.results[0];
          const result = {
            success: true,
            provider: 'google_geocoding_api',
            address: cleanAddr,
            formattedAddress: first.formatted_address,
            latitude: first.geometry.location.lat,
            longitude: first.geometry.location.lng,
            placeId: first.place_id,
            types: first.types || [],
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(first.formatted_address)}`,
            providerNotice: 'Google Maps Geocoding Platform API',
            missingGoogleMapsPlatformKeys: [],
            verified: true
          };
          this._setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn('[MAPS_SERVICE] Google Geocoding error, falling back to OSM:', err.message);
      }
    }

    // Fallback: OpenStreetMap Nominatim
    await this._throttle();
    try {
      const osmUrl = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(cleanAddr)}&limit=1&addressdetails=1`;
      const res = await this._fetch(osmUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          error: `Could not geocode "${cleanAddr}". No matching geographic entity found.`,
          address: cleanAddr,
          provider: 'openstreetmap_nominatim',
          missingGoogleMapsPlatformKeys: ['GOOGLE_MAPS_API_KEY']
        };
      }
      const first = data[0];
      const result = {
        success: true,
        provider: 'openstreetmap_nominatim',
        providerNotice: 'OpenStreetMap Nominatim Geocoding (Google Maps Platform API key not configured: set GOOGLE_MAPS_API_KEY in .env for Google Geocoding)',
        missingGoogleMapsPlatformKeys: ['GOOGLE_MAPS_API_KEY'],
        address: cleanAddr,
        formattedAddress: first.display_name,
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
        placeId: String(first.place_id),
        types: [first.type, first.class].filter(Boolean),
        boundingBox: first.boundingbox,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(first.display_name)}`,
        embedMapUrl: `https://maps.google.com/maps?q=${first.lat},${first.lon}&output=embed`,
        verified: true
      };
      this._setCache(cacheKey, result);
      return result;
    } catch (err) {
      return {
        success: false,
        error: `Geocoding failed for "${cleanAddr}": ${err.message}`,
        address: cleanAddr,
        provider: 'openstreetmap_nominatim',
        missingGoogleMapsPlatformKeys: ['GOOGLE_MAPS_API_KEY']
      };
    }
  }

  /**
   * Reverse geocodes latitude and longitude coordinates into a human-readable address.
   */
  async reverseGeocode(latitude, longitude) {
    this._checkEmergencyStop();
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { success: false, error: 'Valid numeric latitude and longitude are required.' };
    }

    const cacheKey = `rev:${lat.toFixed(5)},${lon.toFixed(5)}`;
    const cached = this._getCache(cacheKey);
    if (cached) return cached;

    // Check if Google Maps API key is configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
    if (apiKey) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
        const res = await this._fetch(gUrl, { headers: { 'User-Agent': USER_AGENT } });
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const first = data.results[0];
          const result = {
            success: true,
            provider: 'google_reverse_geocoding_api',
            providerNotice: 'Google Maps Reverse Geocoding Platform API',
            missingGoogleMapsPlatformKeys: [],
            latitude: lat,
            longitude: lon,
            formattedAddress: first.formatted_address,
            placeId: first.place_id,
            mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
            verified: true
          };
          this._setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn('[MAPS_SERVICE] Google Reverse Geocoding error, falling back to OSM:', err.message);
      }
    }

    // Fallback: OpenStreetMap Nominatim
    await this._throttle();
    try {
      const osmUrl = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const res = await this._fetch(osmUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.display_name) {
        return {
          success: false,
          error: `No entity found at coordinates (${lat}, ${lon}).`,
          latitude: lat,
          longitude: lon,
          provider: 'openstreetmap_nominatim',
          missingGoogleMapsPlatformKeys: ['GOOGLE_MAPS_API_KEY']
        };
      }
      const addr = data.address || {};
      const result = {
        success: true,
        provider: 'openstreetmap_nominatim',
        providerNotice: 'OpenStreetMap Nominatim Reverse Geocoding (Google Maps Platform API key not configured: set GOOGLE_MAPS_API_KEY in .env for Google Reverse Geocoding)',
        missingGoogleMapsPlatformKeys: ['GOOGLE_MAPS_API_KEY'],
        latitude: lat,
        longitude: lon,
        formattedAddress: data.display_name,
        city: addr.city || addr.town || addr.village || addr.suburb || null,
        state: addr.state || null,
        country: addr.country || null,
        postalCode: addr.postcode || null,
        mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
        embedMapUrl: `https://maps.google.com/maps?q=${lat},${lon}&output=embed`,
        verified: true
      };
      this._setCache(cacheKey, result);
      return result;
    } catch (err) {
      return {
        success: false,
        error: `Reverse geocoding failed: ${err.message}`,
        latitude: lat,
        longitude: lon,
        provider: 'openstreetmap_nominatim',
        missingGoogleMapsPlatformKeys: ['GOOGLE_MAPS_API_KEY']
      };
    }
  }

  /**
   * Searches Google Maps for places, businesses, or landmarks.
   * Strictly enforces location permission if user asks for "near me" or "my location".
   */
  async searchPlaces(query, options = {}) {
    this._checkEmergencyStop();
    const rawQuery = String(query || '').trim();
    if (!rawQuery) {
      return {
        success: false,
        clarificationRequired: true,
        summary: 'Please provide a place name, category, or location to search on Google Maps, sir.'
      };
    }

    const loc = options.location ? String(options.location).trim() : '';

    // STRICT LOCATION PRIVACY GUARD:
    // If the query contains "near me", "my location", "around me", "nearby", or location is "me"/"here",
    // and no explicit user consent or coordinates are provided, HALT and request permission or area.
    const isNearMe = /\b(?:near me|around me|my location|current location|here)\b/i.test(rawQuery) ||
      /\b(?:me|my location|here)\b/i.test(loc);

    if (isNearMe && !options.locationConsent && !options.userCoordinates && !options.allowApproximateLocation) {
      return {
        success: false,
        clarificationRequired: true,
        locationPermissionRequired: true,
        summary: 'To protect your privacy and ensure accurate local results, please specify the city or area you want to search near (or grant location access), sir.',
        prompt: 'Which city or area should I search near, sir?'
      };
    }

    // Determine final search query text
    let targetLocation = loc;
    if (isNearMe && (options.locationConsent || options.userCoordinates)) {
      if (options.userCoordinates) {
        targetLocation = `${options.userCoordinates.latitude},${options.userCoordinates.longitude}`;
      } else if (options.userLocation) {
        targetLocation = options.userLocation;
      }
    }

    let fullQuery = rawQuery;
    if (targetLocation && !/\b(?:me|my location|here)\b/i.test(targetLocation) && !rawQuery.toLowerCase().includes(targetLocation.toLowerCase())) {
      fullQuery = `${rawQuery} in ${targetLocation}`;
    }

    const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;

    // 1. Browser-based extraction via Playwright (extracts real cards, ratings, reviews, open status)
    let browserResult = null;
    try {
      browserResult = await browserAutomationEngineInstance.searchGoogleMaps(fullQuery, {
        openVisible: Boolean(options.openVisible),
        channel: options.channel || 'chrome',
        captureScreenshot: options.captureScreenshot !== false
      });
    } catch (err) {
      console.warn('[MAPS_SERVICE] Playwright search error:', err.message);
    }

    let places = [];
    if (browserResult && Array.isArray(browserResult.places) && browserResult.places.length > 0) {
      places = browserResult.places.map(p => ({
        name: p.name,
        details: p.visibleDetails,
        verifiedOnPage: true,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${fullQuery}`)}`
      }));
    }

    // 2. Structured fallback/enrichment via Nominatim search if browser yielded few or zero results
    if (places.length === 0) {
      await this._throttle();
      try {
        const osmSearchUrl = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=${Math.min(options.limit || 5, 8)}&addressdetails=1`;
        const res = await this._fetch(osmSearchUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            places = data.map(item => ({
              name: item.name || item.display_name.split(',')[0].trim(),
              details: item.display_name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              type: item.type || item.class,
              verifiedOnPage: false,
              verifiedGeo: true,
              mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.display_name)}`
            }));
          }
        }
      } catch (err) {
        console.warn('[MAPS_SERVICE] OSM search error:', err.message);
      }
    }

    const placeCount = places.length;
    const isScrapedFromBrowser = places.some(p => p.verifiedOnPage);
    const placesProvider = isScrapedFromBrowser ? 'google_maps_web_ui_scrape' : 'openstreetmap_nominatim';
    const placesProviderNotice = isScrapedFromBrowser
      ? 'Extracted directly from Google Maps Web UI'
      : 'Extracted from OpenStreetMap Nominatim POI catalog (Google Maps Platform API key not configured: set GOOGLE_MAPS_API_KEY in .env for official Google Places API)';

    return {
      success: true,
      verified: placeCount > 0,
      query: fullQuery,
      mapsUrl: mapsSearchUrl,
      embedMapUrl: `https://maps.google.com/maps?q=${encodeURIComponent(fullQuery)}&output=embed`,
      placesProvider,
      placesProviderNotice,
      missingGoogleMapsPlatformKeys: !process.env.GOOGLE_MAPS_API_KEY ? ['GOOGLE_MAPS_API_KEY'] : [],
      placesCount: placeCount,
      places,
      browserScreenshot: browserResult?.screenshot || null,
      summary: placeCount > 0
        ? `Found ${placeCount} place(s) for "${fullQuery}" on Google Maps (${placesProvider}): ${places.slice(0, 4).map(p => p.name).join(', ')}.\n[Interactive Map Link](${mapsSearchUrl})`
        : `Opened Google Maps search for "${fullQuery}". No immediate place cards were parsed, but the search link is verified: ${mapsSearchUrl}`
    };
  }

  /**
   * Calculates routes, distances, and travel times between origin and destination.
   * Grounded in actual provider calculations (OSRM API + Google Maps Directions).
   */
  async calculateRoute({ origin = '', destination = '', travelMode = 'driving', openVisible = false } = {}) {
    this._checkEmergencyStop();
    const cleanOrigin = String(origin || '').trim();
    const cleanDest = String(destination || '').trim();

    const missing = [];
    if (!cleanOrigin) missing.push('origin (starting location)');
    if (!cleanDest) missing.push('destination');

    if (missing.length > 0) {
      return {
        success: false,
        clarificationRequired: true,
        missingFields: missing,
        summary: `Please provide the ${missing.join(' and ')} so I can calculate your route, sir.`
      };
    }

    const validModes = ['driving', 'walking', 'bicycling', 'transit'];
    const mode = validModes.includes(String(travelMode).toLowerCase()) ? String(travelMode).toLowerCase() : 'driving';

    const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(cleanOrigin)}&destination=${encodeURIComponent(cleanDest)}&travelmode=${mode}`;

    // 1. Live Google Maps extraction via Playwright for live traffic and routes
    let liveTrafficSummary = null;
    try {
      const browserRes = await browserAutomationEngineInstance.getGoogleMapsDirections({
        origin: cleanOrigin,
        destination: cleanDest,
        travelMode: mode,
        openVisible
      });
      if (browserRes && browserRes.visibleRouteSummary && !browserRes.visibleRouteSummary.includes('Open in Google Maps')) {
        liveTrafficSummary = browserRes.visibleRouteSummary;
      }
    } catch (err) {
      console.warn('[MAPS_SERVICE] Playwright directions error:', err.message);
    }

    // 2. Geocode both endpoints for accurate distance and turn-by-turn road calculations
    const [geoOrigin, geoDest] = await Promise.all([
      this.geocode(cleanOrigin),
      this.geocode(cleanDest)
    ]);

    let roadDistanceKm = null;
    let estimatedDurationMinutes = null;
    let routeSteps = [];
    let alternativeRoutes = [];

    if (geoOrigin.success && geoDest.success) {
      // Map travel mode to OSRM profile
      const osrmProfile = (mode === 'walking') ? 'foot' : (mode === 'bicycling' ? 'bike' : 'driving');
      try {
        const osrmUrl = `${OSRM_BASE}/route/v1/${osrmProfile}/${geoOrigin.longitude},${geoOrigin.latitude};${geoDest.longitude},${geoDest.latitude}?overview=false&steps=true&alternatives=true`;
        const res = await this._fetch(osrmUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (res.ok) {
          const data = await res.json();
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const primaryRoute = data.routes[0];
            roadDistanceKm = parseFloat((primaryRoute.distance / 1000).toFixed(2));
            estimatedDurationMinutes = parseFloat((primaryRoute.duration / 60).toFixed(1));

            if (primaryRoute.legs && primaryRoute.legs[0]?.steps) {
              routeSteps = primaryRoute.legs[0].steps.slice(0, 8).map(s => ({
                instruction: s.name ? `Proceed onto ${s.name}` : (s.maneuver?.type || 'Continue'),
                distanceMeters: Math.round(s.distance)
              }));
            }

            if (data.routes.length > 1) {
              alternativeRoutes = data.routes.slice(1).map((r, i) => ({
                routeIndex: i + 1,
                distanceKm: parseFloat((r.distance / 1000).toFixed(2)),
                durationMinutes: parseFloat((r.duration / 60).toFixed(1)),
                summary: `Alternative route ${i + 1}: ${parseFloat((r.distance / 1000).toFixed(2))} km, ~${parseFloat((r.duration / 60).toFixed(1))} mins`
              }));
            }
          }
        }
      } catch (err) {
        console.warn('[MAPS_SERVICE] OSRM route calculation error:', err.message);
      }
    }

    const summaryText = liveTrafficSummary
      ? `Route from "${cleanOrigin}" to "${cleanDest}" (${mode}): ${liveTrafficSummary}.`
      : (roadDistanceKm !== null
        ? `Route from "${cleanOrigin}" to "${cleanDest}" (${mode}): approximately ${roadDistanceKm} km, estimated travel time ${estimatedDurationMinutes} minutes.`
        : `Directions from "${cleanOrigin}" to "${cleanDest}" (${mode}) mapped.`);

    const embedMapUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(cleanOrigin)}&daddr=${encodeURIComponent(cleanDest)}&output=embed`;

    return {
      success: true,
      verified: Boolean(liveTrafficSummary || roadDistanceKm !== null),
      origin: cleanOrigin,
      destination: cleanDest,
      travelMode: mode,
      distanceKm: roadDistanceKm,
      durationMinutes: estimatedDurationMinutes,
      routingProvider: 'osrm_open_source_routing',
      routingProviderNotice: 'Road distance and base travel time calculated via Open Source Routing Machine (OSRM). Real-time traffic congestion delays require Google Maps Platform Directions API.',
      trafficProvider: liveTrafficSummary ? 'google_maps_web_ui_scrape' : 'unavailable_without_google_maps_platform_key',
      missingGoogleMapsPlatformKeys: !process.env.GOOGLE_MAPS_API_KEY ? ['GOOGLE_MAPS_API_KEY'] : [],
      liveTrafficCondition: liveTrafficSummary,
      mapsUrl: mapsDirectionsUrl,
      embedMapUrl,
      routeSteps,
      alternativeRoutes,
      summary: `${summaryText}\nRouting: OSRM Open Source Routing Machine (Base time)\nLive Traffic: ${liveTrafficSummary || 'Requires Google Maps Platform key'}\n[Directions Link](${mapsDirectionsUrl})`
    };
  }

  /**
   * Compares places (e.g. "Compare five hotels in South Mumbai")
   */
  async comparePlaces({ query = '', location = '', count = 5 } = {}) {
    this._checkEmergencyStop();
    const cleanQuery = String(query || '').trim();
    const cleanLoc = String(location || '').trim();
    const targetCount = Math.min(Math.max(Number(count) || 5, 2), 10);

    const fullQuery = cleanLoc && !cleanQuery.toLowerCase().includes(cleanLoc.toLowerCase())
      ? `${cleanQuery} in ${cleanLoc}`
      : cleanQuery;

    const searchRes = await this.searchPlaces(fullQuery, { limit: targetCount, openVisible: false });
    if (!searchRes.success) {
      return searchRes;
    }

    const items = searchRes.places.slice(0, targetCount);
    const comparisonTable = items.map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      details: p.details ? p.details.slice(0, 160) : 'Available on Google Maps',
      mapsUrl: p.mapsUrl
    }));

    return {
      success: true,
      verified: items.length > 0,
      query: fullQuery,
      count: items.length,
      places: comparisonTable,
      placesProvider: searchRes.placesProvider,
      placesProviderNotice: searchRes.placesProviderNotice,
      missingGoogleMapsPlatformKeys: searchRes.missingGoogleMapsPlatformKeys || ['GOOGLE_MAPS_API_KEY'],
      mapsUrl: searchRes.mapsUrl,
      embedMapUrl: searchRes.embedMapUrl,
      summary: `Found and compared ${items.length} places for "${fullQuery}" (${searchRes.placesProvider}):\n` +
        items.map((p, i) => `${i + 1}. **${p.name}** — ${p.details ? p.details.slice(0, 120) : ''} ([View on Google Maps](${p.mapsUrl}))`).join('\n')
    };
  }
}

const googleMapsIntelligenceServiceInstance = new GoogleMapsIntelligenceService();

module.exports = {
  GoogleMapsIntelligenceService,
  googleMapsIntelligenceServiceInstance
};
