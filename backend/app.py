from flask import Flask, request, jsonify
from flask_cors import CORS
from neo4j import GraphDatabase
import csv
import io

def run_query(query, params=None):
    with driver.session() as session:
        result = session.run(query, params or {})
        return [r.data() for r in result]

app = Flask(__name__)
CORS(app)

driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "neo4j123")   # ← change password if needed
)



# --------------------
# Health Check
# --------------------
@app.route("/")
def home():
    return jsonify({"status": "NeoGraphMed Backend is running"})


@app.route("/test")
def test_neo4j():
    query = "MATCH (n) RETURN count(n) AS total_nodes"
    result = run_query(query)
    return jsonify(result)


# --------------------
# Add Patient (WITH NAME ✅)
# --------------------
@app.route("/add_patient", methods=["POST"])
def add_patient():
    try:
        data = request.json
        print("RECEIVED DATA:", data)
        
        query = """
        MERGE (p:Patient {id: toUpper(trim($pid))})
        SET p.name = $name,
            p.age = $age,
            p.gender = $gender,
            p.notes = $notes
        """
            
        with driver.session() as session:
            session.run(
                query,
                pid=data["pid"].strip(),
                name=data["name"],
                age=data["age"],
                gender=data["gender"],
                notes=data["notes"]
            )

        return jsonify({"status": "Patient added successfully"}), 200

    except Exception as e:
        print("❌ ERROR in /add_patient:", e)
        return jsonify({"error": "Failed to add patient"}), 500



@app.route("/import_csv", methods=["POST"])
def import_csv():
    try:
        file = request.files["file"]

        rows = csv.DictReader(
            file.stream.read().decode("utf-8").splitlines()
        )

        with driver.session() as session:
            for row in rows:
                pid = row.get("pid", "").strip().upper()
                name = row.get("name")
                age = row.get("age")
                gender = row.get("gender")
                disease = row.get("disease")

                # 1️⃣ Create / update Patient
                session.run(
                    """
                    MERGE (p:Patient {id:$pid})
                    SET p.name=$name,
                        p.age=$age,
                        p.gender=$gender
                    """,
                    pid=pid,
                    name=name,
                    age=age,
                    gender=gender
                )

                # 2️⃣ Create Disease + Relationship
                if disease:
                    session.run(
                        """
                        MATCH (p:Patient {id: toUpper(trim($pid))})
                        MERGE (d:Disease {name:$disease})
                        MERGE (p)-[:HAS_DISEASE]->(d)
                        """,
                        pid=pid,
                        disease=disease
                    )

                print(f"✅ Imported {pid} → {disease}")

        return jsonify({"status": "CSV imported with relationships"}), 200

    except Exception as e:
        print("❌ ERROR in /import_csv:", e)
        return jsonify({"error": "Failed to import CSV"}), 500




# --------------------
# Link Patient → Disease
# --------------------
@app.route("/link_patient_disease", methods=["POST"])
def link_patient_disease():
    data = request.json

    query = """
    MATCH (p:Patient {id:$pid})
    MERGE (d:Disease {name:$disease})
    MERGE (p)-[:HAS_DISEASE]->(d)
    """
    with driver.session() as session:
        session.run(
        query,
        pid=data["pid"].strip().upper(),
        disease=data["disease"]
    )

    return {"status": "Disease linked successfully"}

@app.route("/patient_insights/<pid>", methods=["GET"])
def patient_insights(pid):

    query = """
    MATCH (p:Patient {id: toUpper(trim($pid))})
    OPTIONAL MATCH (p)-[:HAS_DISEASE]->(d:Disease)
    OPTIONAL MATCH (drug:Drug)-[:TREATS]->(d)
    OPTIONAL MATCH (drug)-[:TARGETS]->(g:Gene)
    RETURN
        p.name AS patient_name,
        p.id AS patient_id,
        collect(DISTINCT d.name) AS diseases,
        collect(DISTINCT drug.name) AS drugs,
        collect(DISTINCT g.name) AS genes
    """
    with driver.session() as session:
        record = session.run(query, pid=pid.strip()).single()

    if not record:
        return jsonify({"error": "Patient not found"}), 404

    return jsonify({
        "patient_id": record["patient_id"],
        "patient_name": record["patient_name"],
        "diseases": record["diseases"],
        "drugs": record["drugs"],
        "genes": record["genes"]
    })

