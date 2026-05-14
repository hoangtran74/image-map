/* ---------------------------
   COORDINATE CONVERSION
--------------------------- */
function pixelToLatLon(px, py, W, H) {
  const lon = lonWest + (px / W) * (lonEast - lonWest);
  const lat = latNorth - (py / H) * (latNorth - latSouth);
  return { lat, lon };
}

function latLonToPixel(lat, lon, W, H) {
  const x = ((lon - lonWest) / (lonEast - lonWest)) * W;
  const y = ((latNorth - lat) / (latNorth - latSouth)) * H;
  return { x, y };
}

function latLonToXY(lat, lon) {
  return {
    x: (lon % 360) * 10 + 100,
    y: (lat % 180) * -10 + 100
  };
}


/* ---------------------------
   DRAWING TOOLS
--------------------------- */
drawLineBtn.onclick = () => {
  drawingMode = "line";
  drawPoints = [];
  highlightDrawButton("drawLine");
};

drawPolyBtn.onclick = () => {
  drawingMode = "poly";
  drawPoints = [];
  highlightDrawButton("drawPoly");
};

drawCircleBtn.onclick = () => {
  drawingMode = "circle";
  drawPoints = [];
  highlightDrawButton("drawCircle");
};

drawSelectBtn.onclick = () => {
  drawingMode = null;
  drawPoints = [];
  highlightDrawButton("drawSelect");
  drawDeleteBtn.style.visibility = "visible";
  render();
};

drawDeleteBtn.onclick = () => {
  if (selectedShapeIndex !== null &&
    drawSelectBtn.classList == "draw-active" /* Prevent accidental deletion */
  ) {
    shapes.splice(selectedShapeIndex, 1);
    selectedShapeIndex = null;
    editMode = false;
    highlightDrawButton(null);
    if(!hasLineOrCircle(shapes)) {
     drawSelectBtn.style.visibility = "hidden";
    }
    drawDeleteBtn.style.visibility = "hidden";
    render();
  }
};

function hasLineOrCircle(shapes) {
  return Object.values(shapes).some(
    shape => shape.type === 'line' || shape.type === 'circle'
  );
}


/* ---------------------------
   DRAW TOOL HIGHLIGHT
--------------------------- */
function highlightDrawButton(activeId) {
  const buttons = [
    drawLineBtn,
    //drawPolyBtn,
    drawCircleBtn,
    drawSelectBtn
  ];

  buttons.forEach(btn => {
    if (btn.id === activeId) {
      btn.classList.add("draw-active");
    } else {
      btn.classList.remove("draw-active");
    }
  });
}

/* ---------------------------
   DRAWING CLICK HANDLER
--------------------------- */
let draggingPoint = null;

container.addEventListener("mousedown", e => {
  if (!editMode) return;

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const mapX = (mouseX - originX) / scale;
  const mapY = (mouseY - originY) / scale;

  const shape = shapes[selectedShapeIndex];

  // find nearest point
  shape.pts.forEach((pt, idx) => {
    if (Math.hypot(pt.x - mapX, pt.y - mapY) < 10 / scale) {
      draggingPoint = idx;
    }
  });
});

container.addEventListener("mousemove", e => {
  if (draggingPoint === null) return;

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const mapX = (mouseX - originX) / scale;
  const mapY = (mouseY - originY) / scale;

  shapes[selectedShapeIndex].pts[draggingPoint] = { x: mapX, y: mapY };
  render();
});

container.addEventListener("mouseup", () => {
  draggingPoint = null;
});

container.addEventListener("click", e => {
  if (drawingMode) return; // ignore while drawing

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const mapX = (mouseX - originX) / scale;
  const mapY = (mouseY - originY) / scale;

  selectedShapeIndex = findShapeAtPoint(mapX, mapY);
  editMode = selectedShapeIndex !== null;

  render();
});

