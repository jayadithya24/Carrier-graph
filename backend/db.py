from neo4j import GraphDatabase

URI = "bolt://127.0.0.1:7687"
USER = "neo4j"
PASSWORD = "neo4j123"  # same password as Neo4j Desktop

driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

def run_query(query, params=None):
    with driver.session() as session:
        return list(session.run(query, params or {}))
