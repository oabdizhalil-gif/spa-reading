const APP_DATA_KEY = "appData";
const THEME_KEY = "theme";
const TRANSLATIONS_KEY = "translations";
const TOKEN_REGEX = /\w+|\s+|[^\s\w]+/g;
const WORD_ONLY_REGEX = /^[a-zA-Z]+$/;

const appRoot = document.getElementById("app");
const popup = document.getElementById("word-popup");
const countChip = document.getElementById("block-count");
const themeToggleButton = document.getElementById("theme-toggle");

let appData = { sections: [] };
let lastWordClickMs = 0;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAllBlocks() {
  return appData.sections.flatMap((section) =>
    section.blocks.map((block) => ({ ...block, sectionId: section.id }))
  );
}

function getNextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function saveAppData() {
  localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
}

async function initializeAppData() {
  const raw = localStorage.getItem(APP_DATA_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) {
        appData = parsed;
        return;
      }
    } catch {
      // Continue to JSON fallback.
    }
  }

  try {
    const response = await fetch("./appData.json");
    if (!response.ok) throw new Error("seed fetch failed");
    const seed = await response.json();
    appData = seed && Array.isArray(seed.sections) ? seed : { sections: [] };
  } catch {
    appData = {
      sections: [
        {
          id: 1,
          title: "Beginner Stories",
          blocks: [
            {
              id: 1,
              title: "A Morning Walk",
              text: "Tom goes for a walk every morning. He sees birds, trees, and smiling people in the park.",
            },
          ],
        },
      ],
    };
  }
  saveAppData();
}

function loadTheme() {
  const currentTheme = localStorage.getItem(THEME_KEY) || "light";
  document.body.setAttribute("data-theme", currentTheme);
}

function toggleTheme() {
  const prev = document.body.getAttribute("data-theme") || "light";
  const next = prev === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
}

function closePopup() {
  popup.classList.add("hidden");
}

function showPopup(x, y, word, translation) {
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.innerHTML = `
    <div class="word-popup-word">${escapeHtml(word)}</div>
    <div class="word-popup-translation">${escapeHtml(translation)}</div>
  `;
  popup.classList.remove("hidden");
}

function normalizeWord(word) {
  return String(word).toLowerCase().replace(/[^a-z]/gi, "");
}

function readTranslationsCache() {
  try {
    const raw = localStorage.getItem(TRANSLATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTranslationsCache(cache) {
  localStorage.setItem(TRANSLATIONS_KEY, JSON.stringify(cache));
}

async function translateWord(word) {
  const cleanWord = normalizeWord(word);
  if (!cleanWord) return "Котормо жок";

  const cache = readTranslationsCache();
  if (cache[cleanWord]) return cache[cleanWord];

  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: cleanWord,
        source: "en",
        target: "ky",
        format: "text",
      }),
    });
    if (!response.ok) throw new Error("LibreTranslate failed");
    const data = await response.json();
    const result = data?.translatedText || "Котормо жок";
    cache[cleanWord] = result;
    writeTranslationsCache(cache);
    return result;
  } catch {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanWord)}&langpair=en|ky`
      );
      if (!response.ok) throw new Error("MyMemory failed");
      const data = await response.json();
      const result = data?.responseData?.translatedText || "Котормо жок";
      cache[cleanWord] = result;
      writeTranslationsCache(cache);
      return result;
    } catch {
      return "Котормо жок";
    }
  }
}

function updateCount() {
  countChip.textContent = `${getAllBlocks().length} blocks`;
}

function createBlockCard(block, clickHandler) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "block-card";
  card.innerHTML = `
    <h3>${escapeHtml(block.title)}</h3>
    <p>${escapeHtml(block.text.slice(0, 110))}${block.text.length > 110 ? "..." : ""}</p>
  `;
  card.addEventListener("click", clickHandler);
  return card;
}

function renderHome() {
  let html = `
    <h1>English Reading Platform</h1>
    <p class="subtle">Click a reading card and get Kyrgyz meanings instantly.</p>
  `;

  if (appData.sections.length === 0) {
    appRoot.innerHTML = `${html}<p class="empty-message">No sections yet. Add content from Admin.</p>`;
    return;
  }

  html += appData.sections
    .map(
      (section) => `
      <section class="section">
        <div class="section-header"><h2>${escapeHtml(section.title)}</h2></div>
        <div class="block-grid" id="home-grid-${section.id}"></div>
      </section>
    `
    )
    .join("");
  appRoot.innerHTML = html;

  appData.sections.forEach((section) => {
    const grid = document.getElementById(`home-grid-${section.id}`);
    section.blocks.forEach((block) => {
      grid.appendChild(
        createBlockCard(block, () => {
          window.location.hash = `#/read/${block.id}`;
        })
      );
    });
  });
}

