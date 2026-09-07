from flask import Flask, jsonify, render_template, request
import requests


app = Flask(__name__)
logger = app.logger
logger.setLevel("INFO")


CATEGORY_FILTERS = {
    "restaurant": '["amenity"="restaurant"]',
    "cafe": '["amenity"="cafe"]',
    "hospital": '["amenity"="hospital"]',
    "hotel": '["tourism"="hotel"]',
    "fuel": '["amenity"="fuel"]',
    "grocery": '["shop"="supermarket"]'
}


@app.route("/")
def index():
    return render_template("index.html")


# =========================
# GEOCODING
# =========================

@app.route("/geocode")
def geocode():

    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({
            "error": "Missing search query"
        }), 400

    url = "https://nominatim.openstreetmap.org/search"

    params = {
        "q": query,
        "format": "json",
        "limit": 1
    }

    headers = {
        "User-Agent": "RouteLens/1.0"
    }

    try:

        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=10
        )

        response.raise_for_status()

        results = response.json()

        if not results:
            return jsonify({
                "error": "Location not found"
            }), 404

        location = results[0]

        return jsonify({
            "name": location.get("display_name"),
            "latitude": float(location["lat"]),
            "longitude": float(location["lon"])
        })

    except requests.RequestException as error:

        print(
            "Geocoding request failed:",
            repr(error)
        )

        return jsonify({
            "error": "Unable to contact geocoding service"
        }), 500


# =========================
# ROUTING
# =========================

@app.route("/route")
def route():

    origin_lat = request.args.get("origin_lat")
    origin_lng = request.args.get("origin_lng")

    destination_lat = request.args.get("destination_lat")
    destination_lng = request.args.get("destination_lng")

    if not all([
        origin_lat,
        origin_lng,
        destination_lat,
        destination_lng
    ]):
        return jsonify({
            "error": "Missing route coordinates"
        }), 400

    url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{origin_lng},{origin_lat};"
        f"{destination_lng},{destination_lat}"
    )

    params = {
        "overview": "full",
        "geometries": "geojson"
    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=30
        )

        response.raise_for_status()

        data = response.json()

        if data.get("code") != "Ok" or not data.get("routes"):

            return jsonify({
                "error": data.get(
                    "message",
                    "Unable to find a route"
                )
            }), 404

        route_data = data["routes"][0]

        return jsonify({
            "distance": route_data["distance"],
            "duration": route_data["duration"],
            "geometry": route_data["geometry"]
        })

    except requests.RequestException as error:

        print(
            "Routing request failed:",
            repr(error)
        )

        return jsonify({
            "error": "Unable to contact routing service"
        }), 500


# =========================
# NEARBY PLACES
# =========================

@app.route("/places")
def places():

    logger.info("[RouteLens] /places request received")
    logger.info(
        "[RouteLens] lat=%s lng=%s category=%s",
        request.args.get("lat"),
        request.args.get("lng"),
        request.args.get("category")
    )

    try:
        return _load_places()
    except Exception:
        logger.exception("[RouteLens] Unexpected /places failure")
        return jsonify({
            "error": "Nearby places service is temporarily unavailable."
        }), 502


def _load_places():

    latitude_value = request.args.get("lat", "").strip()
    longitude_value = request.args.get("lng", "").strip()
    category = request.args.get("category", "").strip().lower()

    if not latitude_value or not longitude_value or not category:

        return jsonify({
            "error": "Missing location or category"
        }), 400

    try:
        latitude = float(latitude_value)
        longitude = float(longitude_value)
    except ValueError:
        return jsonify({
            "error": "Invalid coordinates"
        }), 400

    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return jsonify({
            "error": "Invalid coordinates"
        }), 400


    if category not in CATEGORY_FILTERS:

        return jsonify({
            "error": "Invalid category"
        }), 400


    osm_filter = CATEGORY_FILTERS[category]


    query = (
        f"[out:json][timeout:15];"
        f"nwr{osm_filter}(around:2000,{latitude},{longitude});"
        "out center;"
    )

    logger.info("[RouteLens] Overpass query created")


    # Multiple public Overpass servers.
    # If one is unavailable, try the next one.

    overpass_servers = [

        "https://overpass-api.de/api/interpreter",

        "https://overpass.kumi.systems/api/interpreter",

        "https://overpass.private.coffee/api/interpreter"

    ]


    headers = {
        "Accept": "application/json",
        "User-Agent": "RouteLens/1.0 (CS50 final project)"
    }


    for url in overpass_servers:

        try:

            logger.info("[RouteLens] Trying server: %s", url)


            response = requests.post(
                url,
                data={"data": query},
                headers=headers,
                timeout=20
            )


            logger.info("[RouteLens] HTTP status: %s", response.status_code)
            response.raise_for_status()
            logger.info("[RouteLens] Response received")


            data = response.json()
            logger.info("[RouteLens] JSON parsed")


            if not isinstance(data, dict):
                raise ValueError("Overpass response was not a JSON object")

            elements = data.get("elements", [])
            if not isinstance(elements, list):
                raise ValueError("Overpass elements was not a list")
            logger.info("[RouteLens] Elements found: %d", len(elements))

            places = []


            for element in elements:

                if not isinstance(element, dict):
                    continue

                # =========================
                # NODE
                # =========================

                if element.get("type") == "node":

                    place_lat = element.get("lat")
                    place_lng = element.get("lon")


                # =========================
                # WAY / RELATION
                # =========================

                else:

                    center = element.get("center")

                    if not center:
                        continue

                    place_lat = center.get("lat")
                    place_lng = center.get("lon")


                if place_lat is None or place_lng is None:
                    continue


                tags = element.get("tags", {})
                if not isinstance(tags, dict):
                    tags = {}


                places.append({

                    "name": tags.get(
                        "name",
                        "Unnamed place"
                    ),

                    "latitude": place_lat,

                    "longitude": place_lng,

                    "category": category,

                    "address": tags.get(
                        "addr:street",
                        ""
                    )

                })


            # Keep response lightweight.
            places = places[:50]


            logger.info(
                "[RouteLens] Returning %d places from %s",
                len(places),
                url,
            )


            return jsonify({
                "places": places
            })


        except requests.RequestException as error:

            logger.warning(
                "[RouteLens] Server failed: %s (%s)",
                url,
                error
            )

            # Try the next server.
            continue


        except ValueError as error:

            logger.warning(
                "[RouteLens] Invalid Overpass response from %s (%s)",
                url,
                error
            )

            # Try the next server.
            continue


        except Exception:

            logger.exception(
                "[RouteLens] Unexpected failure while processing %s",
                url
            )

            # Try the next server.
            continue


    # =========================
    # ALL SERVERS FAILED
    # =========================

    logger.error("All Overpass servers failed for category %s", category)


    return jsonify({

        "error":
            "Nearby places service is temporarily unavailable."

    }), 502


