/**
 * Uses Open-Meteo (no API key required):
 *   Geocoding : https://geocoding-api.open-meteo.com/v1/search
 *   Weather   : https://api.open-meteo.com/v1/forecast
 *
 * Bonus features implemented:
 *   ✅ Unit toggle (°C / °F)             — toggleUnit()
 *   ✅ Search history (localStorage)     — saveHistory() / renderHistory()
 *   ✅ Animated weather icon (CSS class) — see styles.css animations
 *   ✅ Geolocation on page load          — initGeolocation()
 */

// ── Cached raw data so unit toggle works without re-fetching ──
let cachedWeather = null;
let cachedCity = "";
let cachedCountry = "";
let isCelsius = true;

// ── DOM element references ────────────────────────────────────
const searchInput = document.getElementById("searchInput");
const errorBox = document.getElementById("errorBox");
const errorMsg = document.getElementById("errorMsg");
const loadingBox = document.getElementById("loadingBox");
const weatherCard = document.getElementById("weatherCard");
const cityNameEl = document.getElementById("cityName");
const temperatureEl = document.getElementById("temperature");
const weatherDescEl = document.getElementById("weatherDesc");
const feelsLikeEl = document.getElementById("feelsLike");
const humidityEl = document.getElementById("humidity");
const windSpeedEl = document.getElementById("windSpeed");
const uvIndexEl = document.getElementById("uvIndex");
const forecastList = document.getElementById("forecastList");
const unitToggle = document.getElementById("unitToggle");
const historyBox = document.getElementById("historyBox");
const historyBtns = document.getElementById("historyBtns");
const weatherIcon = document.getElementById("weatherIcon");

// Allow pressing Enter in the search box to trigger a search
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

/* ─────────────────────────────────────────────────────────────
   getCoordinates(city)
   Calls the Open-Meteo Geocoding API to convert a city name
   into latitude, longitude, and country data.
   Returns { lat, lon, name, country } on success, or null
   if the city was not found.
───────────────────────────────────────────────────────────── */
async function getCoordinates(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to reach the geocoding service. Please try again.");
  }

  const data = await response.json();

  // Return null if the API found no matching city
  if (!data.results || data.results.length === 0) {
    return null;
  }

  const result = data.results[0];
  return {
    lat: result.latitude,
    lon: result.longitude,
    name: result.name,
    country: result.country,
  };
}

/* ─────────────────────────────────────────────────────────────
   getWeather(lat, lon)
   Calls the Open-Meteo forecast API with the given coordinates.
   Requests current conditions plus a 5-day daily forecast.
   Returns the full raw API response object.
───────────────────────────────────────────────────────────── */
async function getWeather(lat, lon) {
  const params = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    `current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`,
    `daily=temperature_2m_max,temperature_2m_min,weather_code`,
    `timezone=auto`,
    `forecast_days=5`,
  ].join("&");

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch weather data. Please try again.");
  }

  return await response.json();
}

/* ─────────────────────────────────────────────────────────────
   getWeatherDescription(code)
   Converts a WMO weather code into a human-readable description,
   a plain-text icon that renders reliably on all browsers, and
   an animClass string used to apply the matching CSS animation.
   Plain-text symbols are used instead of multi-codepoint emoji
   to prevent blank-box rendering on some devices.
───────────────────────────────────────────────────────────── */
function getWeatherDescription(code) {
  if (code === 0)
    return { description: "Clear sky", icon: "&#9728;", animClass: "sunny" };
  if (code <= 3)
    return {
      description: "Partly cloudy",
      icon: "&#9925;",
      animClass: "cloudy",
    };
  if (code === 45 || code === 48)
    return { description: "Foggy", icon: "&#127787;", animClass: "cloudy" };
  if (code >= 51 && code <= 55)
    return { description: "Drizzle", icon: "&#127782;", animClass: "rainy" };
  if (code >= 61 && code <= 65)
    return { description: "Rain", icon: "&#127783;", animClass: "rainy" };
  if (code >= 71 && code <= 75)
    return { description: "Snow", icon: "&#10052;", animClass: "snow" };
  if (code >= 80 && code <= 82)
    return {
      description: "Rain showers",
      icon: "&#127782;",
      animClass: "rainy",
    };
  if (code === 95)
    return {
      description: "Thunderstorm",
      icon: "&#9928;",
      animClass: "thunder",
    };
  return { description: "Unknown", icon: "&#127777;", animClass: "" };
}

