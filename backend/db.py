from neo4j import GraphDatabase
import os

URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4j123")  # fallback for local dev
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "bda")

driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

def run_query(query, params=None):
    with driver.session(database=NEO4J_DATABASE) as session:
        return list(session.run(query, params or {}))