container.addEventListener("dblclick", e => {
  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const mapX = (mouseX - originX) / scale;
  const mapY = (mouseY - originY) / scale;

  if (drawingMode) {
    drawPoints.push({ x: mapX, y: mapY });

    if (drawingMode === "line" && drawPoints.length === 2) {
      shapes.push({ type: "line", pts: [...drawPoints] });
      drawingMode = null;
      drawPoints = [];
      highlightDrawButton(null);
    }

    if (drawingMode === "circle" && drawPoints.length === 2) {
      shapes.push({ type: "circle", pts: [...drawPoints] });
      drawingMode = null;
      drawPoints = [];
      highlightDrawButton(null);
    }

    if (drawingMode === "poly" && drawPoints.length > 2 && e.detail === 2) {
      shapes.push({ type: "poly", pts: [...drawPoints] });
      drawingMode = null;
      drawPoints = [];
      highlightDrawButton(null);
    }
    drawSelectBtn.style.visibility = "visible";
    render();
    return;
  }

  const { lat, lon } = pixelToLatLon(mapX, mapY, W, H);
  openMarkerForm(lat, lon);
});

function isPointNearLine(px, py, a, b) {
  const dist = Math.abs((b.y - a.y)*px - (b.x - a.x)*py + b.x*a.y - b.y*a.x) /
               Math.hypot(b.y - a.y, b.x - a.x);
  return dist < 5 / scale;
}

function isPointInPolygon(p, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;

    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function findShapeAtPoint(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];

    if (s.type === "line") {
      if (isPointNearLine(x, y, s.pts[0], s.pts[1])) return i;
    }

    if (s.type === "circle") {
      const [c, r] = s.pts;
      const dist = Math.hypot(x - c.x, y - c.y);
      const radius = Math.hypot(r.x - c.x, r.y - c.y);
      if (Math.abs(dist - radius) < 5 / scale) return i;
    }
    /*
    if (s.type === "poly") {
      if (isPointInPolygon({ x, y }, s.pts)) return i;
    }
    */
  }
  return null;
}


/* ---------------------------
   PAN & MOUSE MOVE
--------------------------- */
container.addEventListener("mousedown", e => {
  if (drawingMode) return;
  isPanning = true;
  container.style.cursor = "grabbing";
  startX = e.clientX - originX;
  startY = e.clientY - originY;
});

window.addEventListener("mouseup", () => {
  isPanning = false;
  container.style.cursor = "grab";
});

window.addEventListener("mousemove", e => {
  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (isPanning) {
    originX = e.clientX - startX;
    originY = e.clientY - startY;
    render();
  } else if (drawingMode && drawPoints.length > 0) {
    const mapX = (mouseX - originX) / scale;
    const mapY = (mouseY - originY) / scale;

    render();

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, originX, originY);
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = "lime";

    const last = drawPoints[drawPoints.length - 1];

    if (drawingMode === "line" || drawingMode === "poly" ) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(mapX, mapY);
      ctx.stroke();
    }

    if (drawingMode === "circle" && drawPoints.length === 1) {
      const r = Math.hypot(mapX - last.x, mapY - last.y);
      ctx.beginPath();
      ctx.arc(last.x, last.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  const mapX = (mouseX - originX) / scale;
  const mapY = (mouseY - originY) / scale;

  if (W && H && mapX >= 0 && mapX <= W && mapY >= 0 && mapY <= H) {
    const { lat, lon } = pixelToLatLon(mapX, mapY, W, H);
    coordReadout.textContent = `Lat: ${lat.toFixed(4)} , Lon: ${lon.toFixed(4)}`;
  } else {
    coordReadout.textContent = "Lat: — , Lon: —";
  }
});

/* ---------------------------
   ZOOM
--------------------------- */
function zoomAt(mouseX, mouseY, zoomFactor) {
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));
  if (newScale === scale) return;

  const dx = mouseX - originX;
  const dy = mouseY - originY;

  originX = mouseX - (dx * newScale) / scale;
  originY = mouseY - (dy * newScale) / scale;

  scale = newScale;
  render();
}

container.addEventListener("wheel", e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
});


