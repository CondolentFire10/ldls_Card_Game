console.log("🔧 script.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD8jy4zI2Y0PsssVJlltO7d3bvtQ1QI4Xo",
  authDomain: "longdistancelovesite-6181c.firebaseapp.com",
  databaseURL: "https://longdistancelovesite-6181c-default-rtdb.firebaseio.com",
  projectId: "longdistancelovesite-6181c",
  storageBucket: "longdistancelovesite-6181c.appspot.com",
  messagingSenderId: "905121302471",
  appId: "1:905121302471:web:97e06ce4fee2717eeffbe2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const board = document.getElementById("board");
const rollBtn = document.getElementById("roll-btn");
const popup = document.getElementById("card-popup");
const categoryEl = document.getElementById("card-category");
const textEl = document.getElementById("card-text");
const verifyBtn = document.getElementById("verify-btn");
const skipBtn = document.getElementById("skip-btn");
const turnIndicator = document.getElementById("turn-indicator");

const players = {
  devon: {
    el: document.getElementById("player-devon"),
    scoreEl: document.getElementById("score-devon")
  },
  hayden: {
    el: document.getElementById("player-hayden"),
    scoreEl: document.getElementById("score-hayden")
  }
};

const colors = ["red", "green", "blue"];
const colorCategory = {
  red: { category: "Love (Easy)", points: 1 },
  green: { category: "Challenge (Hard)", points: 3 },
  blue: { category: "Silly (Medium)", points: 2 }
};

function addTile() {
  const tile = document.createElement("div");
  tile.className = "tile";
  const color = colors[Math.floor(Math.random() * colors.length)];
  tile.style.backgroundColor = color;
  tile.dataset.color = color;
  board.appendChild(tile);
}
for (let i = 0; i < 50; i++) addTile();

function getColorFromCategory(category) {
  for (const [color, data] of Object.entries(colorCategory)) {
    if (data.category === category) return color;
  }
  return "white";
}

function fadeInPopup() {
  if (!popup.classList.contains("show")) {
    popup.style.opacity = 0;
    popup.classList.add("show");
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.05;
      popup.style.opacity = opacity;
      if (opacity >= 1) clearInterval(fadeIn);
    }, 20);
  }
}

function fadeOutPopup() {
  if (popup.classList.contains("show")) {
    let opacity = 1;
    const fadeOut = setInterval(() => {
      opacity -= 0.05;
      popup.style.opacity = opacity;
      if (opacity <= 0) {
        clearInterval(fadeOut);
        popup.classList.remove("show");
      }
    }, 20);
  }
}

function updateUI(state) {
  Object.entries(players).forEach(([name, player]) => {
    const pos = state.positions?.[name] || 0;
    while (pos >= board.children.length) addTile();
    const tile = board.children[pos];
    player.el.style.left = tile.offsetLeft + "px";
    player.scoreEl.textContent = state.scores?.[name] || 0;
  });

  turnIndicator.textContent = `Turn: ${capitalize(state.turn)}`;

  if (state.currentCard && state.waitingForVerification) {
    const cardColor = getColorFromCategory(state.currentCard.category);

    const pastelColors = {
      red: "#ffcccc",
      green: "#ccffcc",
      blue: "#cce5ff"
    };

    const softColor = pastelColors[cardColor] || "white";
    popup.querySelector(".card").style.backgroundColor = softColor;

    categoryEl.textContent = `${state.currentCard.category} (${state.currentCard.points} pts)`;
    textEl.textContent = `${capitalize(state.currentCard.player)}, your task: ${state.currentCard.text}`;
    fadeInPopup();
  } else {
    fadeOutPopup();
  }
}

onValue(ref(db, "game"), (snapshot) => {
  const state = snapshot.val();
  if (state) updateUI(state);
});

