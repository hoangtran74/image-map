/* ============================================================
   FULL JAVASCRIPT ENGINE — VERSION C2
   (No label decluttering, no collision avoidance)
   ============================================================ */

/* ---------------------------
   CONFIG
--------------------------- */
const MAP_IMAGE = "R3.jpg";

const latNorth =  89.5555;
const latSouth = -89.5555;
const lonWest  = -179.25;
const lonEast  = 180;

const MIN_SCALE = 0.8;
const MAX_SCALE = 12;

/* ---------------------------
   DOM REFERENCES
--------------------------- */
const container = document.getElementById("mapContainer");
const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const heatCanvas = document.getElementById("heatCanvas");
const heatCtx = heatCanvas.getContext("2d");

const miniMap = document.getElementById("miniMap");
const miniCtx = miniMap.getContext("2d");

const coordReadout = document.getElementById("coordReadout");

const filterCategory = document.getElementById("filterCategory");
const searchBox = document.getElementById("searchBox");

const markerForm = document.getElementById("markerForm");
const formTitle = document.getElementById("formTitle");
const formLat = document.getElementById("formLat");
const formLon = document.getElementById("formLon");
const formName = document.getElementById("formName");
const formDesc = document.getElementById("formDesc");
const formClass = document.getElementById("formClass");
const formIcon = document.getElementById("formIcon");
const formIconUpload = document.getElementById("formIconUpload");
const formSubmit = document.getElementById("formSubmit");
const formCancel = document.getElementById("formCancel");

const drawLineBtn = document.getElementById("drawLine");
const drawPolyBtn = document.getElementById("drawPoly");
const drawCircleBtn = document.getElementById("drawCircle");
const drawSelectBtn = document.getElementById("drawSelect");
const drawDeleteBtn = document.getElementById("drawDelete");

const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");

const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

/* ---------------------------
   STATE
--------------------------- */
let img = new Image();
img.src = MAP_IMAGE;

let W, H;

let scale = 1;
let originX = 0;
let originY = 0;

let isPanning = false;
let startX = 0;
let startY = 0;

const markers = [];
const shapes = [];

let drawingMode = null;
let drawPoints = [];

let editingMarker = null;
let pendingLat = null;
let pendingLon = null;

let selectedShapeIndex = null;
let editMode = false;
let hoverShapeIndex = null;
let loadOnce = false;

const categoryDefaultIcons = {
  city: "🏙️",
  military: "🛡️",
  naval: "⚓",
  airfield: "✈️",
  landmark: "🏰",
  alert: "❗",
  custom: "📍",
  default: "📍"
};


/* ---------------------------
   MARKERS
--------------------------- */
function addMarker(lat, lon, name, desc, cls, icon, id = null) {
  if (!icon || icon === "") {
    icon = categoryDefaultIcons[cls] || categoryDefaultIcons.default;
  }

  const marker = document.createElement("div");
  marker.className = "marker";

  marker.dataset.lat = lat;
  marker.dataset.lon = lon;
  marker.dataset.name = name;
  marker.dataset.desc = desc;
  marker.dataset.cls = cls;
  marker.dataset.icon = icon;
  marker.dataset.id = id || crypto.randomUUID();

  addmarkerLabel(marker,name);


  /* ---------------------------
     ICON
  --------------------------- */
  if (icon.startsWith("data:")) {
    marker.style.backgroundImage = `url(${icon})`;
    marker.style.backgroundSize = "contain";
    marker.style.backgroundRepeat = "no-repeat";
    marker.style.backgroundPosition = "center";
  } else {
    // Put icon in its own element so it doesn't overwrite the label
    const iconEl = document.createElement("div");
    iconEl.className = "marker-icon";
    iconEl.textContent = icon;
    marker.appendChild(iconEl);
  }

  /* ---------------------------
     EVENTS
  --------------------------- */
  marker.addEventListener("click", () => editMarker(marker));
  marker.addEventListener("dblclick", () => editMarker(marker));

  container.appendChild(marker);
  markers.push(marker);

  updateMarkers();
  refreshSidebar();
  processDescSystem(desc);
}

/* ---------------------------
     LABEL (name only)
  --------------------------- */
function addmarkerLabel(marker,name){
  const label = document.createElement("div");
  label.className = "marker-label";
  label.textContent = name;
  marker.appendChild(label);
  // store reference for zoom logic
  marker._labelEl = label;
}