# --------------------
# Graph API (FINAL & CORRECT)
# --------------------
@app.route("/graph", methods=["GET"])
def get_graph():
    try:
        with driver.session() as session:

            # 1️⃣ Fetch nodes
            nodes_query = """
            MATCH (n)
            RETURN DISTINCT n
            """
            nodes_result = session.run(nodes_query)

            nodes = []
            node_seen = set()

            for record in nodes_result:
                n = record["n"]
                label = list(n.labels)[0]

                if label == "Patient":
                    node_id = f"Patient:{n.get('id')}"
                else:
                    node_id = f"{label}:{n.get('name')}"

        


                if not node_id or node_id in node_seen:
                    continue

                node_seen.add(node_id)
                nodes.append({
                    "id": node_id,
                    "label": list(n.labels)[0],
                    "name": node_id
                })

            # 2️⃣ Fetch relationships
            rels_query = """
            MATCH (a)-[r]->(b)
            RETURN DISTINCT a, r, b
            """
            rels_result = session.run(rels_query)

            links = []
            link_seen = set()

            for record in rels_result:
                a = record["a"]
                b = record["b"]
                r = record["r"]

                def node_key(n):
                    label = list(n.labels)[0]
                    if label == "Patient":
                        return f"Patient:{n.get('id').strip().upper()}"
                    else:
                        return f"{label}:{n.get('name')}"


                source = node_key(a)
                target = node_key(b)


                if not source or not target:
                    continue

                key = (source, target, r.type)
                if key in link_seen:
                    continue

                link_seen.add(key)
                links.append({
                    "source": source,
                    "target": target,
                    "type": r.type
                })

            return jsonify({
                "nodes": nodes,
                "links": links
            }), 200

    except Exception as e:
        print("GRAPH ERROR:", e)
        return jsonify({"error": "Failed to load graph"}), 500



# --------------------
# Patient Diseases
# --------------------
@app.route("/patient_diseases/<pid>")
def get_patient_diseases(pid):
    query = """
    MATCH (p:Patient {id: $pid})-[:HAS_DISEASE]->(d:Disease)
    RETURN d.name AS disease
    """
    result = run_query(query, {"pid": pid})
    return jsonify(result)

@app.route("/similar_patients/<pid>", methods=["GET"])
def get_similar_patients(pid):
    print("🔍 Similar patients API called for:", pid)

    query = """
    MATCH (p:Patient {id: toUpper(trim($pid))})
          -[:HAS_DISEASE]->(d)
          <-[:HAS_DISEASE]-(other:Patient)
    WHERE other.id <> p.id
    RETURN DISTINCT other.id AS similar
    """

    with driver.session() as session:
        result = session.run(query, pid=pid.strip())
        similar = [r["similar"] for r in result]

    print("✅ Similar patients found:", similar)

    return jsonify({
        "patient": pid,
        "similar_patients": similar
    })



# --------------------
# Run Server
# --------------------
if __name__ == "__main__":
    app.run(debug=True)


@app.route("/node_info", methods=["GET"])
def node_info():
    node_id = request.args.get("id")
    label = request.args.get("label")

    # DRUG INFO
    if label == "Drug":
        query = """
        MATCH (d:Drug {name:$name})
        OPTIONAL MATCH (d)-[:TREATS]->(dis:Disease)
        OPTIONAL MATCH (d)-[:TARGETS]->(g:Gene)
        RETURN
          collect(DISTINCT dis.name) AS diseases,
          collect(DISTINCT g.name) AS genes
        """
        result = run_query(query, {"name": node_id})
        return jsonify(result[0])

    # PATIENT INFO
    if label == "Patient":
        query = """
        MATCH (p:Patient {id: $pid})

        OPTIONAL MATCH (p)-[:HAS_DISEASE]->(d:Disease)
        OPTIONAL MATCH (drug:Drug)-[:TREATS]->(d)
        OPTIONAL MATCH (d)-[:HAS_SYMPTOM]->(s:Symptom)
        RETURN
          p.age AS age,
          p.gender AS gender,
          p.notes AS notes,
          collect(DISTINCT d.name) AS diseases,
          collect(DISTINCT drug.name) AS drugs,
          collect(DISTINCT s.name) AS symptoms
        """
        result = run_query(query, {"pid": node_id})
        return jsonify(result[0])

    return jsonify({})



