from db import run_query

# ----------------- Diseases -----------------
diseases = [
    "Diabetes",
    "Hypertension",
    "Asthma",
    "Heart Disease",
    "Cancer",
    "Arthritis",
    "Migraine"
]

for d in diseases:
    run_query(
        "MERGE (:Disease {name: $name})",
        {"name": d}
    )

# ----------------- Drugs -----------------
drugs = [
    ("Metformin", "Diabetes"),
    ("Insulin", "Diabetes"),
    ("Amlodipine", "Hypertension"),
    ("Losartan", "Hypertension"),
    ("Salbutamol", "Asthma"),
    ("Aspirin", "Heart Disease"),
    ("Ibuprofen", "Arthritis"),
    ("Paracetamol", "Migraine")
]

for drug, disease in drugs:
    run_query("""
        MERGE (dr:Drug {name: $drug})
        MERGE (di:Disease {name: $disease})
        MERGE (dr)-[:TREATS]->(di)
    """, {
        "drug": drug,
        "disease": disease
    })

# ----------------- Genes -----------------
genes = [
    ("INS", "Diabetes"),
    ("ACE", "Hypertension"),
    ("BRCA1", "Cancer"),
    ("TP53", "Cancer"),
    ("IL6", "Arthritis"),
    ("CACNA1A", "Migraine")
]

for gene, disease in genes:
    run_query("""
        MERGE (g:Gene {name: $gene})
        MERGE (d:Disease {name: $disease})
        MERGE (g)-[:ASSOCIATED_WITH]->(d)
    """, {
        "gene": gene,
        "disease": disease
    })

print("✅ Healthcare knowledge graph seeded successfully")
