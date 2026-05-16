const ORS_API_KEY =
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjU3Y2IzMWI1Y2M0YTQ5YzJiMjFhNmVlNmI0YjBiNzYxIiwiaCI6Im11cm11cjY0In0=";

// DEPOT
const DEPOT = {
    name: "Depot",
    postcode: "LE11 5GX",
    lat: 52.7727,
    lng: -1.2065
};

const map = L.map('map').setView([54.5, -3], 6);

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '&copy; OpenStreetMap contributors'
    }
).addTo(map);

const ROUTE_COLORS = {
    "Ruta 1": "red",
    "Ruta 2": "blue",
    "Ruta 3": "green",
    "Ruta 4": "orange",
    "Ruta 5": "purple",
    "Ruta 6": "brown",
    "Unassigned": "gray",
    "Invalid": "black"
};

const DRIVER_COLORS = [
    "red",
    "blue",
    "green",
    "orange",
    "purple",
    "brown"
];

let stopsData = [];

let markers = [];
let polylines = [];

let hiddenRoutes = [];

let routeSummaries = {};

// TRACK FINAL MOVES ONLY
let movedStops = {};

const uploadBtn =
    document.getElementById('uploadBtn');

const rebalanceBtn =
    document.getElementById('rebalanceBtn');

const exportBtn =
    document.getElementById('exportBtn');

rebalanceBtn.addEventListener(
    'click',
    rebalanceRoutes
);

exportBtn.addEventListener(
    'click',
    exportRoutes
);

uploadBtn.addEventListener('click', async () => {

    const fileInput =
        document.getElementById('excelFile');

    const file = fileInput.files[0];

    if (!file) {

        alert("Select Excel file.");

        return;
    }

    uploadBtn.innerText = "Loading...";
    uploadBtn.disabled = true;

    clearMap();

    movedStops = {};

    const formData = new FormData();

    formData.append('file', file);

    try {

        const response = await fetch(
            'https://uk-route-backend.onrender.com/upload',
            {
                method: 'POST',
                body: formData
            }
        );

        stopsData = await response.json();

        await renderMap();

        renderSidebar();

    } catch (err) {

        console.error(err);

        alert("Upload error.");
    }

    uploadBtn.innerText = "Generate Routes";
    uploadBtn.disabled = false;
});


function clearMap() {

    markers.forEach(m => map.removeLayer(m));

    polylines.forEach(p => map.removeLayer(p));

    markers = [];
    polylines = [];

    routeSummaries = {};
}


async function renderMap() {

    clearMap();

    const bounds = [];

    const groupedRoutes = {};

    // DEPOT MARKER
    const depotMarker = L.marker(
        [DEPOT.lat, DEPOT.lng]
    )
    .addTo(map)
    .bindPopup(`
        <b>${DEPOT.name}</b><br>
        ${DEPOT.postcode}
    `);

    markers.push(depotMarker);

    bounds.push([DEPOT.lat, DEPOT.lng]);

    stopsData.forEach((stop, index) => {

        if (!stop.lat || !stop.lng) {
            return;
        }

        if (hiddenRoutes.includes(stop.route)) {
            return;
        }

        const icon = L.divIcon({
            className: '',
            html: `
                <div style="
                    background:${stop.color};
                    width:18px;
                    height:18px;
                    border-radius:50%;
                    border:2px solid white;
                    box-shadow:0 0 4px rgba(0,0,0,0.4);
                "></div>
            `,
            iconSize: [18, 18]
        });

        const marker = L.marker(
            [stop.lat, stop.lng],
            { icon }
        ).addTo(map);

        marker.bindPopup(createPopup(index));

        markers.push(marker);

        bounds.push([stop.lat, stop.lng]);

        if (!groupedRoutes[stop.route]) {
            groupedRoutes[stop.route] = [];
        }

        groupedRoutes[stop.route].push(stop);
    });

    for (const [route, stops] of Object.entries(groupedRoutes)) {

        const sampleStop =
            stopsData.find(x => x.route === route);

        await drawRealRoute(
            route,
            stops,
            sampleStop?.color || "gray"
        );
    }

    if (bounds.length > 0) {
        map.fitBounds(bounds);
    }
}


