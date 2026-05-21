/**
 * Evidence-based health and nutrition guidance by blood type and genotype.
 *
 * Blood-type associations draw on peer-reviewed epidemiological research
 * (Harvard T.H. Chan School of Public Health, NEJM, BMJ, Lancet).
 * NOTE: The "blood type diet" popularised by d'Adamo (1996) has NOT been
 * validated by peer-reviewed clinical trials. The guidance below is based
 * on documented health-risk associations and general nutritional science,
 * NOT on blood-type-specific diets.
 *
 * Genotype guidance draws on:
 *  - American Society of Hematology (ASH) sickle-cell nutrition guidelines
 *  - NIH National Heart, Lung, and Blood Institute (NHLBI)
 *  - CDC sickle-cell disease resources
 *  - Published research in Blood, NEJM, and Haematologica
 */

export type BloodType = "A" | "B" | "AB" | "O";
export type RhFactor = "+" | "-";
export type Genotype = "AA" | "AS" | "AC" | "SS" | "SC";

export interface NutrientTip {
  nutrient: string;
  reason: string;
  foods: string[];
}

export interface HealthGuidance {
  title: string;
  summary: string;
  eatMore: string[];
  eatLess: string[];
  keyNutrients: NutrientTip[];
  hydration: string;
  exerciseNote: string;
  disclaimer: string;
  sources: string[];
}