/* ─────────────────────────────────────────────────────────────
   displayCurrentWeather(data, cityName, country)
   Takes the raw Open-Meteo API response and updates all
   current-weather DOM elements: city name, temperature,
   weather description, feels-like, humidity, wind speed,
   and UV index. Respects the current isCelsius preference.
───────────────────────────────────────────────────────────── */
function displayCurrentWeather(data, cityName, country) {
  const current = data.current;

  const tempC = current.temperature_2m;
  const feelsC = current.apparent_temperature;
  const humidity = current.relative_humidity_2m;
  const windSpeed = current.wind_speed_10m;
  const code = current.weather_code;

  const { description, icon, animClass } = getWeatherDescription(code);

  // Set animated icon using innerHTML so HTML entities render correctly
  weatherIcon.innerHTML = icon;
  weatherIcon.className = "weather-icon " + animClass;

  cityNameEl.textContent = `${cityName}, ${country}`;
  humidityEl.textContent = `${humidity}%`;
  windSpeedEl.textContent = `${windSpeed} km/h`;
  uvIndexEl.textContent = "N/A";
  weatherDescEl.textContent = description;

  const displayTemp = isCelsius ? tempC : toFahrenheit(tempC);
  const displayFeels = isCelsius ? feelsC : toFahrenheit(feelsC);
  const unit = isCelsius ? "°C" : "°F";

  temperatureEl.textContent = `${Math.round(displayTemp)}${unit}`;
  feelsLikeEl.textContent = `${description} · Feels like ${Math.round(displayFeels)}${unit}`;
}

/* ─────────────────────────────────────────────────────────────
   displayForecast(daily)
   Builds the 5-day forecast list from the API daily data object.
   Each day is rendered as its own card row on the page body
   background colour (#f0f4f8), with equal spacing between rows.
   Day index 0 is labelled "Today"; indices 1–4 show the full
   weekday name. High and low temperatures are stacked vertically
   on the right side of each row.
   Respects the current isCelsius unit preference.
───────────────────────────────────────────────────────────── */
function displayForecast(daily) {
  forecastList.innerHTML = "";

  const unit = isCelsius ? "°" : "°";

  for (let i = 0; i < 5; i++) {
    const dateStr = daily.time[i];
    const maxTempC = daily.temperature_2m_max[i];
    const minTempC = daily.temperature_2m_min[i];
    const code = daily.weather_code[i];

    const { icon } = getWeatherDescription(code);

    // Index 0 = today; everything else shows the real weekday name
    const dayLabel =
      i === 0
        ? "Today"
        : new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
          });

    const highDisplay = isCelsius
      ? Math.round(maxTempC)
      : Math.round(toFahrenheit(maxTempC));
    const lowDisplay = isCelsius
      ? Math.round(minTempC)
      : Math.round(toFahrenheit(minTempC));

    const li = document.createElement("li");
    li.className = "forecast-item";

    // innerHTML used so HTML entity icons render correctly
    li.innerHTML = `
      <span class="forecast-day">${dayLabel}</span>
      <span class="forecast-icon" aria-hidden="true">${icon}</span>
      <span class="forecast-temps">
        <span class="high">${highDisplay}${unit}</span>
        <span class="low">${lowDisplay}${unit}</span>
      </span>
    `;

    forecastList.appendChild(li);
  }
}

/* ─────────────────────────────────────────────────────────────
   showError(message)
   Hides the weather card and shows an error message so the
   user understands what went wrong.
───────────────────────────────────────────────────────────── */
function showError(message) {
  errorMsg.textContent = message;
  errorBox.classList.remove("hidden");
  weatherCard.classList.add("hidden");
}

/* ─────────────────────────────────────────────────────────────
   showLoading(isLoading)
   Shows or hides the loading indicator. Also hides the error
   box and weather card when a fresh fetch begins.
───────────────────────────────────────────────────────────── */
function showLoading(isLoading) {
  if (isLoading) {
    loadingBox.classList.remove("hidden");
    errorBox.classList.add("hidden");
    weatherCard.classList.add("hidden");
  } else {
    loadingBox.classList.add("hidden");
  }
}

