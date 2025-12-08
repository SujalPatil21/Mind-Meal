/* ======================================================
   MindMeal – Frontend Logic (Updated with Smart Loading Overlay)
====================================================== */

/* -----------------------------
   GLOBAL DOM SELECTORS
----------------------------- */
const inputIngredients = document.getElementById("ingredientsInput");
const recipesGrid = document.getElementById("recipesGrid");
const generateBtn = document.getElementById("generateBtn");
    
// Modal elements
const modal = document.getElementById("recipeModal");
const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalIngredients = document.getElementById("modalIngredients");
const modalSteps = document.getElementById("modalSteps");
const closeModalBtn = document.getElementById("closeModal");
const downloadListBtn = document.getElementById("downloadList");

// ⭐ HEALTHY SWAPS SELECTORS
const healthySwapsBtn = document.getElementById("healthySwaps");
const healthyModal = document.getElementById("healthyModal");
const closeHealthyModalBtn = document.getElementById("closeHealthyModal");
const healthySwapItems = document.getElementById("healthySwapItems");

// ⭐ PANTRY SELECTORS
const pantryListBtn = document.getElementById("pantryList");
const pantryModal = document.getElementById("pantryModal");
const closePantryModalBtn = document.getElementById("closePantryModal");
const pantryItems = document.getElementById("pantryItems");
const downloadPantryBtn = document.getElementById("downloadPantryBtn");

// ⭐ FILTER BUTTONS (Veg / Non-Veg)
const filterVegBtn = document.getElementById("filterVeg");
const filterNonVegBtn = document.getElementById("filterNonVeg");

// Dark mode toggle
const themeToggle = document.getElementById("themeToggle");

// ⭐ LOADING OVERLAY
const loadingOverlay = document.getElementById("loadingOverlay");
const searchedIngredientSpan = document.getElementById("searchedIngredient");


// Backend URL
const BASE_URL = "https://meal-mind-5n51.onrender.com";


/* ======================================================
   LOADING OVERLAY FUNCTIONS
====================================================== */

function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.classList.add("hidden");
    }
}

function showLoadingOverlay(searchQuery) {
    if (loadingOverlay) {
        if (searchedIngredientSpan) {
            searchedIngredientSpan.textContent = searchQuery;
        }
        loadingOverlay.classList.remove("hidden");
    }
}


/* ======================================================
   1) DARK MODE
====================================================== */
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    const isDark = document.body.classList.contains("dark-mode");
    themeToggle.textContent = isDark ? "☀" : "🌙";

    const navIcon = document.querySelector(".nav-logo-icon");
    if (!navIcon) return;

    navIcon.style.transition = "opacity 180ms ease";
    navIcon.style.opacity = "0";

    setTimeout(() => {
        navIcon.src = isDark
            ? "images/small_icon_black.png"
            : "images/small_icon.png";
        navIcon.style.opacity = "1";
    }, 200);
});

/* ======================================================
   🔧 NO-RELOAD FIX
   - Prevent form submission
   - Ensure button never triggers default page reload
====================================================== */

// Defensive fix: force button to act as a non-submit button
if (generateBtn && generateBtn.tagName === "BUTTON") {
    generateBtn.type = "button";
}

// Safe event listener wrapper that prevents any default form submission
generateBtn.addEventListener("click", (event) => {
    if (event && event.preventDefault) event.preventDefault();
    getMeals();
});