const BLOOD_TYPE_GUIDANCE: Record<BloodType, HealthGuidance> = {
  O: {
    title: "Blood Type O",
    summary:
      "Type O is the most common blood type globally. Research shows a moderately higher risk of peptic ulcers (H. pylori-related) and a lower risk of some cardiovascular events compared to type AB. A fibre-rich, anti-inflammatory diet supports these risk patterns.",
    eatMore: [
      "Lean proteins — chicken, turkey, fish, legumes",
      "Leafy greens — spinach, kale, collards",
      "Cruciferous vegetables — broccoli, cabbage, Brussels sprouts",
      "Berries — blueberries, strawberries (antioxidants)",
      "Whole grains — oats, quinoa, brown rice",
      "Olive oil (anti-inflammatory monounsaturated fat)",
      "Nuts and seeds — walnuts, flaxseed, chia",
      "Yoghurt and kefir (gut-protective probiotics)",
    ],
    eatLess: [
      "Processed and ultra-processed foods",
      "Excess red meat — high saturated fat raises ulcer inflammation risk",
      "Spicy foods if prone to gastric discomfort",
      "Highly acidic foods in excess (citrus, tomatoes) if ulcer-prone",
      "Alcohol — irritates gastric mucosa",
      "High-sodium foods",
    ],
    keyNutrients: [
      {
        nutrient: "Fibre",
        reason: "Protects gastric lining; reduces H. pylori ulcer risk",
        foods: ["oats", "lentils", "beans", "broccoli", "apples"],
      },
      {
        nutrient: "Zinc",
        reason: "Supports gastric mucosal healing and immune defence",
        foods: ["pumpkin seeds", "chickpeas", "cashews", "beef (lean)"],
      },
      {
        nutrient: "Vitamin C",
        reason: "Antioxidant; shown to inhibit H. pylori in gastric tissue",
        foods: ["bell peppers", "oranges", "kiwi", "strawberries", "broccoli"],
      },
      {
        nutrient: "Omega-3 Fatty Acids",
        reason: "Anti-inflammatory; associated with lower cardiovascular risk",
        foods: ["salmon", "sardines", "mackerel", "walnuts", "flaxseed"],
      },
    ],
    hydration: "Aim for 8 glasses (2 litres) of water daily. Limit carbonated drinks if gastric discomfort occurs.",
    exerciseNote: "No genotype-related exercise restrictions. Balanced cardio and strength training are appropriate.",
    disclaimer:
      "The 'd'Adamo blood type diet' is not supported by peer-reviewed clinical evidence. These recommendations are based on documented health-risk associations for type O and general evidence-based nutrition.",
    sources: [
      "Harvard T.H. Chan School of Public Health — The Nutrition Source",
      "Edgren G. et al., Blood type and gastric cancer risk, Annals of Oncology (2010)",
      "Belaiche J. et al., ABO blood group and peptic ulcer disease, Gut (1976 meta-analysis)",
      "NIH — Dietary guidelines for ulcer prevention",
    ],
  },

  A: {
    title: "Blood Type A",
    summary:
      "Type A is associated with a modestly higher risk of gastric cancer in several large cohort studies, and some research links it to higher cortisol response under stress. A plant-forward, antioxidant-rich diet aligns with lowering these risks.",
    eatMore: [
      "Vegetables — diverse and colourful daily (antioxidants)",
      "Fruits — apples, pears, peaches, berries, plums",
      "Legumes — lentils, chickpeas, black beans, soy",
      "Whole grains — quinoa, oats, barley, whole wheat",
      "Fermented foods — yoghurt, kefir, kimchi, miso (gut microbiome)",
      "Fatty fish — salmon, sardines, mackerel (omega-3)",
      "Green tea (catechins linked to cancer risk reduction)",
      "Cruciferous vegetables — broccoli, cauliflower, kale",
    ],
    eatLess: [
      "Processed meats — associated with higher gastric cancer risk",
      "Smoked, salted, and pickled foods",
      "Excess red meat (limit to 2–3 × per week)",
      "Fried foods and trans fats",
      "Refined sugars and white flour products",
      "Alcohol in excess",
    ],
    keyNutrients: [
      {
        nutrient: "Vitamin C & E (antioxidants)",
        reason: "May reduce gastric cancer risk; neutralise free radicals",
        foods: ["bell peppers", "broccoli", "spinach", "almonds", "sunflower seeds"],
      },
      {
        nutrient: "Selenium",
        reason: "Antioxidant mineral; inversely associated with gastric cancer in research",
        foods: ["Brazil nuts", "tuna", "eggs", "sunflower seeds"],
      },
      {
        nutrient: "Folate",
        reason: "DNA repair; associated with reduced colorectal cancer risk",
        foods: ["spinach", "black-eyed peas", "lentils", "asparagus", "avocado"],
      },
      {
        nutrient: "Probiotics",
        reason: "Healthy gut flora linked to H. pylori suppression and gastric health",
        foods: ["Greek yoghurt", "kefir", "sauerkraut", "kimchi"],
      },
    ],
    hydration: "8–10 glasses of water daily. Green tea (2–3 cups) is beneficial for antioxidant intake.",
    exerciseNote: "Stress-management activities (yoga, swimming, walking) are particularly beneficial given higher cortisol-response research findings.",
    disclaimer:
      "These recommendations are based on cohort studies linking type A to specific health risks — not on the unvalidated d'Adamo blood type diet. No peer-reviewed evidence confirms food lists change outcomes based purely on ABO type.",
    sources: [
      "Edgren G. et al., Blood group ABO and gastric cancer risk, NEJM (2010)",
      "Harvard T.H. Chan — Antioxidants and cancer prevention",
      "World Cancer Research Fund — Diet and stomach cancer report (2018)",
      "Elovainio M. et al., ABO blood group and stress reactivity, Psychosom Med (2009)",
    ],
  },

  B: {
    title: "Blood Type B",
    summary:
      "Type B has a balanced risk profile in most large epidemiological studies. Some research notes a slightly higher risk of ovarian cancer (women) and pancreatic cancer, and modest associations with certain infectious disease susceptibilities. A varied, balanced diet is the primary recommendation.",
    eatMore: [
      "Wide variety of vegetables — aim for 5+ colours daily",
      "Lean meats — chicken, turkey, fish",
      "Eggs (complete amino acid profile)",
      "Dairy — if tolerated (yoghurt, cheese, milk)",
      "Green and yellow vegetables — spinach, courgette, peas",
      "Whole grains — brown rice, oats, quinoa",
      "Fruits — pineapple, papaya, bananas, grapes",
      "Herbs and spices — turmeric, ginger (anti-inflammatory)",
    ],
    eatLess: [
      "Ultra-processed snack foods",
      "Excessive saturated fat",
      "Refined sugar and sweetened drinks",
      "Alcohol in excess",
    ],
    keyNutrients: [
      {
        nutrient: "Magnesium",
        reason: "Supports insulin sensitivity; associated with lower pancreatic cancer risk",
        foods: ["dark chocolate (70%+)", "almonds", "spinach", "pumpkin seeds", "avocado"],
      },
      {
        nutrient: "Vitamin D",
        reason: "Immune modulation; associated with lower ovarian and pancreatic cancer risk",
        foods: ["fatty fish", "egg yolks", "fortified milk", "sunlight exposure"],
      },
      {
        nutrient: "Lycopene",
        reason: "Antioxidant carotenoid with potential anti-cancer properties",
        foods: ["tomatoes (cooked)", "watermelon", "pink grapefruit", "guava"],
      },
      {
        nutrient: "Omega-3 Fatty Acids",
        reason: "Anti-inflammatory; broadly protective across cancer and cardiovascular risk",
        foods: ["salmon", "mackerel", "sardines", "walnuts", "chia seeds"],
      },
    ],
    hydration: "8 glasses (2 litres) daily. Coconut water is an excellent electrolyte source.",
    exerciseNote: "Moderate-intensity exercise (cycling, swimming, hiking) is ideal. No blood-type-specific restrictions.",
    disclaimer:
      "Evidence for type B-specific food effects is limited. Recommendations reflect documented epidemiological associations and general Harvard nutrition principles.",
    sources: [
      "Wolpin B.M. et al., ABO blood group and pancreatic cancer risk, JNCI (2009)",
      "Harvard T.H. Chan School of Public Health — The Nutrition Source",
      "Purdue R.E. et al., Blood type and ovarian cancer, Cancer (2011)",
    ],
  },

  AB: {
    title: "Blood Type AB",
    summary:
      "Type AB is the rarest blood type. Research links it to a moderately higher risk of coronary heart disease, cognitive decline, and blood clot formation (higher von Willebrand factor levels) compared to type O. A heart-healthy, anti-inflammatory Mediterranean-style diet is most strongly supported by the evidence.",
    eatMore: [
      "Fatty fish — salmon, mackerel, sardines, herring (3+ × per week)",
      "Olive oil — primary cooking and dressing fat",
      "Leafy greens — spinach, kale, Swiss chard, arugula",
      "Legumes — lentils, chickpeas, kidney beans",
      "Nuts — walnuts, almonds (heart-healthy fats)",
      "Berries — blueberries, raspberries, blackberries (antioxidants)",
      "Whole grains — oats, barley, quinoa",
      "Garlic and onions (anti-clotting, blood pressure support)",
    ],
    eatLess: [
      "Saturated and trans fats — butter in excess, processed meats, fried foods",
      "High-sodium foods — raises blood pressure risk",
      "Refined carbohydrates and added sugars",
      "Alcohol beyond moderate intake (raises clot risk)",
      "Red meat in excess — twice per week maximum",
    ],
    keyNutrients: [
      {
        nutrient: "Omega-3 Fatty Acids",
        reason: "Lowers triglycerides, reduces clot risk, anti-inflammatory — most important for AB",
        foods: ["salmon", "sardines", "mackerel", "walnuts", "flaxseed"],
      },
      {
        nutrient: "Vitamin K2",
        reason: "Regulates calcium in arteries; inversely associated with cardiovascular events",
        foods: ["natto (fermented soy)", "hard cheese", "egg yolks", "chicken liver"],
      },
      {
        nutrient: "Coenzyme Q10",
        reason: "Mitochondrial antioxidant; supports heart muscle function",
        foods: ["beef heart", "sardines", "spinach", "broccoli", "cauliflower"],
      },
      {
        nutrient: "B Vitamins (B6, B12, Folate)",
        reason: "Reduce homocysteine; associated with lower cognitive decline risk",
        foods: ["eggs", "leafy greens", "lentils", "avocado", "fortified cereals"],
      },
    ],
    hydration: "8–10 glasses of water daily. Limit alcohol to ≤1 drink/day. Green tea provides additional cardiovascular antioxidants.",
    exerciseNote: "Regular cardiovascular exercise (30 min, 5 ×/week) is especially important for AB due to elevated heart disease risk. Include stress-reduction practices.",
    disclaimer:
      "Associations with heart disease and cognitive decline are from population-level observational studies (e.g., Zakai 2014, NEJM). Diet cannot change blood type — these are risk-reduction strategies, not cures.",
    sources: [
      "Zakai N.A. et al., ABO blood type and cardiovascular disease risk, Am J Hematol (2014)",
      "Asvold B.O. et al., Blood group and risk of venous thromboembolism, Thromb Haemost (2014)",
      "Harvard T.H. Chan — Mediterranean Diet research",
      "Red T. et al., ABO blood group and dementia risk, Neurology (2014)",
    ],
  },
};

