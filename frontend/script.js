const API = "http://127.0.0.1:8001";
let lastAlertId = 0;
let alertRefreshTimer = null;

let incidents = [];
let teams = [];

let dashboardMap = null;
let fullMap = null;
let hospitalMap = null;

let currentLocation = {
    latitude: null,
    longitude: null
};


// =====================================================
// PAGE NAVIGATION
// =====================================================

const pageTitles = {

    dashboard: "Disaster Dashboard",
    incidents: "Live Incidents",
    priority: "Rescue Priority",
    map: "Disaster Map",
    weather: "Weather Intelligence",
    ai: "AI Predictions",
    reports: "Emergency Reports",
    people: "Affected People",
    teams: "Rescue Teams",
    hospitals: "Nearby Hospitals",
    alerts: "Alerts",
    settings: "Settings"

};


document.querySelectorAll(".menu-item[data-section]")
    .forEach(button => {

        button.addEventListener("click", () => {

            openSection(button.dataset.section);

        });

    });


function openSection(sectionId) {

    document
        .querySelectorAll(".menu-item[data-section]")
        .forEach(item => {

            item.classList.remove("active");

        });


    const selectedMenu =
        document.querySelector(
            `.menu-item[data-section="${sectionId}"]`
        );


    if (selectedMenu) {

        selectedMenu.classList.add("active");

    }


    document
        .querySelectorAll(".page-section")
        .forEach(section => {

            section.classList.remove("active-section");

        });


    const selectedSection =
        document.getElementById(sectionId);


    if (selectedSection) {

        selectedSection.classList.add("active-section");

    }


    const title =
        document.getElementById("pageTitle");


    if (title && pageTitles[sectionId]) {

        title.textContent =
            pageTitles[sectionId];

    }


    // Map resize

    if (sectionId === "map") {

        setTimeout(() => {

            initializeFullMap();

            if (fullMap) {
                fullMap.invalidateSize();
            }

        }, 200);

    }


    // Hospitals

    if (sectionId === "hospitals") {

        setTimeout(() => {

            loadHospitals();

        }, 100);

    }


    // Weather

    if (sectionId === "weather") {

        loadWeather();

    }


    // Alerts

    if (sectionId === "alerts") {

        loadGlobalAlerts();

    }

}


// =====================================================
// LOGOUT
// =====================================================

const logoutBtn =
    document.getElementById("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener("click", () => {

        localStorage.removeItem("resqUser");

        window.location.href = "login.html";

    });

}


// =====================================================
// USER
// =====================================================

function loadAdminUser() {

    const savedUser =
        localStorage.getItem("resqUser");


    if (!savedUser) {
        return;
    }


    try {

        const user =
            JSON.parse(savedUser);


        const adminName =
            document.getElementById("adminName");


        if (adminName && user.name) {

            adminName.textContent =
                user.name;

        }

    } catch (error) {

        console.error(error);

    }

}


// =====================================================
// CURRENT LOCATION
// =====================================================

function getCurrentLocation() {

    return new Promise((resolve, reject) => {

        if (!navigator.geolocation) {

            reject(
                new Error(
                    "Geolocation is not supported."
                )
            );

            return;

        }


        navigator.geolocation.getCurrentPosition(

            position => {

                currentLocation.latitude =
                    position.coords.latitude;

                currentLocation.longitude =
                    position.coords.longitude;


                resolve(currentLocation);

            },

            error => {

                console.error(
                    "Location error:",
                    error
                );


                reject(error);

            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }

        );

    });

}

// =====================================================
// LOCATION NAME
// =====================================================

async function getLocationName(latitude, longitude) {

    try {

        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );

        if (!response.ok) {
            throw new Error("Location lookup failed");
        }

        const data = await response.json();

        const address = data.address || {};

        const place =
            address.village ||
            address.town ||
            address.city ||
            address.municipality ||
            address.suburb ||
            address.county ||
            "Current Location";

        const district =
            address.state_district ||
            address.district ||
            "";

        const state =
            address.state ||
            "";

        const parts = [place];

        if (
            district &&
            district.toLowerCase() !== place.toLowerCase()
        ) {
            parts.push(district);
        }

        if (
            state &&
            state.toLowerCase() !== place.toLowerCase() &&
            state.toLowerCase() !== district.toLowerCase()
        ) {
            parts.push(state);
        }

        return parts.join(", ");

    } catch (error) {

        console.error(
            "Location name error:",
            error
        );

        return "Current Location";
    }
}


// =====================================================
// WEATHER
// =====================================================

async function loadWeather() {

    const locationText =
        document.getElementById(
            "weatherLocationText"
        );


    if (locationText) {

        locationText.textContent =
            "Detecting your current location...";

    }


    try {

        const location =
            await getCurrentLocation();


        const latitude =
            location.latitude;


        const longitude =
            location.longitude;


        const locationName =
            await getLocationName(
                latitude,
                longitude
            );


        if (locationText) {

            locationText.textContent =
                `Live weather near ${locationName}`;

        }


        const response =
            await fetch(
                `${API}/api/weather?latitude=${latitude}&longitude=${longitude}`
            );


        if (!response.ok) {

            throw new Error(
                "Weather API failed"
            );

        }


        const data =
            await response.json();


        const weather =
            data.weather ||
            data.data ||
            data;


        const temperature =
            weather.temperature ??
            weather.temperature_c ??
            weather.temp ??
            0;


        const humidity =
            weather.humidity ??
            0;


        const rainfall =
            weather.rainfall ??
            weather.precipitation ??
            0;


        const wind =
            weather.wind_speed ??
            weather.wind ??
            0;


        setText(
            "weatherTemp",
            `${temperature} °C`
        );


        setText(
            "weatherHumidity",
            `${humidity} %`
        );


        setText(
            "weatherRainfall",
            `${rainfall} mm`
        );


        setText(
            "weatherWind",
            `${wind} km/h`
        );


        // Dashboard weather

        setText(
            "dashTemp",
            `${temperature} °C`
        );


        setText(
            "dashHumidity",
            `${humidity} %`
        );


        setText(
            "dashRainfall",
            `${rainfall} mm`
        );


        setText(
            "dashWind",
            `${wind} km/h`
        );


        calculateWeatherRisk(
            Number(rainfall),
            Number(wind),
            Number(humidity)
        );


    } catch (error) {

        console.error(
            "Weather error:",
            error
        );


        if (locationText) {

            locationText.textContent =
                "Location permission required for live weather.";

        }

    }

}


// =====================================================
// WEATHER RISK
// =====================================================

function calculateWeatherRisk(
    rainfall,
    wind,
    humidity
) {

    const title =
        document.getElementById(
            "weatherRiskTitle"
        );


    const text =
        document.getElementById(
            "weatherRiskText"
        );


    if (!title || !text) {
        return;
    }


    let risk = "LOW";

    let message =
        "Current weather conditions are relatively suitable for rescue operations.";


    if (
        rainfall >= 50 ||
        wind >= 50 ||
        humidity >= 90
    ) {

        risk = "HIGH";

        message =
            "Severe weather conditions may affect rescue movement. Emergency teams should use caution.";

    }

    else if (
        rainfall >= 20 ||
        wind >= 30 ||
        humidity >= 75
    ) {

        risk = "MEDIUM";

        message =
            "Weather may slow rescue operations. Teams should monitor conditions continuously.";

    }


    title.textContent =
        `${risk} WEATHER RISK`;


    text.textContent =
        message;

}


// =====================================================
// DASHBOARD SUMMARY
// =====================================================

async function loadDashboardSummary() {

    try {

        const response =
            await fetch(
                `${API}/api/dashboard-summary`
            );


        if (!response.ok) {
            return;
        }


        const data =
            await response.json();


        const summary =
            data.data ||
            data;


        setText(
            "activeIncidents",
            summary.active_incidents ??
            summary.total_incidents ??
            0
        );


        setText(
            "peopleAffected",
            Number(
                summary.people_affected ??
                summary.total_affected ??
                0
            ).toLocaleString()
        );


        setText(
            "highPriority",
            summary.high_priority ??
            summary.high_priority_incidents ??
            0
        );


    } catch (error) {

        console.error(
            "Summary error:",
            error
        );

    }

}


