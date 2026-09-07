// =========================
// MAP SETUP
// =========================

const map = L.map("map").setView(
    [26.9124, 75.7873],
    13
);


// Add map tiles
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors"
    }
).addTo(map);


// =========================
// LOCATION
// =========================

let locationMarker = null;

const locationStatus =
    document.getElementById("location-status");

const statusTitle =
    document.getElementById("status-title");

const locationButton =
    document.getElementById("location-button");


// Get user's location
function locateUser() {

    if (!navigator.geolocation) {

        locationStatus.textContent =
            "Geolocation is not supported by your browser.";

        return;
    }

    locationStatus.textContent =
        "Detecting your location...";


    navigator.geolocation.getCurrentPosition(

        function (position) {

            const latitude =
                position.coords.latitude;

            const longitude =
                position.coords.longitude;


            map.setView(
                [latitude, longitude],
                15
            );


            if (locationMarker) {

                map.removeLayer(
                    locationMarker
                );
            }


            locationMarker = L.marker(
                [latitude, longitude]
            )
            .addTo(map)
            .bindPopup("You are here 📍")
            .openPopup();


            statusTitle.textContent =
                "Ready to explore";

            locationStatus.textContent =
                "Your location has been detected.";

        },


        function (error) {

            console.error(error);

            locationStatus.textContent =
                "Unable to access your location.";

        }

    );
}


// Location button
locationButton.addEventListener(
    "click",
    locateUser
);


// Automatically request location
locateUser();


// =========================
// DESTINATION SEARCH
// =========================

const destinationInput =
    document.getElementById("destination-input");

const searchButton =
    document.getElementById("search-button");

let destinationMarker = null;


// Search destination
async function searchDestination() {

    const query =
        destinationInput.value.trim();


    if (!query) {

        locationStatus.textContent =
            "Please enter a destination.";

        return;
    }


    locationStatus.textContent =
        "Searching for destination...";


    try {

        const response = await fetch(
            `/geocode?q=${encodeURIComponent(query)}`
        );


        const data =
            await response.json();


        if (!response.ok) {

            locationStatus.textContent =
                data.error ||
                "Location not found.";

            return;
        }


        const latitude =
            data.latitude;

        const longitude =
            data.longitude;


        if (destinationMarker) {

            map.removeLayer(
                destinationMarker
            );
        }


        destinationMarker = L.marker(
            [latitude, longitude]
        )
        .addTo(map)
        .bindPopup(
            `<strong>Destination</strong><br>${data.name}`
        )
        .openPopup();


        if (!locationMarker) {

            locationStatus.textContent =
                "Please allow location access first.";

            return;
        }


        const currentPosition =
            locationMarker.getLatLng();


        await calculateRoute(

            currentPosition.lat,
            currentPosition.lng,

            latitude,
            longitude

        );

    }


    catch (error) {

        console.error(error);

        locationStatus.textContent =
            "Something went wrong while searching.";

    }
}


// Search button
searchButton.addEventListener(
    "click",
    searchDestination
);


// Press Enter to search
destinationInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            searchDestination();

        }

    }
);


// =========================
// ROUTING
// =========================

let routeLayer = null;
let routeCoordinates = [];