function updateMarkers() {
  if (!W || !H) return;

  const baseSize = 12;   // stays constant
  const scaled = baseSize; // no scale applied

  markers.forEach(marker => {
    const lat = parseFloat(marker.dataset.lat);
    const lon = parseFloat(marker.dataset.lon);

    // Convert lat/lon → map pixel coordinates
    const { x, y } = latLonToPixel(lat, lon, W, H);

    // Convert map coords → screen coords
    const screenX = originX + x * scale;
    const screenY = originY + y * scale;

    // Position marker
    marker.style.left = screenX + "px";
    marker.style.top = screenY + "px";

    // Keep marker size constant
    marker.style.width = scaled + "px";
    marker.style.height = scaled + "px";
    marker.style.fontSize = (scaled * 0.8) + "px";

    // Optional: label shrinks as you zoom in
    const label = marker.querySelector(".marker-label");
    if (label) {
      label.style.fontSize = "12px";   // constant size
      label.style.top = "-18px";       // constant offset

    }
  });

}

/* ---------------------------
   SIDEBAR
--------------------------- */
function refreshSidebar() {
    const list = document.getElementById("markerList");
    list.innerHTML = "";

    const cat = filterCategory.value.trim().toLowerCase(); // normalize
    const q = searchBox.value.trim().toLowerCase(); // normalize


    markers.forEach(marker => {
        const cls = (marker.dataset.cls || "").trim().toLowerCase();
        const name = (marker.dataset.name || "").trim();
        const desc = (marker.dataset.desc || "").trim();
        const icon = marker.dataset.icon || "";

        // Check category match
        const matchesCategory = (cat === "all" || cat.includes(icon));


    // Function to check match
    const matchesSearch = (() => {
        if (!q) return true; // No search term means match all

        const lowerName = name.toLowerCase();
        const lowerDesc = desc.toLowerCase();
        const query = q.toLowerCase().trim();

        if (query.includes("&&")) {
            // AND logic: all terms must match
            const terms = query.split("&&").map(t => t.trim()).filter(Boolean);
            return terms.every(term =>
                lowerName.includes(term) || lowerDesc.includes(term)
            );
        }
        else if (query.includes("||")) {
            // OR logic: any term can match
            const terms = query.split("||").map(t => t.trim()).filter(Boolean);
            return terms.some(term =>
                lowerName.includes(term) || lowerDesc.includes(term)
            );
        }
        else {
            // Single term search
            return lowerName.includes(query) || lowerDesc.includes(query);
        }
    })();


        // Hide non-matching markers
        if (!matchesCategory || !matchesSearch) {
            marker.style.display = "none"; // For DOM markers
            return;
        }

        // Show matching markers
        marker.style.display = "";

        // Create sidebar item
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div class="marker-row">
            <div class="marker-info">
              <strong>${icon} ${name}</strong>
              <em>${cls}</em>
            </div>

            <div class="marker-actions">
              <button class="gotoBtn" title="Go">➡️</button>
              <button class="editBtn" title="Edit">✏️</button>
             <button class="delBtn" title="Delete">🗑️</button>
            </div>
          </div>
        `;


        // Go to marker
        item.querySelector(".gotoBtn").onclick = () => {
            const { x, y } = latLonToPixel(
                parseFloat(marker.dataset.lat),
                parseFloat(marker.dataset.lon),
                W, H
            );

            marker.querySelector(".marker-label").style.color = "red";
            setTimeout(() => {
                marker.querySelector(".marker-label").style.color = "white";
            }, 5000);


            const targetX = container.clientWidth / 2 - x * scale;
            const targetY = container.clientHeight / 2 - y * scale;

            animateTo(targetX, targetY, 600); // 600ms smooth pan
        };

        // Edit marker
        item.querySelector(".editBtn").onclick = () => editMarker(marker);

        // Delete marker
        item.querySelector(".delBtn").onclick = () => {
            marker.remove();
            const idx = markers.indexOf(marker);
            if (idx >= 0) markers.splice(idx, 1);
            refreshSidebar();
            render();
        };

        list.appendChild(item);
    });
}

// Smooth transition helper
function animateTo(targetX, targetY, duration = 600) {
    const startX = originX;
    const startY = originY;
    const startTime = performance.now();

    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);

        // Ease-out cubic (smooth and natural)
        const ease = 1 - Math.pow(1 - t, 3);

        originX = startX + (targetX - startX) * ease;
        originY = startY + (targetY - startY) * ease;

        render();

        if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

filterCategory.onchange = () => {
  refreshSidebar();
  render();
};

searchBox.oninput = () => {
  refreshSidebar();
  render();
};

/* ---------------------------
   MARKER FORM / EDIT
--------------------------- */
function editMarker(marker) {
  editingMarker = marker;

  formTitle.textContent = "Edit Marker";
  formLat.value = marker.dataset.lat;
  formLon.value = marker.dataset.lon;
  formName.value = marker.dataset.name;
  formDesc.value = marker.dataset.desc;
  formClass.value = marker.dataset.cls;
  formIcon.value = marker.dataset.icon.startsWith("data:") ? "" : marker.dataset.icon;
  formIconUpload.value = "";

  markerForm.style.display = "block";
}

function openMarkerForm(lat, lon) {
  editingMarker = null;

  formTitle.textContent = "Add Marker";
  pendingLat = lat;
  pendingLon = lon;

  formLat.value = lat.toFixed(6);
  formLon.value = lon.toFixed(6);

  formName.value = "";
  formDesc.value = "";
  formClass.value = "";
  formIcon.value = "";
  formIconUpload.value = "";

  markerForm.style.display = "block";
}

function closeMarkerForm() {
  markerForm.style.display = "none";
}

function finalizeMarker(icon) {
  const name = formName.value.trim();
  const desc = formDesc.value.trim();
  const cls  = formClass.value.trim();

  if (!icon || icon === "") {
    icon = categoryDefaultIcons[cls] || categoryDefaultIcons.default;
  }

  if (editingMarker) {
    editingMarker.dataset.name = name;
    editingMarker.dataset.desc = desc;
    editingMarker.dataset.cls  = cls;
    editingMarker.dataset.icon = icon;

    editingMarker.textContent = "";
    editingMarker.style.backgroundImage = "none";
    if (icon.startsWith("data:")) {
      editingMarker.style.backgroundImage = `url(${icon})`;
      editingMarker.style.backgroundSize = "contain";
      editingMarker.style.backgroundRepeat = "no-repeat";
      editingMarker.style.backgroundPosition = "center";
    } else {
      editingMarker.textContent = icon;
    }
    //not working
    const label = editingMarker.querySelector(".marker-label");
    if (label) label.textContent = name;
    addmarkerLabel(editingMarker,name);
    refreshSidebar();
  } else {
    addMarker(
      pendingLat,
      pendingLon,
      name,
      desc,
      cls,
      icon
    );
  }

  closeMarkerForm();
  render();
}

formSubmit.onclick = () => {
  const name = formName.value.trim();
  if (!name) {
    alert("Name is required");
    return;
  }

  let icon = formIcon.value;

  if (formIconUpload.files.length > 0) {
    const file = formIconUpload.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      icon = reader.result;
      finalizeMarker(icon);
    };

    reader.readAsDataURL(file);
    return;
  }

  finalizeMarker(icon);
};

formCancel.onclick = () => closeMarkerForm();

/* ---------------------------
   RENDER
--------------------------- */
function render() {
  if (!W || !H) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.drawImage(img, 0, 0);

  //drawCanvasGrid();
  drawShapes();
  updateMarkers();
  //clusterMarkers();
  declutterLabels();
  //renderHeatmap();
  renderMiniMap();
}


/* ---------------------------
   INIT
--------------------------- */
img.onload = () => {
  W = img.width;
  H = img.height;

  canvas.width = W;
  canvas.height = H;
  heatCanvas.width = W;
  heatCanvas.height = H;
  originX = 0;
  originY = 0;

  //Zoom
  scale = 5;
  //Center
  const { x, y } = latLonToPixel(
      parseFloat(37.631),
      parseFloat(-97.268),
      W, H
  );
  originX = container.clientWidth / 2 - x * scale;
  originY = container.clientHeight / 2 - y * scale;
  drawSelectBtn.style.visibility = "hidden";
  //drawPolyBtn.style.visibility = "hidden";
  drawDeleteBtn.style.visibility = "hidden";

  render();

};
