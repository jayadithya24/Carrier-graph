import {
  addStudent,
  getGraph,
  getRecommendations,
  getSimilarStudents,
  getStudentInsights,
  importCsv,
  linkStudentInterest,
  linkStudentSkill
} from "./api.js";
import {
  addStudentView,
  dashboardView,
  graphView,
  importCSVView,
  insightsView,
  // linkView,
  recommendationView
} from "./components.js";
import { resumeUploadView, resumeResultsView } from "./components.js";
import { uploadResume } from "./api.js";

const app = document.getElementById("app");

const NODE_COLORS = {
  Student: "#16a34a",
  Skill: "#2563eb",
  Course: "#f97316",
  Job: "#dc2626",
  Company: "#7c3aed"
};

let graphState = {
  nodes: [],
  links: [],
  svg: null,
  g: null,
  simulation: null,
  node: null,
  link: null,
  label: null,
  linkLabel: null,
  zoom: null,
  selectedNode: null
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCsvList(text) {
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function render(view) {
  app.classList.remove("full-width", "centered");

  if (view === "dashboard") {
    app.innerHTML = dashboardView();
    app.classList.add("centered");
    return;
  }

  if (view === "add") {
    app.innerHTML = addStudentView();
    app.classList.add("centered");
    return;
  }

  // if (view === "link") {
  //   app.innerHTML = linkView();
  //   app.classList.add("centered");
  //   return;
  // }

  if (view === "insights") {
    app.innerHTML = insightsView();
    app.classList.add("centered");
    return;
  }

  if (view === "recommend") {
    app.innerHTML = recommendationView();
    app.classList.add("centered");
    return;
  }

  if (view === "import") {
    app.innerHTML = importCSVView();
    app.classList.add("centered");
    return;
  }

  if (view === "graph") {
    app.innerHTML = graphView();
    app.classList.add("full-width");
    loadGraph();
    return;
  }

  // Resume upload view removed

  app.innerHTML = dashboardView();
  app.classList.add("centered");
}

function setStatus(id, text, ok = true) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = text;
  el.style.color = ok ? "#166534" : "#b91c1c";
}

function resetGraphState() {
  if (graphState.simulation) {
    graphState.simulation.stop();
  }
  graphState = {
    nodes: [],
    links: [],
    svg: null,
    g: null,
    simulation: null,
    node: null,
    link: null,
    label: null,
    linkLabel: null,
    zoom: null,
    selectedNode: null
  };
}

function getSelectedStudentId() {
  const node = graphState.selectedNode;
  if (!node || node.label !== "Student") {
    return null;
  }
  return String(node.id || "").split(":").pop() || null;
}

function resetGraphView() {
  if (!graphState.svg || !graphState.zoom) {
    return;
  }

  graphState.svg
    .transition()
    .duration(350)
    .call(graphState.zoom.transform, d3.zoomIdentity);
}

function cleanGraphLayout() {
  if (!graphState.simulation) {
    return;
  }

  graphState.nodes.forEach((n) => {
    n.fx = null;
    n.fy = null;
  });

  graphState.simulation.force("xCluster", null);
  graphState.simulation.force("yCluster", null);
  graphState.simulation.alpha(0.35).restart();
}

function clusterGraphNodes() {
  if (!graphState.simulation || !graphState.svg) {
    return;
  }

  const width = Number(graphState.svg.attr("width")) || 1000;
  const height = Number(graphState.svg.attr("height")) || 700;

  const targetX = {
    Student: width * 0.3,
    Skill: width * 0.55,
    Course: width * 0.75,
    Job: width * 0.7,
    Company: width * 0.88
  };

  const targetY = {
    Student: height * 0.35,
    Skill: height * 0.65,
    Course: height * 0.25,
    Job: height * 0.5,
    Company: height * 0.8
  };

  graphState.simulation
    .force("xCluster", d3.forceX((d) => targetX[d.label] || width * 0.5).strength(0.2))
    .force("yCluster", d3.forceY((d) => targetY[d.label] || height * 0.5).strength(0.2))
    .alpha(0.85)
    .restart();
}

function findNode(query) {
  const q = normalize(query);
  return graphState.nodes.find((n) => {
    const id = normalize(n.id);
    const name = normalize((n.name || "").split(":").slice(1).join(":"));
    return id === q || id.endsWith(`:${q}`) || name === q;
  });
}

function resetGraphVisibility() {
  if (!graphState.node) {
    return;
  }
  graphState.node.style("opacity", 1).attr("stroke", "#ffffff").attr("stroke-width", 1.5);
  graphState.link.style("opacity", 0.85).attr("stroke", "#a1a1aa");
  graphState.label.style("opacity", 1);
  graphState.linkLabel.style("opacity", 0.9);
}

function findGraphNodeById(id) {
  return graphState.nodes.find((n) => n.id === id);
}

function getNodeDisplayName(node) {
  if (!node) {
    return "";
  }

  if (node.label === "Student") {
    return node.student_id || String(node.id || "").split(":").pop() || "";
  }

  return String(node.name || node.id || "").split(":").pop();
}

function showNodesByCategory(category) {
  if (!graphState.nodes.length || !graphState.node) {
    return;
  }

  const matchingNodes = graphState.nodes.filter((n) => n.label === category);
  const ids = new Set(matchingNodes.map((n) => n.id));

  const names = matchingNodes
    .map((n) => getNodeDisplayName(n))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  graphState.node
    .style("opacity", (d) => (ids.has(d.id) ? 1 : 0.12))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.5);

  graphState.label.style("opacity", (d) => (ids.has(d.id) ? 1 : 0.12));

  graphState.link.style("opacity", (d) => {
    const source = d.source.id || d.source;
    const target = d.target.id || d.target;
    return ids.has(source) || ids.has(target) ? 0.85 : 0.06;
  });

  graphState.linkLabel.style("opacity", (d) => {
    const source = d.source.id || d.source;
    const target = d.target.id || d.target;
    return ids.has(source) || ids.has(target) ? 0.85 : 0.06;
  });

  const panel = document.getElementById("details-panel");
  if (panel) {
    panel.innerHTML = names.length
      ? `
        <h4>${category} Nodes (${names.length})</h4>
        <ul>${names.map((item) => `<li>${item}</li>`).join("")}</ul>
      `
      : `<h4>${category} Nodes</h4><p class='muted'>No nodes found for this category.</p>`;
  }
}