// Calculate route
async function calculateRoute(
    originLatitude,
    originLongitude,
    destinationLatitude,
    destinationLongitude
) {

    statusTitle.textContent =
        "Calculating route...";

    locationStatus.textContent =
        "Finding the best route...";


    try {

        const response = await fetch(

            `/route?origin_lat=${originLatitude}` +
            `&origin_lng=${originLongitude}` +
            `&destination_lat=${destinationLatitude}` +
            `&destination_lng=${destinationLongitude}`

        );


        const data =
            await response.json();


        if (!response.ok) {

            statusTitle.textContent =
                "Route unavailable";

            locationStatus.textContent =
                data.error ||
                "Unable to calculate route.";

            return;
        }


        if (routeLayer) {

            map.removeLayer(
                routeLayer
            );
        }


        // OSRM: [longitude, latitude]
        // Leaflet: [latitude, longitude]

        const coordinates =
            data.geometry.coordinates.map(

                function (coordinate) {

                    return [
                        coordinate[1],
                        coordinate[0]
                    ];

                }

            );

        routeCoordinates = coordinates;


        routeLayer = L.polyline(
            coordinates,
            {
                color: "#2563eb",
                weight: 6,
                opacity: 0.85
            }
        ).addTo(map);


        map.fitBounds(
            routeLayer.getBounds(),
            {
                padding: [60, 60]
            }
        );


        const distanceKm =
            (data.distance / 1000).toFixed(1);


        const durationMinutes =
            Math.round(
                data.duration / 60
            );


        statusTitle.textContent =
            "Route ready";

        locationStatus.textContent =
            `${distanceKm} km · ${durationMinutes} min`;

    }


    catch (error) {

        console.error(error);

        statusTitle.textContent =
            "Route error";

        locationStatus.textContent =
            "Something went wrong while calculating the route.";

    }

}


// =========================
// NEARBY PLACES
// =========================

const exploreButton =
    document.getElementById("explore-button");

const categoryPanel =
    document.getElementById("category-panel");

const closeCategoryButton =
    document.getElementById(
        "close-category-button"
    );


let placeMarkers = [];


function sampleRouteCoordinates(coordinates) {

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return [];
    }

    const sampleCount = Math.min(
        10,
        Math.max(2, Math.ceil(coordinates.length / 20))
    );

    if (coordinates.length <= sampleCount) {
        return coordinates;
    }

    const sampledCoordinates = [];

    for (let index = 0; index < sampleCount; index += 1) {
        const routeIndex = Math.round(
            index * (coordinates.length - 1) / (sampleCount - 1)
        );

        sampledCoordinates.push(
            coordinates[routeIndex]
        );
    }

    return sampledCoordinates;
}

const placeCard =
    document.getElementById("place-card");

const closePlaceCardButton =
    document.getElementById("close-place-card");

const placeCardName =
    document.getElementById("place-card-name");

const placeCardCategory =
    document.getElementById("place-card-category");

const placeCardDistance =
    document.getElementById("place-card-distance");

const placeCardAddress =
    document.getElementById("place-card-address");


function setPlaceCardRow(row, value) {

    const valueElement =
        row.querySelector(".place-card-value");

    if (!value) {

        row.hidden = true;
        valueElement.textContent = "";

        return;
    }

    valueElement.textContent = value;
    row.hidden = false;
}


function formatCategory(category) {

    if (!category) {
        return "";
    }

    return category.charAt(0).toUpperCase() + category.slice(1);
}


function calculateDistanceInMeters(firstPosition, secondPosition) {

    const earthRadiusMeters = 6371000;
    const latitudeDifference =
        (secondPosition.lat - firstPosition.lat) * Math.PI / 180;
    const longitudeDifference =
        (secondPosition.lng - firstPosition.lng) * Math.PI / 180;

    const firstLatitude =
        firstPosition.lat * Math.PI / 180;
    const secondLatitude =
        secondPosition.lat * Math.PI / 180;

    const haversineValue =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(firstLatitude) *
        Math.cos(secondLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    return 2 * earthRadiusMeters * Math.asin(
        Math.sqrt(haversineValue)
    );
}


function formatDistance(distanceInMeters) {

    if (!Number.isFinite(distanceInMeters)) {
        return "";
    }

    if (distanceInMeters < 1000) {
        return `${Math.round(distanceInMeters)} m away`;
    }

    return `${(distanceInMeters / 1000).toFixed(1)} km away`;
}


function showPlaceCard(place) {

    placeCardName.textContent =
        place.name || "Unnamed place";

    setPlaceCardRow(
        placeCardCategory,
        formatCategory(place.category)
    );

    setPlaceCardRow(
        placeCardAddress,
        place.address && place.address.trim()
            ? place.address.trim()
            : ""
    );

    let distance = "";

    if (locationMarker) {

        const currentPosition =
            locationMarker.getLatLng();

        const placePosition = {
            lat: Number(place.latitude),
            lng: Number(place.longitude)
        };

        if (
            Number.isFinite(placePosition.lat) &&
            Number.isFinite(placePosition.lng)
        ) {
            distance = formatDistance(
                calculateDistanceInMeters(
                    currentPosition,
                    placePosition
                )
            );
        }

    }

    setPlaceCardRow(
        placeCardDistance,
        distance
    );

    placeCard.hidden = false;
    placeCard.setAttribute("aria-hidden", "false");
    placeCard.classList.remove("place-card-visible");

    requestAnimationFrame(
        function () {
            placeCard.classList.add("place-card-visible");
        }
    );

    closePlaceCardButton.focus();
}


function hidePlaceCard() {

    placeCard.classList.remove("place-card-visible");
    placeCard.setAttribute("aria-hidden", "true");
    placeCard.hidden = true;
}


closePlaceCardButton.addEventListener(
    "click",
    hidePlaceCard
);


document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape" && !placeCard.hidden) {
            hidePlaceCard();
        }

    }
);