async function drawRealRoute(routeName, stops, color) {

    if (stops.length < 1) {
        return;
    }

    try {

        stops.sort((a, b) => {

            const distA =
                Math.sqrt(
                    Math.pow(a.lat - DEPOT.lat, 2) +
                    Math.pow(a.lng - DEPOT.lng, 2)
                );

            const distB =
                Math.sqrt(
                    Math.pow(b.lat - DEPOT.lat, 2) +
                    Math.pow(b.lng - DEPOT.lng, 2)
                );

            return distA - distB;
        });

        const coordinates = [
            [DEPOT.lng, DEPOT.lat]
        ];

        stops.forEach(stop => {

            coordinates.push([
                stop.lng,
                stop.lat
            ]);
        });

        coordinates.push([
            DEPOT.lng,
            DEPOT.lat
        ]);

        const response = await fetch(
            'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
            {
                method: 'POST',
                headers: {
                    'Authorization': ORS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    coordinates: coordinates
                })
            }
        );

        const data = await response.json();

        const routeLayer = L.geoJSON(data, {
            style: {
                color: color,
                weight: 5,
                opacity: 0.8
            }
        }).addTo(map);

        polylines.push(routeLayer);

        const summary =
            data.features[0].properties.summary;

        const distanceMiles =
            (summary.distance * 0.000621371)
            .toFixed(1);

        const totalMinutes =
            Math.round(summary.duration / 60);

        const hours =
            Math.floor(totalMinutes / 60);

        const minutes =
            totalMinutes % 60;

        const formattedTime =
            `${hours}h ${minutes}m`;

        routeSummaries[routeName] = {

            distance: distanceMiles,

            duration: formattedTime
        };

    } catch (err) {

        console.error(err);
    }
}


function createPopup(index) {

    const stop = stopsData[index];

    return `
        <div style="min-width:220px">

            <b>${stop.postcode}</b>

            <br><br>

            Current Route:
            <b>${stop.route}</b>

            <br><br>

            <select id="routeSelect${index}">

                ${getRouteOptions(stop.route)}

            </select>

            <br><br>

            <button onclick="changeRoute(${index})">
                Move Stop
            </button>

        </div>
    `;
}


// DYNAMIC ROUTE OPTIONS
function getRouteOptions(currentRoute) {

    // existing routes
    const existingRoutes = [
        ...new Set(
            stopsData.map(x => x.route)
        )
    ];

    // add missing drivers
    for (let i = 1; i <= 6; i++) {

        const driverName =
            `Driver ${i}`;

        if (!existingRoutes.includes(driverName)) {

            existingRoutes.push(driverName);
        }
    }

    // sort
    existingRoutes.sort();

    return existingRoutes.map(route => `
        <option
            value="${route}"
            ${route === currentRoute ? 'selected' : ''}
        >
            ${route}
        </option>
    `).join('');
}


// MOVE STOP
window.changeRoute = async function(index) {

    const select = document.getElementById(
        `routeSelect${index}`
    );

    const newRoute = select.value;

    const stop =
        stopsData[index];

    const oldRoute =
        stop.route;

    // NO CHANGE
    if (oldRoute === newRoute) {
        return;
    }

    // FIRST MOVE
    if (!movedStops[stop.postcode]) {

        movedStops[stop.postcode] = {

            postcode:
                stop.postcode,

            originalRoute:
                oldRoute,

            finalRoute:
                newRoute,

            movedAt:
                new Date().toLocaleString()
        };

    } else {

        // KEEP ORIGINAL
        movedStops[stop.postcode].finalRoute =
            newRoute;

        movedStops[stop.postcode].movedAt =
            new Date().toLocaleString();
    }

    // RETURNED TO ORIGINAL
    if (
        movedStops[stop.postcode].originalRoute ===
        newRoute
    ) {

        delete movedStops[stop.postcode];
    }

    // APPLY CHANGE
    stop.route = newRoute;

    const driverMatch =
        newRoute.match(/Driver (\d+)/);

    if (driverMatch) {

        const driverNumber =
            parseInt(driverMatch[1]) - 1;

        stop.color =
            DRIVER_COLORS[driverNumber];

    } else {

        stop.color =
            ROUTE_COLORS[newRoute] || "gray";
    }

    await renderMap();

    renderSidebar();
};