function applyGraphFocusFilter(mode) {
  if (!mode) {
    resetGraphVisibility();
    return;
  }

  if (mode === "jobs") {
    const rels = new Set(["REQUIRES", "OFFERS"]);
    const visibleNodes = new Set();

    graphState.links.forEach((l) => {
      const source = l.source.id || l.source;
      const target = l.target.id || l.target;
      if (rels.has(l.type)) {
        visibleNodes.add(source);
        visibleNodes.add(target);
      }
    });

    graphState.link.style("opacity", (d) => (rels.has(d.type) ? 1 : 0.06));
    graphState.linkLabel.style("opacity", (d) => (rels.has(d.type) ? 1 : 0.06));
    graphState.node.style("opacity", (d) => (visibleNodes.has(d.id) ? 1 : 0.1));
    graphState.label.style("opacity", (d) => (visibleNodes.has(d.id) ? 1 : 0.1));
    return;
  }

  if (mode === "learning_path") {
    const rels = new Set(["HAS_SKILL", "INTERESTED_IN", "REQUIRES", "TEACHES", "OFFERS"]);
    const visibleNodes = new Set();

    graphState.links.forEach((l) => {
      const source = l.source.id || l.source;
      const target = l.target.id || l.target;
      if (rels.has(l.type)) {
        visibleNodes.add(source);
        visibleNodes.add(target);
      }
    });

    graphState.link.style("opacity", (d) => (rels.has(d.type) ? 0.95 : 0.05));
    graphState.linkLabel.style("opacity", (d) => (rels.has(d.type) ? 0.95 : 0.05));
    graphState.node.style("opacity", (d) => (visibleNodes.has(d.id) ? 1 : 0.1));
    graphState.label.style("opacity", (d) => (visibleNodes.has(d.id) ? 1 : 0.1));
    return;
  }

  if (mode === "missing_skills") {
    const sid = getSelectedStudentId();
    if (!sid) {
      alert("Select a Student node first to highlight missing skills.");
      const focus = document.getElementById("graphFocusFilter");
      if (focus) {
        focus.value = "";
      }
      resetGraphVisibility();
      return;
    }

    const studentNodeId = `Student:${sid}`;
    const owned = new Set();
    const required = new Set();

    graphState.links.forEach((l) => {
      const source = l.source.id || l.source;
      const target = l.target.id || l.target;

      if (l.type === "HAS_SKILL" && source === studentNodeId) {
        owned.add(target);
      }

      if (l.type === "INTERESTED_IN" && source === studentNodeId) {
        const jobId = target;
        graphState.links.forEach((inner) => {
          const innerSource = inner.source.id || inner.source;
          const innerTarget = inner.target.id || inner.target;
          if (inner.type === "REQUIRES" && innerSource === jobId) {
            required.add(innerTarget);
          }
        });
      }
    });

    const missing = new Set([...required].filter((x) => !owned.has(x)));
    const contextNodes = new Set([studentNodeId, ...owned, ...required]);

    graphState.node
      .style("opacity", (d) => (contextNodes.has(d.id) ? 1 : 0.08))
      .attr("stroke", (d) => (missing.has(d.id) ? "#b91c1c" : "#ffffff"))
      .attr("stroke-width", (d) => (missing.has(d.id) ? 3.2 : 1.5));

    graphState.label.style("opacity", (d) => (contextNodes.has(d.id) ? 1 : 0.08));
    graphState.link.style("opacity", (d) => {
      const source = d.source.id || d.source;
      const target = d.target.id || d.target;
      return contextNodes.has(source) && contextNodes.has(target) ? 1 : 0.06;
    });
    graphState.linkLabel.style("opacity", (d) => {
      const source = d.source.id || d.source;
      const target = d.target.id || d.target;
      return contextNodes.has(source) && contextNodes.has(target) ? 1 : 0.06;
    });

    const panel = document.getElementById("details-panel");
    if (panel) {
      const missingNames = [...missing]
        .map((id) => {
          const node = findGraphNodeById(id);
          return (node?.name || id).split(":").pop();
        })
        .filter(Boolean);

      panel.innerHTML = `
        <h4>Missing Skills</h4>
        <p><strong>Student:</strong> ${sid}</p>
        <p>${missingNames.length ? missingNames.join(", ") : "No missing skills for selected interests."}</p>
      `;
    }
  }
}