function renderReader(blockId) {
  const block = getAllBlocks().find((item) => item.id === blockId);
  if (!block) {
    appRoot.innerHTML = "<h1>Reader</h1><p class='empty-message'>Block not found.</p>";
    return;
  }

  appRoot.innerHTML = `
    <h1>${escapeHtml(block.title)}</h1>
    <div id="reader-text" class="reader-text"></div>
  `;
  const readerText = document.getElementById("reader-text");
  const tokens = block.text.match(TOKEN_REGEX) || [];

  tokens.forEach((token, idx) => {
    if (WORD_ONLY_REGEX.test(token)) {
      const wordBtn = document.createElement("button");
      wordBtn.type = "button";
      wordBtn.className = "word-button";
      wordBtn.textContent = token;
      wordBtn.dataset.key = `${token}-${idx}`;
      wordBtn.addEventListener("click", async (event) => {
        const now = Date.now();
        if (now - lastWordClickMs < 150) return;
        lastWordClickMs = now;

        const x = event.clientX + 10;
        const y = event.clientY + 10;
        showPopup(x, y, token, "Жүктөлүүдө...");
        const translation = await translateWord(token);
        showPopup(x, y, token, translation);
      });
      readerText.appendChild(wordBtn);
    } else {
      readerText.appendChild(document.createTextNode(token));
    }
  });
}

function renderAdmin() {
  appRoot.innerHTML = `
    <h1>Admin</h1>
    <p class="subtle">Create, edit, and delete sections and blocks.</p>
    <form id="new-section-form" class="admin-form">
      <input id="new-section-title" type="text" placeholder="New section title" />
      <button type="submit">Add Section</button>
    </form>
    <div id="admin-sections"></div>
    <div id="admin-block-list"></div>
  `;

  document.getElementById("new-section-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const titleInput = document.getElementById("new-section-title");
    const title = titleInput.value.trim();
    if (!title) return;
    appData.sections.push({ id: getNextId(appData.sections), title, blocks: [] });
    saveAppData();
    route();
  });

  const sectionsRoot = document.getElementById("admin-sections");
  const blockListRoot = document.getElementById("admin-block-list");

  if (appData.sections.length === 0) {
    sectionsRoot.innerHTML = "<p class='empty-message'>No sections yet.</p>";
    return;
  }

  appData.sections.forEach((section) => {
    const sectionNode = document.createElement("section");
    sectionNode.className = "section";
    sectionNode.innerHTML = `
      <div class="section-header">
        <h2>${escapeHtml(section.title)}</h2>
        <button type="button" class="danger-text-btn" data-section-del="${section.id}">Delete Section</button>
      </div>
      <div class="block-grid" id="admin-grid-${section.id}"></div>
      <form class="admin-form-inline" data-add-block-form="${section.id}">
        <label>Add block to "${escapeHtml(section.title)}"</label>
        <input type="text" data-block-input="${section.id}" placeholder="Block title" />
        <button type="submit">Add Block</button>
      </form>
    `;
    sectionsRoot.appendChild(sectionNode);

    const grid = sectionNode.querySelector(`#admin-grid-${section.id}`);
    section.blocks.forEach((block) => {
      grid.appendChild(
        createBlockCard(block, () => {
          window.location.hash = `#/edit/${block.id}`;
        })
      );
      const row = document.createElement("div");
      row.className = "admin-list-row";
      row.innerHTML = `
        <span>${escapeHtml(section.title)} / ${escapeHtml(block.title)}</span>
        <button type="button" class="danger-text-btn" data-block-del="${section.id}:${block.id}">Delete Block</button>
      `;
      blockListRoot.appendChild(row);
    });
  });

  sectionsRoot.querySelectorAll("[data-section-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sectionId = Number(btn.dataset.sectionDel);
      appData.sections = appData.sections.filter((section) => section.id !== sectionId);
      saveAppData();
      route();
    });
  });

  sectionsRoot.querySelectorAll("[data-add-block-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const sectionId = Number(form.dataset.addBlockForm);
      const input = form.querySelector(`[data-block-input="${sectionId}"]`);
      const title = input.value.trim();
      if (!title) return;
      const section = appData.sections.find((item) => item.id === sectionId);
      if (!section) return;
      const nextBlockId = getNextId(getAllBlocks());
      section.blocks.push({ id: nextBlockId, title, text: "Write your English text here..." });
      saveAppData();
      route();
    });
  });

  blockListRoot.querySelectorAll("[data-block-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [sectionIdStr, blockIdStr] = btn.dataset.blockDel.split(":");
      const sectionId = Number(sectionIdStr);
      const blockId = Number(blockIdStr);
      const section = appData.sections.find((item) => item.id === sectionId);
      if (!section) return;
      section.blocks = section.blocks.filter((block) => block.id !== blockId);
      saveAppData();
      route();
    });
  });
}

