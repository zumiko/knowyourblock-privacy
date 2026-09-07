/* Know Your Block — interactive web demo
 *
 * Mirrors the app's core loop in the browser, now on the app's REAL map:
 * Mapbox GL JS rendering the same hand-authored Bold & Civic style JSON the
 * iOS app loads (assets/BoldCivicStyle.json), with the honorees at their true
 * coordinates. Walk the last block, get the proximity notification, open the
 * sign, read the story, stamp it as visited.
 *
 * Getting around a real-scale city needs real-scale transit, so:
 *  - Taps near the walker route along actual streets (Mapbox Directions,
 *    walking profile; straight-line fallback if the request fails).
 *  - Far-away taps or signs take the subway: stairs appear, the walker
 *    descends, the map dims to a rocking train car, and the walker climbs
 *    out about a block from the destination. Input is ignored mid-ride.
 *
 * Demo-only deviations from the shipping app (all deliberate):
 *  - Walking speed is exaggerated (WALK_M_PER_S) so the last block takes
 *    seconds, not minutes. The 40 m collect radius is real, though.
 *  - A visit un-stamps itself DEMO_RESET_MS after you close the story, so the
 *    next person at the kiosk can stamp the same sign.
 *
 * The Mapbox token below is a PUBLIC token (pk.) — safe to ship in client
 * code by design. Restrict it to knowyourblock.nyc + localhost in the Mapbox
 * dashboard so it can't be lifted for other sites.
 */