function highlightNodeByQuery(query) {
  const target = findNode(query);
  if (!target) {
    alert("Node not found");
    return;
  }

  const connected = new Set([target.id]);
  graphState.links.forEach((l) => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    if (s === target.id || t === target.id) {
      connected.add(s);
      connected.add(t);
    }
  });

  graphState.node
    .style("opacity", (d) => (connected.has(d.id) ? 1 : 0.12))
    .attr("stroke", (d) => (d.id === target.id ? "#111827" : "#ffffff"))
    .attr("stroke-width", (d) => (d.id === target.id ? 3 : 1.5));

  graphState.label.style("opacity", (d) => (connected.has(d.id) ? 1 : 0.12));

  graphState.link.style("opacity", (d) => {
    const s = d.source.id || d.source;
    const t = d.target.id || d.target;
    return connected.has(s) && connected.has(t) ? 1 : 0.08;
  });

  graphState.linkLabel.style("opacity", (d) => {
    const s = d.source.id || d.source;
    const t = d.target.id || d.target;
    return connected.has(s) && connected.has(t) ? 1 : 0.08;
  });
}

function applyRelationshipFilter(relType) {
  if (!relType) {
    resetGraphVisibility();
    return;
  }

  const connected = new Set();
  graphState.links.forEach((l) => {
    if (l.type === relType) {
      connected.add(l.source.id || l.source);
      connected.add(l.target.id || l.target);
    }
  });

  graphState.link.style("opacity", (d) => (d.type === relType ? 1 : 0.08));
  graphState.linkLabel.style("opacity", (d) => (d.type === relType ? 1 : 0.08));
  graphState.node.style("opacity", (d) => (connected.has(d.id) ? 1 : 0.12));
  graphState.label.style("opacity", (d) => (connected.has(d.id) ? 1 : 0.12));
}

