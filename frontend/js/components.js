export function dashboardView() {
  return `
    <section class="card dashboard">
      <h2>Academic and Career Knowledge Graph</h2>
      <p class="muted">Explore skill gaps, course pathways, and best-fit jobs using graph intelligence.</p>

      <div class="dashboard-grid">
        <button data-view="graph">View Career Graph</button>
        <button data-view="add">Add Student Profile</button>
        <button data-view="link">Link Skill or Job Interest</button>
        <button data-view="insights">Student Insights</button>
        <button data-view="recommend">Recommendations</button>
        <!-- <button data-view="import">Import Students CSV</button> -->
      </div>
    </section>
  `;
}

export function addStudentView() {
  return `
    <section class="card">
      <h2>Add Student</h2>
      <input id="sid" placeholder="Student ID (e.g., S101)" />
      <input id="name" placeholder="Name" />
      <input id="degree" placeholder="Degree (e.g., B.Tech CSE)" />
      <input id="skills" placeholder="Skills (comma separated)" />
      <input id="interests" placeholder="Interested Jobs (comma separated)" />
      <input id="notes" placeholder="Notes (optional)" />
      <button id="submitStudent" class="primary-btn">Add Student</button>
      <p id="status" class="status"></p>
      <button class="back-btn" data-view="dashboard">Back to Dashboard</button>
    </section>
  `;
}

// linkView removed

export function insightsView() {
  return `
    <section class="card">
      <h2>Student Insights</h2>
      <input id="insightSid" placeholder="Student ID" />
      <button id="fetchInsights" class="primary-btn">Get Insights</button>
      <div id="insightResult" class="result-block"></div>
      <button class="back-btn" data-view="dashboard">Back to Dashboard</button>
    </section>
  `;
}

export function recommendationView() {
  return `
    <section class="card">
      <h2>Recommendation Engine</h2>
      <input id="recSid" placeholder="Student ID" />
      <button id="fetchRecommendations" class="primary-btn">Run Recommendations</button>
      <button id="fetchSimilar" class="ghost-btn">Find Similar Students</button>
      <div id="recommendResult" class="result-block"></div>
      <div id="similarResult" class="result-block"></div>
      <button class="back-btn" data-view="dashboard">Back to Dashboard</button>
    </section>
  `;
}

export function importCSVView() {
  return `
    <section class="card">
      <h2>Import Student CSV</h2>
      <p class="muted">Expected columns: sid, name, degree, skills, interests</p>
      <input id="csvFile" type="file" accept=".csv" />
      <button id="uploadCSV" class="primary-btn">Upload CSV</button>
      <p id="csvStatus" class="status"></p>
      <button class="back-btn" data-view="dashboard">Back to Dashboard</button>
    </section>
  `;
}

export function graphView() {
  return `
    <section class="graph-page">
      <div class="graph-toolbar">
        <div class="graph-actions-row">
          <button id="resetFilterBtn" class="graph-action-btn">Reset Filter</button>
          <button id="cleanLayoutBtn" class="graph-action-btn">Clean Layout</button>
          <button id="clusterGraphBtn" class="graph-action-btn">Cluster Node</button>
          <button id="resetViewBtn" class="graph-action-btn">Reset View</button>
        </div>

        <div class="legend-row">
          <button type="button" class="legend legend-chip student" data-node-category="Student">Student</button>
          <button type="button" class="legend legend-chip skill" data-node-category="Skill">Skill</button>
          <button type="button" class="legend legend-chip course" data-node-category="Course">Course</button>
          <button type="button" class="legend legend-chip job" data-node-category="Job">Job</button>
          <button type="button" class="legend legend-chip company" data-node-category="Company">Company</button>
        </div>

        <div class="search-row">
          <select id="relFilter">
            <option value="">All Relationships</option>
            <option value="HAS_SKILL">HAS_SKILL</option>
            <option value="INTERESTED_IN">INTERESTED_IN</option>
            <option value="TEACHES">TEACHES</option>
            <option value="REQUIRES">REQUIRES</option>
            <option value="OFFERS">OFFERS</option>
          </select>
          <select id="graphFocusFilter">
            <option value="">All Graph Data</option>
            <option value="jobs">Show Only Jobs</option>
            <option value="learning_path">Show Learning Path</option>
            <option value="missing_skills">Highlight Missing Skills</option>
          </select>
          <input id="nodeSearch" placeholder="Search by ID or name" />
          <button id="findNode" class="ghost-btn">Find Node</button>
          <button id="clearSearchBtn" class="ghost-btn">Clear Search</button>
          <button id="refreshGraph" class="primary-btn">Refresh Graph</button>
        </div>
      </div>

      <div class="graph-content">
        <div id="graph-container"></div>
        <aside class="node-panel">
          <h3>Node Details</h3>
          <div id="details-panel" class="muted">Click a node to inspect its connections.</div>
        </aside>
      </div>

      <button class="back-btn" data-view="dashboard">Back to Dashboard</button>
    </section>
  `;
}

export function resumeUploadView(studentId = "") {
  return `
    <section class="card">
      <h2>Upload Resume</h2>
      <input id="resumeStudentId" placeholder="Student ID" value="${studentId}" />
      <input type="file" id="resumeFile" accept=".pdf,.docx" />
      <button id="uploadResumeBtn" class="primary-btn">Upload Resume</button>
      <div id="resumeLoading" style="display:none">Processing...</div>
      <div id="resumeResults"></div>
      <p id="resumeError" class="error"></p>
      <button class="back-btn" data-view="dashboard">Back to Dashboard</button>
    </section>
  `;
}

export function resumeResultsView(data) {
  return `
    <div class="resume-results">
      <h3>Extracted Skills</h3>
      <ul>${(data.extracted_skills || []).map(s => `<li>${s}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Added Skills</h3>
      <ul>${(data.added_skills || []).map(s => `<li>${s}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Missing Skills</h3>
      <ul>${(data.missing_skills || []).map(s => `<li>${s}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Recommended Jobs</h3>
      <ul>${(data.recommended_jobs || []).map(j => `<li>${j.job} (${j.score}%)</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Recommended Courses</h3>
      <ul>${(data.recommended_courses || []).map(c => `<li>${c.course}: ${c.teaches.join(', ')}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Education</h3>
      <ul>${(data.education || []).map(e => `<li>${e}</li>`).join("") || "<li>None</li>"}</ul>
      <h3>Experience</h3>
      <ul>${(data.experience || []).map(e => `<li>${e}</li>`).join("") || "<li>None</li>"}</ul>
    </div>
  `;
}
