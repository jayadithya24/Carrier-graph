
from flask import Flask, jsonify, request
from werkzeug.utils import secure_filename
import io
from resume_parser import parse_resume
from flask_cors import CORS
import csv
import os
from db import driver, NEO4J_DATABASE

# Flask app initialization must come first
app = Flask(__name__)
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    CORS(app, origins=[frontend_url])
else:
    CORS(app)

ALLOWED_EXTENSIONS = {'.pdf', '.docx'}

def allowed_file(filename):
    return '.' in filename and os.path.splitext(filename)[-1].lower() in ALLOWED_EXTENSIONS
@app.route("/upload_resume/<student_id>", methods=["POST"])
def upload_resume(student_id):
    sid = normalize_id(student_id)
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    filename = secure_filename(file.filename)
    file_stream = io.BytesIO(file.read())

    # Fetch all skills from DB for better matching
    with driver.session(database=NEO4J_DATABASE) as session:
        db_skills = session.run("MATCH (sk:Skill) RETURN sk.name AS name").value()

    try:
        parsed = parse_resume(file_stream, filename, db_skills)
    except Exception as exc:
        print("Resume parsing error:", exc)
        return jsonify({"error": "Failed to parse resume"}), 500

    extracted_skills = parsed['skills']
    education = parsed['education']
    experience = parsed['experience']

    added_skills = []
    added_interests = []
    # For this use-case, extract job interests from resume (if not present, leave empty)
    # Let's assume resume_parser returns a 'jobs' key (list of job names) or you can extract from experience/education/keywords
    job_interests = parsed.get('jobs', [])
    # If not present, fallback to empty
    if not isinstance(job_interests, list):
        job_interests = []

    with driver.session(database=NEO4J_DATABASE) as session:
        # Remove all links except HAS_SKILL and INTERESTED_IN for this student (optional cleanup)
        session.run(
            """
            MATCH (s:Student {id: $sid})-[r]
            WHERE type(r) <> 'HAS_SKILL' AND type(r) <> 'INTERESTED_IN'
            DELETE r
            """,
            sid=sid
        )

        # Get current student skills
        skill_record = session.run(
            """
            MATCH (s:Student {id: $sid})-[:HAS_SKILL]->(sk:Skill)
            RETURN collect(DISTINCT sk.name) AS skills
            """,
            sid=sid,
        ).single()
        current_skills = set(skill_record["skills"] or [])

        # Add missing skills to Neo4j
        for skill in extracted_skills:
            if skill not in current_skills:
                session.run(
                    """
                    MERGE (sk:Skill {name: $skill})
                    MATCH (s:Student {id: $sid})
                    MERGE (s)-[:HAS_SKILL]->(sk)
                    """,
                    skill=skill,
                    sid=sid,
                )
                added_skills.append(skill)

        # Add job interests (INTERESTED_IN)
        for job in job_interests:
            session.run(
                """
                MERGE (j:Job {name: $job})
                MATCH (s:Student {id: $sid})
                MERGE (s)-[:INTERESTED_IN]->(j)
                """,
                job=job,
                sid=sid,
            )
            added_interests.append(job)

    return jsonify({
        "extracted_skills": extracted_skills,
        "added_skills": added_skills,
        "added_interests": added_interests,
    })
        #         """,
        #         sid=sid, desc=edu[:200]
        #     )
        # for exp in experience:
        #     session.run(
        #         """
        #         MATCH (s:Student {id: $sid})
        #         MERGE (x:Experience {desc: $desc})
        #         MERGE (s)-[:HAS_EXPERIENCE]->(x)
        #         """,
        #         sid=sid, desc=exp[:200]
        #     )

    return jsonify({
        "extracted_skills": extracted_skills,
        "added_skills": added_skills,
        "missing_skills": missing_skills,
        "recommended_jobs": recommended_jobs,
        "recommended_courses": recommended_courses,
        "education": education,
        "experience": experience
    })

