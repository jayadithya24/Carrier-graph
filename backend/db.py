
from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USER")
PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")

if not all([URI, USER, PASSWORD, NEO4J_DATABASE]):
    raise ValueError("One or more required Neo4j environment variables are missing.")

driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

def run_query(query, params=None):
    with driver.session(database=NEO4J_DATABASE) as session:
        return list(session.run(query, params or {}))
