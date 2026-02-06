const BASE_URL = "http://127.0.0.1:5000";

export async function addPatient(data) {
  const res = await fetch(`${BASE_URL}/add_patient`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function linkPatientDisease(data) {
  const res = await fetch(`${BASE_URL}/link_patient_disease`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getPatientInsights(pid) {
  const res = await fetch(`${BASE_URL}/patient_insights/${pid}`);
  return res.json();
}