function renderSidebar() {

    const routeStats =
        document.getElementById('routeStats');

    routeStats.innerHTML = '';

    const uniqueRoutes = [
        ...new Set(stopsData.map(x => x.route))
    ];

    uniqueRoutes.forEach(route => {

        const count = stopsData.filter(
            x => x.route === route
        ).length;

        const hidden =
            hiddenRoutes.includes(route);

        const sampleStop =
            stopsData.find(x => x.route === route);

        const stats =
            routeSummaries[route];

        const distance =
            stats?.distance || "-";

        const duration =
            stats?.duration || "-";

        const card = document.createElement('div');

        card.className = 'route-card';

        card.style.background =
            sampleStop?.color || "gray";

        card.innerHTML = `
            <div style="
                font-size:20px;
                font-weight:bold;
            ">
                ${route}
            </div>

            <div style="
                margin-top:10px;
                font-size:16px;
            ">
                Stops: ${count}
            </div>

            <div style="
                margin-top:5px;
                font-size:16px;
            ">
                Distance: ${distance} miles
            </div>

            <div style="
                margin-top:5px;
                font-size:16px;
            ">
                Time: ${duration}
            </div>

            <div class="route-controls">

                <label>
                    <input
                        type="checkbox"
                        ${hidden ? '' : 'checked'}
                        onchange="toggleRoute('${route}')"
                    >
                    Show Route
                </label>

            </div>
        `;

        routeStats.appendChild(card);
    });
}


window.toggleRoute = async function(route) {

    if (hiddenRoutes.includes(route)) {

        hiddenRoutes =
            hiddenRoutes.filter(
                x => x !== route
            );

    } else {

        hiddenRoutes.push(route);
    }

    await renderMap();

    renderSidebar();
};


// REBALANCE
function rebalanceRoutes() {

    const driverCount = parseInt(
        document.getElementById('driverCount').value
    );

    const validStops = stopsData.filter(
        x => x.lat && x.lng
    );

    if (validStops.length === 0) {
        return;
    }

    validStops.forEach(stop => {

        const dx =
            stop.lng - DEPOT.lng;

        const dy =
            stop.lat - DEPOT.lat;

        let angle =
            Math.atan2(dy, dx);

        angle =
            angle * (180 / Math.PI);

        if (angle < 0) {
            angle += 360;
        }

        stop.angle = angle;
    });

    validStops.sort(
        (a, b) => a.angle - b.angle
    );

    routeSummaries = {};

    let driverGroups = [];

    for (let i = 0; i < driverCount; i++) {

        driverGroups.push({

            name: `Driver ${i + 1}`,

            color: DRIVER_COLORS[i],

            stops: []
        });
    }

    const chunkSize = Math.ceil(
        validStops.length / driverCount
    );

    validStops.forEach((stop, index) => {

        let driverIndex =
            Math.floor(index / chunkSize);

        if (driverIndex >= driverCount) {
            driverIndex = driverCount - 1;
        }

        driverGroups[driverIndex]
            .stops
            .push(stop);
    });

    driverGroups.forEach(driver => {

        driver.stops.forEach(stop => {

            stop.route = driver.name;

            stop.color = driver.color;
        });
    });

    hiddenRoutes = [];

    renderMap();

    renderSidebar();
}


// EXPORT
function exportRoutes() {

    const workbook = XLSX.utils.book_new();

    // ROUTES
    const uniqueRoutes = [
        ...new Set(
            stopsData.map(x => x.route)
        )
    ];

    uniqueRoutes.forEach(route => {

        const routeStops = stopsData.filter(
            x => x.route === route
        );

        const exportData = routeStops.map(
            (stop, index) => ({

                Stop_Number: index + 1,

                Postcode: stop.postcode,

                Route: stop.route
            })
        );

        const worksheet =
            XLSX.utils.json_to_sheet(exportData);

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            route.substring(0, 31)
        );
    });

    // FINAL MOVES ONLY
    const movedStopsArray =
        Object.values(movedStops);

    if (movedStopsArray.length > 0) {

        const movesSheet =
            XLSX.utils.json_to_sheet(
                movedStopsArray.map(
                    (move, index) => ({

                        Move_Number:
                            index + 1,

                        Postcode:
                            move.postcode,

                        From_Route:
                            move.originalRoute,

                        To_Route:
                            move.finalRoute,

                        Last_Modified:
                            move.movedAt
                    })
                )
            );

        XLSX.utils.book_append_sheet(
            workbook,
            movesSheet,
            'Manual_Moves'
        );
    }

    XLSX.writeFile(
        workbook,
        'Optimized_Routes.xlsx'
    );
}