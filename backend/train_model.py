import random
import joblib
import numpy as np

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score


# =========================================
# CONFIG
# =========================================

MODEL_FILE = "resq_priority_model.joblib"

random.seed(42)
np.random.seed(42)


# =========================================
# ENCODE DISASTER
# =========================================

def encode_disaster(disaster_type):

    disaster_type = str(disaster_type).lower().strip()

    mapping = {
        "earthquake": 6,
        "tsunami": 6,
        "cyclone": 5,
        "landslide": 5,
        "flood": 4,
        "fire": 3,
        "other": 1
    }

    return mapping.get(disaster_type, 1)


# =========================================
# ENCODE ROAD
# =========================================

def encode_road(road_access):

    road_access = str(road_access).lower().strip()

    if "blocked" in road_access:
        return 2

    if "partial" in road_access:
        return 1

    return 0


# =========================================
# CREATE PRIORITY SCORE
# =========================================

def calculate_priority(
    disaster_type,
    affected_people,
    road_access,
    hospital_distance,
    rainfall,
    wind_speed,
    humidity
):

    score = 0

    # Disaster severity
    severity = {
        "earthquake": 35,
        "tsunami": 35,
        "cyclone": 30,
        "landslide": 30,
        "flood": 28,
        "fire": 25,
        "other": 20
    }

    score += severity.get(
        disaster_type,
        20
    )

    # Affected people
    if affected_people >= 100:
        score += 30
    elif affected_people >= 50:
        score += 25
    elif affected_people >= 20:
        score += 18
    elif affected_people >= 10:
        score += 12
    elif affected_people > 0:
        score += 6

    # Road
    if road_access == "Blocked":
        score += 15
    elif road_access == "Partially Blocked":
        score += 10
    else:
        score += 3

    # Hospital distance
    if hospital_distance >= 20:
        score += 10
    elif hospital_distance >= 10:
        score += 7
    elif hospital_distance >= 5:
        score += 4
    else:
        score += 1

    # Rainfall
    if rainfall >= 20:
        score += 5
    elif rainfall >= 10:
        score += 3

    # Wind
    if wind_speed >= 50:
        score += 5
    elif wind_speed >= 30:
        score += 3

    # Humidity
    if humidity >= 90:
        score += 3
    elif humidity >= 75:
        score += 1

    return min(
        100,
        max(
            0,
            score
        )
    )


# =========================================
# GENERATE DATASET
# =========================================

X = []
y = []

disaster_types = [
    "earthquake",
    "tsunami",
    "cyclone",
    "landslide",
    "flood",
    "fire",
    "other"
]

road_types = [
    "Open",
    "Partially Blocked",
    "Blocked"
]


for i in range(5000):

    disaster = random.choice(
        disaster_types
    )

    affected = random.randint(
        0,
        500
    )

    road = random.choice(
        road_types
    )

    hospital_distance = round(
        random.uniform(
            0.5,
            30
        ),
        2
    )

    rainfall = round(
        random.uniform(
            0,
            80
        ),
        2
    )

    wind = round(
        random.uniform(
            0,
            80
        ),
        2
    )

    humidity = round(
        random.uniform(
            30,
            100
        ),
        2
    )

    row = [
        encode_disaster(disaster),
        affected,
        encode_road(road),
        hospital_distance,
        rainfall,
        wind,
        humidity
    ]

    score = calculate_priority(
        disaster,
        affected,
        road,
        hospital_distance,
        rainfall,
        wind,
        humidity
    )

    X.append(row)
    y.append(score)


# =========================================
# NUMPY ARRAY
# =========================================

X = np.array(
    X,
    dtype=float
)

y = np.array(
    y,
    dtype=float
)


# =========================================
# TRAIN TEST SPLIT
# =========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42
)


# =========================================
# RANDOM FOREST
# =========================================

model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    random_state=42,
    n_jobs=-1
)


# =========================================
# TRAIN
# =========================================

print("")
print("========================================")
print("       RESQ AI ML TRAINING")
print("========================================")
print("")

print(
    "Training samples:",
    len(X_train)
)

print(
    "Testing samples :",
    len(X_test)
)

print(
    "Model           : Random Forest"
)

print("")


model.fit(
    X_train,
    y_train
)


# =========================================
# EVALUATION
# =========================================

predictions = model.predict(
    X_test
)

mae = mean_absolute_error(
    y_test,
    predictions
)

r2 = r2_score(
    y_test,
    predictions
)


# =========================================
# SAVE MODEL
# =========================================

joblib.dump(
    model,
    MODEL_FILE
)


# =========================================
# RESULT
# =========================================

print("")
print("Model training completed.")
print(
    "Mean Absolute Error:",
    round(mae, 2)
)

print(
    "R2 Score:",
    round(r2, 4)
)

print(
    "Model saved as:",
    MODEL_FILE
)

print("")
print("========================================")
print("        RESQ AI MODEL READY")
print("========================================")
print("")