/* ======================================================
   2) Smooth & Accessible Scroll-to-Suggestions
====================================================== */
function scrollToSuggestions(container) {
    if (!container) return;

    const prevTabIndex = container.getAttribute("tabindex");
    if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");

    const prevRole = container.getAttribute("role");
    const prevAriaLive = container.getAttribute("aria-live");
    const prevAriaLabel = container.getAttribute("aria-label");

    container.setAttribute("role", prevRole || "region");
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-label", prevAriaLabel || "Suggested meals");

    const prefersReduced = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const behavior = prefersReduced ? "auto" : "smooth";

    // Fixed header detection
    const headerCandidates = document.querySelectorAll("header, [role='banner'], .navbar, .nav, .topbar");
    let headerOffset = 0;
    for (const h of headerCandidates) {
        const style = window.getComputedStyle(h);
        if (style.position === "fixed" || style.position === "sticky") {
            headerOffset = Math.max(headerOffset, h.getBoundingClientRect().height);
        }
    }

    const rect = container.getBoundingClientRect();
    const padding = 12;
    const targetTop = window.scrollY + rect.top - headerOffset - padding;

    try {
        window.scrollTo({ top: Math.max(0, targetTop), behavior });
    } catch (e) {
        window.scrollTo(0, Math.max(0, targetTop));
    }

    const focusDelay = prefersReduced ? 0 : 300;

    setTimeout(() => {
        container.focus({ preventScroll: true });

        if (prevRole === null) container.removeAttribute("role");
        else container.setAttribute("role", prevRole);

        if (prevAriaLive === null) container.removeAttribute("aria-live");
        else container.setAttribute("aria-live", prevAriaLive);

        if (prevAriaLabel === null) container.removeAttribute("aria-label");
        else container.setAttribute("aria-label", prevAriaLabel);

    }, focusDelay);
}

/* ======================================================
   3) Fetch Recipes from Backend
====================================================== */

let lastSuggestedRecipes = [];

async function getMeals() {
    const ingredients = inputIngredients.value.trim();

    if (!ingredients) {
        recipesGrid.innerHTML =
            `<p style="color:red;">Please enter at least one ingredient.</p>`;
        return;
    }

    // Show loading overlay with search query
    showLoadingOverlay(ingredients);

    try {
        const res = await fetch(
            `${BASE_URL}/suggest_meal?ingredients=${encodeURIComponent(ingredients)}`
        );
        const data = await res.json();

        // Hide loading overlay after recipes are fetched
        hideLoadingOverlay();

        lastSuggestedRecipes = data.suggestions;
        await renderRecipes(data.suggestions);

        scrollToSuggestions(recipesGrid);

        saveIngredientsToPantry(ingredients);

    } catch (e) {
        // Hide overlay on error and show error message
        hideLoadingOverlay();
        recipesGrid.innerHTML =
            `<p style="color:red;">Unable to fetch recipes. Please try again later.</p>`;
        console.error("Error fetching recipes:", e);
    }
}

/* ======================================================
   4) Render Recipes
====================================================== */
async function renderRecipes(recipes) {

    window.recipesGridRecipes = recipes;

    recipesGrid.innerHTML = "";

    recipes = recipes.filter(r => r.matched_ingredients.length > 0);

    if (!recipes.length) {
        recipesGrid.innerHTML = `<p style="color:red;">No recipes found.</p>`;
        return;
    }

    for (const recipe of recipes) {
        const card = document.createElement("div");
        card.className = "recipe-card fade-in";

        card.innerHTML = `
            <h3>${recipe.name}</h3>
            <p><b>Matched:</b> ${recipe.matched_ingredients.join(", ")}</p>
            <p><b>Missing:</b> ${recipe.missing_ingredients.join(", ")}</p>
            <button class="view-btn" data-name="${recipe.name}">View</button>
        `;

        recipesGrid.appendChild(card);
    }

    attachModalHandlers(recipes);
}

/* ======================================================
   5) Modal Logic (AI Images)
====================================================== */
function attachModalHandlers(recipesData) {
    document.querySelectorAll(".view-btn").forEach(btn => {
        btn.addEventListener("click", async () => {

            const recipe = recipesData.find(r => r.name === btn.dataset.name);
            if (!recipe) return;
           
            modalImg.src = "images/Placeholder.png";
            let imageUrl = "images/Placeholder.png";
           

            try {
                const res = await fetch(
                    `${BASE_URL}/generate_image?recipe_name=${encodeURIComponent(recipe.name)}`
                );
                const imgData = await res.json();

                if (imgData.image) imageUrl = imgData.image;
            } catch (e) {
                console.error("Error generating image:", e);
            }

            modalImg.src = imageUrl;
            modalTitle.innerText = recipe.name;

            modalDesc.innerText =
                recipe.nutrition?.calories
                    ? `Calories: ${recipe.nutrition.calories}`
                    : "Calories: N/A";

            modalIngredients.innerHTML = recipe.ingredients
                .map(i => `<li>${i}</li>`)
                .join("");

            modalSteps.innerHTML = recipe.steps
                .map(s => `<li>${s}</li>`)
                .join("");

            modal.classList.remove("hidden");
            document.body.style.overflow = "hidden";

            downloadListBtn.onclick = () => downloadAsText(recipe);
        });
    });
}