async function renderNodeDetails(nodeData) {
  const panel = document.getElementById("details-panel");
  if (!panel) return;

  if (nodeData.label === "Student") {
    // Find jobs the student is interested in (INTERESTED_IN)
    const studentId = nodeData.id;
    const interestLinks = graphState.links.filter(l => l.type === "INTERESTED_IN" && (l.source.id || l.source) === studentId);
    const jobs = interestLinks.map(l => {
      const jobNode = graphState.nodes.find(n => n.id === (l.target.id || l.target));
      return jobNode ? jobNode : null;
    }).filter(Boolean);

    // For each job, find companies that offer it (OFFERS)
    let companiesByJob = [];
    jobs.forEach(jobNode => {
      const companyLinks = graphState.links.filter(l => l.type === "OFFERS" && (l.target.id || l.target) === jobNode.id);
      const companyNames = companyLinks.map(l => {
        const companyNode = graphState.nodes.find(n => n.id === (l.source.id || l.source));
        return companyNode ? companyNode.name : null;
      }).filter(Boolean);
      companiesByJob.push({ job: jobNode.name, companies: companyNames });
    });

    panel.innerHTML = `
      <h4>Student</h4>
      <p><strong>${(nodeData.name || nodeData.id).split(":").pop()}</strong></p>
      <h5>Interested Jobs</h5>
      <ul>${jobs.length ? jobs.map(j => `<li>${j.name}</li>`).join("") : "<li>None</li>"}</ul>
      <h5>Companies Offering These Jobs</h5>
      <ul>
        ${companiesByJob.length ? companiesByJob.map(j =>
          `<li><strong>${j.job}</strong>: ${j.companies.length ? j.companies.join(", ") : "No companies found"}</li>`
        ).join("") : "<li>None</li>"}
      </ul>
    `;
    return;
  }

  // Default: show relationships
  const related = [];
  graphState.links.forEach((l) => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    if (s === nodeData.id) {
      const targetName = (l.target.name || l.target.id || t).toString().split(":").pop();
      related.push(`${l.type} -> ${targetName}`);
    }
    if (t === nodeData.id) {
      const sourceName = (l.source.name || l.source.id || s).toString().split(":").pop();
      related.push(`${l.type} <- ${sourceName}`);
    }
  });
  const list = related.length
    ? `<ul>${related.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : "<p class='muted'>No connected relationships.</p>";
  panel.innerHTML = `
    <h4>${nodeData.label}</h4>
    <p><strong>${(nodeData.name || nodeData.id).split(":").pop()}</strong></p>
    ${list}
  `;
}

async function loadGraph() {
  resetGraphState();

  const container = document.getElementById("graph-container");
  if (!container) {
    return;
  }

  // Always clear previous render to avoid stacked SVG layers and frozen interactions.
  container.innerHTML = "";

  const width = Math.max(container.clientWidth, 760);
  const height = Math.max(container.clientHeight, 560);

  let data;
  try {
    data = await getGraph();
  } catch (err) {
    container.innerHTML = `
      <p class='error'>Unable to load graph: ${err.message}</p>
      <p class='muted'>Make sure Neo4j is running on bolt://localhost:7687, then refresh graph.</p>
    `;
    return;
  }

  if (!data.nodes || data.nodes.length === 0) {
    container.innerHTML = "<p class='muted'>No graph data found. Seed the database first.</p>";
    return;
  }

  const nodes = data.nodes.map((n) => ({ ...n }));
  const links = data.links.map((l) => ({ ...l }));

  const svg = d3
    .select(container)
    .append("svg")
    .attr("id", "graphSvg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g");

  const zoom = d3
    .zoom()
    .scaleExtent([0.35, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
  svg.call(zoom);

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(130))
    .force("charge", d3.forceManyBody().strength(-420))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius((d) => (d.label === "Student" ? 18 : 15)));

  const link = g
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#a1a1aa")
    .attr("stroke-width", 1.4)
    .attr("opacity", 0.85);

  const linkLabel = g
    .append("g")
    .selectAll("text")
    .data(links)
    .join("text")
    .text((d) => d.type)
    .attr("font-size", "10px")
    .attr("fill", "#334155")
    .attr("text-anchor", "middle")
    .attr("opacity", 0.9);

  const node = g
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", (d) => (d.label === "Student" ? 12 : 10))
    .attr("fill", (d) => NODE_COLORS[d.label] || "#64748b")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.5)
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

  const label = g
    .append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text((d) => (d.name || d.id).split(":").pop())
    .attr("font-size", "11px")
    .attr("text-anchor", "middle")
    .attr("fill", "#111827");

  node.on("click", async (event, d) => {
    event.stopPropagation();
    graphState.selectedNode = d;
    await renderNodeDetails(d);
  });

  svg.on("click", () => {
    const panel = document.getElementById("details-panel");
    if (panel) {
      panel.innerHTML = "Click a node to inspect its connections.";
    }
  });

  simulation.on("tick", () => {
    node
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y);

    label
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y + 18);

    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    linkLabel
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2);
  });

  graphState = {
    nodes,
    links,
    svg,
    g,
    simulation,
    node,
    link,
    label,
    linkLabel,
    zoom,
    selectedNode: null
  };
}

function formatCourseRows(courses) {
  if (!courses || courses.length === 0) {
    return "<p class='muted'>No course suggestions yet.</p>";
  }

  return `
    <ul>
      ${courses
        .map((c) => `<li><strong>${c.course}</strong>: ${(c.teaches || []).join(", ")}</li>`)
        .join("")}
    </ul>
  `;
}

function formatJobRows(jobs) {
  if (!jobs || jobs.length === 0) {
    return "<p class='muted'>No job matches available.</p>";
  }

  return `
    <ul>
      ${jobs
        .map(
          (j) => `<li><strong>${j.job}</strong> - ${j.score}% match (${j.matched_skills}/${j.required_skills.length})</li>`
        )
        .join("")}
    </ul>
  `;
}

function formatSimilarRows(items) {
  if (!items || items.length === 0) {
    return "<p class='muted'>No similar students found.</p>";
  }

  return `
    <ul>
      ${items
        .map(
          (s) => `<li><strong>${s.student_name}</strong> (${s.student_id}) - shared: ${(s.shared_skills || []).join(", ")}</li>`
        )
        .join("")}
    </ul>
  `;
}

function formatGapScore(score) {
  const value = Number(score || 0);
  const label = value >= 70 ? "High Gap" : value >= 40 ? "Medium Gap" : "Low Gap";
  return `${value}% (${label})`;
}

document.addEventListener("click", async (event) => {
  const navBtn = event.target.closest("[data-view]");
  if (navBtn) {
    render(navBtn.dataset.view);
    return;
  }

  const categoryBtn = event.target.closest("[data-node-category]");
  if (categoryBtn) {
    const relFilter = document.getElementById("relFilter");
    if (relFilter) {
      relFilter.value = "";
    }

    const graphFocusFilter = document.getElementById("graphFocusFilter");
    if (graphFocusFilter) {
      graphFocusFilter.value = "";
    }

    showNodesByCategory(categoryBtn.dataset.nodeCategory);
    return;
  }

  if (event.target.id === "submitStudent") {
    const sid = document.getElementById("sid")?.value;
    const name = document.getElementById("name")?.value;
    const degree = document.getElementById("degree")?.value;
    const skills = parseCsvList(document.getElementById("skills")?.value);
    const interests = parseCsvList(document.getElementById("interests")?.value);
    const notes = document.getElementById("notes")?.value;

    try {
      const result = await addStudent({ sid, name, degree, skills, interests, notes });
      setStatus("status", result.status || "Student added");
    } catch (err) {
      setStatus("status", err.message, false);
    }
    return;
  }

  if (event.target.id === "linkSkillBtn") {
    const sid = document.getElementById("linkSid")?.value;
    const skill = document.getElementById("linkSkill")?.value;

    try {
      const result = await linkStudentSkill({ sid, skill });
      setStatus("linkStatus", result.status || "Skill linked");
    } catch (err) {
      setStatus("linkStatus", err.message, false);
    }
    return;
  }

  if (event.target.id === "linkJobBtn") {
    const sid = document.getElementById("linkSid")?.value;
    const job = document.getElementById("linkJob")?.value;

    try {
      const result = await linkStudentInterest({ sid, job });
      setStatus("linkStatus", result.status || "Job interest linked");
    } catch (err) {
      setStatus("linkStatus", err.message, false);
    }
    return;
  }

  if (event.target.id === "fetchInsights") {
    const sid = document.getElementById("insightSid")?.value;
    const target = document.getElementById("insightResult");
    if (!target) {
      return;
    }

    target.innerHTML = "Loading insights...";

    try {
      const data = await getStudentInsights(sid);
      target.innerHTML = `
        <h4>${data.student_name} (${data.student_id})</h4>
        <p><strong>Degree:</strong> ${data.degree || "N/A"}</p>
        <p><strong>Current Skills:</strong> ${(data.current_skills || []).join(", ") || "None"}</p>
        <p><strong>Interested Jobs:</strong> ${(data.interested_jobs || []).join(", ") || "None"}</p>
      `;
    } catch (err) {
      target.innerHTML = `<p class='error'>${err.message}</p>`;
    }
    return;
  }

  if (event.target.id === "fetchRecommendations") {
    const sid = document.getElementById("recSid")?.value;
    const target = document.getElementById("recommendResult");
    if (!target) {
      return;
    }

    target.innerHTML = "Running recommendations...";

    try {
      const data = await getRecommendations(sid);
      target.innerHTML = `
        <h4>Recommendation Summary (${data.student_id})</h4>
        <p><strong>Current Skills:</strong> ${(data.current_skills || []).join(", ") || "None"}</p>
        <p><strong>Missing Skills:</strong> ${(data.missing_skills || []).join(", ") || "None"}</p>
        <p><strong>Skill Gap Score:</strong> ${formatGapScore(data.skill_gap_score)}</p>
        <h5>Courses for Missing Skills</h5>
        ${formatCourseRows(data.courses)}
        <h5>Best Job Matches</h5>
        ${formatJobRows(data.job_matches)}
      `;
    } catch (err) {
      target.innerHTML = `<p class='error'>${err.message}</p>`;
    }
    return;
  }

  if (event.target.id === "fetchSimilar") {
    const sid = document.getElementById("recSid")?.value;
    const target = document.getElementById("similarResult");
    if (!target) {
      return;
    }

    target.innerHTML = "Finding similar students...";

    try {
      const data = await getSimilarStudents(sid);
      target.innerHTML = `
        <h4>Similar Students</h4>
        ${formatSimilarRows(data.similar_students)}
      `;
    } catch (err) {
      target.innerHTML = `<p class='error'>${err.message}</p>`;
    }
    return;
  }

  if (event.target.id === "uploadCSV") {
    const file = document.getElementById("csvFile")?.files?.[0];
    if (!file) {
      setStatus("csvStatus", "Please select a CSV file", false);
      return;
    }

    try {
      const result = await importCsv(file);
      setStatus("csvStatus", `Imported ${result.rows || 0} rows successfully`);
    } catch (err) {
      setStatus("csvStatus", err.message, false);
    }
    return;
  }

  if (event.target.id === "refreshGraph") {
    loadGraph();
    return;
  }

  if (event.target.id === "findNode") {
    const value = document.getElementById("nodeSearch")?.value;
    if (!value) {
      return;
    }
    highlightNodeByQuery(value);
    return;
  }

  if (event.target.id === "resetFilterBtn") {
    const relFilter = document.getElementById("relFilter");
    if (relFilter) {
      relFilter.value = "";
    }
    const graphFocusFilter = document.getElementById("graphFocusFilter");
    if (graphFocusFilter) {
      graphFocusFilter.value = "";
    }
    const search = document.getElementById("nodeSearch");
    if (search) {
      search.value = "";
    }
    resetGraphVisibility();
    return;
  }

  if (event.target.id === "clearSearchBtn") {
    const search = document.getElementById("nodeSearch");
    if (search) {
      search.value = "";
    }
    resetGraphVisibility();
    return;
  }

  if (event.target.id === "resetViewBtn") {
    resetGraphView();
    return;
  }

  if (event.target.id === "cleanLayoutBtn") {
    cleanGraphLayout();
    return;
  }

  if (event.target.id === "clusterGraphBtn") {
    clusterGraphNodes();
    return;
  }

});

document.addEventListener("change", (event) => {
  if (event.target.id === "relFilter") {
    applyRelationshipFilter(event.target.value);
    return;
  }

  if (event.target.id === "graphFocusFilter") {
    applyGraphFocusFilter(event.target.value);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  render("dashboard");

  // If Graph View is shown, initialize Cytoscape
  document.addEventListener("click", (event) => {
    if (event.target.id === "btnGraph") {
      setTimeout(() => {
        if (document.getElementById("cy")) {
          renderCytoscapeGraph();
        }
      }, 100);
    }
  });
});

function renderCytoscapeGraph() {
  const cy = window.cytoscape({
    container: document.getElementById("cy"),
    elements: [
      // Sample nodes
      { data: { id: "S001", label: "Student", name: "S001" } },
      { data: { id: "S002", label: "Student", name: "S002" } },
      { data: { id: "React", label: "Skill", name: "React" } },
      { data: { id: "SQL", label: "Skill", name: "SQL" } },
      { data: { id: "Frontend Engineer", label: "Job", name: "Frontend Engineer" } },
      { data: { id: "React Bootcamp", label: "Course", name: "React Bootcamp" } },
      { data: { id: "Microsoft", label: "Company", name: "Microsoft" } },
      // Sample edges
      { data: { source: "S001", target: "React", label: "HAS_SKILL" } },
      { data: { source: "S001", target: "Frontend Engineer", label: "INTERESTED_IN" } },
      { data: { source: "Frontend Engineer", target: "React", label: "REQUIRES" } },
      { data: { source: "React Bootcamp", target: "React", label: "TEACHES" } },
      { data: { source: "Microsoft", target: "Frontend Engineer", label: "OFFERS" } },
    ],
    style: [
      {
        selector: 'node[label="Student"]',
        style: { 'background-color': '#16a34a', 'label': 'data(name)' }
      },
      {
        selector: 'node[label="Skill"]',
        style: { 'background-color': '#2563eb', 'label': 'data(name)' }
      },
      {
        selector: 'node[label="Course"]',
        style: { 'background-color': '#f97316', 'label': 'data(name)' }
      },
      {
        selector: 'node[label="Job"]',
        style: { 'background-color': '#dc2626', 'label': 'data(name)' }
      },
      {
        selector: 'node[label="Company"]',
        style: { 'background-color': '#7c3aed', 'label': 'data(name)' }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#a1a1aa',
          'target-arrow-color': '#a1a1aa',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'text-rotation': 'autorotate',
          'text-margin-y': -10
        }
      }
    ],
    layout: {
      name: 'cose',
      animate: true
    }
  });

  cy.on('tap', 'node', function(evt){
    const node = evt.target.data();
    const details = document.getElementById('node-details-content');
    if (details) {
      details.innerHTML = `<strong>${node.label}</strong>: ${node.name}`;
    }
  });

  cy.on('tap', function(evt){
    if(evt.target === cy) {
      const details = document.getElementById('node-details-content');
      if (details) details.innerHTML = 'Click a node to inspect its connections.';
    }
  });
}

function showResumeUpload(studentId = "") {
  app.innerHTML = resumeUploadView(studentId);
  document.getElementById("uploadResumeBtn").onclick = async () => {
    const sid = document.getElementById("resumeStudentId").value.trim();
    const fileInput = document.getElementById("resumeFile");
    const errorEl = document.getElementById("resumeError");
    const loadingEl = document.getElementById("resumeLoading");
    const resultsEl = document.getElementById("resumeResults");
    errorEl.textContent = "";
    resultsEl.innerHTML = "";
    if (!sid) {
      errorEl.textContent = "Student ID required";
      return;
    }
    if (!fileInput.files.length) {
      errorEl.textContent = "Please select a PDF or DOCX file.";
      return;
    }
    loadingEl.style.display = "block";
    try {
      const result = await uploadResume(sid, fileInput.files[0]);
      resultsEl.innerHTML = resumeResultsView(result);
    } catch (err) {
      errorEl.textContent = err.message || "Upload failed.";
    } finally {
      loadingEl.style.display = "none";
    }
  };
  document.querySelectorAll(".back-btn").forEach(btn => btn.onclick = () => renderView("dashboard"));
}

// Removed addResumeNavButton and its call. The button is now always present in HTML and handled by [data-view] navigation.
