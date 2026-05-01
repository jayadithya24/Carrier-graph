const BASE_URL = "http://127.0.0.1:5000";

async function parseResponse(res) {
  const raw = await res.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: `Request failed (${res.status})` };
    }
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export async function addStudent(payload) {
  const res = await fetch(`${BASE_URL}/add_student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res);
}

export async function linkStudentSkill(payload) {
  const res = await fetch(`${BASE_URL}/link_student_skill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res);
}

export async function linkStudentInterest(payload) {
  const res = await fetch(`${BASE_URL}/link_student_interest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(res);
}

export async function getStudentInsights(sid) {
  const res = await fetch(`${BASE_URL}/student_insights/${encodeURIComponent(sid)}`);
  return parseResponse(res);
}

export async function getRecommendations(sid) {
  const res = await fetch(`${BASE_URL}/recommendations/${encodeURIComponent(sid)}`);
  return parseResponse(res);
}

export async function getSimilarStudents(sid) {
  const res = await fetch(`${BASE_URL}/similar_students/${encodeURIComponent(sid)}`);
  return parseResponse(res);
}

export async function getGraph() {
  const res = await fetch(`${BASE_URL}/graph`);
  return parseResponse(res);
}

export async function importCsv(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/import_csv`, {
    method: "POST",
    body: form
  });
  return parseResponse(res);
}

export async function uploadResume(studentId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/upload_resume/${encodeURIComponent(studentId)}`, {
    method: "POST",
    body: formData
  });
  return parseResponse(res);
}
