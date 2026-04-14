from db import run_query

# ----------------- Skills -----------------
skills = [
    "Python",
    "SQL",
    "Machine Learning",
    "Data Structures",
    "System Design",
    "React",
    "JavaScript",
    "DBMS",
    "Statistics",
    "Cloud Computing",
]

for skill in skills:
    run_query("MERGE (:Skill {name: $name})", {"name": skill})


# ----------------- Jobs + Skill Requirements -----------------
jobs = [
    ("Data Scientist", ["Python", "SQL", "Machine Learning", "Statistics"]),
    ("Data Analyst", ["Python", "SQL", "Statistics", "DBMS"]),
    ("Web Developer", ["React", "JavaScript", "DBMS"]),
    (
        "Backend Engineer",
        ["Python", "DBMS", "System Design", "Cloud Computing"],
    ),
]

for job_name, required_skills in jobs:
    run_query("MERGE (:Job {name: $name})", {"name": job_name})
    for skill in required_skills:
        run_query(
            """
            MERGE (j:Job {name: $job})
            MERGE (s:Skill {name: $skill})
            MERGE (j)-[:REQUIRES]->(s)
            """,
            {"job": job_name, "skill": skill},
        )


# ----------------- Courses + Skills Taught -----------------
courses = [
    ("Coursera Machine Learning", ["Machine Learning", "Python", "Statistics"]),
    ("React Bootcamp", ["React", "JavaScript"]),
    ("SQL for Data Careers", ["SQL", "DBMS"]),
    ("System Design Essentials", ["System Design", "Cloud Computing"]),
]

for course_name, taught_skills in courses:
    run_query("MERGE (:Course {name: $name})", {"name": course_name})
    for skill in taught_skills:
        run_query(
            """
            MERGE (c:Course {name: $course})
            MERGE (s:Skill {name: $skill})
            MERGE (c)-[:TEACHES]->(s)
            """,
            {"course": course_name, "skill": skill},
        )


# ----------------- Companies + Offered Jobs -----------------
companies = [
    ("Google", ["Data Scientist", "Backend Engineer"]),
    ("Infosys", ["Data Analyst", "Web Developer"]),
    ("Microsoft", ["Backend Engineer", "Data Scientist"]),
]

for company_name, offered_jobs in companies:
    run_query("MERGE (:Company {name: $name})", {"name": company_name})
    for job_name in offered_jobs:
        run_query(
            """
            MERGE (c:Company {name: $company})
            MERGE (j:Job {name: $job})
            MERGE (c)-[:OFFERS]->(j)
            """,
            {"company": company_name, "job": job_name},
        )


# ----------------- Sample Students -----------------
students = [
    {
        "id": "S001",
        "name": "Aarav",
        "degree": "B.Tech CSE",
        "skills": ["Python", "SQL"],
        "interests": ["Data Scientist"],
    },
    {
        "id": "S002",
        "name": "Meera",
        "degree": "BCA",
        "skills": ["React", "JavaScript", "DBMS"],
        "interests": ["Web Developer"],
    },
    {
        "id": "S003",
        "name": "Rohan",
        "degree": "B.Tech IT",
        "skills": ["Python", "DBMS", "Cloud Computing"],
        "interests": ["Backend Engineer", "Data Analyst"],
    },
]

for student in students:
    run_query(
        """
        MERGE (s:Student {id: $id})
        SET s.name = $name,
            s.degree = $degree
        """,
        {
            "id": student["id"],
            "name": student["name"],
            "degree": student["degree"],
        },
    )

    for skill in student["skills"]:
        run_query(
            """
            MERGE (s:Student {id: $id})
            MERGE (sk:Skill {name: $skill})
            MERGE (s)-[:HAS_SKILL]->(sk)
            """,
            {"id": student["id"], "skill": skill},
        )

    for job in student["interests"]:
        run_query(
            """
            MERGE (s:Student {id: $id})
            MERGE (j:Job {name: $job})
            MERGE (s)-[:INTERESTED_IN]->(j)
            """,
            {"id": student["id"], "job": job},
        )

print("Academic and Career knowledge graph seeded successfully")
