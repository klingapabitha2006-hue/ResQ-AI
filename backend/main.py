from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db_connection

import requests
import bcrypt
import math
import time
import os
import json
import joblib

from pathlib import Path
from dotenv import load_dotenv


# =========================================================
# ENVIRONMENT
# =========================================================

ENV_FILE = Path(__file__).resolve().parent / ".env"

load_dotenv(
    dotenv_path=ENV_FILE
)

print(
    "OPENAI KEY LOADED:",
    bool(
        os.getenv(
            "OPENAI_API_KEY",
            ""
        ).strip()
    )
)


# =========================================================
# ML MODEL
# =========================================================

MODEL_PATH = (
    Path(__file__).resolve().parent
    / "resq_priority_model.joblib"
)

ml_model = None

try:

    if MODEL_PATH.exists():

        ml_model = joblib.load(
            MODEL_PATH
        )

        print(
            "RESQ AI ML MODEL LOADED: True"
        )

    else:

        print(
            "RESQ AI ML MODEL LOADED: False"
        )

        print(
            "ML model file not found."
        )

except Exception as error:

    print(
        "ML MODEL LOAD ERROR:",
        error
    )

    ml_model = None


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="ResQ AI API",
    version="1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================================================
# MODELS
# =========================================================

class LoginRequest(BaseModel):

    email: str

    password: str

    role: str


class DisasterReport(BaseModel):

    disaster_type: str

    location: str

    latitude: float | None = None

    longitude: float | None = None

    affected_people: int = 0

    road_access: str = "Open"

    hospital_distance_km: float | None = None

    description: str = ""


class CopilotRequest(BaseModel):

    message: str

    language: str = "auto"


# =========================================================
# DATABASE HELPER
# =========================================================

