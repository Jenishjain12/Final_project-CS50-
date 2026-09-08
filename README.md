# RouteLens

🌐 **Live Demo:** https://final-project-cs-50.vercel.app/ 
#### Video Demo: https://youtu.be/-xMEoAxJKt8

#### Description:

RouteLens is a route-aware map and navigation web application developed as my CS50x Final Project. The idea behind RouteLens came from a simple problem with map applications: while navigating from one destination to another, users may want to explore useful places nearby without losing the context of their active route.

RouteLens is designed around the principle **"Navigate. Explore. Continue."** Instead of treating navigation and nearby-place discovery as completely separate activities, RouteLens keeps the current route visible while allowing the user to discover places around the journey. A user can detect their current location, search for a destination, generate a driving route, explore nearby categories such as restaurants, cafes, hospitals, hotels, fuel stations, and grocery stores, inspect individual places, and add a selected place as a stop.

## How RouteLens Works

When the application starts, the frontend initializes an interactive map using Leaflet.js and OpenStreetMap map tiles. The browser's Geolocation API is used to request the user's current position. Once a location is available, it is displayed on the map and becomes the origin for route calculations.

When a user enters a destination, the frontend sends the search query to the Flask backend through the `/geocode` endpoint. The backend sends the query to Nominatim, an OpenStreetMap geocoding service. Nominatim converts the human-readable destination into latitude and longitude coordinates. RouteLens then sends the origin and destination coordinates to the `/route` endpoint. The Flask backend requests a driving route from OSRM and returns the route distance, duration, and complete route geometry to the frontend. Leaflet then draws that route on the map.

The main feature of RouteLens is its route-aware nearby-place search. If there is an active route, the application does not simply search around the user's current location. Instead, the route geometry is sampled at a limited number of points. Those points are sent to the `/route-places` endpoint, which builds an Overpass API query that searches for OpenStreetMap objects around the sampled route points. The returned places are processed, deduplicated, and ranked according to their distance from the sampled route locations. This allows RouteLens to discover useful places along the journey while preserving the active route.

If no route is active, RouteLens falls back to the `/places` endpoint and searches around the user's current location. Selecting a nearby place displays a contextual place card containing the available name, category, address, and distance from the user's current location. The route itself remains on the map while the place is being explored. A selected place can also be added as a stop, after which the route can be recalculated.

## Files

### `app.py`

`app.py` is the Flask backend and contains the server-side logic of RouteLens. It serves the main page, handles destination geocoding, requests driving routes, finds nearby places, performs route-aware searches, validates incoming data, communicates with Nominatim, OSRM, and Overpass, processes OpenStreetMap data, deduplicates results, calculates geographic distances using the Haversine formula, and handles network and API failures.

The `CATEGORY_FILTERS` dictionary maps the categories presented in the interface to OpenStreetMap/Overpass tags. This avoids writing a separate conditional branch for every category.

### `templates/index.html`

`index.html` defines the main structure of the RouteLens interface. It contains the top navigation area, destination search box, interactive map container, place information card, nearby-category panel, location controls, and application status area. It also loads Leaflet and connects the application stylesheet and JavaScript through Flask's `url_for` function.

### `static/app.js`

`app.js` contains the client-side behavior of RouteLens. It initializes the Leaflet map and manages application state. It handles browser geolocation, destination searching, backend communication, route rendering, route coordinate storage and sampling, nearby-place discovery, place markers, place cards, distance calculation, category selection, and the Add as Stop workflow.

A particularly important design choice is keeping `routeCoordinates` separately from the visual Leaflet `routeLayer`. The route geometry is reusable application data, while `routeLayer` is its visual representation on the map.

### `static/styles.css`

`styles.css` controls the visual appearance of RouteLens. It defines the map-focused interface, navigation bar, search panel, buttons, status card, category panel, place card, animations, and responsive behavior for smaller screens.

### `requirements.txt`

`requirements.txt` contains the Python dependencies required by the backend:

- Flask
- Requests

Leaflet.js is loaded on the frontend, while OpenStreetMap, Nominatim, OSRM, and Overpass are accessed as external services.

## Design Choices

One of the main design decisions was to keep RouteLens as a single map-focused experience instead of creating separate pages for navigation and nearby-place discovery. This directly supports the project's central goal of preserving route context.

Another important decision was to use OpenStreetMap-based services. Nominatim provides geocoding, OSRM provides route calculation, and Overpass provides access to nearby OpenStreetMap objects. Using these services allowed the project to work with real geographic data without building a geographic database from scratch.

For route-aware searches, RouteLens samples the route rather than making a separate external request for every coordinate in the route geometry. A route can contain many coordinates, so querying every point would create unnecessary requests. Sampling provides a practical balance between route coverage and external API usage.

The project also uses the Haversine formula for geographic distance calculations because latitude and longitude represent positions on the Earth's surface. Nearby results are deduplicated using OpenStreetMap object identifiers where available, preventing the same place from appearing multiple times when it is found around several route sample points.

Error handling is an important part of the design because external geographic services can experience timeouts, connection failures, invalid responses, or temporary unavailability. RouteLens validates user input, applies request timeouts, checks HTTP responses, validates returned JSON, and provides user-facing error messages.

## Technology Stack

- **Python** — backend programming language
- **Flask** — web framework
- **Requests** — HTTP communication from the backend
- **JavaScript** — client-side application logic
- **HTML5** — page structure
- **CSS3** — interface styling
- **Leaflet.js** — interactive map rendering
- **OpenStreetMap** — map and geographic data
- **Nominatim** — geocoding
- **OSRM** — driving route calculation
- **Overpass API** — nearby OpenStreetMap data queries
- **Browser Geolocation API** — current location detection

## Project Structure

```text
routelens/
│
├── app.py
├── requirements.txt
│
├── templates/
│   └── index.html
│
└── static/
    ├── app.js
    └── styles.css
```

## Running RouteLens

Create and activate a Python virtual environment, then install the required dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the Flask development server with:

```bash
python -m flask --app app run --debug
```

Then open the local Flask address shown in the terminal. Allow location access in the browser so RouteLens can determine the current position.

## External Services and Attribution

RouteLens uses:

- OpenStreetMap contributors for map and geographic data
- Nominatim for geocoding
- OSRM for route calculation
- Overpass API for nearby OpenStreetMap data
- Leaflet.js for interactive map rendering

Their respective usage policies, rate limits, and attribution requirements should be respected when running or deploying the application.

## Future Improvements

Possible future improvements include better detour analysis, estimated additional travel time for a selected stop, more OpenStreetMap categories, improved place filtering, traffic-aware routing, saved places, route history, and a dedicated mobile experience. These are future ideas and are not claimed as features of the current version.

## CS50 Final Project

RouteLens was created as my CS50x Final Project. The project combines concepts from the course with additional research into web APIs, geographic data, mapping, routing, and browser geolocation.

The objective was to build more than a demonstration of individual programming techniques: a working application that addresses a real interaction problem in navigation software.

The central question behind RouteLens is:

> **How can a navigation application let users explore useful places along their journey without making them lose their active route?**

RouteLens is my attempt to answer that question with a simple workflow:

**Navigate. Explore. Continue.**

## Author

**Jenish Jain**

CS50x Final Project