// =====================================================
// INCIDENTS
// =====================================================

async function loadIncidents() {

    try {

        const response =
            await fetch(
                `${API}/api/disaster-reports`
            );


        if (!response.ok) {
            return;
        }


        const data =
            await response.json();


        incidents =
            data.reports ||
            data.incidents ||
            data.data ||
            [];


        renderIncidents();

        renderPriority();

        renderAffectedPeople();

        renderReports();

        renderAI();


        initializeDashboardMap();


        renderDashboardAlerts();


    } catch (error) {

        console.error(
            "Incident error:",
            error
        );

    }

}


// =====================================================
// PRIORITY
// =====================================================

function getPriority(report) {

    const score =
        Number(
            report.priority_score ||
            report.score ||
            0
        );


    if (score >= 70) {

        return {
            level: "HIGH",
            className: "high"
        };

    }


    if (score >= 40) {

        return {
            level: "MEDIUM",
            className: "medium"
        };

    }


    return {
        level: "LOW",
        className: "low"
    };

}


// =====================================================
// INCIDENT TABLE
// =====================================================

function renderIncidents() {

    const table =
        document.getElementById(
            "incidentsTable"
        );


    if (!table) {
        return;
    }


    if (!incidents.length) {

        table.innerHTML = `
            <tr>
                <td colspan="8">
                    No emergency incidents found.
                </td>
            </tr>
        `;

        return;

    }


    table.innerHTML =
        incidents.map(report => {

            const priority =
                getPriority(report);


            return `

                <tr>

                    <td>
                        #${report.id || "-"}
                    </td>

                    <td>
                        ${escapeHtml(
                            report.disaster_type ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            report.location ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${Number(
                            report.affected_people ||
                            0
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            report.road_access ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${
                            report.hospital_distance_km ??
                            "-"
                        } km
                    </td>

                    <td>

                        <span class="
                            priority-badge
                            ${priority.className}
                        ">

                            ${priority.level}

                        </span>

                    </td>

                    <td>
                        ${formatDate(
                            report.created_at
                        )}
                    </td>

                </tr>

            `;

        }).join("");

}


// =====================================================
// PRIORITY CARDS
// =====================================================

function renderPriority() {

    const dashboard =
        document.getElementById(
            "dashboardPriority"
        );


    const cards =
        document.getElementById(
            "priorityCards"
        );


    const sorted =
        [...incidents]
        .sort(
            (a, b) =>
                Number(
                    b.priority_score ||
                    b.score ||
                    0
                )
                -
                Number(
                    a.priority_score ||
                    a.score ||
                    0
                )
        );


    if (dashboard) {

        const top =
            sorted.slice(0, 5);


        dashboard.innerHTML =
            top.length
                ? top.map(renderPriorityItem).join("")
                : `<div class="empty-state">
                    No active emergencies.
                   </div>`;

    }


    if (cards) {

        cards.innerHTML =
            sorted.length
                ? sorted.map(
                    renderPriorityCard
                  ).join("")
                : `<div class="empty-state">
                    No AI priority data.
                   </div>`;

    }

}


// =====================================================
// PRIORITY ITEM
// =====================================================

function renderPriorityItem(report) {

    const score =
        Number(
            report.priority_score ||
            report.score ||
            0
        );


    const priority =
        getPriority(report);


    return `

        <div class="priority-item">

            <div class="priority-top">

                <strong>
                    ${escapeHtml(
                        report.disaster_type ||
                        "Emergency"
                    )}
                </strong>

                <strong class="
                    priority-score
                    ${priority.className}
                ">
                    ${score}
                </strong>

            </div>

            <div class="priority-location">

                ${escapeHtml(
                    report.location ||
                    "Unknown"
                )}

                · ${priority.level}

            </div>

        </div>

    `;

}


// =====================================================
// PRIORITY CARD
// =====================================================

function renderPriorityCard(report) {

    const score =
        Number(
            report.priority_score ||
            report.score ||
            0
        );


    const priority =
        getPriority(report);


    let action =
        "Monitor the situation.";


    if (score >= 70) {

        action =
            "Immediate rescue team deployment recommended.";

    }

    else if (score >= 40) {

        action =
            "Prepare rescue resources and monitor.";

    }


    return `

        <div class="panel priority-card">

            <div class="priority-card-header">

                <div>

                    <span class="eyebrow">
                        AI PRIORITY
                    </span>

                    <h3>
                        ${escapeHtml(
                            report.disaster_type ||
                            "Emergency"
                        )}
                    </h3>

                </div>

                <div class="
                    priority-big-score
                    ${priority.className}
                ">

                    ${score}

                </div>

            </div>


            <p>

                📍
                ${escapeHtml(
                    report.location ||
                    "Unknown"
                )}

            </p>


            <p>

                👥
                ${Number(
                    report.affected_people ||
                    0
                )}
                people affected

            </p>


            <p>

                🛣
                ${escapeHtml(
                    report.road_access ||
                    "Unknown"
                )}

            </p>


            <div class="
                recommendation-box
                ${priority.className}
            ">

                <strong>
                    ${priority.level}
                </strong>

                <p>
                    ${action}
                </p>

            </div>

        </div>

    `;

}


// =====================================================
// DASHBOARD MAP
// =====================================================

