export function welcomeView() {
  return `
    <div class="card">
      <h2>Welcome</h2>
      <p>Select an option from the navigation above.</p>
    </div>
  `;
}

export function addPatientView() {
  return `
    <div class="card">
      <h2>Add Patient</h2>

      <input id="pid" placeholder="Patient ID" />
      <input id="name" placeholder="Name" />
      <input id="age" placeholder="Age" />
      <input id="gender" placeholder="Gender" />
      <input id="notes" placeholder="Notes" />

      <button class="primary-btn" type="button" onclick="window.submitPatient()">
  ➕ Add Patient
</button>

      <p id="status"></p>

      <button class="back-btn" onclick="window.loadView('dashboard')">
  ← Back to Dashboard
</button>

    </div>
  `;
}




export function linkDiseaseView() {
  return `
    <div class="card">
      <h2>Link Disease</h2>

      <input id="pid" placeholder="Patient ID" />
      <input id="disease" placeholder="Disease Name" />

      <button class="primary-btn" id="linkDisease">
  🔗 Link Disease
</button>

      <p id="status"></p>

      <button class="back-btn" onclick="window.loadView('dashboard')">
  ← Back to Dashboard
</button>
</div>

  `;
}


export function searchView() {
  return `
    <div class="card">
      <h2>Patient Insights</h2>
      <input id="pid" placeholder="Patient ID">
      <button class="primary" id="searchPatient">Search</button>
      <pre id="result"></pre>
       <!-- ✅ BACK BUTTON -->
      <button class="back-btn" onclick="window.loadView('dashboard')">
  ← Back to Dashboard
</button>


    </div>
  `;
}

export function riskView() {
  return `
    <div class="card">
      <h2>🔥 Patient Risk Scores</h2>
      <p>Calculate health risk score based on diseases & treatments.</p>

      <input id="riskPid" class="risk-input" placeholder="Enter Patient ID" />

      <button id="calculateRisk" class="risk-btn">
  🔥 Calculate Risk
</button>

      <div id="riskResult" style="margin-top: 12px;"></div>

      <br />
      <button class="back-btn" onclick="window.loadView('dashboard')">
  ← Back to Dashboard
</button>


    </div>
  `;
}


export function dashboardView() {
  return `
    <div class="card dashboard">
      <h2>⭐ MedGraph Dashboard ⭐</h2>
      <p class="muted">
        A smart knowledge graph for patients, diseases & treatments.
      </p>

      <div class="dashboard-grid">
        <button onclick="window.loadView('graph')">🧠 View Medical Graph</button>
<button onclick="window.loadView('add')">➕ Add New Patient</button>


<button onclick="window.loadView('risk')">🔥 Update Risk Scores</button>
<button onclick="window.loadView('import')">📁 Import Data (CSV)</button>


      </div>
    </div>
  `;
}

export function importCSVView() {
  return `
    <div class="card">
      <h2>Import CSV</h2>
      <p>Select a patient CSV file to upload into MedGraph.</p>

      <label class="file-upload">
  <input type="file" id="csvFile" />
  <span class="file-upload-text">📄 Choose CSV file</span>
</label>

      <br /><br />

      <button id="uploadCSV" class="primary-btn">
  ⬆️ Upload CSV
</button>

      <p id="csvStatus"></p>

      <br />
       <!-- ✅ BACK BUTTON -->
      <button class="back-btn" onclick="window.loadView('dashboard')">
  ← Back to Dashboard
</button>


    </div>
  `;
}

export function graphView() {
  return `
  <div class="graph-page full-width">

    <!-- =====================
         Toolbar
    ====================== -->
    <div class="graph-toolbar">

      <!-- Node type pills -->
      <div class="node-types">
        <button class="pill drug">Drug</button>
        <button class="pill disease">Disease</button>
        <button class="pill gene">Gene</button>
        <button class="pill symptom">Symptom</button>
        <button class="pill patient">Patient</button>
      </div>

      <!-- Action buttons -->
      <div class="actions">
        <button id="resetFilterBtn">Reset Filter</button>
        <button id="riskBtn">Calculate Risk Score</button>
        <button id="similarBtn">Find Similar Patients</button>
        <button id="cleanLayoutBtn">Clean Layout</button>
        <button id="clusterPatientsBtn">Cluster Patients</button>
        <button id="resetViewBtn">Reset View</button>
      </div>

      <!-- Search row -->
      <div class="search-row">
        <select id="relFilter">
          <option value="">All Relationships</option>
          <option value="HAS_DISEASE">HAS_DISEASE</option>
          <option value="TREATS">TREATS</option>
          <option value="HAS_SYMPTOM">HAS_SYMPTOM</option>
          <option value="INTERACTS_WITH">INTERACTS_WITH</option>
        </select>

        <input id="nodeSearch" placeholder="Search node..." />

        <button id="findNode" class="btn btn-secondary">
          🔍 Find
        </button>

        <button id="refreshGraph" class="btn btn-primary">
          🔄 Load / Refresh Graph
        </button>
      </div>
    </div>

    <!-- =====================
         Similar Patients Panel
    ====================== -->
    <div class="similar-patients-panel">
      <h4>👥 Similar Patients</h4>
      <div id="similarStatus" class="similar-status muted">
        Click “Find Similar Patients” to analyze similarity
      </div>
      <ul id="similarList" class="similar-list"></ul>
    </div>

    <!-- =====================
         Main Content Area
    ====================== -->
    <div class="graph-content">

      <!-- 🔴 GRAPH RENDER TARGET (D3 OWNS SVG) -->
      <div
        id="graph-container"
        style="height: 75vh; min-height: 600px; width: 100%;"
      ></div>

      <!-- Node details -->
      <div class="node-info">
        <h3>Node Info</h3>
        <div id="details-panel">
          Click a node to see details
        </div>
      </div>

    </div>

    <!-- Back button -->
    <button
      class="back-btn graph-back"
      onclick="window.loadView('dashboard')"
    >
      ← Back to Dashboard
    </button>

  </div>
  `;
}