@app.route("/route-places", methods=["POST"])
def route_places():

    logger.info("[RouteLens] /route-places request received")

    try:
        payload = request.get_json(silent=True) or {}
        category = str(payload.get("category", "")).strip().lower()
        route_points = payload.get("points")

        if category not in CATEGORY_FILTERS:
            return jsonify({"error": "Invalid category"}), 400

        if not isinstance(route_points, list) or not route_points:
            return jsonify({"error": "Missing or empty route"}), 400

        search_points = []

        for point in route_points[:10]:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                continue

            latitude = float(point[0])
            longitude = float(point[1])

            if -90 <= latitude <= 90 and -180 <= longitude <= 180:
                search_points.append((latitude, longitude))

        if not search_points:
            return jsonify({"error": "Invalid route coordinates"}), 400

        radius = 650
        query_parts = [
            f"nwr{CATEGORY_FILTERS[category]}"
            f"(around:{radius},{latitude},{longitude});"
            for latitude, longitude in search_points
        ]
        query = (
            "[out:json][timeout:15];"
            "("
            + "".join(query_parts)
            + ");out center;"
        )

        logger.info(
            "[RouteLens] Route query created with %d search points",
            len(search_points)
        )

        data = _request_overpass(query, category)
        elements = data.get("elements", [])
        places_by_key = {}

        for element in elements:
            place = _place_from_element(element, category)

            if place is None:
                continue

            place["distance_to_route"] = min(
                _haversine_distance(
                    place["latitude"],
                    place["longitude"],
                    latitude,
                    longitude
                )
                for latitude, longitude in search_points
            )

            places_by_key[place.pop("_dedupe_key")] = place

        places = sorted(
            places_by_key.values(),
            key=lambda place: place["distance_to_route"]
        )[:50]

        logger.info(
            "[RouteLens] Returning %d route-aware %s places",
            len(places),
            category
        )

        return jsonify({"places": places})

    except (TypeError, ValueError):
        logger.warning("[RouteLens] Invalid route-places payload", exc_info=True)
        return jsonify({"error": "Invalid route coordinates"}), 400

    except Exception:
        logger.exception("[RouteLens] Unexpected /route-places failure")
        return jsonify({
            "error": "Nearby places service is temporarily unavailable."
        }), 502


def _request_overpass(query, category):

    headers = {
        "Accept": "application/json",
        "User-Agent": "RouteLens/1.0 (CS50 final project)"
    }

    overpass_servers = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter"
    ]

    for url in overpass_servers:
        try:
            logger.info("[RouteLens] Route search server: %s", url)
            response = requests.post(
                url,
                data={"data": query},
                headers=headers,
                timeout=20
            )
            response.raise_for_status()
            data = response.json()

            if not isinstance(data, dict) or not isinstance(
                data.get("elements", []), list
            ):
                raise ValueError("Invalid Overpass response")

            return data

        except (requests.RequestException, ValueError) as error:
            logger.warning(
                "[RouteLens] Route search server failed: %s (%s)",
                url,
                error
            )

    logger.error("[RouteLens] All route search servers failed for %s", category)
    raise RuntimeError("All Overpass servers failed")


def _place_from_element(element, category):

    if not isinstance(element, dict):
        return None

    if element.get("type") == "node":
        latitude = element.get("lat")
        longitude = element.get("lon")
    else:
        center = element.get("center")
        latitude = center.get("lat") if isinstance(center, dict) else None
        longitude = center.get("lon") if isinstance(center, dict) else None

    if latitude is None or longitude is None:
        return None

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        return None

    tags = element.get("tags", {})
    if not isinstance(tags, dict):
        tags = {}

    name = tags.get("name") or "Unnamed place"
    osm_type = element.get("type")
    osm_id = element.get("id")
    dedupe_key = (
        f"{osm_type}/{osm_id}"
        if osm_type and osm_id is not None
        else f"{latitude:.6f}/{longitude:.6f}/{name}"
    )

    return {
        "_dedupe_key": dedupe_key,
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "category": category,
        "address": tags.get("addr:street", "")
    }


def _haversine_distance(first_latitude, first_longitude,
                        second_latitude, second_longitude):

    from math import asin, cos, radians, sin, sqrt

    latitude_difference = radians(second_latitude - first_latitude)
    longitude_difference = radians(second_longitude - first_longitude)
    first_latitude = radians(first_latitude)
    second_latitude = radians(second_latitude)

    haversine_value = (
        sin(latitude_difference / 2) ** 2
        + cos(first_latitude)
        * cos(second_latitude)
        * sin(longitude_difference / 2) ** 2
    )

    return 6371000 * 2 * asin(sqrt(haversine_value))