/* ======================================================
   Close Modal
====================================================== */
closeModalBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
});

/* ======================================================
   6) Download Recipe
====================================================== */
function downloadAsText(recipe) {
    const fileName = recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const content = `
${recipe.name}

Calories: ${recipe?.nutrition?.calories || "N/A"}

Ingredients:
${recipe.ingredients.map(i => "- " + i).join("\n")}

Steps:
${recipe.steps.map((s, i) => i + 1 + ". " + s).join("\n")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}-recipe.txt`;
    link.click();
}

/* ======================================================
   7) Pantry Feature
====================================================== */
async function saveIngredientsToPantry(input) {
    const items = input.split(",").map(i => i.trim().toLowerCase());

    for (const ing of items) {
        try {
            await fetch(`${BASE_URL}/add_to_pantry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ingredient: ing })
            });
        } catch (e) {
            console.error("Error saving to pantry:", e);
        }
    }
}

pantryListBtn.addEventListener("click", async () => {
    await loadPantry();
    pantryModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
});

closePantryModalBtn.addEventListener("click", () => {
    pantryModal.classList.add("hidden");
    document.body.style.overflow = "auto";
});

async function loadPantry() {
    try {
        const res = await fetch(`${BASE_URL}/get_pantry`);
        const data = await res.json();

        pantryItems.innerHTML = data.ingredients.length
            ? data.ingredients.map(i => `<li>${i}</li>`).join("")
            : "<li>No ingredients saved yet.</li>";
    } catch (e) {
        pantryItems.innerHTML = "<li>Error loading pantry.</li>";
        console.error("Error loading pantry:", e);
    }
}

downloadPantryBtn.addEventListener("click", () => {
    window.location.href = `${BASE_URL}/download_pantry`;
});

/* ======================================================
   8) Healthy Swaps
====================================================== */
healthySwapsBtn.addEventListener("click", async () => {
    await loadHealthySwaps();
    healthyModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
});

closeHealthyModalBtn.addEventListener("click", () => {
    healthyModal.classList.add("hidden");
    document.body.style.overflow = "auto";
});

async function loadHealthySwaps() {
    if (!window.recipesGridRecipes) {
        healthySwapItems.innerHTML = "<li>No swaps available.</li>";
        return;
    }

    let swaps = window.recipesGridRecipes
        .filter(r => r.healthy_alternative)
        .map(r => `<li><b>${r.name}:</b> ${r.healthy_alternative}</li>`);

    healthySwapItems.innerHTML =
        swaps.length ? swaps.join("") : "<li>No healthy swaps found.</li>";
}

/* ======================================================
   9) Veg / Non-Veg Filters
====================================================== */
filterVegBtn.addEventListener("click", () => applyTypeFilter("veg"));
filterNonVegBtn.addEventListener("click", () => applyTypeFilter("non-veg"));

function applyTypeFilter(type) {
    if (!lastSuggestedRecipes.length) {
        recipesGrid.innerHTML =
            "<p style='color:red;'>Click Get Suggestions first.</p>";
        return;
    }

    const filtered = lastSuggestedRecipes.filter(r => r.type === type);

    if (!filtered.length) {
        recipesGrid.innerHTML =
            `<p style="color:red;">No ${type} recipes found for your ingredients.</p>`;
        return;
    }

    renderRecipes(filtered);
}