## Database connection is configured in db.py


def normalize_name(value):
    return str(value or "").strip()


def normalize_id(value):
    return str(value or "").strip().upper()


def parse_list_field(raw_value):
    if isinstance(raw_value, list):
        values = raw_value
    elif isinstance(raw_value, str):
        values = raw_value.replace("|", ",").split(",")
    else:
        values = []

    cleaned = []
    seen = set()
    for item in values:
        text = normalize_name(item)
        key = text.lower()
        if text and key not in seen:
            seen.add(key)
            cleaned.append(text)
    return cleaned


def resolve_existing_name(session, label, name):
    raw_name = normalize_name(name)
    if not raw_name:
        return ""

    query = f"""
    MATCH (n:{label})
    WHERE toLower(trim(n.name)) = toLower(trim($name))
    RETURN n.name AS name
    LIMIT 1
    """
    record = session.run(query, name=raw_name).single()
    if record and record.get("name"):
        return record["name"].strip()
    return raw_name


def score_job_matches(session, student_skills):
    skill_keys = [s.lower() for s in student_skills]

    query = """
    MATCH (job:Job)-[:REQUIRES]->(req:Skill)
    WITH job, collect(DISTINCT req.name) AS required_skills
    WITH
        job,
        required_skills,
        size([s IN required_skills WHERE toLower(s) IN $skill_keys]) AS overlap
    WHERE size(required_skills) > 0
    RETURN
        job.name AS job,
        required_skills,
        overlap,
        toFloat(overlap) / toFloat(size(required_skills)) AS score
    ORDER BY score DESC, overlap DESC, job ASC
    """

    rows = session.run(query, skill_keys=skill_keys)
    matches = []
    for row in rows:
        score_pct = round(float(row["score"]) * 100.0, 1)
        matches.append(
            {
                "job": row["job"],
                "required_skills": row["required_skills"],
                "matched_skills": row["overlap"],
                "score": score_pct,
            }
        )
    return matches


def calculate_skill_gap_score(current_skills, required_skills):
    required_unique = sorted({s for s in required_skills if s})
    if not required_unique:
        return 0.0

    current_keys = {s.lower() for s in current_skills if s}
    missing_count = len([s for s in required_unique if s.lower() not in current_keys])
    return round((missing_count / len(required_unique)) * 100.0, 1)


