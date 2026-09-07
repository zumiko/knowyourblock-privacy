/* KYB Radio — plays the honorees' music through YouTube's official embedded
   player (IFrame API). Nothing is downloaded or re-hosted; playback and rights
   stay with the original uploaders.

   Track data comes from assets/radio-data.js (KYB_RADIO_TRACKS), generated
   from the app's streets.json by scripts/gen_radio.py. */

(function () {
  "use strict";

  var CHANNELS = [
    { name: "All City",      callsign: "All City", freq: "87.9",  stationId: "KYB · ALL CITY" },
    { name: "Brooklyn",      callsign: "BK",       freq: "90.1",  stationId: "KYB-BK · BROOKLYN" },
    { name: "Manhattan",     callsign: "MN",       freq: "94.7",  stationId: "KYB-MN · MANHATTAN" },
    { name: "Queens",        callsign: "QNS",      freq: "98.3",  stationId: "KYB-QNS · QUEENS" },
    { name: "The Bronx",     callsign: "BX",       freq: "102.5", stationId: "KYB-BX · THE BRONX" },
    { name: "Staten Island", callsign: "SI",       freq: "106.9", stationId: "KYB-SI · STATEN ISLAND" }
  ];

  var state = {
    channel: CHANNELS[0],
    queue: [],        // tracks for the current channel (play order)
    index: 0,
    shuffle: false,
    started: false,   // user has pressed Start (autoplay is allowed after a gesture)
    player: null,
    playerReady: false
  };

  var els = {
    dial: document.getElementById("dial"),
    needle: document.getElementById("needle"),
    tuneKnob: document.getElementById("tuneKnob"),
    stationId: document.getElementById("stationId"),
    startBtn: document.getElementById("startBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    npBadge: document.getElementById("npBadge"),
    npHonoree: document.getElementById("npHonoree"),
    npSong: document.getElementById("npSong"),
    npStreet: document.getElementById("npStreet"),
    npPlace: document.getElementById("npPlace"),
    npStory: document.getElementById("npStory")
  };

  function tracksFor(channel) {
    if (channel.name === "All City") return KYB_RADIO_TRACKS.slice();
    return KYB_RADIO_TRACKS.filter(function (t) { return t.borough === channel.name; });
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function current() { return state.queue[state.index]; }

  function channelSlug(channel) { return channel.name.toLowerCase().replace(/\s+/g, "-"); }

  function tuneHardware() {
    var i = CHANNELS.indexOf(state.channel);
    // Needle slides to the middle of the selected station's slice of the band.
    els.needle.style.left = ((i + 0.5) / CHANNELS.length * 100) + "%";
    // The tune knob turns with it.
    els.tuneKnob.style.transform = "rotate(" + (i * 60 - 150) + "deg)";
  }

  function setChannel(channel, opts) {
    state.channel = channel;
    state.queue = state.shuffle ? shuffled(tracksFor(channel)) : tracksFor(channel);
    state.index = 0;
    els.stationId.textContent = channel.stationId;
    if (!(opts && opts.keepHash)) {
      history.replaceState(null, "", channel.name === "All City" ? "radio.html" : "radio.html#" + channelSlug(channel));
    }
    renderDial();
    tuneHardware();
    showTrack(true);
  }

  function renderDial() {
    els.dial.innerHTML = "";
    CHANNELS.forEach(function (channel) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", channel === state.channel ? "true" : "false");
      btn.setAttribute("aria-label", channel.name + " channel, " + tracksFor(channel).length + " tracks");
      btn.innerHTML =
        '<span class="freq">' + channel.freq + "</span>" +
        '<span class="callsign">' + channel.callsign + "</span>";
      btn.addEventListener("click", function () { setChannel(channel); });
      els.dial.appendChild(btn);
    });
  }

  function renderNowPlaying(track) {
    els.npBadge.src = track.badge;
    els.npBadge.alt = "Illustrated portrait badge of " + track.honoree;
    els.npHonoree.textContent = track.honoree;
    els.npSong.textContent = track.songTitle;
    els.npStreet.textContent = track.honoraryName;
    els.npPlace.textContent =
      track.neighborhood + ", " + track.borough + " · " + track.crossStreets +
      (track.yearCoNamed ? " · co-named " + track.yearCoNamed : "");
    els.npStory.textContent = track.storyHook;
  }

  function showTrack(play) {
    var track = current();
    if (!track) return;
    renderNowPlaying(track);
    if (state.started && state.playerReady) {
      if (play) state.player.loadVideoById(track.youtubeId);
      else state.player.cueVideoById(track.youtubeId);
    }
  }

  function step(delta) {
    var n = state.queue.length;
    state.index = ((state.index + delta) % n + n) % n;
    showTrack(true);
  }

  // ---------- YouTube IFrame API ----------
  window.onYouTubeIframeAPIReady = function () {
    state.player = new YT.Player("player", {
      width: "100%",
      height: "100%",
      videoId: current().youtubeId,
      playerVars: {
        autoplay: 1,
        rel: 0,               // related videos limited to same channel
        playsinline: 1
      },
      events: {
        onReady: function () {
          state.playerReady = true;
          state.player.playVideo();
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) step(1); // continuous broadcast
        },
        onError: function () {
          // Unavailable/blocked video: keep the station on the air.
          setTimeout(function () { step(1); }, 1500);
        }
      }
    });
  };

  function start() {
    if (state.started) return;
    state.started = true;
    // Replaces the #player placeholder (and the Start button inside it) with the iframe.
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  // ---------- wire up ----------
  els.startBtn.addEventListener("click", start);
  els.prevBtn.addEventListener("click", function () { start(); step(-1); });
  els.nextBtn.addEventListener("click", function () { start(); step(1); });
  els.shuffleBtn.addEventListener("click", function () {
    state.shuffle = !state.shuffle;
    els.shuffleBtn.setAttribute("aria-pressed", state.shuffle ? "true" : "false");
    var playing = current();
    state.queue = state.shuffle ? shuffled(tracksFor(state.channel)) : tracksFor(state.channel);
    // Keep the current track where the listener left it.
    var idx = state.queue.findIndex(function (t) { return t.id === playing.id; });
    if (state.shuffle && idx > 0) {
      state.queue.splice(idx, 1);
      state.queue.unshift(playing);
      idx = 0;
    }
    state.index = Math.max(0, idx);
  });

  // Deep-linkable channels: radio.html#the-bronx etc.
  var fromHash = CHANNELS.find(function (c) {
    return channelSlug(c) === (location.hash || "").replace("#", "");
  });
  setChannel(fromHash || CHANNELS[0], { keepHash: true });
})();
