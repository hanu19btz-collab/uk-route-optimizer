from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import pandas as pd
import requests
import io

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API postcode UK
POSTCODE_API = "https://api.postcodes.io/postcodes/"

# RUTE
ROUTES = {

    "Ruta 1": [
        "NG1", "NG2", "NG3",
        "NG4", "NG5", "NG12"
    ],

    "Ruta 2": [
        "NG6", "NG7", "NG8",
        "NG9", "NG10", "NG11"
    ],

    "Ruta 3": [
        "LE2", "LE3", "LE6",
        "LE9", "LE19", "CV13"
    ],

    "Ruta 4": [
        "LE1", "LE4", "LE5",
        "LE7", "LE8", "LE13",
        "LE14", "LE15",
        "LE16", "LE18"
    ],

    "Ruta 5": [
        "LE11", "LE12",
        "LE65", "LE67",
        "DE12", "DE73",
        "DE74", "DE24",
        "DE23", "DE22",
        "DE21", "DE1",
        "DE3"
    ]
}

# Culori
ROUTE_COLORS = {
    "Ruta 1": "red",
    "Ruta 2": "blue",
    "Ruta 3": "green",
    "Ruta 4": "orange",
    "Ruta 5": "purple",
    "Unassigned": "gray",
    "Invalid": "black"
}


# Detectare rută
def get_route(postcode):

    postcode = postcode.upper().strip()

    district = postcode.split(" ")[0]

    for route_name, prefixes in ROUTES.items():

        for prefix in prefixes:

            if district == prefix:
                return route_name

    return "Unassigned"


@app.post("/upload")
async def upload_excel(file: UploadFile = File(...)):

    # Citire Excel
    content = await file.read()

    df = pd.read_excel(io.BytesIO(content))

    print(df.columns)
    print(df.head())

    locations = []

    for _, row in df.iterrows():

        postcode = str(
            row.get("Postcode") or
            row.get("postcode") or
            row.get("POSTCODE") or
            row.get("Post Code") or
            row.get("Postal Code")
        ).upper().strip()

        if postcode == "NAN":
            continue

        # Detectare rută
        route = get_route(postcode)

        try:

            # Eliminăm spațiile
            clean_postcode = postcode.replace(" ", "")

            response = requests.get(
                f"{POSTCODE_API}{clean_postcode}"
            )

            if response.status_code == 200:

                data = response.json()

                if data["status"] == 200:

                    result = data["result"]

                    locations.append({

                        "name": postcode,

                        "postcode": postcode,

                        "lat": result["latitude"],

                        "lng": result["longitude"],

                        "route": route,

                        "color": ROUTE_COLORS.get(
                            route,
                            "gray"
                        )
                    })

                else:

                    print(f"Invalid postcode: {postcode}")

                    locations.append({

                        "name": postcode,

                        "postcode": postcode,

                        "lat": None,

                        "lng": None,

                        "route": "Invalid",

                        "color": "black"
                    })

            else:

                print(f"API error for: {postcode}")

        except Exception as e:

            print(f"Error for {postcode}")

            print(e)

    return locations