/* ---------------------------
   EXPORT / IMPORT
--------------------------- */
exportBtn.onclick = () => {
  const visibleMarkers = markers.reduce((acc, m) => {
    if (m.style.display !== "none") {
      acc.push({
        id:   m.dataset.id,
        lat:  parseFloat(m.dataset.lat),
        lon:  parseFloat(m.dataset.lon),
        name: m.dataset.name,
        desc: m.dataset.desc,
        cls:  m.dataset.cls,
        icon: m.dataset.icon
      });
    }
    return acc;
  }, []);

  const data = {
    markers: visibleMarkers,
    shapes: shapes
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "map_state.json";
  a.click();

  URL.revokeObjectURL(url);
};

importFile.onchange = function () {
  const files = Array.from(this.files);
  if (!files.length) return;

  // Clear existing map state
  //markers.forEach(m => m.remove());
  //markers.length = 0;
  //shapes.length = 0;

  let pending = files.length;

  files.forEach(file => {
    const reader = new FileReader();

    reader.onload = e => {
      const text = e.target.result;
      const name = file.name.toLowerCase();

      try {
        const data = JSON.parse(text);

        // --- GEOJSON ---
        if (name.endsWith(".geojson")) {
          loadGeoJSON(data);
        }

        // --- JSON (your map_state format) ---
        else if (name.endsWith(".json")) {
          if (data.markers) {
            data.markers.forEach(m => {
              addMarker(m.lat, m.lon, m.name, m.desc, m.cls, m.icon, m.id);
            });
          }

          if (data.shapes) {
            data.shapes.forEach(s => shapes.push(s));
            //drawSelectBtn.style.visibility = "hidden";
            //drawDeleteBtn.style.visibility = "hidden";
          }
        }
      } catch (err) {
        console.error("Error parsing file:", file.name, err);
      }

      // When all files are processed → refresh UI once
      pending--;
      if (pending === 0) {
        refreshSidebar();
        render();
      }
    };

    reader.readAsText(file);
  });
};


function loadGeoJSON(gj) {
  if (!gj || !gj.type) return;

  const features = gj.type === "FeatureCollection"
    ? gj.features
    : gj.type === "Feature"
      ? [gj]
      : [];

  features.forEach(f => {
    const geom = f.geometry;
    if (!geom) return;

    if (geom.type === "Polygon") {
      importPolygon(geom.coordinates[0]);
    }

    if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach(poly => importPolygon(poly[0]));
    }
  });
}

function importPolygon(ring) {
  const pts = ring.map(([lon, lat]) => {
    return latLonToPixel(lat, lon, W, H); // map-pixel coords
  });

  shapes.push({
    type: "poly",
    pts: closePolygon(pts)
  });
}

function closePolygon(pts) {
  const first = pts[0];
  const last  = pts[pts.length - 1];

  if (first.x !== last.x || first.y !== last.y) {
    pts.push({ x: first.x, y: first.y });
  }
  return pts;
}

/* ---------------------------
   GRID
--------------------------- */
function drawCanvasGrid() {
  ctx.lineWidth = 1 / scale;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.font = `${12 / scale}px sans-serif`;
  ctx.textBaseline = "top";

  // --- LONGITUDE LINES ---
  for (let lon = Math.ceil(lonWest / 10) * 10; lon <= lonEast; lon += 10) {
    const x = ((lon - lonWest) / (lonEast - lonWest)) * W;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();

    // Label formatting
    let label;
    if (lon === 0) label = "0°";
    else if (lon > 0) label = `${lon}°E`;
    else label = `${Math.abs(lon)}°W`;

    // Place label slightly above the map (atlas style)
    ctx.textAlign = "center";
    ctx.fillText(label, x, -14 / scale);
  }

  // --- LATITUDE LINES ---
  for (let lat = Math.ceil(latSouth / 10) * 10; lat <= latNorth; lat += 10) {
    const y = ((latNorth - lat) / (latNorth - latSouth)) * H;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();

    // Label formatting
    let label;
    if (lat === 0) label = "0°";
    else if (lat > 0) label = `${lat}°N`;
    else label = `${Math.abs(lat)}°S`;

    // Place label to the left of the map
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, -6 / scale, y);
  }
}