function initializeDashboardMap() {

    const element =
        document.getElementById(
            "resqMap"
        );


    if (!element ||
        typeof L === "undefined") {

        return;

    }


    if (dashboardMap) {

        dashboardMap.invalidateSize();

        return;

    }


    dashboardMap =
        L.map("resqMap")
        .setView(
            [8.55, 77.58],
            8
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(dashboardMap);


    renderIncidentMarkers(
        dashboardMap
    );

}


// =====================================================
// FULL MAP
// =====================================================

function initializeFullMap() {

    const element =
        document.getElementById(
            "resqMapFull"
        );


    if (!element ||
        typeof L === "undefined") {

        return;

    }


    if (fullMap) {

        fullMap.invalidateSize();

        return;

    }


    fullMap =
        L.map("resqMapFull")
        .setView(
            [8.55, 77.58],
            7
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(fullMap);


    renderIncidentMarkers(fullMap);


    loadGlobalAlerts(true);

}


// =====================================================
// INCIDENT MARKERS
// =====================================================

function renderIncidentMarkers(map) {

    if (!map) {
        return;
    }


    incidents.forEach(report => {

        if (
            report.latitude == null ||
            report.longitude == null
        ) {

            return;

        }


        const score =
            Number(
                report.priority_score ||
                report.score ||
                0
            );


        let color =
            "#39d98a";


        if (score >= 70) {

            color =
                "#ff4d4d";

        }

        else if (score >= 40) {

            color =
                "#ffae42";

        }


        L.circleMarker(

            [
                Number(report.latitude),
                Number(report.longitude)
            ],

            {
                radius: 9,
                color: color,
                fillColor: color,
                fillOpacity: 0.8,
                weight: 2
            }

        )
        .addTo(map)
        .bindPopup(`

            <strong>
                ${escapeHtml(
                    report.disaster_type ||
                    "Emergency"
                )}
            </strong>

            <br>

            📍
            ${escapeHtml(
                report.location ||
                "Unknown"
            )}

            <br>

            👥
            ${Number(
                report.affected_people ||
                0
            )}

            people affected

            <br>

            🎯
            Priority:
            ${score}/100

        `);

    });

}


// =====================================================
// GLOBAL LIVE DISASTER ALERTS
// =====================================================

async function loadGlobalAlerts(
    addToMap = false
) {

    try {

        const response =
            await fetch(
                `${API}/api/global-alerts`
            );


        if (!response.ok) {

            throw new Error(
                "Global alert API failed"
            );

        }


        const data =
            await response.json();


        const alerts =
            data.alerts || [];


        renderAlerts(
            alerts
        );


        if (addToMap) {

            addGlobalAlertsToMap(
                alerts
            );

        }


    } catch (error) {

        console.error(
            "Global alerts error:",
            error
        );


        const container =
            document.getElementById(
                "allAlerts"
            );


        if (container) {

            container.innerHTML = `
                <div class="panel">
                    Live disaster feed is temporarily unavailable.
                </div>
            `;

        }

    }

}


// =====================================================
// RENDER GLOBAL ALERTS
// =====================================================

function renderAlerts(alerts) {

    const allAlerts =
        document.getElementById(
            "allAlerts"
        );


    const dashboardAlerts =
        document.getElementById(
            "dashboardAlerts"
        );


    if (!alerts.length) {

        const empty =
            `
            <div class="panel">
                No recent external disaster alerts.
            </div>
            `;


        if (allAlerts) {
            allAlerts.innerHTML =
                empty;
        }


        if (dashboardAlerts) {
            dashboardAlerts.innerHTML =
                empty;
        }


        return;

    }


    const html =
        alerts.map(alert => {

            const magnitude =
                Number(
                    alert.magnitude || 0
                );


            const level =
                magnitude >= 6
                    ? "HIGH"
                    : magnitude >= 4.5
                        ? "MEDIUM"
                        : "LOW";


            return `

                <div class="
                    panel
                    live-alert-card
                    ${level.toLowerCase()}
                ">

                    <div class="alert-title">

                        <strong>
                            🌍
                            ${escapeHtml(
                                alert.title ||
                                "Disaster Alert"
                            )}
                        </strong>

                        <span>
                            ${level}
                        </span>

                    </div>


                    <p>
                        📍
                        ${escapeHtml(
                            alert.location ||
                            "Unknown location"
                        )}
                    </p>


                    ${
                        alert.magnitude
                        ?
                        `<p>
                            Magnitude:
                            <strong>
                                ${alert.magnitude}
                            </strong>
                        </p>`
                        :
                        ""
                    }


                    <small>
                        ${formatDate(
                            alert.time
                        )}
                    </small>

                </div>

            `;

        }).join("");


    if (allAlerts) {

        allAlerts.innerHTML =
            html;

    }


    if (dashboardAlerts) {

        dashboardAlerts.innerHTML =
            alerts
            .slice(0, 4)
            .map(alert => `

                <div class="alert-item">

                    <span class="alert-dot"></span>

                    <div>

                        <strong>
                            ${escapeHtml(
                                alert.title ||
                                "Disaster Alert"
                            )}
                        </strong>

                        <p>
                            ${escapeHtml(
                                alert.location ||
                                "Unknown"
                            )}
                        </p>

                    </div>

                </div>

            `)
            .join("");

    }

}


// =====================================================
// GLOBAL ALERT MAP
// =====================================================

function addGlobalAlertsToMap(
    alerts
) {

    if (!fullMap) {
        return;
    }


    alerts.forEach(alert => {

        if (
            alert.latitude == null ||
            alert.longitude == null
        ) {

            return;

        }


        const magnitude =
            Number(
                alert.magnitude || 0
            );


        const color =
            magnitude >= 6
                ? "#ff3f3f"
                : magnitude >= 4.5
                    ? "#ffad42"
                    : "#ffdf58";


        L.circleMarker(

            [
                Number(alert.latitude),
                Number(alert.longitude)
            ],

            {
                radius:
                    Math.max(
                        5,
                        Math.min(
                            14,
                            magnitude * 2
                        )
                    ),

                color: color,

                fillColor: color,

                fillOpacity: 0.75,

                weight: 2

            }

        )
        .addTo(fullMap)

        .bindPopup(`

            <strong>
                🌍 External Disaster Alert
            </strong>

            <br>

            ${escapeHtml(
                alert.location ||
                "Unknown"
            )}

            <br>

            Magnitude:
            ${magnitude}

        `);

    });

}


// =====================================================
// HOSPITALS
// =====================================================

async function loadHospitals() {

    const grid =
        document.getElementById(
            "hospitalGrid"
        );


    const status =
        document.getElementById(
            "locationStatus"
        );


    const locationText =
        document.getElementById(
            "hospitalLocationText"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = `
        <div class="panel">
            🔄 Finding real hospitals near your location...
        </div>
    `;


    try {

        const location =
            await getCurrentLocation();


        const latitude =
            location.latitude;


        const longitude =
            location.longitude;


        const name =
            await getLocationName(
                latitude,
                longitude
            );


        if (status) {

            status.textContent =
                "LOCATION DETECTED";

        }


        if (locationText) {

            locationText.textContent =
                `Real hospitals near ${name}`;

        }


        const response =
            await fetch(
                `${API}/api/hospitals?latitude=${latitude}&longitude=${longitude}&radius=10000`
            );


        if (!response.ok) {

            throw new Error(
                "Hospital API failed"
            );

        }


        const data =
            await response.json();


        const hospitals =
            data.hospitals || [];


        renderHospitals(
            hospitals,
            latitude,
            longitude
        );


    } catch (error) {

        console.error(
            "Hospital error:",
            error
        );


        if (status) {

            status.textContent =
                "LOCATION NOT AVAILABLE";

        }


        grid.innerHTML = `
            <div class="panel">
                📍 Please allow location access to find real nearby hospitals.
            </div>
        `;

    }

}


// =====================================================
// RENDER HOSPITALS
// =====================================================

function renderHospitals(
    hospitals,
    latitude,
    longitude
) {

    const grid =
        document.getElementById(
            "hospitalGrid"
        );


    if (!grid) {
        return;
    }


    if (!hospitals.length) {

        grid.innerHTML = `
            <div class="panel">
                No mapped hospitals were found within 10 km.
            </div>
        `;

        return;

    }


    grid.innerHTML =
        hospitals.map(hospital => `

            <div class="panel hospital-card">

                <span class="hospital-icon">
                    🏥
                </span>

                <h3>
                    ${escapeHtml(
                        hospital.name ||
                        "Hospital"
                    )}
                </h3>


                <strong>

                    ${
                        hospital.distance_km != null
                        ?
                        `${hospital.distance_km} km away`
                        :
                        "Distance unavailable"
                    }

                </strong>


                <p>

                    ${
                        hospital.address
                        ?
                        escapeHtml(
                            hospital.address
                        )
                        :
                        "Address not available"
                    }

                </p>


                ${
                    hospital.phone
                    ?
                    `<p>
                        📞
                        ${escapeHtml(
                            hospital.phone
                        )}
                    </p>`
                    :
                    ""
                }


                <button
                    class="small-btn"
                    onclick="
                        openHospitalLocation(
                            ${hospital.latitude},
                            ${hospital.longitude}
                        )
                    "
                >
                    View on Map
                </button>

            </div>

        `)
        .join("");


    initializeHospitalMap(
        latitude,
        longitude,
        hospitals
    );

}


// =====================================================
// HOSPITAL MAP
// =====================================================

function initializeHospitalMap(
    latitude,
    longitude,
    hospitals
) {

    const element =
        document.getElementById(
            "hospitalMap"
        );


    if (!element ||
        typeof L === "undefined") {

        return;

    }


    if (hospitalMap) {

        hospitalMap.remove();

        hospitalMap = null;

    }


    hospitalMap =
        L.map("hospitalMap")
        .setView(
            [
                latitude,
                longitude
            ],
            12
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(hospitalMap);


    // Current location

    L.marker([
        latitude,
        longitude
    ])
    .addTo(hospitalMap)
    .bindPopup(
        "📍 Your current location"
    );


    // Hospitals

    hospitals.forEach(hospital => {

        if (
            hospital.latitude == null ||
            hospital.longitude == null
        ) {

            return;

        }


        L.marker([
            Number(hospital.latitude),
            Number(hospital.longitude)
        ])
        .addTo(hospitalMap)
        .bindPopup(`

            <strong>
                🏥
                ${escapeHtml(
                    hospital.name ||
                    "Hospital"
                )}
            </strong>

            <br>

            ${
                hospital.distance_km != null
                ?
                `${hospital.distance_km} km away`
                :
                ""
            }

        `);

    });

}


// =====================================================
// OPEN HOSPITAL LOCATION
// =====================================================

function openHospitalLocation(
    latitude,
    longitude
) {

    openSection("hospitals");


    if (hospitalMap) {

        hospitalMap.setView(
            [
                latitude,
                longitude
            ],
            16
        );

    }

}


// =====================================================
// AFFECTED PEOPLE
// =====================================================

function renderAffectedPeople() {

    let total = 0;

    let high = 0;

    let medium = 0;


    const areas = {};


    incidents.forEach(report => {

        const people =
            Number(
                report.affected_people ||
                0
            );


        total += people;


        const priority =
            getPriority(report);


        if (priority.level === "HIGH") {

            high += people;

        }

        else if (
            priority.level === "MEDIUM"
        ) {

            medium += people;

        }


        const location =
            report.location ||
            "Unknown";


        areas[location] =
            (
                areas[location] ||
                0
            ) + people;

    });


    setText(
        "peopleTotal",
        total.toLocaleString()
    );


    setText(
        "peopleHigh",
        high.toLocaleString()
    );


    setText(
        "peopleMedium",
        medium.toLocaleString()
    );


    const container =
        document.getElementById(
            "affectedAreas"
        );


    if (!container) {
        return;
    }


    const sorted =
        Object.entries(areas)
        .sort(
            (a, b) =>
                b[1] - a[1]
        )
        .slice(0, 10);


    container.innerHTML =
        sorted.map(item => `

            <div class="area-row">

                <span>
                    ${escapeHtml(
                        item[0]
                    )}
                </span>

                <strong>
                    ${Number(
                        item[1]
                    ).toLocaleString()}
                </strong>

            </div>

        `)
        .join("");

}
// =====================================================
// SEARCH HOSPITAL LOCATION
// =====================================================

async function searchHospitalLocation() {

    const input =
        document.getElementById(
            "hospitalLocationInput"
        );

    const status =
        document.getElementById(
            "hospitalLocationStatus"
        );

    if (!input || !status) {
        return;
    }

    const location =
        input.value.trim();

    if (!location) {

        status.textContent =
            "Please enter a location.";

        return;
    }

    status.textContent =
        "🔍 Searching location...";

    try {

        const response =
            await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(location)}`
            );

        if (!response.ok) {
            throw new Error(
                "Location search failed"
            );
        }

        const data =
            await response.json();

        if (!data.length) {

            status.textContent =
                "❌ Location not found.";

            return;
        }

        const latitude =
            Number(data[0].lat);

        const longitude =
            Number(data[0].lon);

        const displayName =
            data[0].display_name;


        // Store selected location

        currentLocation.latitude =
            latitude;

        currentLocation.longitude =
            longitude;


        // Show selected location

        status.textContent =
            `📍 ${displayName}`;


        // Load hospitals for searched location

        await loadHospitals();

    }
    catch (error) {

        console.error(
            "Hospital location search error:",
            error
        );

        status.textContent =
            "❌ Unable to search this location.";

    }

}
// =====================================================
// HOSPITALS
// =====================================================

async function loadHospitals() {

    const grid =
        document.getElementById("hospital-grid")

    const status =
        document.getElementById("locationStatus");

    const locationText =
        document.getElementById("hospitalLocationText");

    if (!grid) {
        return;
    }

    grid.innerHTML = `
        <div class="panel">
            🔄 Finding real hospitals near your location...
        </div>
    `;

    try {

        const location =
            await getCurrentLocation();

        const latitude =
            location.latitude;

        const longitude =
            location.longitude;

        const name =
            await getLocationName(
                latitude,
                longitude
            );

        if (status) {
            status.textContent =
                "LOCATION DETECTED";
        }

        if (locationText) {
            locationText.textContent =
                `Real hospitals near ${name}`;
        }

        const response =
            await fetch(
                `${API}/api/hospitals?latitude=${latitude}&longitude=${longitude}&radius=10000`
            );

        if (!response.ok) {
            throw new Error("Hospital API failed");
        }

        const data =
            await response.json();

        const hospitals =
            data.hospitals || [];

        renderHospitals(
            hospitals,
            latitude,
            longitude
        );

    } catch (error) {

        console.error(
            "Hospital error:",
            error
        );

        if (status) {
            status.textContent =
                "LOCATION NOT AVAILABLE";
        }

        grid.innerHTML = `
            <div class="panel">
                📍 Please allow location access to find real nearby hospitals.
            </div>
        `;
    }
}


// =====================================================
// RENDER HOSPITALS
// =====================================================

function renderHospitals(
    hospitals,
    latitude,
    longitude
) {

    const grid =
        document.getElementById("hospitalGrid");

    if (!grid) {
        return;
    }

    if (!hospitals.length) {

        grid.innerHTML = `
            <div class="panel">
                No mapped hospitals were found within 10 km.
            </div>
        `;

        return;
    }

    grid.innerHTML =
        hospitals.map(hospital => `

            <div class="panel hospital-card">

                <span class="hospital-icon">
                    🏥
                </span>

                <h3>
                    ${escapeHtml(
                        hospital.name ||
                        "Hospital"
                    )}
                </h3>

                <strong>
                    ${
                        hospital.distance_km != null
                        ? `${hospital.distance_km} km away`
                        : "Distance unavailable"
                    }
                </strong>

                <p>
                    ${
                        hospital.address
                        ? escapeHtml(hospital.address)
                        : "Address not available"
                    }
                </p>

                ${
                    hospital.phone
                    ?
                    `<p>
                        📞 ${escapeHtml(hospital.phone)}
                    </p>`
                    :
                    ""
                }

                <button
                    class="small-btn"
                    onclick="
                        openHospitalLocation(
                            ${hospital.latitude},
                            ${hospital.longitude}
                        )
                    "
                >
                    📍 View on Map
                </button>

            </div>

        `).join("");

    initializeHospitalMap(
        latitude,
        longitude,
        hospitals
    );
}


// =====================================================
// HOSPITALS
// =====================================================

async function loadHospitals() {

    const grid =
        document.getElementById("hospital-grid");

    const status =
        document.getElementById("hospitalLocationStatus");

    const locationInput =
        document.getElementById("hospitalLocationInput");

    if (!grid) {
        return;
    }

    grid.innerHTML = `
        <div class="panel">
            🔄 Finding real hospitals near your location...
        </div>
    `;

    try {

        let latitude = currentLocation.latitude;
        let longitude = currentLocation.longitude;

        /*
         * Use stored/search-selected location first.
         * If unavailable, get current browser location.
         */

        if (
            latitude == null ||
            longitude == null
        ) {

            const location =
                await getCurrentLocation();

            latitude =
                location.latitude;

            longitude =
                location.longitude;
        }

        currentLocation.latitude =
            latitude;

        currentLocation.longitude =
            longitude;


        const name =
            await getLocationName(
                latitude,
                longitude
            );


        if (status) {

            status.textContent =
                `📍 ${name}`;

        }


        if (
            locationInput &&
            !locationInput.value.trim()
        ) {

            locationInput.value =
                name;

        }


        const response =
            await fetch(
                `${API}/api/hospitals?latitude=${latitude}&longitude=${longitude}&radius=10000`
            );


        if (!response.ok) {

            throw new Error(
                "Hospital API failed"
            );

        }


        const data =
            await response.json();


        if (data.status !== "success") {

            throw new Error(
                data.message ||
                "Hospital search failed"
            );

        }


        const hospitals =
            data.hospitals || [];


        renderHospitals(
            hospitals,
            latitude,
            longitude
        );


        setText(
            "medicalPriorityCount",
            getMedicalPriorityCount()
        );


    }
    catch (error) {

        console.error(
            "Hospital error:",
            error
        );


        grid.innerHTML = `
            <div class="panel">
                ❌ Unable to load nearby hospitals.
                <br><br>
                Please try again.
            </div>
        `;

    }

}


// =====================================================
// SEARCH HOSPITAL LOCATION
// =====================================================

async function searchHospitalLocation() {

    const input =
        document.getElementById(
            "hospitalLocationInput"
        );

    const status =
        document.getElementById(
            "hospitalLocationStatus"
        );


    if (!input || !status) {
        return;
    }


    const location =
        input.value.trim();


    if (!location) {

        status.textContent =
            "Please enter a location.";

        return;

    }


    status.textContent =
        "🔍 Searching location...";


    try {

        const response =
            await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(location)}`
            );


        if (!response.ok) {

            throw new Error(
                "Location search failed"
            );

        }


        const data =
            await response.json();


        if (!data.length) {

            status.textContent =
                "❌ Location not found.";

            return;

        }


        const latitude =
            Number(data[0].lat);

        const longitude =
            Number(data[0].lon);


        const displayName =
            data[0].display_name;


        currentLocation.latitude =
            latitude;

        currentLocation.longitude =
            longitude;


        status.textContent =
            `📍 ${displayName}`;


        await loadHospitals();


    }
    catch (error) {

        console.error(
            "Hospital location error:",
            error
        );


        status.textContent =
            "❌ Unable to search location.";

    }

}


// =====================================================
// RENDER HOSPITALS
// =====================================================

function renderHospitals(
    hospitals,
    latitude,
    longitude
) {

    const grid =
        document.getElementById(
            "hospital-grid"
        );


    const nearestName =
        document.getElementById(
            "nearestHospital"
        );


    const nearestDistance =
        document.getElementById(
            "hospitalDistanceInfo"
        );


    const nearestAddress =
        document.getElementById(
            "nearestHospitalAddress"
        );


    if (!grid) {
        return;
    }


    if (!hospitals.length) {

        grid.innerHTML = `
            <div class="panel">
                🏥 No mapped hospitals were found
                within 10 km.
            </div>
        `;


        if (nearestName) {

            nearestName.textContent =
                "No hospital found";

        }


        if (nearestDistance) {

            nearestDistance.textContent =
                "Try another location.";

        }


        if (nearestAddress) {

            nearestAddress.textContent =
                "";

        }


        return;

    }


    // Nearest hospital

    const nearest =
        hospitals[0];


    if (nearestName) {

        nearestName.textContent =
            nearest.name ||
            "Nearby Hospital";

    }


    if (nearestDistance) {

        nearestDistance.textContent =
            nearest.distance_km != null
                ? `📏 ${nearest.distance_km} km away`
                : "Distance unavailable";

    }


    if (nearestAddress) {

        nearestAddress.textContent =
            nearest.address ||
            "Address unavailable";

    }


    // Hospital cards

    grid.innerHTML =
        hospitals
            .slice(0, 20)
            .map(
                (hospital, index) => {

                    return `

                        <div class="panel hospital-card">

                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    align-items:flex-start;
                                    gap:12px;
                                "
                            >

                                <div>

                                    <span
                                        class="hospital-icon"
                                    >
                                        🏥
                                    </span>

                                    <h3
                                        style="
                                            margin-top:8px;
                                        "
                                    >
                                        ${escapeHtml(
                                            hospital.name ||
                                            "Hospital"
                                        )}
                                    </h3>

                                </div>


                                <strong>
                                    #${index + 1}
                                </strong>

                            </div>


                            <p
                                style="
                                    margin-top:12px;
                                    font-weight:700;
                                "
                            >

                                📏
                                ${
                                    hospital.distance_km != null
                                    ? `${hospital.distance_km} km away`
                                    : "Distance unavailable"
                                }

                            </p>


                            <p
                                style="
                                    margin-top:8px;
                                "
                            >

                                📍
                                ${
                                    hospital.address
                                    ? escapeHtml(
                                        hospital.address
                                    )
                                    : "Address unavailable"
                                }

                            </p>

                        </div>

                    `;

                }
            )
            .join("");


    initializeHospitalMap(
        latitude,
        longitude,
        hospitals
    );

}


// =====================================================
// HOSPITAL MAP
// =====================================================

function initializeHospitalMap(
    latitude,
    longitude,
    hospitals
) {

    const element =
        document.getElementById(
            "hospitalMap"
        );


    /*
     * hospitalMap is optional.
     * If the HTML does not contain it,
     * hospital list still works normally.
     */

    if (
        !element ||
        typeof L === "undefined"
    ) {

        return;

    }


    if (hospitalMap) {

        hospitalMap.remove();

        hospitalMap = null;

    }


    hospitalMap =
        L.map("hospitalMap")
        .setView(
            [
                latitude,
                longitude
            ],
            12
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    )
    .addTo(hospitalMap);


    L.marker([
        latitude,
        longitude
    ])
    .addTo(hospitalMap)
    .bindPopup(
        "📍 Selected location"
    );


    hospitals.forEach(
        hospital => {

            if (
                hospital.latitude == null ||
                hospital.longitude == null
            ) {

                return;

            }


            L.marker([
                Number(hospital.latitude),
                Number(hospital.longitude)
            ])
            .addTo(hospitalMap)
            .bindPopup(`

                <strong>
                    🏥
                    ${escapeHtml(
                        hospital.name ||
                        "Hospital"
                    )}
                </strong>

                <br>

                ${
                    hospital.distance_km != null
                    ? `${hospital.distance_km} km away`
                    : ""
                }

            `);

        }
    );

}


// =====================================================
// OPEN HOSPITAL LOCATION
// =====================================================

function openHospitalLocation(
    latitude,
    longitude
) {

    openSection("hospitals");


    setTimeout(() => {

        if (hospitalMap) {

            hospitalMap.setView(
                [
                    Number(latitude),
                    Number(longitude)
                ],
                17
            );

        }

    }, 300);

}


// =====================================================
// MEDICAL PRIORITY COUNT
// =====================================================

function getMedicalPriorityCount() {

    if (
        !incidents ||
        incidents.length === 0
    ) {

        return 0;

    }


    return incidents.filter(
        report => {

            const score =
                Number(
                    report.priority_score ||
                    report.score ||
                    0
                );


            return score >= 70;

        }
    ).length;

}

// =====================================================
// REPORTS
// =====================================================

function renderReports() {

    const container =
        document.getElementById(
            "reportCards"
        );


    if (!container) {
        return;
    }


    if (!incidents.length) {

        container.innerHTML =
            `<div class="empty-state">
                No reports found.
             </div>`;

        return;

    }


    container.innerHTML =
        incidents
        .slice(0, 10)
        .map(report => {

            const priority =
                getPriority(report);


            return `

                <div class="report-card">

                    <div>

                        <strong>
                            ${escapeHtml(
                                report.disaster_type ||
                                "Emergency"
                            )}
                        </strong>

                        <p>
                            📍
                            ${escapeHtml(
                                report.location ||
                                "Unknown"
                            )}
                        </p>

                    </div>


                    <span class="
                        priority-badge
                        ${priority.className}
                    ">

                        ${priority.level}

                    </span>

                </div>

            `;

        })
        .join("");

}


// =====================================================
// RESCUE TEAMS
// =====================================================

async function loadRescueTeams() {

    try {

        const response =
            await fetch(
                `${API}/api/rescue-teams`
            );


        if (!response.ok) {
            return;
        }


        const data =
            await response.json();


        teams =
            data.teams ||
            [];


        setText(
            "rescueTeams",
            data.total_teams ??
            teams.length
        );


        renderTeams();

    } catch (error) {

        console.error(
            "Team error:",
            error
        );

    }

}


function renderTeams() {

    const container =
        document.getElementById(
            "teamsGrid"
        );


    if (!container) {
        return;
    }


    if (!teams.length) {

        container.innerHTML =
            `<div class="panel">
                No rescue teams found.
             </div>`;

        return;

    }


    container.innerHTML =
        teams.map(team => `

            <div class="panel team-card">

                <div class="team-icon">
                    🚑
                </div>

                <h3>
                    ${escapeHtml(
                        team.team_name ||
                        "Rescue Team"
                    )}
                </h3>

                <p>
                    Type:
                    ${escapeHtml(
                        team.team_type ||
                        "Emergency"
                    )}
                </p>

                <p>
                    Members:
                    ${Number(
                        team.members_count ||
                        0
                    )}
                </p>

                <p>
                    📍
                    ${escapeHtml(
                        team.current_location ||
                        "Unknown"
                    )}
                </p>

                <span class="team-status">
                    ${escapeHtml(
                        team.status ||
                        "AVAILABLE"
                    )}
                </span>

            </div>

        `)
        .join("");

}


// =====================================================
// AI PREDICTIONS
// =====================================================
function renderAI() {

    const mainScore =
        document.getElementById("aiMainScore");

    const mainLevel =
        document.getElementById("aiMainLevel");

    const mainReason =
        document.getElementById("aiMainReason");

    const action =
        document.getElementById("aiAction");

    const locationElement =
        document.getElementById("aiPriorityLocation");

    const affectedElement =
        document.getElementById("aiAffectedPeople");

    const weatherElement =
        document.getElementById("aiWeatherRisk");

    const roadElement =
        document.getElementById("aiRoadAccess");

    const hospitalElement =
        document.getElementById("aiHospitalDistance");

    const recommendationText =
        document.getElementById("aiRecommendationText");

    const todayIncidents =
        document.getElementById("aiTodayIncidents");

    const todayPeople =
        document.getElementById("aiTodayPeople");

    const todayHigh =
        document.getElementById("aiTodayHigh");

    const peakTime =
        document.getElementById("aiPeakTime");

    const reasons =
        document.getElementById("aiReasons");

    const queue =
        document.getElementById("aiPriorityQueue");


    /* =========================================
       NO DATA
       ========================================= */

    if (!incidents || incidents.length === 0) {

        if (mainScore)
            mainScore.textContent = "0/100";

        if (mainLevel)
            mainLevel.textContent = "WAITING FOR DATA";

        if (locationElement)
            locationElement.textContent =
                "No emergency data available";

        return;
    }


    /* =========================================
       PREPARE INCIDENT DATA
       ========================================= */

    const data = incidents.map((incident) => {

        const score = Number(
            incident.priority_score ??
            incident.score ??
            0
        );

        const affected =
            Number(incident.affected_people ?? 0);

        const hospital =
            Number(
                incident.hospital_distance_km ?? 0
            );

        const road =
            incident.road_access || "Unknown";

        const disaster =
            incident.disaster_type || "Emergency";

        const location =
            incident.location || "Unknown location";

        return {
            ...incident,
            score,
            affected,
            hospital,
            road,
            disaster,
            location
        };

    });


    /* =========================================
       SORT HIGHEST PRIORITY FIRST
       ========================================= */

    data.sort((a, b) => {

        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return b.affected - a.affected;

    });


    const top = data[0];


    /* =========================================
       PRIORITY LEVEL
       ========================================= */

    let level = "LOW";

    if (top.score >= 85) {
        level = "CRITICAL";
    }
    else if (top.score >= 70) {
        level = "HIGH";
    }
    else if (top.score >= 40) {
        level = "MEDIUM";
    }


    /* =========================================
       FIRST RESCUE LOCATION
       ========================================= */

    if (locationElement) {

        locationElement.textContent =
            `🚑 ${top.location}`;

    }


    if (mainScore) {

        mainScore.textContent =
            `${top.score}/100`;

    }


    if (mainLevel) {

        mainLevel.textContent =
            level;

    }


    /* =========================================
       INCIDENT DETAILS
       ========================================= */

    if (affectedElement) {

        affectedElement.textContent =
            top.affected;

    }


    if (roadElement) {

        roadElement.textContent =
            top.road;

    }


    if (hospitalElement) {

        hospitalElement.textContent =
            `${top.hospital.toFixed(1)} km`;

    }
    async function loadTodayAI() {

    try {

        const response =
            await fetch(`${API}/api/ai-today`);

        const result =
            await response.json();

        if (result.status !== "success") {
            return;
        }


        /* TODAY TOTALS */

        setText(
            "aiTodayIncidents",
            result.total_incidents ?? 0
        );

        setText(
            "aiTodayPeople",
            result.total_people ?? 0
        );

        setText(
            "aiTodayHigh",
            result.high_priority ?? 0
        );


        /* PEAK TIME */

        setText(
            "aiPeakTime",
            result.peak_time || "No incidents today"
        );


        /* FIRST RESCUE */

        const first =
            result.first_rescue;

        if (!first) {

            setText(
                "aiPriorityLocation",
                "No emergency reported today"
            );

            setText(
                "aiMainScore",
                "0/100"
            );

            setText(
                "aiMainLevel",
                "NO INCIDENTS TODAY"
            );

            setText(
                "aiAction",
                "✅ No immediate rescue action required."
            );

            setText(
                "aiRecommendationText",
                "ResQ AI is monitoring for new emergency reports."
            );

            return;
        }


        const score =
            Number(first.priority_score || 0);


        let level = "LOW";

        if (score >= 85) {
            level = "CRITICAL";
        }
        else if (score >= 70) {
            level = "HIGH";
        }
        else if (score >= 40) {
            level = "MEDIUM";
        }


        setText(
            "aiPriorityLocation",
            `🚑 ${first.location}`
        );

        setText(
            "aiMainScore",
            `${score}/100`
        );

        setText(
            "aiMainLevel",
            level
        );


        /* ACTION */

        let action =
            "👁️ Continue monitoring the incident.";

        if (score >= 85) {
            action =
                "🚨 Deploy rescue team immediately.";
        }
        else if (score >= 70) {
            action =
                "🚑 Send rescue resources as first priority.";
        }
        else if (score >= 40) {
            action =
                "⚠️ Prepare rescue resources and monitor.";
        }


        setText(
            "aiAction",
            action
        );


        setText(
            "aiRecommendationText",
            `Based on today's ${result.total_incidents} emergency reports, `
            + `${first.location} currently has the highest rescue priority `
            + `with a score of ${score}/100.`
        );


        setText(
            "aiAffectedPeople",
            first.affected_people ?? 0
        );

        setText(
            "aiRoadAccess",
            first.road_access || "Unknown"
        );

        setText(
            "aiHospitalDistance",
            `${Number(
                first.hospital_distance_km || 0
            ).toFixed(1)} km`
        );

    }
    catch (error) {

        console.error(
            "Today AI Error:",
            error
        );

    }

}


    /* =========================================
       WEATHER RISK
       ========================================= */

    let weatherRisk = "LOW";

    const rainfall =
        Number(top.rainfall ?? 0);

    const wind =
        Number(top.wind_speed ?? 0);

    const humidity =
        Number(top.humidity ?? 0);


    if (
        rainfall >= 50 ||
        wind >= 50 ||
        humidity >= 90
    ) {

        weatherRisk = "HIGH";

    }
    else if (
        rainfall >= 20 ||
        wind >= 30 ||
        humidity >= 75
    ) {

        weatherRisk = "MEDIUM";

    }


    if (weatherElement) {

        weatherElement.textContent =
            weatherRisk;

    }


    /* =========================================
       AI REASON
       ========================================= */

    if (mainReason) {

        mainReason.textContent =
            `AI ranked ${data.length} emergency `
            + `locations using rescue priority score, `
            + `affected population, road access, `
            + `hospital distance and weather risk.`;

    }


    /* =========================================
       RESCUE ACTION
       ========================================= */

    let rescueAction = "";

    if (level === "CRITICAL") {

        rescueAction =
            "🚨 Deploy rescue team immediately.";

    }
    else if (level === "HIGH") {

        rescueAction =
            "🚑 Send rescue resources as first priority.";

    }
    else if (level === "MEDIUM") {

        rescueAction =
            "⚠️ Prepare rescue resources and monitor.";

    }
    else {

        rescueAction =
            "👁️ Continue monitoring the incident.";

    }


    if (action) {

        action.textContent =
            rescueAction;

    }


    if (recommendationText) {

        recommendationText.textContent =
            `Based on ${data.length} emergency records, `
            + `${top.location} currently has the highest `
            + `rescue priority with a score of ${top.score}/100. `
            + `This location should be assessed first.`;

    }


    /* =========================================
       AI DECISION FACTORS
       ========================================= */

    if (reasons) {

        reasons.innerHTML = `

            <li>
                👥 Affected population:
                <strong>${top.affected}</strong> people
            </li>

            <li>
                🌊 Disaster type:
                <strong>${escapeHtml(top.disaster)}</strong>
            </li>

            <li>
                🚧 Road accessibility:
                <strong>${escapeHtml(top.road)}</strong>
            </li>

            <li>
                🏥 Hospital distance:
                <strong>${top.hospital.toFixed(1)} km</strong>
            </li>

            <li>
                🌧️ Weather risk:
                <strong>${weatherRisk}</strong>
            </li>

        `;

    }


    /* =========================================
       TODAY'S INCIDENT INTELLIGENCE
       ========================================= */

    const today =
        new Date().toDateString();

    const todayData =
        data.filter((item) => {

            if (!item.created_at) {
                return false;
            }

            return new Date(
                item.created_at
            ).toDateString() === today;

        });


    const todayList =
        todayData.length > 0
            ? todayData
            : data;


    const totalPeople =
        todayList.reduce(
            (sum, item) =>
                sum + item.affected,
            0
        );


    const highCount =
        todayList.filter(
            item => item.score >= 70
        ).length;


    if (todayIncidents) {

        todayIncidents.textContent =
            todayList.length;

    }


    if (todayPeople) {

        todayPeople.textContent =
            totalPeople;

    }


    if (todayHigh) {

        todayHigh.textContent =
            highCount;

    }


    /* =========================================
       PEAK EMERGENCY TIME
       ========================================= */

    const timeBuckets = {};

    data.forEach((item) => {

        if (!item.created_at) {
            return;
        }

        const date =
            new Date(item.created_at);

        const hour =
            date.getHours();

        const bucket =
            `${String(hour).padStart(2, "0")}:00`;

        timeBuckets[bucket] =
            (timeBuckets[bucket] || 0) + 1;

    });


    let peakHour = null;
    let peakCount = 0;

    Object.entries(timeBuckets)
        .forEach(([hour, count]) => {

            if (count > peakCount) {

                peakCount = count;
                peakHour = hour;

            }

        });


    if (peakTime) {

        if (peakHour) {

            peakTime.textContent =
                `⏰ ${peakHour} — ${peakCount} emergency reports`;

        }
        else {

            peakTime.textContent =
                "Not enough time data";

        }

    }


    /* =========================================
       RESCUE PRIORITY QUEUE
       ========================================= */

    if (queue) {

        queue.innerHTML = "";

        data.slice(0, 10)
            .forEach((item, index) => {

                const itemLevel =
                    item.score >= 85
                        ? "CRITICAL"
                        : item.score >= 70
                        ? "HIGH"
                        : item.score >= 40
                        ? "MEDIUM"
                        : "LOW";


                const card =
                    document.createElement("div");

                card.className =
                    "ai-queue-item";


                card.innerHTML = `

                    <div>

                        <strong>
                            #${index + 1}
                            ${escapeHtml(item.location)}
                        </strong>

                        <p>
                            ${escapeHtml(item.disaster)}
                            •
                            ${item.affected} people affected
                        </p>

                    </div>

                    <div>

                        <strong>
                            ${item.score}/100
                        </strong>

                        <small>
                            ${itemLevel}
                        </small>

                    </div>

                `;


                queue.appendChild(card);

            });

    }

}


// =====================================================
// DASHBOARD ALERTS FROM REPORTS
// =====================================================

function renderDashboardAlerts() {

    const container =
        document.getElementById(
            "dashboardAlerts"
        );


    if (!container) {
        return;
    }


    const critical =
        incidents.filter(report => {

            return Number(
                report.priority_score ||
                report.score ||
                0
            ) >= 70;

        });


    if (!critical.length) {

        container.innerHTML = `
            <div class="empty-state">
                No high-priority emergency alerts.
            </div>
        `;

        return;

    }


    container.innerHTML =
        critical
        .slice(0, 5)
        .map(report => `

            <div class="alert-item">

                <span class="alert-dot"></span>

                <div>

                    <strong>
                        HIGH PRIORITY
                    </strong>

                    <p>
                        ${escapeHtml(
                            report.disaster_type ||
                            "Emergency"
                        )}
                        -
                        ${escapeHtml(
                            report.location ||
                            "Unknown"
                        )}
                    </p>

                </div>

            </div>

        `)
        .join("");

}


// =====================================================
// REFRESH ALL
// =====================================================

async function refreshAll() {

    await loadDashboardSummary();

    await loadIncidents();

    await loadRescueTeams();

    await loadWeather();

    await loadTodayAI();

    await loadGlobalAlerts();

}


// =====================================================
// SEARCH
// =====================================================

const search =
    document.getElementById(
        "incidentSearch"
    );


const filter =
    document.getElementById(
        "incidentFilter"
    );


if (search) {

    search.addEventListener(
        "input",
        filterIncidents
    );

}


if (filter) {

    filter.addEventListener(
        "change",
        filterIncidents
    );

}


function filterIncidents() {

    const query =
        (
            search?.value ||
            ""
        ).toLowerCase();


    const selected =
        filter?.value ||
        "ALL";


    const table =
        document.getElementById(
            "incidentsTable"
        );


    if (!table) {
        return;
    }


    const filtered =
        incidents.filter(report => {

            const priority =
                getPriority(report);


            const text =
                `${report.disaster_type || ""}
                 ${report.location || ""}`
                .toLowerCase();


            return (
                text.includes(query) &&
                (
                    selected === "ALL" ||
                    priority.level === selected
                )
            );

        });


    table.innerHTML =
        filtered.map(report => {

            const priority =
                getPriority(report);


            return `

                <tr>

                    <td>
                        #${report.id}
                    </td>

                    <td>
                        ${escapeHtml(
                            report.disaster_type ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            report.location ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${Number(
                            report.affected_people ||
                            0
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            report.road_access ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${
                            report.hospital_distance_km ??
                            "-"
                        } km
                    </td>

                    <td>
                        <span class="
                            priority-badge
                            ${priority.className}
                        ">
                            ${priority.level}
                        </span>
                    </td>

                    <td>
                        ${formatDate(
                            report.created_at
                        )}
                    </td>

                </tr>

            `;

        })
        .join("");

}


// =====================================================
// HELPERS
// =====================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


function formatDate(date) {

    if (!date) {
        return "-";
    }


    try {

        return new Date(
            date
        ).toLocaleString();

    } catch {

        return "-";

    }

}


// =====================================================
// INITIAL LOAD
// =====================================================

async function initializeAdmin() {

    loadAdminUser();

    initializeDashboardMap();

    await loadDashboardSummary();

    await loadIncidents();

    await loadRescueTeams();

    await loadWeather();

    await loadGlobalAlerts();

}


initializeAdmin();


// =====================================================
// AUTO REFRESH
// =====================================================

setInterval(() => {

    const auto =
        document.getElementById(
            "autoRefresh"
        );

    if (!auto || auto.checked) {

        refreshAll();

    }

}, 60000);


// =====================================================
// WEATHER LOCATION SEARCH
// =====================================================

async function searchWeatherLocation() {

    const input =
        document.getElementById(
            "weatherLocationInput"
        );

    const locationText =
        document.getElementById(
            "weatherLocationText"
        );

    if (!input || !locationText) {
        return;
    }

    const location =
        input.value.trim();

    if (!location) {

        locationText.textContent =
            "Please enter a location.";

        return;
    }

    locationText.textContent =
        "🔄 Finding location and weather...";

    try {

        // Find latitude and longitude
        const geoResponse =
            await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`
            );

        if (!geoResponse.ok) {
            throw new Error(
                "Location search failed"
            );
        }

        const geoData =
            await geoResponse.json();

        if (!geoData.length) {

            locationText.textContent =
                "❌ Location not found.";

            return;
        }

        const latitude =
            parseFloat(
                geoData[0].lat
            );

        const longitude =
            parseFloat(
                geoData[0].lon
            );

        const displayName =
            geoData[0].display_name;


        // Get weather from backend
        const weatherResponse =
            await fetch(
                `${API}/api/weather?latitude=${latitude}&longitude=${longitude}`
            );

        if (!weatherResponse.ok) {

            throw new Error(
                "Weather API failed"
            );

        }

        const result =
            await weatherResponse.json();

        const weather =
            result.weather ||
            result.data ||
            result;


        const temperature =
            Number(
                weather.temperature ??
                weather.temperature_c ??
                weather.temp ??
                0
            );

        const humidity =
            Number(
                weather.humidity ??
                0
            );

        const rainfall =
            Number(
                weather.rainfall ??
                weather.precipitation ??
                0
            );

        const wind =
            Number(
                weather.wind_speed ??
                weather.wind ??
                0
            );


        // Show location
        locationText.textContent =
            "📍 " + displayName;


        // Show weather
        setText(
            "weatherTemp",
            `${temperature} °C`
        );

        setText(
            "weatherHumidity",
            `${humidity} %`
        );

        setText(
            "weatherRainfall",
            `${rainfall} mm`
        );

        setText(
            "weatherWind",
            `${wind} km/h`
        );


        // Calculate weather risk
        calculateWeatherRisk(
            rainfall,
            wind,
            humidity
        );


        console.log(
            "Weather loaded:",
            displayName
        );

    } catch (error) {

        console.error(
            "Weather search error:",
            error
        );

        locationText.textContent =
            "❌ Unable to get weather data. Please try again.";

    }

}
async function searchDisasterLocation() {

    const input =
        document.getElementById("mapLocationInput");

    const status =
        document.getElementById("mapLocationStatus");

    const hospitalBox =
        document.getElementById("mapHospitals");

    const alertTitle =
        document.getElementById("mapAlertTitle");

    const alertText =
        document.getElementById("mapAlertText");


    const location =
        input ? input.value.trim() : "";


    if (!location) {

        if (status)
            status.textContent =
                "Please enter a location.";

        return;
    }


    try {

        if (status)
            status.textContent =
                "🔍 Finding location...";


        /* =========================================
           1. FIND LOCATION
           ========================================= */

        const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`
        );

        const geoData =
            await geoResponse.json();


        if (!geoData.length) {

            if (status)
                status.textContent =
                    "❌ Location not found.";

            return;
        }


        const latitude =
            Number(geoData[0].lat);

        const longitude =
            Number(geoData[0].lon);

        const displayName =
            geoData[0].display_name;


        /* =========================================
           2. MOVE MAP
           ========================================= */

        if (fullMap) {

            fullMap.setView(
                [latitude, longitude],
                13
            );


            L.marker([
                latitude,
                longitude
            ])
            .addTo(fullMap)
            .bindPopup(
                `<strong>📍 ${escapeHtml(location)}</strong>`
            )
            .openPopup();

        }


        if (status)
            status.textContent =
                `📍 ${displayName}`;


        /* =========================================
           3. FIND NEARBY HOSPITALS
           ========================================= */

        if (hospitalBox) {

            hospitalBox.innerHTML =
                `<div class="empty-state">
                    🏥 Finding nearby hospitals...
                </div>`;

        }


        const hospitalResponse =
            await fetch(
                `${API}/api/hospitals?latitude=${latitude}&longitude=${longitude}&radius=10000`
            );


        if (!hospitalResponse.ok) {
            throw new Error("Hospital service unavailable");
        }


        const hospitalData =
            await hospitalResponse.json();


        /* =========================================
           4. DISPLAY HOSPITALS
           ========================================= */

        if (
            hospitalData.status === "success" &&
            hospitalData.hospitals &&
            hospitalData.hospitals.length > 0
        ) {

            hospitalBox.innerHTML =
                hospitalData.hospitals
                    .slice(0, 5)
                    .map((hospital) => {

                        const name =
                            hospital.name ||
                            "Hospital";

                        const distance =
                            hospital.distance_km ??
                            hospital.distance ??
                            "--";


                        return `
                            <div class="ai-queue-item">

                                <div>

                                    <strong>
                                        🏥 ${escapeHtml(name)}
                                    </strong>

                                    <p>
                                        Available medical support
                                    </p>

                                </div>

                                <div>

                                    <strong>
                                        ${distance} km
                                    </strong>

                                    <small>
                                        NEARBY
                                    </small>

                                </div>

                            </div>
                        `;

                    })
                    .join("");

        }
        else {

            hospitalBox.innerHTML =
                `<div class="empty-state">
                    No nearby hospitals found.
                </div>`;

        }


        /* =========================================
           5. LOCAL EMERGENCY ALERT
           ========================================= */

        const nearbyIncidents =
            incidents.filter((incident) => {

                if (
                    !incident.latitude ||
                    !incident.longitude
                ) {
                    return false;
                }


                const distance =
                    calculateDistance(
                        latitude,
                        longitude,
                        Number(incident.latitude),
                        Number(incident.longitude)
                    );


                return distance <= 25;

            });


        if (nearbyIncidents.length > 0) {

            nearbyIncidents.sort(
                (a, b) =>
                    Number(
                        b.priority_score ||
                        b.score ||
                        0
                    )
                    -
                    Number(
                        a.priority_score ||
                        a.score ||
                        0
                    )
            );


            const top =
                nearbyIncidents[0];


            const score =
                Number(
                    top.priority_score ||
                    top.score ||
                    0
                );


            if (alertTitle)
                alertTitle.textContent =
                    `🚨 ${top.disaster_type || "Emergency"} Alert`;

            if (alertText)
                alertText.textContent =
                    `${top.location} has an active emergency. `
                    + `${top.affected_people || 0} people affected. `
                    + `AI Priority: ${score}/100.`;

        }
        else {

            if (alertTitle)
                alertTitle.textContent =
                    `🟢 No Active Alert`;

            if (alertText)
                alertText.textContent =
                    `No active emergency was found near ${location}.`;

        }

    }
    catch (error) {

        console.error(
            "Disaster Map Error:",
            error
        );


        if (status)
            status.textContent =
                "❌ Unable to load location information.";

        if (hospitalBox)
            hospitalBox.innerHTML =
                `<div class="empty-state">
                    Hospital information unavailable.
                </div>`;

    }

}
function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLon =
        (lon2 - lon1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}
function loadLocalAlerts() {
    const alertBox = document.getElementById("allAlerts");

    if (!alertBox) return;

    if (!incidents || incidents.length === 0) {
        alertBox.innerHTML = `
            <div class="panel">
                🟢 No active emergency alerts
            </div>
        `;
        return;
    }

    const sorted = [...incidents].sort((a, b) => {
        return Number(b.priority_score || b.score || 0)
             - Number(a.priority_score || a.score || 0);
    });

    alertBox.innerHTML = sorted.slice(0, 10).map(incident => {

        const score = Number(
            incident.priority_score || incident.score || 0
        );

        let level = "LOW";
        let icon = "🟢";

        if (score >= 85) {
            level = "CRITICAL";
            icon = "🚨";
        } else if (score >= 70) {
            level = "HIGH";
            icon = "🔴";
        } else if (score >= 40) {
            level = "MEDIUM";
            icon = "🟠";
        }

        return `
            <div class="panel alert-card">
                <span class="eyebrow">${icon} ${level} ALERT</span>

                <h3>
                    ${escapeHtml(
                        incident.disaster_type || "Emergency"
                    )}
                </h3>

                <p>
                    📍 ${escapeHtml(
                        incident.location || "Unknown location"
                    )}
                </p>

                <p>
                    👥 ${incident.affected_people || 0}
                    people affected
                </p>

                <strong>
                    AI Priority Score: ${score}/100
                </strong>

                <p>
                    🚑 ${
                        score >= 85
                        ? "Deploy rescue team immediately."
                        : score >= 70
                        ? "Send rescue resources as first priority."
                        : score >= 40
                        ? "Prepare rescue resources and monitor."
                        : "Continue monitoring."
                    }
                </p>
            </div>
        `;
    }).join("");
}
setTimeout(() => {
    loadLocalAlerts();
}, 1000);