/* ─────────────────────────────────────────────────────────────
   handleSearch()
   Main entry point triggered by the Search button or Enter key.
   Validates the input, calls getCoordinates to resolve the city,
   then calls getWeather and passes the result to the display
   functions. All API calls use async/await, not .then() chains.
───────────────────────────────────────────────────────────── */
async function handleSearch() {
  const city = searchInput.value.trim();

  if (!city) {
    showError("Please enter a city name.");
    return;
  }

  showLoading(true);

  try {
    // Step 1 — resolve city name to coordinates
    const coords = await getCoordinates(city);

    if (!coords) {
      showLoading(false);
      showError(
        `City "${city}" was not found. Please check the spelling and try again.`,
      );
      return;
    }

    // Step 2 — fetch weather for those coordinates
    const weatherData = await getWeather(coords.lat, coords.lon);

    // Cache everything so the unit toggle can re-render without a new fetch
    cachedWeather = weatherData;
    cachedCity = coords.name;
    cachedCountry = coords.country;

    // Step 3 — update the DOM
    showLoading(false);
    displayCurrentWeather(weatherData, coords.name, coords.country);
    displayForecast(weatherData.daily);

    weatherCard.classList.remove("hidden");
    errorBox.classList.add("hidden");

    // Save city to search history (bonus feature)
    saveHistory(coords.name);
  } catch (err) {
    showLoading(false);
    showError("Something went wrong: " + err.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   BONUS: toggleUnit()
   Switches the display between °C and °F without making a new
   API request. Re-renders using the cached weather data.
───────────────────────────────────────────────────────────── */
function toggleUnit() {
  if (!cachedWeather) return;

  isCelsius = !isCelsius;
  unitToggle.textContent = isCelsius ? "Switch to °F" : "Switch to °C";

  displayCurrentWeather(cachedWeather, cachedCity, cachedCountry);
  displayForecast(cachedWeather.daily);
}

/* ─────────────────────────────────────────────────────────────
   toFahrenheit(celsius)
   Helper that converts a Celsius number to Fahrenheit.
───────────────────────────────────────────────────────────── */
function toFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

/* ─────────────────────────────────────────────────────────────
   BONUS: saveHistory(cityName)
   Persists the searched city in localStorage, keeping only the
   5 most recent unique entries, then re-renders the buttons.
───────────────────────────────────────────────────────────── */
function saveHistory(cityName) {
  let history = JSON.parse(localStorage.getItem("weatherHistory") || "[]");

  // Remove any existing entry for this city (case-insensitive) then prepend
  history = history.filter((c) => c.toLowerCase() !== cityName.toLowerCase());
  history.unshift(cityName);
  history = history.slice(0, 5);

  localStorage.setItem("weatherHistory", JSON.stringify(history));
  renderHistory(history);
}

/* 
   BONUS: renderHistory(history)
   Creates a clickable pill button for each recent city so the
   user can quickly re-search it without retyping.
*/
function renderHistory(history) {
  historyBtns.innerHTML = "";

  if (!history || history.length === 0) {
    historyBox.classList.add("hidden");
    return;
  }

  history.forEach((city) => {
    const btn = document.createElement("button");
    btn.className = "history-btn";
    btn.textContent = city;
    btn.addEventListener("click", () => {
      searchInput.value = city;
      handleSearch();
    });
    historyBtns.appendChild(btn);
  });

  historyBox.classList.remove("hidden");
}

/* ─────────────────────────────────────────────────────────────
   BONUS: initGeolocation()
   Tries to detect the user's location via the browser Geolocation
   API when the page loads. If permission is granted, it fetches
   and displays local weather automatically without any search.
───────────────────────────────────────────────────────────── */
async function initGeolocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude: lat, longitude: lon } = position.coords;

      showLoading(true);

      try {
        // Attempt reverse-geocode to get a city name from coordinates
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        let cityName = "My Location";
        let countryName = "";

        if (geoData.results && geoData.results.length > 0) {
          cityName = geoData.results[0].name;
          countryName = geoData.results[0].country;
        }

        const weatherData = await getWeather(lat, lon);

        cachedWeather = weatherData;
        cachedCity = cityName;
        cachedCountry = countryName;

        showLoading(false);
        displayCurrentWeather(weatherData, cityName, countryName);
        displayForecast(weatherData.daily);
        weatherCard.classList.remove("hidden");
      } catch (err) {
        showLoading(false);
        // Silently fail — the user can still type a city and search manually
      }
    },
    () => {
      // User denied geolocation permission — no action needed
    },
  );
}

/* ─────────────────────────────────────────────────────────────
   init()
   Runs immediately on page load. Restores search history from
   localStorage and attempts to get the user's location.
───────────────────────────────────────────────────────────── */
(function init() {
  const history = JSON.parse(localStorage.getItem("weatherHistory") || "[]");
  renderHistory(history);
  initGeolocation();
})();
