/* Know Your Block — interactive web demo
 *
 * Mirrors the app's core loop in the browser: walk a stylized Bold & Civic map,
 * get a proximity notification when you reach an honorary street, open the sign,
 * read the story, and stamp it as visited.
 *
 * Demo-only deviations from the shipping app (all deliberate):
 *  - Real NYC coordinates are compressed around their centroid (WORLD_SCALE) so all
 *    seven honorees sit in one walkable demo world. Relative bearings are preserved,
 *    and each sign is nudged onto the nearest street line so it stands on a corner.
 *  - The map is a procedurally drawn street grid in the app's palette, not Mapbox.
 *  - A visit un-stamps itself DEMO_RESET_MS after you close the story, so the next
 *    person at the kiosk can stamp the same sign.
 */
(function () {
  "use strict";

  var STREETS = window.KYB_STREETS || [];

  // ---- tuning ------------------------------------------------------------
  var COLLECT_RADIUS_M = 40;      // GameConstants.defaultCollectRadiusMeters
  var REARM_RADIUS_M = 58;        // hysteresis before a street can re-notify
  var DEMO_RESET_MS = 10000;      // visits reset 10s after leaving the story
  var WORLD_SCALE = 0.1;          // real metres -> demo metres
  var BASE_PX_PER_M = 2.6;        // roughly the app's zoom-16 feel
  var baseScale = BASE_PX_PER_M;  // viewport-derived scale, before user zoom
  var PX_PER_M = BASE_PX_PER_M;   // baseScale x zoom
  var uiScale = 1;                // sign and puck size track the screen size
  var zoom = 1;
  var MIN_ZOOM = 0.13;            // far enough out to fit all seven on screen at once
  var MAX_ZOOM = 1.6;
  var WALK_M_PER_S = 115;         // demo-world walking speed
  var GRID_ANGLE = -29 * Math.PI / 180; // Brooklyn's street grid rotation
  var MINOR_SPACING = 64;
  var MAJOR_EVERY = 5;
  var STRIDE_S = 0.62;            // one full walk cycle

  var C = {
    paper: "#f4efe4", olive: "#c4c19f", teal: "#9fb6ad",
    roadMinor: "#e7e0d0", roadMajor: "#d8cbac", casing: "#ded3ba",
    red: "#c0392b"
  };

  // ---- elements ----------------------------------------------------------
  var screenEl = document.getElementById("screen");
  var canvas = document.getElementById("map");
  var ctx = canvas.getContext("2d");
  var pinLayer = document.getElementById("pinLayer");
  var puckEl = document.getElementById("puck");
  var counterEl = document.getElementById("counter");
  var hintEl = document.getElementById("hint");
  var toastEl = document.getElementById("toast");
  var notifEl = document.getElementById("notif");
  var notifTitleEl = document.getElementById("notifTitle");
  var peekEl = document.getElementById("peek");
  var peekArrowEl = document.getElementById("peekArrow");
  var peekNameEl = document.getElementById("peekName");
  var peekDistEl = document.getElementById("peekDist");
  var scrimEl = document.getElementById("scrim");
  var sheetEl = document.getElementById("sheet");
  var sheetScrollEl = document.getElementById("sheetScroll");
  var heroEl = document.getElementById("hero");
  var recordEl = document.getElementById("record");
  var collectAreaEl = document.getElementById("collectArea");
  var storyEl = document.getElementById("story");
  var linksAreaEl = document.getElementById("linksArea");
  var sheetNameEl = document.getElementById("sheetName");
  var zoomInBtn = document.getElementById("zoomIn");
  var zoomOutBtn = document.getElementById("zoomOut");

  // ---- world model -------------------------------------------------------
  var lat0 = 0, lng0 = 0;
  STREETS.forEach(function (s) { lat0 += s.location.lat; lng0 += s.location.lng; });
  lat0 /= STREETS.length; lng0 /= STREETS.length;
  var M_PER_DEG_LAT = 111320;
  var M_PER_DEG_LNG = 111320 * Math.cos(lat0 * Math.PI / 180);

  var places = STREETS.map(function (s) {
    return {
      data: s,
      x: (s.location.lng - lng0) * M_PER_DEG_LNG * WORLD_SCALE,
      y: (lat0 - s.location.lat) * M_PER_DEG_LAT * WORLD_SCALE, // +y = south = screen down
      el: null, signEl: null,
      collected: false, collectedAt: null,
      armed: true, resetTimer: null
    };
  });

  var byId = {};
  places.forEach(function (p) { byId[p.data.id] = p; });

  var view = { w: 0, h: 0 };
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // ---- geometry helpers --------------------------------------------------
  var COS_G = Math.cos(GRID_ANGLE), SIN_G = Math.sin(GRID_ANGLE);
  function toGrid(x, y) { return { u: x * COS_G + y * SIN_G, v: -x * SIN_G + y * COS_G }; }
  function fromGrid(u, v) { return { x: u * COS_G - v * SIN_G, y: u * SIN_G + v * COS_G }; }
  function snap(n) { return Math.round(n / MINOR_SPACING) * MINOR_SPACING; }
  function onLine(n) { return Math.abs(n - snap(n)) < 0.75; }

  // Nudge each sign onto the nearer of its two street lines, so it stands on a real
  // street the walker can reach rather than mid-block.
  places.forEach(function (p) {
    var g = toGrid(p.x, p.y);
    if (Math.abs(g.u - snap(g.u)) <= Math.abs(g.v - snap(g.v))) {
      g.u = snap(g.u);
      p.axis = "u"; // stands on a constant-u street
    } else {
      g.v = snap(g.v);
      p.axis = "v";
    }
    p.gu = g.u; p.gv = g.v;
    var w = fromGrid(g.u, g.v);
    p.x = w.x; p.y = w.y;
  });

  var start = places[0]; // Shirley Chisholm Place
  var startG = start.axis === "u"
    ? { u: start.gu, v: start.gv + 110 }
    : { u: start.gu + 110, v: start.gv };
  var startW = fromGrid(startG.u, startG.v);
  var puck = { x: startW.x, y: startW.y, heading: -Math.PI / 2, moving: false };
  var route = [];
  var cam = { x: puck.x, y: puck.y, follow: true };

  function screenX(wx) { return (wx - cam.x) * PX_PER_M + view.w / 2; }
  function screenY(wy) { return (wy - cam.y) * PX_PER_M + view.h / 2; }
  function worldX(sx) { return (sx - view.w / 2) / PX_PER_M + cam.x; }
  function worldY(sy) { return (sy - view.h / 2) / PX_PER_M + cam.y; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  // The demo world is compressed, so distances are reported in demo metres —
  // the same scale the 40 m collect radius is expressed in.
  function formatDistance(m) {
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
  }

  // ---- background scenery (fixed, in grid space) -------------------------
  var vMin = Math.min.apply(null, places.map(function (p) { return p.gv; }));
  var vMax = Math.max.apply(null, places.map(function (p) { return p.gv; }));
  var RIVER_V = vMin - 340;
  var RIVER_HALF = 70;
  // Parks fill whole blocks, inset to the kerb, so streets frame them rather than cross them.
  var PARKS = [
    { u: -430, v: (vMin + vMax) / 2 - 90, w: 300, h: 190 },
    { u: 470, v: (vMin + vMax) / 2 + 210, w: 250, h: 230 },
    { u: 60, v: vMax + 300, w: 380, h: 170 }
  ].map(function (p) {
    var inset = 5;
    return {
      u0: snap(p.u - p.w / 2) + inset, u1: snap(p.u + p.w / 2) - inset,
      v0: snap(p.v - p.h / 2) + inset, v1: snap(p.v + p.h / 2) - inset
    };
  });

  // ---- canvas rendering --------------------------------------------------
  function resize() {
    view.w = screenEl.clientWidth;
    view.h = screenEl.clientHeight;
    // One scale factor drives sign and puck size, so a phone, a laptop and a wall-sized
    // touch table all render legible chrome; zoom follows it at half strength so bigger
    // screens also reveal more of the neighbourhood.
    uiScale = Math.max(0.9, Math.min(1.5, Math.min(view.w, view.h) / 460));
    baseScale = BASE_PX_PER_M * (1 + (uiScale - 1) * 0.5);
    PX_PER_M = baseScale * zoom;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Signs and the walker shrink as you pull back, but never past legibility. */
  function markerScale() {
    return uiScale * Math.max(0.32, Math.min(1.15, zoom));
  }

  /** Zoom about a screen point, keeping the world under it pinned in place. */
  function setZoom(next, anchorX, anchorY) {
    var clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (clamped === zoom) return;
    var ax = anchorX === undefined ? view.w / 2 : anchorX;
    var ay = anchorY === undefined ? view.h / 2 : anchorY;
    var wx = worldX(ax), wy = worldY(ay);
    zoom = clamped;
    PX_PER_M = baseScale * zoom;
    cam.x = wx - (ax - view.w / 2) / PX_PER_M;
    cam.y = wy - (ay - view.h / 2) / PX_PER_M;
    zoomOutBtn.disabled = zoom <= MIN_ZOOM + 0.001;
    zoomInBtn.disabled = zoom >= MAX_ZOOM - 0.001;
  }

  function visibleGridBounds() {
    var pad = 200;
    var corners = [
      [worldX(-pad), worldY(-pad)],
      [worldX(view.w + pad), worldY(-pad)],
      [worldX(view.w + pad), worldY(view.h + pad)],
      [worldX(-pad), worldY(view.h + pad)]
    ].map(function (c) { return toGrid(c[0], c[1]); });
    return {
      uMin: Math.min.apply(null, corners.map(function (c) { return c.u; })),
      uMax: Math.max.apply(null, corners.map(function (c) { return c.u; })),
      vMin: Math.min.apply(null, corners.map(function (c) { return c.v; })),
      vMax: Math.max.apply(null, corners.map(function (c) { return c.v; }))
    };
  }

  function gridLine(uOrV, from, to, isU) {
    var a = isU ? fromGrid(uOrV, from) : fromGrid(from, uOrV);
    var b = isU ? fromGrid(uOrV, to) : fromGrid(to, uOrV);
    ctx.moveTo(screenX(a.x), screenY(a.y));
    ctx.lineTo(screenX(b.x), screenY(b.y));
  }

  function strokeGrid(bounds, spacing, everyNth, width, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    var i, k;
    for (i = Math.floor(bounds.uMin / spacing); i <= Math.ceil(bounds.uMax / spacing); i++) {
      if (everyNth && (((i % everyNth) + everyNth) % everyNth) !== 0) continue;
      gridLine(i * spacing, bounds.vMin, bounds.vMax, true);
    }
    for (k = Math.floor(bounds.vMin / spacing); k <= Math.ceil(bounds.vMax / spacing); k++) {
      if (everyNth && (((k % everyNth) + everyNth) % everyNth) !== 0) continue;
      gridLine(k * spacing, bounds.uMin, bounds.uMax, false);
    }
    ctx.stroke();
  }

  function fillGridRect(p, color) {
    var pts = [
      fromGrid(p.u0, p.v0),
      fromGrid(p.u1, p.v0),
      fromGrid(p.u1, p.v1),
      fromGrid(p.u0, p.v1)
    ];
    ctx.beginPath();
    pts.forEach(function (pt, i) {
      var sx = screenX(pt.x), sy = screenY(pt.y);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawRiver(bounds) {
    var step = 60;
    ctx.beginPath();
    var u;
    for (u = bounds.uMin - step; u <= bounds.uMax + step; u += step) {
      var v = RIVER_V + Math.sin(u / 420) * 90 - RIVER_HALF;
      var pt = fromGrid(u, v);
      ctx.lineTo(screenX(pt.x), screenY(pt.y));
    }
    for (u = bounds.uMax + step; u >= bounds.uMin - step; u -= step) {
      var v2 = RIVER_V + Math.sin(u / 420) * 90 + RIVER_HALF;
      var pt2 = fromGrid(u, v2);
      ctx.lineTo(screenX(pt2.x), screenY(pt2.y));
    }
    ctx.closePath();
    ctx.fillStyle = C.teal;
    ctx.fill();
  }

  function drawMap() {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, view.w, view.h);

    var b = visibleGridBounds();
    drawRiver(b);

    // road casings, then the road surfaces on top
    ctx.lineCap = "butt";
    var rw = PX_PER_M / BASE_PX_PER_M; // roads keep a constant real-world width
    strokeGrid(b, MINOR_SPACING, 0, 9 * rw, C.casing);
    strokeGrid(b, MINOR_SPACING, 0, 7 * rw, C.roadMinor);
    strokeGrid(b, MINOR_SPACING, MAJOR_EVERY, 20 * rw, C.casing);
    strokeGrid(b, MINOR_SPACING, MAJOR_EVERY, 17 * rw, C.roadMajor);

    PARKS.forEach(function (p) { fillGridRect(p, C.olive); });

    // collect-radius halos for streets you haven't stamped yet
    places.forEach(function (p) {
      if (p.collected) return;
      var d = dist(puck.x, puck.y, p.x, p.y);
      var inRange = d <= COLLECT_RADIUS_M;
      ctx.beginPath();
      ctx.arc(screenX(p.x), screenY(p.y), COLLECT_RADIUS_M * PX_PER_M, 0, Math.PI * 2);
      ctx.setLineDash(inRange ? [] : [7, 7]);
      ctx.lineWidth = inRange ? 2.5 : 1.5;
      ctx.strokeStyle = inRange ? "rgba(192,57,43,0.75)" : "rgba(192,57,43,0.28)";
      if (inRange) { ctx.fillStyle = "rgba(192,57,43,0.07)"; ctx.fill(); }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // ---- street sign component --------------------------------------------
  function buildSign(street, plateSize, badgeSize, collected) {
    var sign = document.createElement("div");
    sign.className = "sign" + (collected ? "" : " locked");

    var plate = document.createElement("div");
    plate.className = "sign-plate";
    plate.style.width = (plateSize * 1.9) + "px";
    plate.style.height = plateSize + "px";
    plate.style.borderRadius = (plateSize * 0.14) + "px";

    var name = document.createElement("div");
    name.className = "sign-name";
    name.textContent = street.honoraryName;
    name.style.fontSize = (plateSize * (plateSize <= 70 ? 0.2 : 0.15)) + "px";
    plate.appendChild(name);

    var wrap = document.createElement("div");
    wrap.className = "sign-badge-wrap";
    wrap.style.transform = "translate(" + (badgeSize * 0.28) + "px," + (badgeSize * 0.28) + "px)";

    var badge = document.createElement("img");
    badge.className = "sign-badge";
    badge.src = "assets/badges/" + street.faceImage + ".jpg";
    badge.alt = "";
    badge.style.width = badge.style.height = badgeSize + "px";
    sign.style.setProperty("--badge-ring", Math.max(1.5, badgeSize * 0.06) + "px");
    wrap.appendChild(badge);

    sign.appendChild(plate);
    sign.appendChild(wrap);
    return sign;
  }

  function buildPin(place) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pin pulsing";
    btn.setAttribute("aria-label", place.data.honoraryName + " — open story");

    var sign = buildSign(place.data, 56, 22, false);
    var pole = document.createElement("div");
    pole.className = "pole";
    var shadow = document.createElement("div");
    shadow.className = "pole-shadow";

    btn.appendChild(sign);
    btn.appendChild(pole);
    btn.appendChild(shadow);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openStreet(place.data.id);
    });

    place.el = btn;
    place.signEl = sign;
    pinLayer.appendChild(btn);
  }

  places.forEach(buildPin);

  function refreshPin(place) {
    place.signEl.classList.toggle("locked", !place.collected);
    place.el.classList.toggle("pulsing", !place.collected);
  }

  // ---- walking -----------------------------------------------------------
  // The walker never cuts across a block: routes are built in grid space as a chain of
  // segments that each run along one street, turning only at intersections.

  /** Nearest point on the street grid to an arbitrary spot, plus the street it lies on. */
  function snapToStreet(g) {
    return Math.abs(g.u - snap(g.u)) <= Math.abs(g.v - snap(g.v))
      ? { u: snap(g.u), v: g.v, axis: "u" }
      : { u: g.u, v: snap(g.v), axis: "v" };
  }

  /** Waypoints from a start on street `axis` to `dest`, turning only at corners. */
  function legsFrom(from, axis, dest) {
    var pts = [];
    if (axis === "u") {
      if (dest.axis === "v") {
        pts.push({ u: from.u, v: dest.v });   // walk this street to the cross street
        pts.push({ u: dest.u, v: dest.v });   // then along the cross street
      } else if (Math.abs(dest.u - from.u) < 0.75) {
        pts.push({ u: dest.u, v: dest.v });   // same street the whole way
      } else {
        var crossV = snap(dest.v);
        pts.push({ u: from.u, v: crossV });
        pts.push({ u: dest.u, v: crossV });
        pts.push({ u: dest.u, v: dest.v });
      }
    } else {
      if (dest.axis === "u") {
        pts.push({ u: dest.u, v: from.v });
        pts.push({ u: dest.u, v: dest.v });
      } else if (Math.abs(dest.v - from.v) < 0.75) {
        pts.push({ u: dest.u, v: dest.v });
      } else {
        var crossU = snap(dest.u);
        pts.push({ u: crossU, v: from.v });
        pts.push({ u: crossU, v: dest.v });
        pts.push({ u: dest.u, v: dest.v });
      }
    }
    return pts;
  }

  function routeLength(from, pts) {
    var total = 0, prev = from;
    pts.forEach(function (p) { total += Math.hypot(p.u - prev.u, p.v - prev.v); prev = p; });
    return total;
  }

  function walkTo(x, y) {
    var from = toGrid(puck.x, puck.y);
    var dest = snapToStreet(toGrid(x, y));

    // The walker is always on at least one street; at a corner, take the shorter route.
    var options = [];
    if (onLine(from.u)) options.push(legsFrom(from, "u", dest));
    if (onLine(from.v)) options.push(legsFrom(from, "v", dest));
    if (!options.length) options.push(legsFrom(from, "u", dest)); // safety net

    var best = options.reduce(function (a, b) {
      return routeLength(from, b) < routeLength(from, a) ? b : a;
    });

    route = best
      .map(function (p) { return fromGrid(p.u, p.v); })
      .filter(function (p, i, arr) {
        var prev = i === 0 ? puck : arr[i - 1];
        return dist(prev.x, prev.y, p.x, p.y) > 0.5;
      });
    cam.follow = false;
  }

  function stepWalk(dt) {
    if (!route.length) {
      if (puck.moving) { puck.moving = false; puckEl.classList.remove("walking"); }
      return;
    }
    var budget = WALK_M_PER_S * dt;
    while (budget > 0 && route.length) {
      var next = route[0];
      var dx = next.x - puck.x, dy = next.y - puck.y;
      var d = Math.hypot(dx, dy);
      if (d <= budget) {
        puck.x = next.x; puck.y = next.y;
        budget -= d;
        route.shift();
      } else {
        puck.x += dx / d * budget;
        puck.y += dy / d * budget;
        budget = 0;
      }
      if (d > 0.001) puck.heading = Math.atan2(dy, dx);
    }
    if (!route.length) cam.follow = true;

    if (!puck.moving) { puck.moving = true; puckEl.classList.add("walking"); }
    puckEl.classList.toggle("flip", Math.cos(puck.heading) < 0);
  }

  // ---- proximity + notification -----------------------------------------
  var notifTimer = null;
  var notifStreetId = null;

  function showNotification(place) {
    notifStreetId = place.data.id;
    notifTitleEl.textContent = "You're near " + place.data.honoraryName;
    notifEl.classList.add("show");
    clearTimeout(notifTimer);
    notifTimer = setTimeout(hideNotification, 5200);
  }
  function hideNotification() {
    notifEl.classList.remove("show");
    clearTimeout(notifTimer);
  }
  notifEl.addEventListener("click", function () {
    if (notifStreetId) openStreet(notifStreetId);
    hideNotification();
  });
  notifEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); notifEl.click(); }
  });

  function updateProximity() {
    var nearest = null, nearestD = Infinity;
    places.forEach(function (p) {
      var d = dist(puck.x, puck.y, p.x, p.y);
      p.distance = d;
      p.inRange = d <= COLLECT_RADIUS_M;

      if (!p.collected) {
        if (d > REARM_RADIUS_M) p.armed = true;
        else if (p.inRange && p.armed && !sheetOpen) {
          p.armed = false;
          showNotification(p);
        }
        if (d < nearestD) { nearestD = d; nearest = p; }
      }
    });

    if (nearest) {
      peekEl.hidden = false;
      peekNameEl.textContent = nearest.data.honoraryName;
      peekDistEl.textContent = nearest.inRange
        ? "In range — tap the sign to visit"
        : formatDistance(nearestD) + " away";
      peekEl.classList.toggle("in-range", nearest.inRange);
      var ang = Math.atan2(nearest.y - puck.y, nearest.x - puck.x) + Math.PI / 2;
      peekArrowEl.style.transform = "rotate(" + ang + "rad)";
    } else {
      peekEl.hidden = false;
      peekNameEl.textContent = "All seven collected";
      peekDistEl.textContent = "Visits reset shortly after you close a story";
      peekEl.classList.remove("in-range");
      peekArrowEl.style.transform = "rotate(0rad)";
    }

    if (sheetOpen && currentPlace) refreshCollectArea(currentPlace);
  }

  // ---- render loop -------------------------------------------------------
  var lastFrame = 0;
  function frame(now) {
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now;

    stepWalk(dt);
    if (cam.follow) {
      cam.x += (puck.x - cam.x) * Math.min(1, dt * 6);
      cam.y += (puck.y - cam.y) * Math.min(1, dt * 6);
    }

    drawMap();

    var ms = markerScale();
    places.forEach(function (p) {
      p.el.style.transform = "translate3d(" + screenX(p.x) + "px," + screenY(p.y) + "px,0)" +
        " translate(-50%,-100%) scale(" + ms + ")";
    });
    puckEl.style.transform = "translate3d(" + screenX(puck.x) + "px," + screenY(puck.y) + "px,0)" +
      " translate(-50%,-50%) scale(" + ms + ")";

    updateProximity();
    requestAnimationFrame(frame);
  }

  // ---- map gestures ------------------------------------------------------
  var drag = null;
  var pointers = {};      // live pointers on the map, for pinch
  var pinch = null;

  function localPoint(e) {
    var rect = screenEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function activePointers() {
    return Object.keys(pointers).map(function (k) { return pointers[k]; });
  }

  function beginPinch() {
    var pts = activePointers();
    pinch = {
      startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      startZoom: zoom
    };
    // Clearing the drag is what stops a pinch from also being read as a swipe or tap:
    // every pointer still down belongs to the pinch, and none of them can start a walk.
    drag = null;
    screenEl.classList.remove("dragging");
  }

  screenEl.addEventListener("pointerdown", function (e) {
    if (sheetOpen) return;
    if (e.target.closest(".pin, .notif, .sheet, .topbar, .zoom-controls")) return;
    pointers[e.pointerId] = localPoint(e);
    screenEl.setPointerCapture(e.pointerId);

    if (activePointers().length === 2) {
      beginPinch();
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    screenEl.classList.add("dragging");
  });

  screenEl.addEventListener("pointermove", function (e) {
    if (!(e.pointerId in pointers)) return;
    pointers[e.pointerId] = localPoint(e);
    hintEl.classList.add("gone");

    if (pinch) {
      var pts = activePointers();
      if (pts.length < 2) return;
      var mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      cam.follow = false;
      setZoom(pinch.startZoom * (d / pinch.startDist), mid.x, mid.y);
      return;
    }

    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.hypot(dx, dy);
    drag.x = e.clientX; drag.y = e.clientY;
    cam.follow = false;
    cam.x -= dx / PX_PER_M;
    cam.y -= dy / PX_PER_M;
  });

  function endDrag(e) {
    delete pointers[e.pointerId];

    if (pinch) {
      if (activePointers().length < 2) pinch = null;
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;

    if (drag.moved > 8) {
      // Swiped the map: the walker sets off for wherever you swiped to.
      walkTo(cam.x, cam.y);
    } else {
      // Tapped a spot: walk straight there.
      var p = localPoint(e);
      walkTo(worldX(p.x), worldY(p.y));
      hintEl.classList.add("gone");
    }
    drag = null;
    screenEl.classList.remove("dragging");
  }
  screenEl.addEventListener("pointerup", endDrag);
  screenEl.addEventListener("pointercancel", endDrag);

  screenEl.addEventListener("wheel", function (e) {
    if (sheetOpen) return;
    e.preventDefault();
    var p = localPoint(e);
    cam.follow = false;
    setZoom(zoom * Math.exp(-e.deltaY * 0.0016), p.x, p.y);
    hintEl.classList.add("gone");
  }, { passive: false });

  zoomInBtn.addEventListener("click", function () { setZoom(zoom * 1.35); });
  zoomOutBtn.addEventListener("click", function () { setZoom(zoom / 1.35); });

  document.addEventListener("keydown", function (e) {
    if (sheetOpen) {
      if (e.key === "Escape") closeSheet();
      return;
    }
    if (e.key === "+" || e.key === "=") { setZoom(zoom * 1.35); return; }
    if (e.key === "-" || e.key === "_") { setZoom(zoom / 1.35); return; }
    var step = MINOR_SPACING;
    var d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    walkTo(puck.x + d[0], puck.y + d[1]);
    hintEl.classList.add("gone");
  });

  // ---- story sheet -------------------------------------------------------
  var sheetOpen = false;
  var currentPlace = null;

  function recordRow(label, value, cls) {
    var row = document.createElement("div");
    row.className = "record-row";
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value;
    if (cls) dd.className = cls;
    row.appendChild(dt);
    row.appendChild(dd);
    return row;
  }

  function renderRecord(place) {
    var s = place.data;
    recordEl.innerHTML = "";
    recordEl.appendChild(recordRow("Location", s.neighborhood + " · " + s.location.crossStreets));
    if (s.yearCoNamed) recordEl.appendChild(recordRow("Co-named", String(s.yearCoNamed)));
    if (place.collected && place.collectedAt) {
      recordEl.appendChild(recordRow("Visited", place.collectedAt.toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric"
      }), "red"));
    }
    if (s.needsVerification) {
      recordEl.appendChild(recordRow("Note", "Location approximate — pending verification against NYC records", "faint"));
    }
  }

  function refreshCollectArea(place) {
    var key = place.collected ? "done" : (place.inRange ? "ready" : "far");
    var distKey = key === "far" ? Math.round((place.distance || 0) / 5) : 0;
    if (collectAreaEl.dataset.key === key && collectAreaEl.dataset.dist === String(distKey)) return;
    collectAreaEl.dataset.key = key;
    collectAreaEl.dataset.dist = String(distKey);
    collectAreaEl.innerHTML = "";

    if (key === "done") return;

    if (key === "ready") {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "visit-btn";
      btn.textContent = "Visit This Icon";
      btn.addEventListener("click", function () { collect(place); });
      collectAreaEl.appendChild(btn);
      return;
    }

    var box = document.createElement("div");
    box.className = "locked-box";
    var t = document.createElement("div");
    t.className = "lb-title";
    t.textContent = "Get Closer to Visit";
    var sub = document.createElement("div");
    sub.className = "lb-sub";
    sub.textContent = formatDistance(place.distance || 0) +
      " away — you'll need to be within " + COLLECT_RADIUS_M + " m";
    box.appendChild(t);
    box.appendChild(sub);
    collectAreaEl.appendChild(box);
  }

  function renderHero(place) {
    heroEl.innerHTML = "";
    var avail = heroEl.clientWidth || 340;
    var plateSize = Math.min(220, Math.floor(avail / 1.9));
    var sign = buildSign(place.data, plateSize, Math.round(plateSize * 0.31), place.collected);
    heroEl.appendChild(sign);
    if (place.collected) {
      // Every visit to a stamped sign replays the seal-slam, like flipping to a passport page.
      requestAnimationFrame(function () { sign.classList.add("slamming", "jolting"); });
    }
    return sign;
  }

  function openStreet(id) {
    var place = byId[id];
    if (!place) return;
    clearTimeout(place.resetTimer);
    place.resetTimer = null;
    hideNotification();
    hintEl.classList.add("gone");

    currentPlace = place;
    sheetOpen = true;
    sheetNameEl.textContent = place.data.honoraryName;

    // Un-hide first so the hero can measure the sheet's real width.
    scrimEl.hidden = false;
    sheetEl.hidden = false;

    renderHero(place);
    renderRecord(place);
    collectAreaEl.dataset.key = "";
    refreshCollectArea(place);

    storyEl.innerHTML = "";
    place.data.story.split("\n\n").forEach(function (para) {
      var p = document.createElement("p");
      p.textContent = para;
      storyEl.appendChild(p);
    });

    linksAreaEl.innerHTML = "";
    if (place.data.links && place.data.links.length) {
      var h = document.createElement("h2");
      h.className = "section-head";
      h.textContent = "Learn More";
      var wrap = document.createElement("div");
      wrap.className = "links";
      place.data.links.forEach(function (l) {
        var a = document.createElement("a");
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = l.label;
        a.insertAdjacentHTML("beforeend",
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>');
        wrap.appendChild(a);
      });
      linksAreaEl.appendChild(h);
      linksAreaEl.appendChild(wrap);
    }

    sheetScrollEl.scrollTop = 0;
    requestAnimationFrame(function () {
      scrimEl.classList.add("show");
      sheetEl.classList.add("show");
    });
    document.getElementById("closeBtn").focus();
  }

  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    scrimEl.classList.remove("show");
    sheetEl.classList.remove("show");
    setTimeout(function () {
      if (sheetOpen) return;
      scrimEl.hidden = true;
      sheetEl.hidden = true;
    }, 380);

    if (currentPlace && currentPlace.collected) scheduleReset(currentPlace);
    currentPlace = null;
  }

  document.getElementById("closeBtn").addEventListener("click", closeSheet);
  scrimEl.addEventListener("click", closeSheet);

  // ---- collect + demo reset ---------------------------------------------
  function updateCounter() {
    var n = places.filter(function (p) { return p.collected; }).length;
    counterEl.textContent = n + " / " + places.length + " visited";
  }

  function collect(place) {
    if (place.collected) return;
    place.collected = true;
    place.collectedAt = new Date();
    if (navigator.vibrate) navigator.vibrate(28);

    var sign = renderHero(place);
    sign.classList.add("slamming", "jolting");
    renderRecord(place);
    collectAreaEl.dataset.key = "";
    refreshCollectArea(place);
    refreshPin(place);
    updateCounter();
  }

  var resetToastTimer = null;
  function scheduleReset(place) {
    clearTimeout(place.resetTimer);
    var secondsLeft = Math.round(DEMO_RESET_MS / 1000);

    function tick() {
      showToast("Demo reset · " + place.data.honoraryName + " in " + secondsLeft + "s");
      secondsLeft--;
      if (secondsLeft >= 0) {
        place.resetTimer = setTimeout(tick, 1000);
      } else {
        place.collected = false;
        place.collectedAt = null;
        place.armed = dist(puck.x, puck.y, place.x, place.y) > REARM_RADIUS_M;
        place.resetTimer = null;
        refreshPin(place);
        updateCounter();
        showToast(place.data.honoraryName + " is ready for the next visitor");
        clearTimeout(resetToastTimer);
        resetToastTimer = setTimeout(hideToast, 2600);
      }
    }
    tick();
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
  }
  function hideToast() { toastEl.classList.remove("show"); }

  // ---- boot --------------------------------------------------------------
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(screenEl);
  resize();
  updateCounter();
  zoomOutBtn.disabled = zoom <= MIN_ZOOM;
  zoomInBtn.disabled = zoom >= MAX_ZOOM;
  puckEl.style.setProperty("--cycle", STRIDE_S + "s");
  requestAnimationFrame(frame);
})();
