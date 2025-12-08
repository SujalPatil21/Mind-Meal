from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json, os, httpx
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

app = FastAPI()

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sujalpatil21.github.io",
        "https://meal-mind-5n51.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- FILE PATH FIX ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RECIPES_FILE = os.path.join(BASE_DIR, "recipes.json")
PANTRY_FILE = os.path.join(BASE_DIR, "pantry.json")

# GitHub Pages placeholder image
LOCAL_PLACEHOLDER = "https://sujalpatil21.github.io/Meal-Mind/docs/images/Placeholder.png"

# Create pantry file if missing
if not os.path.exists(PANTRY_FILE):
    with open(PANTRY_FILE, "w") as f:
        json.dump({"ingredients": []}, f)

# Load recipes on startup
with open(RECIPES_FILE, "r") as f:
    RECIPES = json.load(f)

# ---------------- FAL API KEY ----------------
FAL_API_KEY = os.getenv("FAL_API_KEY")
IMAGE_CACHE = {}

# ===========================================================
#          FAL FLUX SCHNELL IMAGE GENERATION
# ===========================================================
async def generate_flux_image(prompt: str) -> dict:
    url = "https://fal.run/fal-ai/flux/schnell"
    headers = {
        "Authorization": f"Key {FAL_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "prompt": prompt,
        "image_size": "square"
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(url, json=payload, headers=headers)

            if res.status_code != 200:
                return {"image": LOCAL_PLACEHOLDER, "error": f"FAL error {res.status_code}"}

            data = res.json()

            try:
                return {"image": data["images"][0]["url"], "error": None}
            except:
                return {"image": LOCAL_PLACEHOLDER, "error": "Invalid FAL response"}

    except Exception as e:
        return {"image": LOCAL_PLACEHOLDER, "error": str(e)}
def normalize(word: str) -> str:
    word = word.lower().strip()
    if word.endswith("es"):
        return word[:-2]
    if word.endswith("s"):
        return word[:-1]
    return word

# ===========================================================
#   MAIN RECIPE SUGGESTION
# ===========================================================
@app.get("/suggest_meal")
async def suggest_meal(ingredients: str):
    # Normalize user ingredients (supports egg -> eggs)
    user_ingredients = [normalize(i) for i in ingredients.split(",")]
    suggestions = []

    for recipe in RECIPES:
        recipe_ing_raw = recipe["ingredients"]          # Original ingredients
        recipe_ing_norm = [normalize(x) for x in recipe_ing_raw]  # Normalized

        # Identify matched & missing (smart singular/plural)
        matched = [
            orig for orig in recipe_ing_raw
            if normalize(orig) in user_ingredients
        ]

        missing = [
            orig for orig in recipe_ing_raw
            if normalize(orig) not in user_ingredients
        ]

        # Only include recipes with at least one match
        if matched:
            suggestions.append({
                "name": recipe["name"],
                "ingredients": recipe_ing_raw,
                "matched_ingredients": matched,
                "missing_ingredients": missing,
                "steps": recipe.get("steps", []),
                "nutrition": recipe.get("nutrition", {}),
                "healthy_alternative": recipe.get("healthy_alternative", ""),
                "type": recipe.get("type", "unknown"),
                "image": LOCAL_PLACEHOLDER
            })

    return {"suggestions": suggestions}


# ===========================================================
#   IMAGE GENERATION ENDPOINT
# ===========================================================
@app.get("/generate_image")
async def generate_image(recipe_name: str):

    key = recipe_name.lower().strip()

    if key in IMAGE_CACHE:
        return {"image": IMAGE_CACHE[key], "error": None}

    recipe = next((r for r in RECIPES if r["name"].lower() == key), None)
    if not recipe:
        return {"image": LOCAL_PLACEHOLDER, "error": "Recipe not found"}

    prompt = (
        f"Professional food photography of {recipe['name']}.\n"
        f"Ingredients: {', '.join(recipe['ingredients'])}.\n"
        "Realistic, appetizing, gourmet, 4k studio lighting."
    )

    result = await generate_flux_image(prompt)

    if result["error"] is None:
        IMAGE_CACHE[key] = result["image"]

    return result

@app.get("/")
async def root():
    return {"message": "MindMeal API is running correctly on Render!"}

# ===========================================================
#   PANTRY SYSTEM
# ===========================================================
class PantryItem(BaseModel):
    ingredient: str

@app.post("/add_to_pantry")
async def add_to_pantry(item: PantryItem):
    ingredient = item.ingredient.strip().lower()

    with open(PANTRY_FILE, "r") as f:
        data = json.load(f)

    if ingredient and ingredient not in data["ingredients"]:
        data["ingredients"].append(ingredient)

        with open(PANTRY_FILE, "w") as f:
            json.dump(data, f, indent=2)

    return {"ingredients": data["ingredients"]}

@app.get("/get_pantry")
async def get_pantry():
    with open(PANTRY_FILE, "r") as f:
        return json.load(f)

@app.get("/download_pantry")
async def download_pantry():
    with open(PANTRY_FILE, "r") as f:
        data = json.load(f)

    txt_content = "\n".join(data["ingredients"])

    return PlainTextResponse(
        txt_content,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=pantry_list.txt"}
    )

# ===========================================================
#   ⭐ REQUIRED FOR RENDER DEPLOYMENT
# ===========================================================
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