rollBtn.addEventListener("click", async () => {
  rollBtn.disabled = true;

  const snapshot = await get(ref(db, "game"));
  const state = snapshot.val();

  if (!state || state.waitingForVerification) {
    rollBtn.disabled = false;
    return;
  }

  await animateDiceRoll();

  const roll = Math.floor(Math.random() * 6) + 1;
  const player = state.turn;

  document.getElementById("move-result").textContent = `${capitalize(player)} rolled a ${roll} and moved ${roll} spaces!`;

  const newPos = (state.positions?.[player] || 0) + roll;
  while (newPos >= board.children.length) addTile();
  const tile = board.children[newPos];
  const tileColor = tile?.dataset.color;

  if (!tile || !tileColor || !colorCategory[tileColor]) {
    console.error("❌ Invalid tile or color at position", newPos);
    return;
  }

  const categoryData = colorCategory[tileColor];

  const res = await fetch(`https://script.google.com/macros/s/AKfycbxM2KKSFxctTXtIMJtftQPdOJbj-PPOCvLnAeZw2Bf-ic7ugbc2UJrcQf7c9jT8srKv2g/exec?category=${encodeURIComponent(categoryData.category)}`);
  const data = await res.json();
  const randomText = data[Math.floor(Math.random() * data.length)];

  await animatePlayerMove(player, tile.offsetLeft);

  await update(ref(db, "game"), {
    [`positions/${player}`]: newPos,
    currentCard: {
      player,
      category: categoryData.category,
      text: randomText,
      points: categoryData.points
    },
    waitingForVerification: true
  });

  // DO NOT re-enable rollBtn here — it gets re-enabled after verify/skip
});

async function animateDiceRoll() {
  const originalText = rollBtn.textContent;
  let count = 0;
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const num = (count % 6) + 1;
      rollBtn.textContent = `Rolling... ${num}`;
      count++;
      if (count > 15) {
        clearInterval(interval);
        rollBtn.textContent = originalText;
        resolve();
      }
    }, 80);
  });
}

function animatePlayerMove(playerName, targetLeft) {
  return new Promise((resolve) => {
    const playerEl = players[playerName].el;
    const gameContainer = document.querySelector(".game-container");

    let startLeft = parseInt(playerEl.style.left) || 0;
    let distance = targetLeft - startLeft;
    let steps = 15;
    let stepCount = 0;

    function step() {
      stepCount++;
      const newLeft = startLeft + (distance * stepCount / steps);
      playerEl.style.left = newLeft + "px";

      // Auto-scroll to keep player in view
      const playerCenter = newLeft + playerEl.offsetWidth / 2;
      const containerCenter = gameContainer.offsetWidth / 2;
      const scrollTo = playerCenter - containerCenter;
      gameContainer.scrollTo({
        left: scrollTo,
        behavior: "smooth"
      });

      if (stepCount < steps) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }

    step();
  });
}

verifyBtn.onclick = async () => {
  const snapshot = await get(ref(db, "game"));
  const state = snapshot.val();
  const player = state.turn;
  const newScore = (state.scores?.[player] || 0) + state.currentCard.points;

  document.getElementById("move-result").textContent = "";

  await update(ref(db, "game"), {
    [`scores/${player}`]: newScore,
    turn: player === "devon" ? "hayden" : "devon",
    waitingForVerification: false,
    currentCard: null
  });

  rollBtn.disabled = false;
};

skipBtn.onclick = async () => {
  const snapshot = await get(ref(db, "game"));
  const state = snapshot.val();
  const player = state.turn;

  document.getElementById("move-result").textContent = "";

  await update(ref(db, "game"), {
    turn: player === "devon" ? "hayden" : "devon",
    waitingForVerification: false,
    currentCard: null
  });

  rollBtn.disabled = false;
};

function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}



const resetBtn = document.getElementById("reset-btn");

resetBtn.onclick = async () => {
  const confirmed = confirm("Are you sure you want to reset the game? This will erase all scores and positions.");
  if (!confirmed) return;

  await set(ref(db, "game"), {
    positions: {
      devon: 0,
      hayden: 0
    },
    scores: {
      devon: 0,
      hayden: 0
    },
    turn: "devon",
    waitingForVerification: false,
    currentCard: null
  });

  document.getElementById("move-result").textContent = "";

  rollBtn.disabled = false; // ✅ Re-enable the Roll Dice button
  alert("Game has been reset.");
};