function clearPlaceMarkers() {

    hidePlaceCard();

    placeMarkers.forEach(
        function (marker) {

            map.removeLayer(
                marker
            );

        }
    );

    placeMarkers = [];
}


// =========================
// OPEN CATEGORY PANEL
// =========================

exploreButton.addEventListener(
    "click",
    function () {

        categoryPanel.style.display =
            "block";

    }
);


// =========================
// CLOSE CATEGORY PANEL
// =========================

closeCategoryButton.addEventListener(
    "click",
    function () {

        categoryPanel.style.display =
            "none";

    }
);


// =========================
// CATEGORY BUTTONS
// =========================

document
    .querySelectorAll(".category-button")
    .forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const category =
                        button.dataset.category;

                    loadNearbyPlaces(category);

                }
            );

        }
    );


// =========================
// LOAD NEARBY PLACES
// =========================

async function loadNearbyPlaces(category) {

    if (!locationMarker) {

        locationStatus.textContent =
            "Please allow location access first.";

        return;
    }


    const position =
        locationMarker.getLatLng();


    statusTitle.textContent =
        "Finding nearby places...";

    const hasActiveRoute =
        routeCoordinates.length > 0;

    locationStatus.textContent = hasActiveRoute
        ? `Finding ${category}s along your route...`
        : `Searching for ${category}s nearby...`;


    try {

        let response;

        if (hasActiveRoute) {

            response = await fetch(
                "/route-places",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        category: category,
                        points: sampleRouteCoordinates(
                            routeCoordinates
                        )
                    })
                }
            );

        } else {

            const params = new URLSearchParams({
                lat: position.lat,
                lng: position.lng,
                category: category
            });

            response = await fetch(
                `/places?${params.toString()}`
            );

        }


        const data =
            await response.json();


        console.log(
            "Nearby places response:",
            data
        );


        if (!response.ok) {

            statusTitle.textContent =
                "Search failed";

            locationStatus.textContent =
                data.error ||
                "Unable to find places.";

            return;
        }


        clearPlaceMarkers();


        // =========================
        // CREATE NEW MARKERS
        // =========================

        const places = Array.isArray(data.places)
            ? data.places
            : [];

        places.forEach(
            function (place) {

                const marker =
                    L.marker([
                        place.latitude,
                        place.longitude
                    ])
                    .addTo(map);

                marker.on(
                    "click",
                    function () {
                        showPlaceCard(place);
                    }
                );


                placeMarkers.push(
                    marker
                );

            }
        );


        // Close category panel
        categoryPanel.style.display =
            "none";


        // Update status
        statusTitle.textContent =
            `${places.length} places found`;

        locationStatus.textContent = hasActiveRoute
            ? `${places.length} ${category}s near your route`
            : `Nearby ${category}s`;

    }


    catch (error) {

        console.error(error);

        statusTitle.textContent =
            "Search failed";

        locationStatus.textContent =
            "Unable to find nearby places.";

    }

}