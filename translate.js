
const originalText = document.querySelector(".text").innerText.trim();

async function translate(text, targetLang) {
  const res = await fetch("https://translate.argosopentech.com/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "en",
      target: targetLang,
      format: "text"
    })
  });
  const data = await res.json();
  return data.translatedText;
}

async function updateTranslation(langChoice) {
  const targetLang = langChoice === "auto"
    ? (navigator.language || navigator.userLanguage).slice(0, 2)
    : langChoice;

  const supported = ["en", "fr", "es", "de", "it", "pt", "ru", "zh", "ar", "tr", "hi", "ja", "ko", "uk"];

  const finalLang = supported.includes(targetLang) ? targetLang : "en";

  if (finalLang === "en") {
    document.querySelector(".text").innerText = originalText;
    return;
  }

  document.querySelector(".text").innerText = "Translating...";

  try {
    const translated = await translate(originalText, finalLang);
    document.querySelector(".text").innerText = translated;
  } catch (e) {
    document.querySelector(".text").innerText = originalText + "\n[Translation error]";
    console.error("Translation failed:", e);
  }
}

// Appel initial avec langue auto
window.addEventListener("DOMContentLoaded", () => {
  updateTranslation("auto");
});

// Menu déroulant
document.getElementById("language").addEventListener("change", (e) => {
  updateTranslation(e.target.value);
});

