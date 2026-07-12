# OtterFit Nutrition Baselines

This file records the public nutrition references currently used by OtterFit v51. These values are product baselines, not medical advice. The app should continue to present estimates as adjustable because individual needs vary by age, sex, health condition, medication, activity level, pregnancy, and clinical goals.

## App Constants

| Metric | Current app value | Product use |
| --- | ---: | --- |
| Protein | `max(50 g/day, 0.8 g/kg body weight)` | Calculates a daily protein floor from current account weight while never going below FDA Daily Value. |
| Fiber | `28 g/day` | Daily fiber target shown in nutrition status and next-meal advice. |
| Added/free sugar budget | `< 10% of calories` | Converts the user's daily calorie target into grams of sugar budget. |
| Sodium | `< 2300 mg/day` | Flags high-sodium days and suggests lighter next meals. |
| Water | `2000 ml/day` | Simple tracking target for hydration reminders. |

## Source Notes

### Protein

The 0.8 g/kg/day adult protein baseline follows the adult Recommended Dietary Allowance described in the Dietary Reference Intakes work from the National Academies / Institute of Medicine. OtterFit uses it as a conservative body-weight floor, but v51 also applies the FDA Daily Value of 50 g/day as the minimum product target, then lets the app prioritize protein when the user's daily logged intake is below target.

Official reference:
- National Academies Press, Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids: https://nap.nationalacademies.org/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids
- FDA, Daily Value on the Nutrition and Supplement Facts Labels: https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels

### Fiber

OtterFit uses 28 g/day as a practical daily target because the Dietary Guidelines for Americans show 28 g dietary fiber as the Daily Value reference for a 2,000-calorie pattern. This is close enough for a product-level progress goal, while still requiring user adjustment for personal plans.

Official reference:
- Dietary Guidelines for Americans 2020-2025, Appendix 1 / Daily Nutritional Goals: https://www.dietaryguidelines.gov/resources/2020-2025-dietary-guidelines-online-materials

### Added Sugars

OtterFit uses the Dietary Guidelines limit of less than 10% of calories from added sugars. In the app, the user's calorie target is multiplied by 10%, then divided by 4 kcal/g to convert that budget to grams.

Official reference:
- Dietary Guidelines for Americans 2020-2025: https://www.dietaryguidelines.gov/

### Sodium

OtterFit uses 2,300 mg/day as the sodium ceiling. This aligns with FDA Daily Value labeling guidance and the Dietary Guidelines sodium limit for adults.

Official references:
- FDA, Sodium in Your Diet: https://www.fda.gov/food/nutrition-education-resources-materials/sodium-your-diet
- Dietary Guidelines for Americans 2020-2025: https://www.dietaryguidelines.gov/

### Water

OtterFit currently uses a simplified 2,000 ml/day target to keep mobile tracking easy. The National Academies' Adequate Intake values for total water are higher and include water from foods and all beverages, so this app value should be treated as a simple drink-tracking target rather than a clinical hydration requirement.

Official reference:
- National Academies, Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate: https://nap.nationalacademies.org/catalog/10925/dietary-reference-intakes-for-water-potassium-sodium-chloride-and-sulfate

## Product Copy Rule

When OtterFit says "official baseline" in the UI, it means these public reference baselines. The app should still say estimates can be adjusted, especially for AI food recognition, portion size, soup broth, sauces, and restaurant meals.