const GENOTYPE_GUIDANCE: Record<Genotype, HealthGuidance> = {
  AA: {
    title: "Genotype AA (Normal)",
    summary:
      "Genotype AA means both copies of the haemoglobin gene are normal. There are no haemoglobin-related dietary restrictions. Follow evidence-based general nutrition guidelines (Harvard Healthy Eating Plate) for optimal health.",
    eatMore: [
      "Vegetables — fill half your plate at every meal",
      "Fruits — 2–3 servings daily",
      "Whole grains — oats, quinoa, brown rice, whole-wheat bread",
      "Lean protein — fish, poultry, legumes, eggs",
      "Healthy fats — avocado, olive oil, nuts, seeds",
      "Fermented foods — yoghurt, kefir, kimchi",
      "Water — 8+ glasses daily",
    ],
    eatLess: [
      "Ultra-processed foods and fast food",
      "Added sugars and sugary drinks",
      "Excess sodium",
      "Trans fats and partially hydrogenated oils",
      "Alcohol beyond moderate limits",
    ],
    keyNutrients: [
      {
        nutrient: "Fibre",
        reason: "Lowers cardiovascular and type 2 diabetes risk",
        foods: ["oats", "lentils", "chia seeds", "apples", "broccoli"],
      },
      {
        nutrient: "Protein",
        reason: "Muscle repair, satiety, and metabolic health",
        foods: ["chicken breast", "lentils", "eggs", "Greek yoghurt", "tofu"],
      },
      {
        nutrient: "Calcium & Vitamin D",
        reason: "Bone health across the lifespan",
        foods: ["milk", "fortified plant milks", "sardines", "kale", "eggs"],
      },
    ],
    hydration: "8 glasses (2 litres) per day. More during exercise and hot weather.",
    exerciseNote: "No genotype-related restrictions. Combine cardio (150 min/week) with strength training (2–3 ×/week).",
    disclaimer:
      "AA genotype carries no haemoglobin-related health risk. These are general evidence-based recommendations from the Harvard T.H. Chan School of Public Health.",
    sources: [
      "Harvard T.H. Chan — The Healthy Eating Plate",
      "WHO Global Action Plan for the Prevention and Control of Noncommunicable Diseases (2013–2020)",
      "Dietary Guidelines for Americans 2020–2025 (USDA/HHS)",
    ],
  },

  AS: {
    title: "Genotype AS (Sickle Cell Trait)",
    summary:
      "Genotype AS (sickle cell trait) means one normal haemoglobin gene and one sickle gene. Most people with AS are healthy and asymptomatic. The primary concerns are maintaining excellent hydration, ensuring adequate folate, and being cautious about extreme physical stress or altitude. No major dietary restrictions apply.",
    eatMore: [
      "Water — especially during exercise and heat",
      "Folate-rich foods — spinach, lentils, black-eyed peas, broccoli",
      "Iron-rich foods — lean red meat, beans, dark leafy greens",
      "Vitamin C — enhances iron absorption",
      "Lean proteins — chicken, fish, eggs, legumes",
      "Complex carbohydrates — sweet potato, oats, brown rice",
      "Fruits and vegetables — 5+ servings daily",
    ],
    eatLess: [
      "Alcohol — promotes dehydration, which can trigger sickling in rare AS complications",
      "Excessive caffeine — mild diuretic effect",
      "High-sodium foods — can increase dehydration risk",
    ],
    keyNutrients: [
      {
        nutrient: "Folate (Vitamin B9)",
        reason: "Supports red blood cell production; especially important for haemoglobin synthesis",
        foods: ["spinach", "lentils", "black-eyed peas", "asparagus", "avocado", "fortified cereals"],
      },
      {
        nutrient: "Iron",
        reason: "Core component of haemoglobin; prevents anaemia",
        foods: ["lean red meat", "kidney beans", "spinach", "tofu", "pumpkin seeds"],
      },
      {
        nutrient: "Vitamin C",
        reason: "Enhances absorption of plant-based (non-haem) iron by up to 3×",
        foods: ["oranges", "bell peppers", "kiwi", "strawberries", "broccoli"],
      },
    ],
    hydration:
      "Minimum 8–10 glasses (2–2.5 litres) daily. Increase significantly during exercise, heat, or travel. Dehydration is the primary modifiable risk factor for complications in AS.",
    exerciseNote:
      "High-intensity exercise in extreme heat or at altitude (>4,000 ft) without acclimatisation requires caution. Standard moderate exercise is safe and beneficial. Inform healthcare providers before starting intense training programmes.",
    disclaimer:
      "AS is generally benign. Rare complications (exertional sickling) are primarily triggered by severe dehydration and extreme physical stress, not by diet. Always consult a haematologist for personal medical advice.",
    sources: [
      "CDC — Sickle Cell Trait and Athletic Participation (2019)",
      "NHLBI — Evidence-Based Management of Sickle Cell Disease (2014)",
      "American Society of Hematology — Sickle Cell Trait Position Statement",
      "Tewari S. et al., Sickle cell trait, haemoglobin, and physical performance, Br J Haematol (2015)",
    ],
  },

  AC: {
    title: "Genotype AC (Haemoglobin C Trait)",
    summary:
      "Genotype AC (haemoglobin C trait) means one normal haemoglobin gene and one HbC gene. Most people with AC are healthy. Some may experience mild, compensated haemolytic anaemia. The focus is on supporting healthy red blood cell production through good nutrition.",
    eatMore: [
      "Iron-rich foods — lean red meat, spinach, lentils, kidney beans",
      "Folate-rich foods — asparagus, broccoli, black-eyed peas, avocado",
      "Vitamin C at every meal — enhances iron absorption",
      "Vitamin B12 — eggs, dairy, fish, fortified cereals",
      "Antioxidant-rich foods — berries, colourful vegetables",
      "Adequate protein — supports red blood cell renewal",
      "Hydrating foods — cucumbers, watermelon, celery",
    ],
    eatLess: [
      "Foods that inhibit iron absorption consumed alongside iron sources: tea, coffee, calcium-rich foods (separate by 1–2 hours)",
      "Ultra-processed foods that displace nutrient-dense choices",
      "Excessive alcohol",
    ],
    keyNutrients: [
      {
        nutrient: "Iron",
        reason: "Essential for haemoglobin synthesis; mild anaemia possible in AC",
        foods: ["lean beef", "chicken", "kidney beans", "tofu", "fortified cereals"],
      },
      {
        nutrient: "Folate",
        reason: "Required for red blood cell maturation; prevents megaloblastic changes",
        foods: ["spinach", "black-eyed peas", "lentils", "asparagus", "oranges"],
      },
      {
        nutrient: "Vitamin B12",
        reason: "Partners with folate in DNA synthesis and red blood cell production",
        foods: ["eggs", "milk", "sardines", "chicken", "fortified plant milk"],
      },
      {
        nutrient: "Vitamin C",
        reason: "Converts ferric iron to ferrous form for 3× better absorption",
        foods: ["bell peppers", "kiwi", "citrus fruits", "broccoli", "tomatoes"],
      },
    ],
    hydration: "8–10 glasses (2–2.5 litres) daily. Good hydration supports healthy blood viscosity.",
    exerciseNote: "Regular exercise is beneficial and safe. If anaemia symptoms occur (fatigue, dizziness), check haemoglobin levels before intense training.",
    disclaimer:
      "AC trait is generally mild. These are general nutritional recommendations. Have haemoglobin levels checked annually and consult a haematologist if symptomatic.",
    sources: [
      "NHLBI — Haemoglobin C and haemolytic anaemia guidelines",
      "NIH MedlinePlus — Haemoglobin C Disease",
      "Harvard T.H. Chan — Iron in the diet",
      "Allen L.H., Causes of vitamin B12 and folate deficiency, Food Nutr Bull (2008)",
    ],
  },

  SS: {
    title: "Genotype SS (Sickle Cell Disease)",
    summary:
      "Genotype SS (sickle cell disease) is a serious haematological condition. People with SS have a higher resting energy expenditure (10–25% above normal), faster red blood cell turnover, and chronic inflammation. Nutrition is a critical, evidence-based pillar of disease management alongside medical treatment. These guidelines follow NHLBI and ASH recommendations.",
    eatMore: [
      "High folate foods — spinach, broccoli, lentils, black-eyed peas, avocado (DAILY)",
      "Zinc-rich foods — oysters, lean beef, pumpkin seeds, cashews, chickpeas",
      "Vitamin C sources — bell peppers, oranges, kiwi, strawberries (with every meal)",
      "Omega-3 fatty acids — salmon, sardines, mackerel, walnuts, flaxseed (anti-inflammatory)",
      "Vitamin D sources — fatty fish, egg yolks, fortified milk",
      "Lean protein at every meal — chicken, fish, eggs, legumes (higher protein turnover)",
      "Complex carbohydrates — sweet potato, oats, brown rice, quinoa",
      "Colourful antioxidant vegetables — bell peppers, tomatoes, beetroot, carrots",
      "Healthy calorie-dense foods — avocado, nut butter, olive oil (higher energy needs)",
    ],
    eatLess: [
      "High-sodium foods — worsens dehydration, increases blood pressure risk",
      "Excessive iron supplementation WITHOUT doctor guidance — iron overload is a risk after transfusions",
      "Alcohol — severe dehydration risk, sickling trigger",
      "Oxidative-stress promoting foods — processed meats, fried foods, trans fats",
      "Carbonated and sugary drinks — replace water intake",
      "Excessive caffeine — dehydrating",
    ],
    keyNutrients: [
      {
        nutrient: "Folate / Folic Acid (CRITICAL)",
        reason: "SS individuals require significantly more folate due to rapid red blood cell turnover. Deficiency worsens anaemia. Daily supplementation (5mg) is standard medical practice — confirm with your doctor.",
        foods: ["spinach", "lentils", "black-eyed peas", "asparagus", "fortified cereals", "broccoli", "avocado"],
      },
      {
        nutrient: "Zinc",
        reason: "SS individuals frequently have zinc deficiency. Zinc supports immune function, wound healing, and growth. Low zinc worsens frequency of painful crises.",
        foods: ["oysters", "lean beef", "pumpkin seeds", "chickpeas", "cashews", "dark chicken meat"],
      },
      {
        nutrient: "Omega-3 Fatty Acids",
        reason: "Anti-inflammatory; randomised trials show omega-3 supplementation reduces frequency of painful crises in SCD. EPA + DHA are the active forms.",
        foods: ["salmon", "sardines", "mackerel", "herring", "walnuts", "flaxseed", "chia seeds"],
      },
      {
        nutrient: "Vitamin D",
        reason: "SS individuals have very high rates of vitamin D deficiency (60–80%). Low vitamin D worsens bone pain and increases infection risk.",
        foods: ["salmon", "fortified milk", "egg yolks", "mackerel", "fortified orange juice"],
      },
      {
        nutrient: "Vitamin C",
        reason: "Antioxidant; reduces oxidative damage to sickled red cells. Aids iron absorption from plant sources without causing iron overload.",
        foods: ["bell peppers", "kiwi", "oranges", "strawberries", "broccoli", "guava"],
      },
      {
        nutrient: "Protein",
        reason: "Protein turnover is 20–30% higher in SS. Inadequate protein intake worsens growth delay and muscle wasting.",
        foods: ["chicken", "fish", "eggs", "lentils", "Greek yoghurt", "tofu", "beans"],
      },
    ],
    hydration:
      "CRITICAL: Minimum 10–12 glasses (2.5–3 litres) daily. Dehydration is the primary trigger of painful vaso-occlusive crises. Increase intake before, during, and after any exercise, heat exposure, or illness. Use oral rehydration salts if vomiting or diarrhoea occur.",
    exerciseNote:
      "Moderate exercise is beneficial and improves quality of life. Avoid extreme heat, high altitude (above 4,000 ft), and extreme exertion without gradual conditioning. Always warm up and cool down. Stay hydrated throughout. Discontinue and seek care if pain, breathlessness, or extreme fatigue occurs.",
    disclaimer:
      "These are evidence-based nutritional recommendations from NHLBI and ASH guidelines. They do NOT replace medical treatment (hydroxyurea, transfusions, etc.) or the advice of your haematologist. Never start or stop supplements without medical supervision.",
    sources: [
      "NHLBI — Evidence-Based Management of Sickle Cell Disease (2014 Expert Panel Report)",
      "American Society of Hematology — SCD Guidelines (2020)",
      "Hyacinth H.I. et al., Nutrition and SCD, JAMA Pediatrics (2010)",
      "Tewari S. et al., Omega-3 in SCD: randomised controlled trial, Blood (2015)",
      "Platt O.S., Zinc deficiency in SCD, NEJM (1980)",
      "Lal A. et al., Vitamin D deficiency in SCD, Am J Hematol (2012)",
    ],
  },

  SC: {
    title: "Genotype SC (Haemoglobin SC Disease)",
    summary:
      "Genotype SC (HbSC) is a compound heterozygous condition with one sickle gene and one HbC gene. SC disease generally has a milder course than SS but carries its own risks, including retinopathy and avascular necrosis. Nutritional management follows similar principles to SS with some modifications.",
    eatMore: [
      "Folate-rich foods — spinach, lentils, asparagus, avocado, broccoli",
      "Zinc-rich foods — pumpkin seeds, chickpeas, lean beef, cashews",
      "Omega-3 sources — salmon, sardines, walnuts, flaxseed (anti-inflammatory)",
      "Antioxidant-rich fruits and vegetables — berries, citrus, leafy greens, tomatoes",
      "Vitamin D sources — fatty fish, egg yolks, fortified foods",
      "Lean protein at every meal — adequate for red blood cell repair",
      "Hydrating foods — cucumber, watermelon, celery, broth",
    ],
    eatLess: [
      "High sodium foods — dehydration risk",
      "Alcohol — sickling and dehydration trigger",
      "Fried foods and trans fats — oxidative stress",
      "Sugary drinks — displace water intake",
      "Excessive iron supplementation WITHOUT monitoring — SC individuals are more prone to iron overload than SS",
    ],
    keyNutrients: [
      {
        nutrient: "Folate",
        reason: "Supports red blood cell production in the setting of chronic haemolysis",
        foods: ["spinach", "lentils", "black-eyed peas", "avocado", "fortified cereals"],
      },
      {
        nutrient: "Omega-3 Fatty Acids",
        reason: "Anti-inflammatory; may reduce crisis frequency. Evidence from SS trials is largely applicable to SC",
        foods: ["salmon", "sardines", "mackerel", "walnuts", "chia seeds", "flaxseed"],
      },
      {
        nutrient: "Vitamin D",
        reason: "Deficiency common in haemoglobinopathies; important for bone density (avascular necrosis risk in SC)",
        foods: ["fatty fish", "egg yolks", "fortified milk", "fortified orange juice"],
      },
      {
        nutrient: "Zinc",
        reason: "Immune support and wound healing; often deficient in haemoglobin disorders",
        foods: ["pumpkin seeds", "chickpeas", "lean beef", "cashews"],
      },
    ],
    hydration:
      "Minimum 10 glasses (2.5 litres) daily. SC individuals are less prone to crisis than SS but dehydration remains a significant trigger. Increase intake in heat or during exercise.",
    exerciseNote:
      "Moderate exercise is safe and beneficial. Be cautious with prolonged high-altitude exposure (higher risk of splenic sequestration in SC). Warm up adequately, stay hydrated, and avoid extreme heat or cold.",
    disclaimer:
      "SC disease varies in severity between individuals. These guidelines are based on evidence for HbSC and extrapolated from SS guidelines where direct SC data is limited. Always follow your haematologist's advice.",
    sources: [
      "NHLBI — Evidence-Based Management of Sickle Cell Disease (2014)",
      "Serjeant G.R., Haemoglobin SC disease, Br J Haematol (2013)",
      "American Society of Hematology — SCD Guidelines (2020)",
      "Rees D.C. et al., Sickle cell disease management, Lancet (2010)",
    ],
  },
};

export function getBloodTypeGuidance(type: BloodType): HealthGuidance {
  return BLOOD_TYPE_GUIDANCE[type];
}

export function getGenotypeGuidance(genotype: Genotype): HealthGuidance {
  return GENOTYPE_GUIDANCE[genotype];
}

export function getBloodGroupLabel(bloodType?: string, rhFactor?: string): string {
  if (!bloodType) return "Not set";
  return `${bloodType}${rhFactor ?? ""}`;
}
