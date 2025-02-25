let score = parseInt(localStorage.getItem("score")) || 0;
let count = parseInt(localStorage.getItem("clickCount")) || 0;
let scorePerClick = parseInt(localStorage.getItem("scorePerClick")) || 1;
let upgradeCost = parseInt(localStorage.getItem("upgradeCost")) || 25;

function updateDisplay() {
  document.getElementById("score").textContent = score;
  document.getElementById("counter").textContent = count;
  document.getElementById("scorePerClick").textContent = scorePerClick;
  document.getElementById("upgradeCost").textContent = upgradeCost;
}

updateDisplay();

document.getElementById("confettiButton").addEventListener("click", () => {
  score += scorePerClick;
  count++;
  localStorage.setItem("score", score);
  localStorage.setItem("clickCount", count);
  updateDisplay();

  let maxParticles = 128;
  let batchSize = 64;
  let confettiCount = 0;

  function launchConfetti() {
    if (confettiCount >= maxParticles) return;

    confetti({
      particleCount: batchSize,
      spread: 360,
      startVelocity: 32,
      origin: { x: Math.random(), y: Math.random() * 0.3 },
    });

    confettiCount += batchSize;

    if (confettiCount < maxParticles) {
      requestAnimationFrame(launchConfetti);
    }
  }

  launchConfetti();
});

document.getElementById("upgradeButton").addEventListener("click", () => {
  if (score >= upgradeCost) {
    score -= upgradeCost;
    scorePerClick *= 2;
    upgradeCost = Math.ceil(upgradeCost * Math.PI);
    localStorage.setItem("scorePerClick", scorePerClick);
    localStorage.setItem("upgradeCost", upgradeCost);
    localStorage.setItem("score", score);
    updateDisplay();
  }
});

document.getElementById("clearButton").addEventListener("click", () => {
  score = 0;
  count = 0;
  scorePerClick = 1;
  upgradeCost = 25;
  localStorage.setItem("score", score);
  localStorage.setItem("clickCount", count);
  localStorage.setItem("scorePerClick", scorePerClick);
  localStorage.setItem("upgradeCost", upgradeCost);
  updateDisplay();
});