(function () {
  "use strict";

  var MAPBOX_TOKEN = "pk.eyJ1IjoiY2xhamVsbGkiLCJhIjoiY210cXRsbHRiMThtdDJ3cHJubTFpMHJsaCJ9.Mg2bCWRC25tKktVaPcScAQ";
  var STREETS = window.KYB_STREETS || [];

  // ---- tuning ------------------------------------------------------------
  var COLLECT_RADIUS_M = 40;      // GameConstants.defaultCollectRadiusMeters (real metres)
  var REARM_RADIUS_M = 58;        // hysteresis before a street can re-notify
  var DEMO_RESET_MS = 10000;      // visits reset 10s after leaving the story
  var WALK_M_PER_S = 65;          // exaggerated demo walking speed
  var SUBWAY_MIN_M = 600;         // farther than this and the walker rides the train
  var ENTRANCE_M = 45;            // subway entrance spawns this far from the walker
  var ARRIVE_M = 130;             // the train drops you about a block from the sign
  var START_ZOOM = 16;
  var STRIDE_S = 0.62;            // one full walk cycle

  // ---- elements ----------------------------------------------------------
  var screenEl = document.getElementById("screen");
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
  var transitEl = document.getElementById("transit");
  var transitDestEl = document.getElementById("transitDest");

  // ---- geography (real coordinates, metres via local equirectangular) ----
  var M_PER_DEG_LAT = 111320;
  function mPerDegLng(lat) { return 111320 * Math.cos(lat * Math.PI / 180); }

  /** Real metres between two {lng,lat} points (fine at city scale). */
  function distM(a, b) {
    var dx = (b.lng - a.lng) * mPerDegLng((a.lat + b.lat) / 2);
    var dy = (b.lat - a.lat) * M_PER_DEG_LAT;
    return Math.hypot(dx, dy);
  }

  /** Point `meters` from `from` toward `to`. */
  function offsetToward(from, to, meters) {
    var total = distM(from, to);
    if (total < 1) return { lng: from.lng, lat: from.lat };
    var t = meters / total;
    return {
      lng: from.lng + (to.lng - from.lng) * t,
      lat: from.lat + (to.lat - from.lat) * t
    };
  }

  function formatDistance(m) {
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
  }

  var places = STREETS.map(function (s) {
    return {
      data: s,
      lng: s.location.lng, lat: s.location.lat,
      el: null, signEl: null, marker: null,
      collected: false, collectedAt: null,
      armed: true, resetTimer: null
    };
  });
  var byId = {};
  places.forEach(function (p) { byId[p.data.id] = p; });

  // The walker starts a short block north of the first entry (Shirley Chisholm Place).
  var start = places[0];
  var puck = {
    lng: start.lng,
    lat: start.lat + 160 / M_PER_DEG_LAT,
    moving: false
  };
  var route = [];         // [{lng,lat}, ...] still to walk
  var walkSeq = 0;        // cancels stale Directions responses
  var follow = true;      // camera tracks the walker
  var transit = false;    // subway ride in progress: ignore all input

  // ---- map ---------------------------------------------------------------
  mapboxgl.accessToken = MAPBOX_TOKEN;
  var map = null;
  var puckMarker = null;

  fetch("assets/BoldCivicStyle.json")
    .then(function (r) { return r.json(); })
    .then(boot)
    .catch(function (err) {
      showToast("Map failed to load — check the network and the Mapbox token");
      console.error(err);
    });

  function boot(styleJSON) {
    map = new mapboxgl.Map({
      container: "map",
      style: styleJSON,
      center: [puck.lng, puck.lat],
      zoom: START_ZOOM,
      minZoom: 9.2,
      maxZoom: 18.5,
      pitchWithRotate: false,
      dragRotate: false
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable(); // arrows walk the demo instead (below)

    // walker puck becomes a real marker
    puckEl.parentNode.removeChild(puckEl);
    puckMarker = new mapboxgl.Marker({ element: puckEl, anchor: "center" })
      .setLngLat([puck.lng, puck.lat])
      .addTo(map);
    puckEl.style.setProperty("--cycle", STRIDE_S + "s");

    places.forEach(buildPin);
    map.on("load", addHaloLayers);
    map.on("zoom", rescalePins);
    rescalePins();

    map.on("dragstart", function () { follow = false; hintEl.classList.add("gone"); });
    map.on("click", function (e) {
      if (transit || sheetOpen) return;
      hintEl.classList.add("gone");
      goTo({ lng: e.lngLat.lng, lat: e.lngLat.lat }, null);
    });
    map.on("zoom", function () {
      zoomInBtn.disabled = map.getZoom() >= map.getMaxZoom() - 0.01;
      zoomOutBtn.disabled = map.getZoom() <= map.getMinZoom() + 0.01;
    });

    updateCounter();
    requestAnimationFrame(frame);
  }

  // ---- collect-radius halos (real 40 m circles on the map) ---------------
  function haloRing(p) {
    var pts = [];
    var mLng = mPerDegLng(p.lat);
    for (var i = 0; i <= 48; i++) {
      var a = (i / 48) * Math.PI * 2;
      pts.push([
        p.lng + Math.cos(a) * COLLECT_RADIUS_M / mLng,
        p.lat + Math.sin(a) * COLLECT_RADIUS_M / M_PER_DEG_LAT
      ]);
    }
    return pts;
  }

  function haloData() {
    return {
      type: "FeatureCollection",
      features: places.filter(function (p) { return !p.collected; }).map(function (p) {
        return {
          type: "Feature",
          properties: { inRange: !!p.inRange },
          geometry: { type: "Polygon", coordinates: [haloRing(p)] }
        };
      })
    };
  }

  function addHaloLayers() {
    map.addSource("halos", { type: "geojson", data: haloData() });
    map.addLayer({
      id: "halo-fill", type: "fill", source: "halos",
      filter: ["get", "inRange"],
      paint: { "fill-color": "rgba(192,57,43,0.07)" }
    });
    map.addLayer({
      id: "halo-line-far", type: "line", source: "halos",
      filter: ["!", ["get", "inRange"]],
      paint: { "line-color": "rgba(192,57,43,0.28)", "line-width": 1.5, "line-dasharray": [2, 2] }
    });
    map.addLayer({
      id: "halo-line-near", type: "line", source: "halos",
      filter: ["get", "inRange"],
      paint: { "line-color": "rgba(192,57,43,0.75)", "line-width": 2.5 }
    });
  }

  var haloStamp = "";
  function refreshHalos() {
    if (!map.getSource("halos")) return;
    var stamp = places.map(function (p) { return (p.collected ? "c" : p.inRange ? "r" : "f"); }).join("");
    if (stamp === haloStamp) return;
    haloStamp = stamp;
    map.getSource("halos").setData(haloData());
  }

  // ---- street sign component (unchanged from the classic demo) -----------
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
      if (transit) return; // no taps register during the subway ride
      openStreet(place.data.id);
    });

    place.el = btn;
    place.signEl = sign;

    var root = document.createElement("div");
    root.className = "pin-root";
    root.appendChild(btn);
    place.marker = new mapboxgl.Marker({ element: root, anchor: "bottom" })
      .setLngLat([place.lng, place.lat])
      .addTo(map);
  }

  /** Signs shrink as you pull back to citywide zoom, but never past legibility. */
  function rescalePins() {
    var z = map.getZoom();
    var t = Math.max(0, Math.min(1, (z - 10.5) / (15.5 - 10.5)));
    var s = 0.3 + t * 0.7;
    places.forEach(function (p) { p.el.style.transform = "scale(" + s + ")"; });
  }

  function refreshPin(place) {
    place.signEl.classList.toggle("locked", !place.collected);
    place.el.classList.toggle("pulsing", !place.collected);
  }

  // ---- getting around ----------------------------------------------------
  function goTo(dest, targetPlace) {
    if (distM(puck, dest) > SUBWAY_MIN_M) rideSubway(dest, targetPlace);
    else walkVia(dest);
  }

  /** Walk along real streets (Mapbox Directions, walking profile). */
  function walkVia(dest) {
    var seq = ++walkSeq;
    var url = "https://api.mapbox.com/directions/v5/mapbox/walking/" +
      puck.lng + "," + puck.lat + ";" + dest.lng + "," + dest.lat +
      "?geometries=geojson&overview=full&access_token=" + MAPBOX_TOKEN;

    var fallback = setTimeout(function () { if (seq === walkSeq) setRoute([dest], seq); }, 2500);
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        clearTimeout(fallback);
        if (seq !== walkSeq) return;
        var coords = json.routes && json.routes[0] && json.routes[0].geometry.coordinates;
        var pts = (coords || []).map(function (c) { return { lng: c[0], lat: c[1] }; });
        pts.push(dest); // Directions snaps to the road network; still end exactly at the tap
        setRoute(pts.length ? pts : [dest], seq);
      })
      .catch(function () {
        clearTimeout(fallback);
        if (seq === walkSeq) setRoute([dest], seq);
      });
  }

  function setRoute(pts, seq) {
    if (seq !== walkSeq) return;
    route = pts.filter(function (p, i, arr) {
      var prev = i === 0 ? puck : arr[i - 1];
      return distM(prev, p) > 0.5;
    });
  }

  function stepWalk(dt) {
    if (!route.length) {
      if (puck.moving) { puck.moving = false; puckEl.classList.remove("walking"); }
      return;
    }
    var budget = WALK_M_PER_S * dt;
    while (budget > 0 && route.length) {
      var next = route[0];
      var d = distM(puck, next);
      if (d > 0.001) puckEl.classList.toggle("flip", next.lng < puck.lng);
      if (d <= budget) {
        puck.lng = next.lng; puck.lat = next.lat;
        budget -= d;
        route.shift();
      } else {
        var t = budget / d;
        puck.lng += (next.lng - puck.lng) * t;
        puck.lat += (next.lat - puck.lat) * t;
        budget = 0;
      }
    }
    if (!route.length) follow = true;
    if (!puck.moving) { puck.moving = true; puckEl.classList.add("walking"); }
  }

  // ---- the subway ride ---------------------------------------------------
  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function stairsMarker(at) {
    var el = document.createElement("div");
    el.className = "substairs";
    el.innerHTML =
      '<div class="lamp"></div>' +
      '<div class="stairwell"><i></i><i></i><i></i><i></i></div>';
    return new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([at.lng, at.lat])
      .addTo(map);
  }

  function walkStraightTo(dest) {
    return new Promise(function (res) {
      walkSeq++;
      route = [dest];
      (function wait() {
        if (!route.length && distM(puck, dest) < 2) res();
        else setTimeout(wait, 80);
      })();
    });
  }

  function rideSubway(dest, targetPlace) {
    if (transit) return;
    transit = true;
    walkSeq++; route = [];
    hideNotification();
    hintEl.classList.add("gone");

    var entrance = offsetToward(puck, dest, ENTRANCE_M);
    var arrive = targetPlace
      ? offsetToward({ lng: targetPlace.lng, lat: targetPlace.lat }, puck, ARRIVE_M)
      : offsetToward(dest, puck, Math.min(ARRIVE_M, distM(puck, dest) / 2));
    var destName = targetPlace ? targetPlace.data.honoraryName : nearestName(dest);

    var inMarker = stairsMarker(entrance);
    var outMarker = null;

    walkStraightTo(entrance)
      .then(function () {
        puckEl.classList.add("descending");
        return sleep(750);
      })
      .then(function () {
        transitDestEl.textContent = "Riding to " + destName;
        transitEl.hidden = false;
        requestAnimationFrame(function () { transitEl.classList.add("show"); });
        return sleep(450);
      })
      .then(function () {
        // relocate the world while it's dark
        inMarker.remove();
        puck.lng = arrive.lng; puck.lat = arrive.lat;
        puckMarker.setLngLat([puck.lng, puck.lat]);
        map.jumpTo({ center: [arrive.lng, arrive.lat], zoom: Math.max(map.getZoom(), 15.4) });
        outMarker = stairsMarker(arrive);
        return sleep(3100); // the ride itself
      })
      .then(function () {
        transitEl.classList.remove("show");
        return sleep(420);
      })
      .then(function () {
        transitEl.hidden = true;
        puckEl.classList.remove("descending");
        puckEl.classList.add("ascending");
        return sleep(750);
      })
      .then(function () {
        puckEl.classList.remove("ascending");
        follow = true;
        transit = false;
        showToast(targetPlace
          ? "One block from " + destName + " — walk the rest"
          : "This is your stop");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, 3200);
        return sleep(2400);
      })
      .then(function () { if (outMarker) outMarker.remove(); });
  }

  function nearestName(pt) {
    var best = places[0], bestD = Infinity;
    places.forEach(function (p) {
      var d = distM(pt, p);
      if (d < bestD) { bestD = d; best = p; }
    });
    return bestD < 900 ? best.data.honoraryName : "the next neighborhood";
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
    if (transit) return;
    if (notifStreetId) openStreet(notifStreetId);
    hideNotification();
  });
  notifEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); notifEl.click(); }
  });

  function updateProximity() {
    var nearest = null, nearestD = Infinity;
    places.forEach(function (p) {
      var d = distM(puck, p);
      p.distance = d;
      p.inRange = d <= COLLECT_RADIUS_M;

      if (!p.collected) {
        if (d > REARM_RADIUS_M) p.armed = true;
        else if (p.inRange && p.armed && !sheetOpen && !transit) {
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
        : formatDistance(nearestD) + " away" + (nearestD > SUBWAY_MIN_M ? " — tap to ride the subway" : "");
      peekEl.classList.toggle("in-range", nearest.inRange);
      var mLng = mPerDegLng(puck.lat);
      var ang = Math.atan2(-(nearest.lat - puck.lat) * M_PER_DEG_LAT,
        (nearest.lng - puck.lng) * mLng) + Math.PI / 2;
      peekArrowEl.style.transform = "rotate(" + ang + "rad)";
    } else {
      peekEl.hidden = false;
      peekNameEl.textContent = "All " + places.length + " collected";
      peekDistEl.textContent = "Visits reset shortly after you close a story";
      peekEl.classList.remove("in-range");
      peekArrowEl.style.transform = "rotate(0rad)";
    }

    refreshHalos();
    if (sheetOpen && currentPlace) refreshCollectArea(currentPlace);
  }

  // ---- render loop -------------------------------------------------------
  var lastFrame = 0;
  function frame(now) {
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
    lastFrame = now;

    stepWalk(dt);
    puckMarker.setLngLat([puck.lng, puck.lat]);

    if (follow && !transit) {
      var c = map.getCenter();
      var k = Math.min(1, dt * 6);
      if (distM(c, puck) > 0.5) {
        map.jumpTo({ center: [c.lng + (puck.lng - c.lng) * k, c.lat + (puck.lat - c.lat) * k] });
      }
    }

    updateProximity();
    requestAnimationFrame(frame);
  }

  // ---- zoom + keyboard ---------------------------------------------------
  zoomInBtn.addEventListener("click", function () { map.zoomIn(); });
  zoomOutBtn.addEventListener("click", function () { map.zoomOut(); });

  document.addEventListener("keydown", function (e) {
    if (sheetOpen) {
      if (e.key === "Escape") closeSheet();
      return;
    }
    if (transit) return;
    if (e.key === "+" || e.key === "=") { map.zoomIn(); return; }
    if (e.key === "-" || e.key === "_") { map.zoomOut(); return; }
    var step = 85; // one short block
    var d = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
    if (!d || !map) return;
    e.preventDefault();
    walkVia({
      lng: puck.lng + d[0] / mPerDegLng(puck.lat),
      lat: puck.lat + d[1] / M_PER_DEG_LAT
    });
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

    if ((place.distance || 0) > SUBWAY_MIN_M) {
      var ride = document.createElement("button");
      ride.type = "button";
      ride.className = "subway-btn";
      ride.innerHTML = '<span class="route-bullet">K</span> Ride the Subway There';
      ride.addEventListener("click", function () {
        closeSheet();
        rideSubway({ lng: place.lng, lat: place.lat }, place);
      });
      collectAreaEl.appendChild(ride);
    }
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
    if (transit) return;
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

  var toastTimer = null;
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
        place.armed = distM(puck, place) > REARM_RADIUS_M;
        place.resetTimer = null;
        refreshPin(place);
        updateCounter();
        showToast(place.data.honoraryName + " is ready for the next visitor");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, 2600);
      }
    }
    tick();
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
  }
  function hideToast() { toastEl.classList.remove("show"); }
})();