/* ---------------------------
   SHAPES
--------------------------- */
function drawShapes() {

  shapes.forEach((s, i) => {
    const isSelected = (i === selectedShapeIndex &&
      drawSelectBtn.classList == "draw-active" /* Prevent accidental deletion */
    );
    // --- Stroke + Fill Style ---
    ctx.lineWidth = isSelected ? 1 : 0.5;
    //ctx.lineWidth = isSelected ? 7 / scale : 5 / scale;
    ctx.strokeStyle = isSelected ? "red" : "cyan";
    ctx.fillStyle = isSelected
      ? "rgba(255,0,0,0.25)"
      : "rgba(0,255,255,0.2)";

    // --- Draw Shape ---
    if (s.type === "line") {
      const [a, b] = s.pts;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (s.type === "circle") {
      const [a, b] = s.pts;
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (s.type === "poly") {
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      s.pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    // --- Draw Edit Handles (Only When Selected + Editing) ---
    if (isSelected && editMode) {
      ctx.fillStyle = "blue";
      s.pts.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8 / scale, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
}

/* ---------------------------
   HEATMAP
--------------------------- */
function renderHeatmap() {
  if (!W || !H) return;

  heatCtx.setTransform(1, 0, 0, 1, 0, 0);
  heatCtx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);

  heatCtx.setTransform(scale, 0, 0, scale, originX, originY);

  markers.forEach(m => {

    //if(m.style.display != "none"){
    const lat = parseFloat(m.dataset.lat);
    const lon = parseFloat(m.dataset.lon);
    const { x, y } = latLonToPixel(lat, lon, W, H);

    const radius = 10;
    const gradient = heatCtx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, "rgba(255,0,0,0.6)");
    gradient.addColorStop(1, "rgba(255,0,0,0)");

    heatCtx.fillStyle = gradient;
    heatCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    //}
  });
}

/* ---------------------------
   MINIMAP
--------------------------- */
function renderMiniMap() {
  if (!W || !H) return;

  const mw = miniMap.width;
  const mh = miniMap.height;

  miniCtx.setTransform(1, 0, 0, 1, 0, 0);
  miniCtx.clearRect(0, 0, mw, mh);

  const scaleMini = Math.min(mw / W, mh / H);
  const offsetX = (mw - W * scaleMini) / 2;
  const offsetY = (mh - H * scaleMini) / 2;

  miniCtx.setTransform(scaleMini, 0, 0, scaleMini, offsetX, offsetY);
  miniCtx.drawImage(img, 0, 0);

  const invScale = 1 / scale;
  const viewX = -originX * invScale;
  const viewY = -originY * invScale;
  const viewW = container.clientWidth * invScale;
  const viewH = container.clientHeight * invScale;

  miniCtx.lineWidth = 2 / scaleMini;
  miniCtx.strokeStyle = "yellow";
  miniCtx.strokeRect(viewX, viewY, viewW, viewH);
}

/* ---------------------------
   CLUSTERING
--------------------------- */
function clusterMarkers() {
  if (scale > 1.5) {
    markers.forEach(m => {
      m.style.display = "block";
      const icon = m.dataset.icon || "";
      if (icon.startsWith("data:")) {
        m.textContent = "";
        m.style.backgroundImage = `url(${icon})`;
      } else {
        m.textContent = icon;
        m.style.backgroundImage = "none";
      }
    });
    return;
  }

  const gridSize = 80 / scale;
  const clusters = {};

  markers.forEach(marker => {
    const lat = parseFloat(marker.dataset.lat);
    const lon = parseFloat(marker.dataset.lon);
    const { x, y } = latLonToPixel(lat, lon, W, H);

    const gx = Math.floor(x / gridSize);
    const gy = Math.floor(y / gridSize);
    const key = gx + "_" + gy;

    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(marker);
  });

  markers.forEach(m => m.style.display = "none");

  Object.values(clusters).forEach(group => {
    const rep = group[0];
    rep.style.display = "block";

    if (group.length > 1) {
      rep.textContent = group.length;
      rep.style.backgroundImage = "none";
      rep.style.backgroundColor = "rgba(0,0,0,0.5)";
      rep.style.color = "white";
      rep.style.textAlign = "center";
      rep.style.border = "1px solid yellow";
      rep.style.borderRadius = "50%";

      const label = rep.querySelector(".marker-label");
      if (label) label.textContent = `${group.length} markers`;
    } else {

      const icon = rep.dataset.icon || "";
      if (icon.startsWith("data:")) {
        rep.textContent = "";
        rep.style.backgroundImage = `url(${icon})`;
        rep.style.backgroundColor = "none";
      } else {
        rep.textContent = icon;
        rep.style.backgroundImage = "none";
      }
      rep.style.border = "none";

      const label = rep.querySelector(".marker-label");
      if (label) label.textContent = rep.dataset.name;
    }
  });

}

/* ---------------------------------------------------------
   LABEL DECLUTTERING ENGINE
   Call after updateMarkers() and after every render()
--------------------------------------------------------- */

function declutterLabels() {
  const LABEL_SPACING = 4;   // minimum vertical gap between labels

  // Collect all visible labels with their bounding boxes
  const items = [];
  markers.forEach(marker => {
    const label = marker.querySelector(".marker-label");
    if (!label) return;

    const rect = label.getBoundingClientRect();
    items.push({
      marker,
      label,
      rect,
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
      offsetY: 0
    });
  });

  // Sort by Y so we resolve collisions top → bottom
  items.sort((a, b) => a.y - b.y);

  // Sweep and resolve overlaps
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];

    if (isOverlap(prev, curr)) {
      const needed = (prev.y + prev.h + LABEL_SPACING) - curr.y;
      curr.offsetY += needed;
      curr.y += needed;
    }
  }

  // Apply offsets
  items.forEach(item => {
    item.label.style.transform = `translateY(${item.offsetY}px)`;
  });
}

function isOverlap(a, b) {
  return !(
    b.x > a.x + a.w ||
    b.x + b.w < a.x ||
    b.y > a.y + a.h ||
    b.y + b.h < a.y
  );
}

/* ---------------------------------------------------------
   CHECK BOX FOR SMART SEARCH
   Call within AddMarkers()
--------------------------------------------------------- */
const checkboxContainer = document.getElementById("checkboxes");
const checkBoxObj = {}; // keeps track of created checkboxes

function processDescSystem(data) {
  if (!data.trim()) return;

  const rows = data
    .split("\n")
    .map(line => line.split(":")[1]?.trim())
    .filter(Boolean);

  const uniqueSystems = new Set();

  rows.forEach(text => {
    text.split(/\s+/).forEach(sys => {
      if (sys) uniqueSystems.add(sys);
    });
  });

  uniqueSystems.forEach(sys => {
    if (!checkBoxObj[sys]) createCheckBox(sys);
  });
}

function createCheckBox(value) {
  checkBoxObj[value] = true;

  const wrapper = document.createElement("div");
  wrapper.className = "checkbox-item";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = value;
 checkbox.addEventListener("change", (e) => checkBoxfilterList(value.toLowerCase(), e.target.checked));
  const text = document.createElement("span");
  text.textContent = value;
  wrapper.appendChild(checkbox);
  wrapper.appendChild(text);
  checkboxContainer.appendChild(wrapper);
}

function checkBoxfilterList(value, isChecked) {
  let parts = searchBox.value.split("&&").filter(Boolean);

  if (isChecked) {
    // ADD value if not already present
    if (!parts.includes(value)) {
      parts.push(value);
    }
  } else {
    // REMOVE value
    parts = parts.filter(v => v !== value);
  }

  // Rebuild search box string
  searchBox.value = parts.join("&&");

  searchBox.dispatchEvent(new Event("input"));
}