function renderEditor(blockId) {
  let selectedSection = null;
  let selectedBlock = null;

  for (const section of appData.sections) {
    const found = section.blocks.find((block) => block.id === blockId);
    if (found) {
      selectedSection = section;
      selectedBlock = found;
      break;
    }
  }

  if (!selectedSection || !selectedBlock) {
    appRoot.innerHTML = "<h1>Editor</h1><p class='empty-message'>Block not found.</p>";
    return;
  }

  appRoot.innerHTML = `
    <h1>Edit Block</h1>
    <form id="edit-form" class="editor-form">
      <label for="block-title">Title</label>
      <input id="block-title" type="text" value="${escapeHtml(selectedBlock.title)}" />
      <label for="block-text">Text</label>
      <textarea id="block-text" rows="10">${escapeHtml(selectedBlock.text)}</textarea>
      <div class="editor-actions">
        <button type="submit">Save Changes</button>
        <button id="delete-block-btn" type="button" class="danger-btn">Delete Block</button>
      </div>
    </form>
  `;

  document.getElementById("edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("block-title").value.trim();
    const text = document.getElementById("block-text").value;
    if (!title) return;
    selectedBlock.title = title;
    selectedBlock.text = text;
    saveAppData();
    route();
  });

  document.getElementById("delete-block-btn").addEventListener("click", () => {
    selectedSection.blocks = selectedSection.blocks.filter((block) => block.id !== blockId);
    saveAppData();
    window.location.hash = "#/admin";
  });
}

function route() {
  closePopup();
  updateCount();
  const hash = window.location.hash || "#/";

  if (hash === "#/" || hash === "#") {
    renderHome();
    return;
  }
  if (hash === "#/admin") {
    renderAdmin();
    return;
  }

  const readMatch = hash.match(/^#\/read\/(\d+)$/);
  if (readMatch) {
    renderReader(Number(readMatch[1]));
    return;
  }

  const editMatch = hash.match(/^#\/edit\/(\d+)$/);
  if (editMatch) {
    renderEditor(Number(editMatch[1]));
    return;
  }

  appRoot.innerHTML = "<h1>404</h1><p class='empty-message'>Page not found.</p>";
}

document.addEventListener("click", (event) => {
  if (!popup.contains(event.target) && !event.target.classList.contains("word-button")) {
    closePopup();
  }
});

themeToggleButton.addEventListener("click", toggleTheme);
window.addEventListener("hashchange", route);

async function bootstrap() {
  loadTheme();
  await initializeAppData();
  if (!window.location.hash) window.location.hash = "#/";
  route();
}

bootstrap();