def build_graph_from_csv():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "sample.csv")
    if not os.path.exists(data_path):
        return {"nodes": [], "links": []}

    nodes = []
    links = []
    seen_nodes = set()
    seen_links = set()

    def add_node(node_id, label, name, student_id=None):
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        payload = {"id": node_id, "label": label, "name": name}
        if student_id:
            payload["student_id"] = student_id
        nodes.append(payload)

    def add_link(source, target, rel_type):
        key = (source, target, rel_type)
        if key in seen_links:
            return
        seen_links.add(key)
        links.append({"source": source, "target": target, "type": rel_type})

    with open(data_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = normalize_id(row.get("sid") or row.get("student_id"))
            student_name = normalize_name(row.get("name"))
            if not sid:
                continue

            student_node_id = f"Student:{sid}"
            add_node(student_node_id, "Student", student_name or student_node_id, sid)

            for skill in parse_list_field(row.get("skills", "")):
                skill_node_id = f"Skill:{skill.lower()}"
                add_node(skill_node_id, "Skill", skill)
                add_link(student_node_id, skill_node_id, "HAS_SKILL")

            for job in parse_list_field(row.get("interests", "")):
                job_node_id = f"Job:{job.lower()}"
                add_node(job_node_id, "Job", job)
                add_link(student_node_id, job_node_id, "INTERESTED_IN")

    return {"nodes": nodes, "links": links}


@app.route("/")
def home():
    return jsonify({"status": "CareerGraph backend is running"})


@app.route("/test")
def test_neo4j():
    with driver.session(database=NEO4J_DATABASE) as session:
        record = session.run("MATCH (n) RETURN count(n) AS total_nodes").single()
    return jsonify({"total_nodes": record["total_nodes"] if record else 0})


@app.route("/add_student", methods=["POST"])
def add_student():
    try:
        data = request.json or {}

        sid = normalize_id(data.get("sid"))
        name = normalize_name(data.get("name"))
        degree = normalize_name(data.get("degree"))
        notes = normalize_name(data.get("notes"))

        if not sid or not name:
            return jsonify({"error": "Student ID and name are required"}), 400

        skills = parse_list_field(data.get("skills", []))
        interests = parse_list_field(data.get("interests", []))

        with driver.session(database=NEO4J_DATABASE) as session:
            existing = session.run(
                """
                MATCH (s:Student {id: $sid})
                RETURN count(s) AS total
                """,
                sid=sid,
            ).single()

            if existing and existing["total"] > 0:
                return jsonify({"error": "Student ID already exists"}), 409

            session.run(
                """
                CREATE (s:Student {id: $sid, name: $name, degree: $degree, notes: $notes})
                """,
                sid=sid,
                name=name,
                degree=degree,
                notes=notes,
            )

            for skill in skills:
                canonical_skill = resolve_existing_name(session, "Skill", skill)
                session.run(
                    """
                    MATCH (s:Student {id: $sid})
                    MERGE (sk:Skill {name: $skill})
                    MERGE (s)-[:HAS_SKILL]->(sk)
                    """,
                    sid=sid,
                    skill=canonical_skill,
                )

            for job in interests:
                canonical_job = resolve_existing_name(session, "Job", job)
                session.run(
                    """
                    MATCH (s:Student {id: $sid})
                    MERGE (j:Job {name: $job})
                    MERGE (s)-[:INTERESTED_IN]->(j)
                    """,
                    sid=sid,
                    job=canonical_job,
                )

        return (
            jsonify(
                {
                    "status": "Student added successfully",
                    "linked_skills": skills,
                    "linked_interests": interests,
                }
            ),
            200,
        )
    except Exception as exc:
        print("ERROR in /add_student:", exc)
        return jsonify({"error": "Failed to add student"}), 500


@app.route("/link_student_skill", methods=["POST"])
def link_student_skill():
    data = request.json or {}
    sid = normalize_id(data.get("sid"))
    skill_raw = normalize_name(data.get("skill"))

    if not sid or not skill_raw:
        return jsonify({"error": "Student ID and skill are required"}), 400

    with driver.session(database=NEO4J_DATABASE) as session:
        skill = resolve_existing_name(session, "Skill", skill_raw)
        session.run(
            """
            MATCH (s:Student {id: $sid})
            MERGE (sk:Skill {name: $skill})
            MERGE (s)-[:HAS_SKILL]->(sk)
            """,
            sid=sid,
            skill=skill,
        )

    return jsonify({"status": "Skill linked successfully"})


@app.route("/link_student_interest", methods=["POST"])
def link_student_interest():
    data = request.json or {}
    sid = normalize_id(data.get("sid"))
    job_raw = normalize_name(data.get("job"))

    if not sid or not job_raw:
        return jsonify({"error": "Student ID and job are required"}), 400

    with driver.session(database=NEO4J_DATABASE) as session:
        job = resolve_existing_name(session, "Job", job_raw)
        session.run(
            """
            MATCH (s:Student {id: $sid})
            MERGE (j:Job {name: $job})
            MERGE (s)-[:INTERESTED_IN]->(j)
            """,
            sid=sid,
            job=job,
        )

    return jsonify({"status": "Job interest linked successfully"})


@app.route("/student_insights/<sid>", methods=["GET"])
def student_insights(sid):
    sid = normalize_id(sid)

    with driver.session(database=NEO4J_DATABASE) as session:
        record = session.run(
            """
            MATCH (s:Student {id: $sid})
            OPTIONAL MATCH (s)-[:HAS_SKILL]->(owned:Skill)
            OPTIONAL MATCH (s)-[:INTERESTED_IN]->(job:Job)
            OPTIONAL MATCH (job)-[:REQUIRES]->(required:Skill)
            RETURN
                s.id AS student_id,
                s.name AS student_name,
                s.degree AS degree,
                collect(DISTINCT owned.name) AS skills,
                collect(DISTINCT job.name) AS interested_jobs,
                collect(DISTINCT required.name) AS required_skills
            """,
            sid=sid,
        ).single()

        if not record:
            return jsonify({"error": "Student not found"}), 404

        skills = sorted([x for x in (record["skills"] or []) if x])
        interested_jobs = sorted([x for x in (record["interested_jobs"] or []) if x])
        required_skills = sorted([x for x in (record["required_skills"] or []) if x])

        skill_keys = {s.lower() for s in skills}
        missing_skills = [s for s in required_skills if s.lower() not in skill_keys]

        course_rows = session.run(
            """
            MATCH (c:Course)-[:TEACHES]->(sk:Skill)
            WHERE sk.name IN $missing_skills
            RETURN c.name AS course, collect(DISTINCT sk.name) AS teaches
            ORDER BY course ASC
            """,
            missing_skills=missing_skills,
        )
        suggested_courses = [
            {"course": row["course"], "teaches": row["teaches"]} for row in course_rows
        ]

        job_matches = score_job_matches(session, skills)

        similar_rows = session.run(
            """
            MATCH (s1:Student {id: $sid})-[:HAS_SKILL]->(skill:Skill)<-[:HAS_SKILL]-(s2:Student)
            WHERE s2.id <> s1.id
            RETURN
                s2.id AS student_id,
                s2.name AS student_name,
                collect(DISTINCT skill.name) AS shared_skills,
                count(DISTINCT skill) AS score
            ORDER BY score DESC, student_name ASC
            LIMIT 5
            """,
            sid=sid,
        )
        similar_students = [
            {
                "student_id": row["student_id"],
                "student_name": row["student_name"],
                "shared_skills": row["shared_skills"],
                "score": row["score"],
            }
            for row in similar_rows
        ]

        skill_gap_score = calculate_skill_gap_score(skills, required_skills)

    return jsonify(
        {
            "student_id": record["student_id"],
            "student_name": record["student_name"],
            "degree": record["degree"],
            "current_skills": skills,
            "interested_jobs": interested_jobs,
            "missing_skills": missing_skills,
            "skill_gap_score": skill_gap_score,
            "suggested_courses": suggested_courses,
            "recommended_jobs": job_matches[:5],
            "similar_students": similar_students,
        }
    )


@app.route("/recommendations/<sid>", methods=["GET"])
def recommendations(sid):
    sid = normalize_id(sid)

    with driver.session(database=NEO4J_DATABASE) as session:
        skill_record = session.run(
            """
            MATCH (s:Student {id: $sid})-[:HAS_SKILL]->(sk:Skill)
            RETURN collect(DISTINCT sk.name) AS skills
            """,
            sid=sid,
        ).single()

        student_exists = session.run(
            "MATCH (s:Student {id: $sid}) RETURN count(s) AS total", sid=sid
        ).single()
        if not student_exists or student_exists["total"] == 0:
            return jsonify({"error": "Student not found"}), 404

        student_skills = sorted([x for x in (skill_record["skills"] or []) if x])

        missing_rows = session.run(
            """
            MATCH (s:Student {id: $sid})-[:INTERESTED_IN]->(j:Job)-[:REQUIRES]->(sk:Skill)
            WHERE NOT (s)-[:HAS_SKILL]->(sk)
            RETURN DISTINCT sk.name AS skill
            ORDER BY skill ASC
            """,
            sid=sid,
        )
        missing_skills = [r["skill"] for r in missing_rows]

        course_rows = session.run(
            """
            MATCH (c:Course)-[:TEACHES]->(sk:Skill)
            WHERE sk.name IN $missing
            RETURN c.name AS course, collect(DISTINCT sk.name) AS teaches
            ORDER BY course ASC
            """,
            missing=missing_skills,
        )
        courses = [{"course": r["course"], "teaches": r["teaches"]} for r in course_rows]

        jobs = score_job_matches(session, student_skills)
        required_for_interests = session.run(
            """
            MATCH (s:Student {id: $sid})-[:INTERESTED_IN]->(:Job)-[:REQUIRES]->(sk:Skill)
            RETURN collect(DISTINCT sk.name) AS required
            """,
            sid=sid,
        ).single()
        required_skills = (required_for_interests or {}).get("required") or []
        skill_gap_score = calculate_skill_gap_score(student_skills, required_skills)

    return jsonify(
        {
            "student_id": sid,
            "current_skills": student_skills,
            "missing_skills": missing_skills,
            "skill_gap_score": skill_gap_score,
            "courses": courses,
            "job_matches": jobs[:8],
        }
    )


@app.route("/similar_students/<sid>", methods=["GET"])
def similar_students(sid):
    sid = normalize_id(sid)

    query = """
    MATCH (s1:Student {id: $sid})-[:HAS_SKILL]->(skill:Skill)<-[:HAS_SKILL]-(s2:Student)
    WHERE s2.id <> s1.id
    RETURN
        s2.id AS student_id,
        s2.name AS student_name,
        collect(DISTINCT skill.name) AS shared_skills,
        count(DISTINCT skill) AS score
    ORDER BY score DESC, student_name ASC
    """

    with driver.session(database=NEO4J_DATABASE) as session:
        rows = session.run(query, sid=sid)
        similar = [
            {
                "student_id": row["student_id"],
                "student_name": row["student_name"],
                "shared_skills": row["shared_skills"],
                "score": row["score"],
            }
            for row in rows
        ]

    return jsonify({"student": sid, "similar_students": similar})


@app.route("/import_csv", methods=["POST"])
def import_csv():
    try:
        uploaded_file = request.files.get("file")
        if not uploaded_file:
            return jsonify({"error": "No file uploaded"}), 400

        rows = csv.DictReader(uploaded_file.stream.read().decode("utf-8").splitlines())

        imported = 0
        with driver.session(database=NEO4J_DATABASE) as session:
            for row in rows:
                sid = normalize_id(row.get("sid") or row.get("student_id"))
                name = normalize_name(row.get("name"))
                degree = normalize_name(row.get("degree"))
                skills = parse_list_field(row.get("skills", ""))
                interests = parse_list_field(row.get("interests", ""))

                if not sid or not name:
                    continue

                session.run(
                    """
                    MERGE (s:Student {id: $sid})
                    SET s.name = $name,
                        s.degree = $degree
                    """,
                    sid=sid,
                    name=name,
                    degree=degree,
                )

                for skill in skills:
                    canonical_skill = resolve_existing_name(session, "Skill", skill)
                    session.run(
                        """
                        MATCH (s:Student {id: $sid})
                        MERGE (sk:Skill {name: $skill})
                        MERGE (s)-[:HAS_SKILL]->(sk)
                        """,
                        sid=sid,
                        skill=canonical_skill,
                    )

                for job in interests:
                    canonical_job = resolve_existing_name(session, "Job", job)
                    session.run(
                        """
                        MATCH (s:Student {id: $sid})
                        MERGE (j:Job {name: $job})
                        MERGE (s)-[:INTERESTED_IN]->(j)
                        """,
                        sid=sid,
                        job=canonical_job,
                    )

                imported += 1

        return jsonify({"status": "CSV imported", "rows": imported})
    except Exception as exc:
        print("ERROR in /import_csv:", exc)
        return jsonify({"error": "Failed to import CSV"}), 500


@app.route("/graph", methods=["GET"])
def get_graph():
    try:
        with driver.session(database=NEO4J_DATABASE) as session:
            nodes_result = session.run("MATCH (n) RETURN DISTINCT n")
            rels_result = session.run("MATCH (a)-[r]->(b) RETURN DISTINCT a, r, b")

            nodes = []
            seen_nodes = set()


            def node_key(n):
                label = list(n.labels)[0]
                if label == "Student":
                    sid = normalize_id(n.get("id"))
                    if sid:
                        return f"Student:{sid}"
                name = normalize_name(n.get("name"))
                if name:
                    return f"{label}:{name.lower()}"
                # Fallback to Neo4j internal id if missing properties
                return f"{label}:neo4j_{n.id}"

            skipped_nodes = []

            def node_display(n):
                label = list(n.labels)[0]
                if label == "Student":
                    sid = normalize_id(n.get("id"))
                    return f"Student:{sid}"
                name = normalize_name(n.get("name"))
                return f"{label}:{name}"

            for record in nodes_result:
                n = record["n"]
                key = node_key(n)
                if key in seen_nodes:
                    continue
                if not key:
                    skipped_nodes.append(dict(n))
                    continue
                seen_nodes.add(key)
                label = list(n.labels)[0]
                payload = {
                    "id": key,
                    "label": label,
                    "name": node_display(n),
                }
                if label == "Student":
                    payload["student_id"] = normalize_id(n.get("id"))
                nodes.append(payload)

            links = []
            seen_links = set()
            for record in rels_result:
                source = node_key(record["a"])
                target = node_key(record["b"])
                rel_type = record["r"].type
                if not source or not target:
                    continue

                key = (source, target, rel_type)
                if key in seen_links:
                    continue

                seen_links.add(key)
                links.append({"source": source, "target": target, "type": rel_type})

        if skipped_nodes:
            print(f"Skipped nodes due to missing properties: {skipped_nodes}")
        return jsonify({"nodes": nodes, "links": links}), 200
    except Exception as exc:
        print("GRAPH ERROR:", exc)
        fallback = build_graph_from_csv()
        if fallback["nodes"]:
            return (
                jsonify(
                    {
                        "nodes": fallback["nodes"],
                        "links": fallback["links"],
                        "warning": "Neo4j unavailable - using CSV fallback graph",
                    }
                ),
                200,
            )

        return jsonify({"error": "Failed to load graph"}), 500


@app.route("/node_info", methods=["GET"])
def node_info():
    node_id = normalize_name(request.args.get("id"))
    label = normalize_name(request.args.get("label"))

    with driver.session(database=NEO4J_DATABASE) as session:
        if label == "Student":
            sid = node_id.split(":")[-1].upper()
            record = session.run(
                """
                MATCH (s:Student {id: $sid})
                OPTIONAL MATCH (s)-[:HAS_SKILL]->(sk:Skill)
                OPTIONAL MATCH (s)-[:INTERESTED_IN]->(j:Job)
                RETURN
                    s.name AS name,
                    s.degree AS degree,
                    collect(DISTINCT sk.name) AS skills,
                    collect(DISTINCT j.name) AS jobs
                """,
                sid=sid,
            ).single()
            return jsonify(record.data() if record else {})

        if label == "Job":
            job_name = node_id.split(":", 1)[-1]
            record = session.run(
                """
                MATCH (j:Job)
                WHERE toLower(j.name) = toLower($job_name)
                OPTIONAL MATCH (j)-[:REQUIRES]->(sk:Skill)
                OPTIONAL MATCH (c:Company)-[:OFFERS]->(j)
                RETURN
                    j.name AS name,
                    collect(DISTINCT sk.name) AS required_skills,
                    collect(DISTINCT c.name) AS companies
                LIMIT 1
                """,
                job_name=job_name,
            ).single()
            return jsonify(record.data() if record else {})

    return jsonify({})


if __name__ == "__main__":
    app.run(debug=True)