def open_database():

    last_error = None

    for attempt in range(3):

        try:

            db = get_db_connection()

            db.ping(
                reconnect=True,
                attempts=3,
                delay=1
            )

            return db

        except Exception as error:

            last_error = error

            print(
                f"MySQL connection attempt "
                f"{attempt + 1} failed:",
                error
            )

            time.sleep(1)

    raise last_error


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {

        "status":
            "success",

        "service":
            "ResQ AI API",

        "message":
            "ResQ AI backend is running"

    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor()

        cursor.execute(
            "SELECT 1"
        )

        cursor.fetchone()

        return {

            "status":
                "healthy",

            "service":
                "ResQ AI API",

            "database":
                "connected",

            "ml_model":
                "loaded"
                if ml_model is not None
                else "fallback"

        }

    except Exception as error:

        print(
            "HEALTH ERROR:",
            error
        )

        return {

            "status":
                "unhealthy",

            "service":
                "ResQ AI API",

            "database":
                "disconnected",

            "ml_model":
                "loaded"
                if ml_model is not None
                else "fallback",

            "error":
                str(error)

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# LOGIN
# =========================================================

@app.post("/api/login")
def login_user(
    login: LoginRequest
):

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(

            """
            SELECT
                id,
                name,
                email,
                password_hash,
                role
            FROM users
            WHERE email = %s
            AND role = %s
            """,

            (
                login.email.strip(),
                login.role.upper().strip()
            )

        )

        user = cursor.fetchone()

        if not user:

            return {

                "status":
                    "error",

                "message":
                    "Invalid email or role"

            }

        stored_hash = (
            user["password_hash"]
        )

        if isinstance(
            stored_hash,
            str
        ):

            stored_hash = (
                stored_hash.encode(
                    "utf-8"
                )
            )

        password_correct = (
            bcrypt.checkpw(

                login.password.encode(
                    "utf-8"
                ),

                stored_hash

            )
        )

        if not password_correct:

            return {

                "status":
                    "error",

                "message":
                    "Invalid password"

            }

        return {

            "status":
                "success",

            "message":
                "Login successful",

            "user": {

                "id":
                    user["id"],

                "name":
                    user["name"],

                "email":
                    user["email"],

                "role":
                    user["role"]

            }

        }

    except Exception as error:

        print(
            "LOGIN ERROR:",
            error
        )

        return {

            "status":
                "error",

            "message":
                str(error)

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# WEATHER
# =========================================================

@app.get("/api/weather")
def get_weather(
    latitude: float,
    longitude: float,
    report_id: int | None = None
):

    db = None

    cursor = None

    try:

        weather_url = (

            "https://api.open-meteo.com/v1/forecast"

            f"?latitude={latitude}"

            f"&longitude={longitude}"

            "&current="

            "temperature_2m,"

            "relative_humidity_2m,"

            "precipitation,"

            "wind_speed_10m"

            "&daily="

            "temperature_2m_max,"

            "temperature_2m_min,"

            "precipitation_probability_max"

            "&timezone=auto"

        )

        response = requests.get(
            weather_url,
            timeout=15
        )

        response.raise_for_status()

        weather_json = (
            response.json()
        )

        current = (
            weather_json.get(
                "current",
                {}
            )
        )

        daily = (
            weather_json.get(
                "daily",
                {}
            )
        )

        temperature = current.get(
            "temperature_2m",
            0
        )

        humidity = current.get(
            "relative_humidity_2m",
            0
        )

        rainfall = current.get(
            "precipitation",
            0
        )

        wind_speed = current.get(
            "wind_speed_10m",
            0
        )

        weather = {

            "temperature":
                temperature,

            "humidity":
                humidity,

            "rainfall":
                rainfall,

            "wind_speed":
                wind_speed,

            "forecast_max":
                (
                    daily.get(
                        "temperature_2m_max",
                        [None]
                    )[0]
                    if daily.get(
                        "temperature_2m_max"
                    )
                    else None
                ),

            "forecast_min":
                (
                    daily.get(
                        "temperature_2m_min",
                        [None]
                    )[0]
                    if daily.get(
                        "temperature_2m_min"
                    )
                    else None
                ),

            "rain_probability":
                (
                    daily.get(
                        "precipitation_probability_max",
                        [None]
                    )[0]
                    if daily.get(
                        "precipitation_probability_max"
                    )
                    else None
                )

        }

        # SAVE WEATHER

        if report_id is not None:

            db = open_database()

            cursor = db.cursor()

            cursor.execute(

                """
                INSERT INTO weather_data
                (
                    report_id,
                    temperature,
                    humidity,
                    rainfall,
                    wind_speed
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,

                (
                    report_id,
                    temperature,
                    humidity,
                    rainfall,
                    wind_speed
                )

            )

            db.commit()

            cursor.close()

            db.close()

            db = None
            cursor = None

        return {

            "status":
                "success",

            "weather":
                weather,

            "temperature":
                temperature,

            "humidity":
                humidity,

            "rainfall":
                rainfall,

            "wind_speed":
                wind_speed,

            "forecast_max":
                weather["forecast_max"],

            "forecast_min":
                weather["forecast_min"],

            "rain_probability":
                weather["rain_probability"]

        }

    except Exception as error:

        print(
            "WEATHER ERROR:",
            error
        )

        return {

            "status":
                "error",

            "message":
                str(error)

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# LOCATION NAME
# =========================================================

@app.get("/api/location-name")
def get_location_name(
    latitude: float,
    longitude: float
):

    try:

        url = (

            "https://nominatim.openstreetmap.org/reverse"

            f"?lat={latitude}"

            f"&lon={longitude}"

            "&format=json"

            "&zoom=18"

        )

        response = requests.get(

            url,

            headers={

                "User-Agent":
                    "ResQ-AI/1.0"

            },

            timeout=10

        )

        response.raise_for_status()

        data = response.json()

        address = data.get(
            "address",
            {}
        )

        city = (

            address.get("city")

            or address.get("town")

            or address.get("village")

            or address.get("municipality")

            or address.get("county")

            or ""

        )

        state = address.get(
            "state",
            ""
        )

        district = (

            address.get(
                "state_district"
            )

            or
            address.get(
                "district"
            )

            or
            ""

        )

        parts = []

        if city:

            parts.append(
                city
            )

        if (
            district
            and district not in parts
        ):

            parts.append(
                district
            )

        if (
            state
            and state not in parts
        ):

            parts.append(
                state
            )

        display_name = ", ".join(
            parts
        )

        if not display_name:

            display_name = data.get(
                "display_name",
                "Unknown location"
            )

        return {

            "status":
                "success",

            "location":
                display_name,

            "city":
                city,

            "district":
                district,

            "state":
                state

        }

    except Exception as error:

        print(
            "LOCATION ERROR:",
            error
        )

        return {

            "status":
                "error",

            "message":
                str(error)

        }


# =========================================================
# DISTANCE
# =========================================================

def calculate_distance(
    lat1,
    lon1,
    lat2,
    lon2
):

    earth_radius = 6371

    lat1 = math.radians(
        lat1
    )

    lat2 = math.radians(
        lat2
    )

    dlat = (
        lat2 - lat1
    )

    dlon = math.radians(
        lon2 - lon1
    )

    a = (

        math.sin(
            dlat / 2
        ) ** 2

        +

        math.cos(lat1)

        *

        math.cos(lat2)

        *

        math.sin(
            dlon / 2
        ) ** 2

    )

    c = (

        2

        *

        math.atan2(

            math.sqrt(a),

            math.sqrt(
                1 - a
            )

        )

    )

    return (
        earth_radius * c
    )


# =========================================================
# HOSPITALS
# =========================================================

def build_hospital_viewbox(
    latitude,
    longitude,
    radius_km
):

    lat_delta = radius_km / 111.0

    cos_lat = max(
        0.1,
        abs(
            math.cos(
                math.radians(latitude)
            )
        )
    )

    lon_delta = (
        radius_km /
        (111.0 * cos_lat)
    )

    south = latitude - lat_delta
    north = latitude + lat_delta

    west = longitude - lon_delta
    east = longitude + lon_delta

    return (
        west,
        north,
        east,
        south
    )


def search_hospitals_nominatim(
    latitude,
    longitude,
    radius_km
):

    west, north, east, south = (
        build_hospital_viewbox(
            latitude,
            longitude,
            radius_km
        )
    )

    url = (
        "https://nominatim.openstreetmap.org/search"
    )

    params = {

        "q":
            "hospital",

        "format":
            "jsonv2",

        "limit":
            50,

        "viewbox":
            f"{west},{north},{east},{south}",

        "bounded":
            1,

        "addressdetails":
            1,

        "dedupe":
            1,

        "layer":
            "poi"

    }

    response = requests.get(

        url,

        params=params,

        headers={

            "User-Agent":
                "ResQ-AI/1.0 hospital-search"

        },

        timeout=20

    )

    response.raise_for_status()

    return response.json()


def search_hospitals_photon(
    latitude,
    longitude
):

    url = (
        "https://photon.komoot.io/api/"
    )

    params = {

        "q":
            "hospital",

        "lat":
            latitude,

        "lon":
            longitude,

        "zoom":
            14,

        "limit":
            50

    }

    response = requests.get(

        url,

        params=params,

        headers={

            "User-Agent":
                "ResQ-AI/1.0 hospital-search"

        },

        timeout=20

    )

    response.raise_for_status()

    return response.json()


@app.get("/api/hospitals")
def get_hospitals(

    latitude: float,

    longitude: float,

    radius: int = 10000

):

    radius_meters = max(

        1000,

        min(
            radius,
            50000
        )

    )

    radius_km = (
        radius_meters / 1000.0
    )

    hospitals = []

    first_error = None

    # =====================================================
    # NOMINATIM
    # =====================================================

    try:

        results = (
            search_hospitals_nominatim(

                latitude,

                longitude,

                radius_km

            )
        )

        for item in results:

            try:

                hospital_lat = float(
                    item.get("lat")
                )

                hospital_lon = float(
                    item.get("lon")
                )

            except (
                TypeError,
                ValueError
            ):

                continue

            distance = calculate_distance(

                latitude,

                longitude,

                hospital_lat,

                hospital_lon

            )

            if distance > radius_km:

                continue

            address = (
                item.get(
                    "address",
                    {}
                )
            )

            address_parts = []

            for key in [

                "road",
                "suburb",
                "city",
                "town",
                "village",
                "district"

            ]:

                value = address.get(
                    key
                )

                if (
                    value
                    and
                    value not in address_parts
                ):

                    address_parts.append(
                        value
                    )

            hospital_name = (

                item.get("name")

                or

                item.get(
                    "display_name",
                    "Nearby Hospital"
                ).split(",")[0]

            )

            hospitals.append({

                "name":
                    hospital_name,

                "latitude":
                    hospital_lat,

                "longitude":
                    hospital_lon,

                "distance_km":
                    round(
                        distance,
                        2
                    ),

                "address":
                    ", ".join(
                        address_parts
                    ),

                "phone":
                    "",

                "website":
                    "",

                "opening_hours":
                    "",

                "operational_status":
                    "",

                "rating":
                    "",

                "source":
                    "Nominatim / OpenStreetMap"

            })

    except Exception as error:

        first_error = str(
            error
        )

        print(
            "NOMINATIM HOSPITAL ERROR:",
            error
        )

    # =====================================================
    # PHOTON FALLBACK
    # =====================================================

    if not hospitals:

        try:

            print(
                "Trying Photon hospital fallback..."
            )

            photon_data = (
                search_hospitals_photon(

                    latitude,

                    longitude

                )
            )

            for feature in (
                photon_data.get(
                    "features",
                    []
                )
            ):

                geometry = (
                    feature.get(
                        "geometry",
                        {}
                    )
                )

                coordinates = (
                    geometry.get(
                        "coordinates",
                        []
                    )
                )

                if len(coordinates) < 2:

                    continue

                hospital_lon = float(
                    coordinates[0]
                )

                hospital_lat = float(
                    coordinates[1]
                )

                distance = calculate_distance(

                    latitude,

                    longitude,

                    hospital_lat,

                    hospital_lon

                )

                if distance > radius_km:

                    continue

                properties = (
                    feature.get(
                        "properties",
                        {}
                    )
                )

                hospital_name = (

                    properties.get(
                        "name"
                    )

                    or

                    properties.get(
                        "street",
                        "Nearby Hospital"
                    )

                )

                address_parts = []

                for key in [

                    "street",
                    "district",
                    "city",
                    "state"

                ]:

                    value = properties.get(
                        key
                    )

                    if (
                        value
                        and
                        value not in address_parts
                    ):

                        address_parts.append(
                            value
                        )

                hospitals.append({

                    "name":
                        hospital_name,

                    "latitude":
                        hospital_lat,

                    "longitude":
                        hospital_lon,

                    "distance_km":
                        round(
                            distance,
                            2
                        ),

                    "address":
                        ", ".join(
                            address_parts
                        ),

                    "phone":
                        "",

                    "website":
                        "",

                    "opening_hours":
                        "",

                    "operational_status":
                        "",

                    "rating":
                        "",

                    "source":
                        "Photon / OpenStreetMap"

                })

        except Exception as error:

            print(
                "PHOTON HOSPITAL ERROR:",
                error
            )

    # =====================================================
    # REMOVE DUPLICATES
    # =====================================================

    unique_hospitals = []

    seen = set()

    for hospital in hospitals:

        key = (

            round(
                hospital["latitude"],
                5
            ),

            round(
                hospital["longitude"],
                5
            )

        )

        if key in seen:

            continue

        seen.add(key)

        unique_hospitals.append(
            hospital
        )

    # =====================================================
    # SORT
    # =====================================================

    unique_hospitals.sort(

        key=lambda item:
            item["distance_km"]

    )

    # =====================================================
    # RESPONSE
    # =====================================================

    if unique_hospitals:

        return {

            "status":
                "success",

            "total":
                len(
                    unique_hospitals
                ),

            "hospitals":
                unique_hospitals[:20],

            "source":
                "Nominatim/Photon"

        }

    return {

        "status":
            "success",

        "total":
            0,

        "hospitals":
            [],

        "source":
            "Nominatim/Photon",

        "message":

            (
                "No hospital found within "
                f"{radius_km:.0f} km."
            )

    }


# =========================================================
# RULE-BASED PRIORITY FALLBACK
# =========================================================

def calculate_priority_values(

    disaster_type,

    affected_people,

    road_access,

    hospital_distance_km,

    rainfall,

    wind_speed,

    humidity

):

    score = 0

    disaster = str(
        disaster_type or ""
    ).lower()

    severity_scores = {

        "earthquake":
            35,

        "tsunami":
            35,

        "cyclone":
            30,

        "landslide":
            30,

        "flood":
            28,

        "fire":
            25,

        "other":
            20

    }

    score += severity_scores.get(
        disaster,
        20
    )

    affected = int(
        affected_people or 0
    )

    if affected >= 100:

        score += 30

    elif affected >= 50:

        score += 25

    elif affected >= 20:

        score += 18

    elif affected >= 10:

        score += 12

    elif affected > 0:

        score += 6

    road = str(
        road_access or ""
    ).lower()

    if "blocked" in road:

        score += 15

    elif "partial" in road:

        score += 10

    else:

        score += 3

    if hospital_distance_km is not None:

        distance = float(
            hospital_distance_km
        )

        if distance >= 20:

            score += 10

        elif distance >= 10:

            score += 7

        elif distance >= 5:

            score += 4

        else:

            score += 1

    if float(
        rainfall or 0
    ) >= 20:

        score += 5

    elif float(
        rainfall or 0
    ) >= 10:

        score += 3

    if float(
        wind_speed or 0
    ) >= 50:

        score += 5

    elif float(
        wind_speed or 0
    ) >= 30:

        score += 3

    score = min(

        100,

        max(
            0,
            score
        )

    )

    if score >= 70:

        level = "HIGH"

    elif score >= 40:

        level = "MEDIUM"

    else:

        level = "LOW"

    return (
        score,
        level
    )


# =========================================================
# ML PRIORITY PREDICTION
# =========================================================

def predict_ml_priority(

    disaster_type,

    affected_people,

    road_access,

    hospital_distance_km,

    rainfall,

    wind_speed,

    humidity

):

    if ml_model is None:

        return None

    disaster_mapping = {

        "earthquake":
            6,

        "tsunami":
            6,

        "cyclone":
            5,

        "landslide":
            5,

        "flood":
            4,

        "fire":
            3,

        "other":
            1

    }

    disaster_value = (
        disaster_mapping.get(

            str(
                disaster_type or "other"
            ).lower().strip(),

            1

        )
    )

    road_text = str(
        road_access or "Open"
    ).lower().strip()

    if "blocked" in road_text:

        road_value = 2

    elif "partial" in road_text:

        road_value = 1

    else:

        road_value = 0

    features = [[

        disaster_value,

        int(
            affected_people or 0
        ),

        road_value,

        float(
            hospital_distance_km or 0
        ),

        float(
            rainfall or 0
        ),

        float(
            wind_speed or 0
        ),

        float(
            humidity or 0
        )

    ]]

    try:

        prediction = (
            ml_model.predict(
                features
            )[0]
        )

    except Exception as error:

        print(
            "ML PREDICTION ERROR:",
            error
        )

        return None

    score = int(
        round(prediction)
    )

    score = max(

        0,

        min(

            100,

            score

        )

    )

    if score >= 70:

        level = "HIGH"

    elif score >= 40:

        level = "MEDIUM"

    else:

        level = "LOW"

    return (
        score,
        level
    )


# =========================================================
# CREATE DISASTER REPORT
# =========================================================

@app.post("/api/disaster-reports")
def create_disaster_report(
    report: DisasterReport
):

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor(
            dictionary=True
        )

        # =================================================
        # STEP 1 - LOCATION
        # =================================================

        latitude = (
            report.latitude
        )

        longitude = (
            report.longitude
        )

        # =================================================
        # STEP 2 - WEATHER
        # =================================================

        rainfall = 0

        wind_speed = 0

        humidity = 0

        temperature = 0

        if (
            latitude is not None
            and longitude is not None
        ):

            try:

                weather_url = (

                    "https://api.open-meteo.com/v1/forecast"

                    f"?latitude={latitude}"

                    f"&longitude={longitude}"

                    "&current="

                    "temperature_2m,"

                    "relative_humidity_2m,"

                    "precipitation,"

                    "wind_speed_10m"

                    "&timezone=auto"

                )

                weather_response = requests.get(

                    weather_url,

                    timeout=15

                )

                weather_response.raise_for_status()

                weather_json = (
                    weather_response.json()
                )

                current = (
                    weather_json.get(
                        "current",
                        {}
                    )
                )

                temperature = current.get(
                    "temperature_2m",
                    0
                )

                humidity = current.get(
                    "relative_humidity_2m",
                    0
                )

                rainfall = current.get(
                    "precipitation",
                    0
                )

                wind_speed = current.get(
                    "wind_speed_10m",
                    0
                )

            except Exception as weather_error:

                print(
                    "Weather fetch failed:",
                    weather_error
                )

        # =================================================
        # STEP 3 - INSERT REPORT
        # =================================================

        cursor.execute(

            """
            INSERT INTO disaster_reports
            (
                disaster_type,
                location,
                latitude,
                longitude,
                affected_people,
                road_access,
                hospital_distance_km,
                description
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,

            (

                report.disaster_type,

                report.location,

                latitude,

                longitude,

                report.affected_people,

                report.road_access,

                report.hospital_distance_km,

                report.description

            )

        )

        report_id = (
            cursor.lastrowid
        )

        # =================================================
        # STEP 4 - SAVE WEATHER
        # =================================================

        try:

            cursor.execute(

                """
                INSERT INTO weather_data
                (
                    report_id,
                    temperature,
                    humidity,
                    rainfall,
                    wind_speed
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,

                (

                    report_id,

                    temperature,

                    humidity,

                    rainfall,

                    wind_speed

                )

            )

        except Exception as weather_error:

            print(
                "Weather save failed:",
                weather_error
            )

        # =================================================
        # STEP 5 - ML PRIORITY
        # =================================================

        ml_priority = (
            predict_ml_priority(

                report.disaster_type,

                report.affected_people,

                report.road_access,

                report.hospital_distance_km,

                rainfall,

                wind_speed,

                humidity

            )
        )

        if ml_priority is not None:

            priority_score, priority_level = (
                ml_priority
            )

            priority_source = (
                "machine-learning"
            )

        else:

            priority_score, priority_level = (

                calculate_priority_values(

                    report.disaster_type,

                    report.affected_people,

                    report.road_access,

                    report.hospital_distance_km,

                    rainfall,

                    wind_speed,

                    humidity

                )

            )

            priority_source = (
                "rule-based-fallback"
            )

        # =================================================
        # STEP 6 - SAVE PRIORITY
        # =================================================

        try:

            cursor.execute(

                """
                INSERT INTO rescue_priorities
                (
                    report_id,
                    priority_score,
                    priority_level
                )
                VALUES
                (
                    %s,
                    %s,
                    %s
                )
                """,

                (

                    report_id,

                    priority_score,

                    priority_level

                )

            )

        except Exception as priority_error:

            print(
                "Priority save failed:",
                priority_error
            )

        # =================================================
        # STEP 7 - ALERT
        # =================================================

        alert_title = (

            f"🚨 New "
            f"{report.disaster_type} "
            f"Emergency"

        )

        alert_message = (

            f"Emergency reported at "
            f"{report.location}. "
            f"{report.affected_people} "
            f"people affected. "
            f"Priority: "
            f"{priority_level} "
            f"({priority_score}/100)."

        )

        try:

            cursor.execute(

                """
                INSERT INTO alerts
                (
                    report_id,
                    alert_type,
                    title,
                    message,
                    location,
                    priority_level,
                    priority_score,
                    is_read
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,

                (

                    report_id,

                    report.disaster_type,

                    alert_title,

                    alert_message,

                    report.location,

                    priority_level,

                    priority_score,

                    False

                )

            )

        except Exception as alert_error:

            print(
                "Alert save failed:",
                alert_error
            )

        # =================================================
        # STEP 8 - COMMIT
        # =================================================

        db.commit()

        print(
            "Report + weather + ML priority + alert saved successfully"
        )

        return {

            "status":
                "success",

            "message":
                "Emergency report submitted successfully",

            "report_id":
                report_id,

            "priority": {

                "score":
                    priority_score,

                "level":
                    priority_level,

                "source":
                    priority_source

            },

            "weather": {

                "temperature":
                    temperature,

                "humidity":
                    humidity,

                "rainfall":
                    rainfall,

                "wind_speed":
                    wind_speed

            },

            "alert": {

                "title":
                    alert_title,

                "message":
                    alert_message

            }

        }

    except Exception as error:

        print(
            "CREATE DISASTER REPORT ERROR:",
            error
        )

        if db:

            try:
                db.rollback()
            except Exception:
                pass

        return {

            "status":
                "error",

            "message":
                str(error)

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# GET DISASTER REPORTS
# =========================================================

@app.get("/api/disaster-reports")
def get_disaster_reports():

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(

            """
            SELECT
                dr.id,
                dr.disaster_type,
                dr.location,
                dr.latitude,
                dr.longitude,
                dr.affected_people,
                dr.road_access,
                dr.hospital_distance_km,
                dr.description,
                dr.created_at,

                COALESCE(
                    rp.priority_score,
                    0
                ) AS priority_score,

                COALESCE(
                    rp.priority_level,
                    'LOW'
                ) AS priority_level

            FROM disaster_reports dr

            LEFT JOIN rescue_priorities rp
                ON rp.report_id = dr.id

            ORDER BY
                dr.created_at DESC
            """
        )

        reports = (
            cursor.fetchall()
        )

        return {

            "status":
                "success",

            "total":
                len(reports),

            "reports":
                reports

        }

    except Exception as error:

        print(
            "GET REPORTS ERROR:",
            error
        )

        return {

            "status":
                "error",

            "message":
                str(error),

            "reports":
                []

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# RESCUE TEAMS
# =========================================================

@app.get("/api/rescue-teams")
def get_rescue_teams():

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(

            """
            SELECT *
            FROM rescue_teams
            ORDER BY id DESC
            """

        )

        teams = (
            cursor.fetchall()
        )

        return {

            "status":
                "success",

            "teams":
                teams

        }

    except Exception as error:

        print(
            "RESCUE TEAM ERROR:",
            error
        )

        return {

            "status":
                "error",

            "message":
                str(error),

            "teams":
                []

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# ALERTS
# =========================================================

@app.get("/api/alerts")
def get_alerts():

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(

            """
            SELECT
                id,
                report_id,
                alert_type,
                title,
                message,
                location,
                priority_level,
                priority_score,
                is_read,
                created_at
            FROM alerts
            ORDER BY id DESC
            LIMIT 100
            """

        )

        alerts = (
            cursor.fetchall()
        )

        return {

            "status":
                "success",

            "alerts":
                alerts

        }

    except Exception as error:

        print(
            "ALERT ERROR:",
            error
        )

        return {

            "status":
                "error",

            "message":
                str(error),

            "alerts":
                []

        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# GLOBAL ALERTS
# =========================================================

@app.get("/api/global-alerts")
def global_alerts():

    return get_alerts()


# =========================================================
# COPILOT - GET DATABASE REPORTS
# =========================================================

def copilot_get_reports():

    db = None

    cursor = None

    try:

        db = open_database()

        cursor = db.cursor(
            dictionary=True
        )

        cursor.execute(

            """
            SELECT
                dr.id,
                dr.disaster_type,
                dr.location,
                dr.affected_people,
                dr.road_access,
                dr.hospital_distance_km,
                dr.description,
                dr.created_at,

                COALESCE(
                    rp.priority_score,
                    0
                ) AS priority_score,

                COALESCE(
                    rp.priority_level,
                    'LOW'
                ) AS priority_level

            FROM disaster_reports dr

            LEFT JOIN rescue_priorities rp
                ON rp.report_id = dr.id

            ORDER BY
                dr.created_at DESC

            LIMIT 50
            """

        )

        reports = (
            cursor.fetchall()
        )

        return reports

    except Exception as error:

        print(
            "COPILOT DB ERROR:",
            error
        )

        return []

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if db:

            try:
                db.close()
            except Exception:
                pass


# =========================================================
# COPILOT LANGUAGE DETECTION
# =========================================================

def copilot_detect_language(

    text,

    requested_language

):

    if requested_language in (

        "ta-IN",

        "en-IN"

    ):

        return requested_language

    if any(

        "\u0B80" <= char <= "\u0BFF"

        for char in text

    ):

        return "ta-IN"

    tanglish_words = [

        "enna",

        "eppadi",

        "epdi",

        "enga",

        "enge",

        "inga",

        "anga",

        "enakku",

        "unga",

        "ungalukku",

        "irukku",

        "iruka",

        "venum",

        "pannanum",

        "pannunga",

        "sollunga",

        "kudunga",

        "mudhala",

        "muthalla",

        "anuppanum",

        "yen",

        "eppo",

        "ippo",

        "nalla",

        "pana",

        "help",

        "rescue"

    ]

    lower = text.lower()

    for word in tanglish_words:

        if word in lower:

            return "ta-IN"

    return "en-IN"


# =========================================================
# EMERGENCY DETECTION
# =========================================================

def copilot_is_emergency(
    message
):

    text = str(
        message or ""
    ).lower()

    emergency_words = [

        "emergency",

        "help me",

        "save me",

        "ambulance",

        "fire",

        "fire accident",

        "police",

        "accident",

        "injury",

        "injured",

        "bleeding",

        "unconscious",

        "earthquake",

        "flood",

        "cyclone",

        "landslide",

        "tsunami",

        "disaster",

        "danger",

        "trapped",

        "stuck",

        "rescue",

        "112",

        "108",

        "101",

        "100",

        "அவசரம்",

        "உதவி",

        "ஆம்புலன்ஸ்",

        "தீ",

        "விபத்து",

        "காயம்",

        "ரத்தம்",

        "மயக்கம்",

        "வெள்ளம்",

        "நிலநடுக்கம்",

        "புயல்",

        "மீட்பு"

    ]

    for word in emergency_words:

        if word in text:

            return True

    return False


# =========================================================
# EMERGENCY NUMBER RESPONSE
# =========================================================

def copilot_emergency_answer(
    language
):

    if language == "ta-IN":

        return (

            "🚨 இது emergency என்றால் உடனே "
            "உதவி பெறுங்கள்.\n\n"

            "📞 112 – India Emergency Number\n"

            "🚑 108 – Ambulance / Emergency Medical Service\n"

            "🚒 101 – Fire Service\n"

            "👮 100 – Police (where available)\n\n"

            "உங்களால் safe-ஆ இருந்தால் "
            "உங்கள் exact location-ஐ emergency service-க்கு "
            "share செய்யுங்கள். அருகிலுள்ள பாதுகாப்பான "
            "இடத்திற்கு செல்லுங்கள்."

        )

    return (

        "🚨 This may be an emergency. "
        "Please get help immediately.\n\n"

        "📞 112 – India Emergency Number\n"

        "🚑 108 – Ambulance / Emergency Medical Service\n"

        "🚒 101 – Fire Service\n"

        "👮 100 – Police (where available)\n\n"

        "Share your exact location with the emergency "
        "service and move to a safe place when possible."

    )


# =========================================================
# OPENAI COPILOT
# =========================================================

def copilot_call_openai(

    message,

    language,

    reports

):

    api_key = (

        os.getenv(

            "OPENAI_API_KEY",

            ""

        ).strip()

    )

    if not api_key:

        raise RuntimeError(

            "OPENAI_API_KEY is not configured"

        )

    model = (

        os.getenv(

            "OPENAI_MODEL",

            "gpt-5.6-luna"

        ).strip()

        or

        "gpt-5.6-luna"

    )

    language_name = (

        "Tamil"

        if language == "ta-IN"

        else "English"

    )

    compact_reports = []

    for report in reports[:25]:

        compact_reports.append({

            "id":
                report.get("id"),

            "disaster_type":
                report.get(
                    "disaster_type"
                ),

            "location":
                report.get(
                    "location"
                ),

            "affected_people":
                report.get(
                    "affected_people"
                ),

            "road_access":
                report.get(
                    "road_access"
                ),

            "hospital_distance_km":
                report.get(
                    "hospital_distance_km"
                ),

            "priority_score":
                report.get(
                    "priority_score"
                ),

            "priority_level":
                report.get(
                    "priority_level"
                ),

            "description":
                report.get(
                    "description"
                ),

            "created_at":
                str(

                    report.get(
                        "created_at"
                    )
                    or ""

                )

        })

    system_prompt = f"""

You are ResQ AI Copilot, an intelligent
assistant inside a disaster-response platform.

Answer the user's exact question directly.

Do not give unnecessary long explanations.

Answer only what the user asks.

You can answer:
- normal conversation
- project questions
- technical questions
- emergency questions
- disaster-response questions
- incident questions
- priority questions
- questions about supplied incident data

IMPORTANT:

When the user asks about current ResQ AI incidents,
use ONLY the supplied database context.

Never invent:
- incidents
- locations
- hospital distances
- weather values
- rescue teams
- priority scores

For India:

112 = Emergency
108 = Ambulance / Emergency Medical Service
101 = Fire Service
100 = Police where available

If the user asks an emergency safety question,
give calm and practical guidance.

Reply in {language_name}.

Tanglish questions may be answered naturally
in Tanglish/Tamil.

Keep normal answers concise and demo-friendly.

CURRENT DATABASE:

{json.dumps(
    compact_reports,
    ensure_ascii=False,
    default=str
)}

"""

    payload = {

        "model":
            model,

        "instructions":
            system_prompt,

        "input":
            message

    }

    try:

        response = requests.post(

            "https://api.openai.com/v1/responses",

            headers={

                "Authorization":
                    f"Bearer {api_key}",

                "Content-Type":
                    "application/json"

            },

            json=payload,

            timeout=45

        )

        response.raise_for_status()

    except requests.exceptions.HTTPError as error:

        error_text = ""

        try:

            error_text = response.text

        except Exception:

            pass

        raise RuntimeError(

            f"OpenAI HTTP error "
            f"{response.status_code}: "
            f"{error_text}"

        ) from error

    except requests.exceptions.RequestException as error:

        raise RuntimeError(

            f"OpenAI connection error: "
            f"{error}"

        ) from error

    data = response.json()

    texts = []

    for item in (
        data.get(
            "output",
            []
        )
        or []
    ):

        for content in (
            item.get(
                "content",
                []
            )
            or []
        ):

            if (
                content.get(
                    "type"
                )
                == "output_text"
            ):

                text = (
                    content.get(
                        "text",
                        ""
                    )
                )

                if text:

                    texts.append(
                        text
                    )

    if not texts:

        output_text = (

            data.get(
                "output_text",
                ""
            )

        )

        if output_text:

            texts.append(
                output_text
            )

    answer = (

        "\n".join(
            texts
        ).strip()

    )

    if not answer:

        raise RuntimeError(

            "OpenAI returned an empty response"

        )

    return answer


# =========================================================
# COPILOT API
# =========================================================

@app.post("/api/copilot")
def resq_copilot(
    request: CopilotRequest
):

    print("")

    print(
        "========================================"
    )

    print(
        "        COPILOT REQUEST RECEIVED"
    )

    print(
        "========================================"
    )

    print(
        "MESSAGE:",
        request.message
    )

    print(
        "LANGUAGE:",
        request.language
    )

    print(
        "========================================"
    )

    print("")

    try:

        message = (
            request.message or ""
        ).strip()

        if not message:

            return {

                "status":
                    "error",

                "message":
                    "Please enter a message."

            }

        language = (
            copilot_detect_language(

                message,

                request.language or "auto"

            )
        )

        reports = (
            copilot_get_reports()
        )

        try:

            answer = (
                copilot_call_openai(

                    message,

                    language,

                    reports

                )
            )

            print("")

            print(
                "========================================"
            )

            print(
                "       OPENAI RESPONSE SUCCESS"
            )

            print(
                "========================================"
            )

            print(
                "ANSWER RECEIVED"
            )

            print(
                "========================================"
            )

            print("")

            return {

                "status":
                    "success",

                "data": {

                    "language":
                        language,

                    "intent":
                        "assistant",

                    "answer":
                        answer,

                    "source":
                        "openai"

                }

            }

        except Exception as ai_error:

            print("")

            print(
                "========================================"
            )

            print(
                "       OPENAI COPILOT ERROR"
            )

            print(
                "========================================"
            )

            print(
                repr(ai_error)
            )

            print(
                "========================================"
            )

            print("")

            if copilot_is_emergency(
                message
            ):

                answer = (
                    copilot_emergency_answer(
                        language
                    )
                )

                return {

                    "status":
                        "success",

                    "data": {

                        "language":
                            language,

                        "intent":
                            "emergency",

                        "answer":
                            answer,

                        "source":
                            "emergency-fallback"

                    }

                }

            return {

                "status":
                    "error",

                "message":
                    f"OpenAI error: {str(ai_error)}"

            }

    except Exception as error:

        print("")

        print(
            "========================================"
        )

        print(
            "          COPILOT API ERROR"
        )

        print(
            "========================================"
        )

        print(
            repr(error)
        )

        print(
            "========================================"
        )

        print("")

        return {

            "status":
                "error",

            "message":
                str(error)

        }


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
def startup_message():

    print("")

    print(
        "========================================"
    )

    print(
        "        RESQ AI BACKEND STARTED"
    )

    print(
        "========================================"
    )

    print(
        "API: http://127.0.0.1:8001"
    )

    print(
        "Docs: http://127.0.0.1:8001/docs"
    )

    print(
        "ML MODEL:",
        "LOADED"
        if ml_model is not None
        else "FALLBACK"
    )

    print(
        "========================================"
    )

    print("")