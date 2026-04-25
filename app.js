const STORAGE_KEY = "appData";
const WORD_CLICKABLE_REGEX = /^[A-Za-z]+(?:'[A-Za-z]+)?$/;
const TOKEN_REGEX = /\w+|\s+|[^\s\w]+/g;

const defaultData = {
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

const appRoot = document.getElementById("app");
const countChip = document.getElementById("block-count");
const popup = document.getElementById("word-popup");

let state = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sections)) return defaultData;
    return parsed;
  } catch (error) {
    console.error("Failed to parse localStorage appData:", error);
    return defaultData;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getAllBlocks() {
  return state.sections.flatMap((section) => section.blocks.map((block) => ({ ...block, sectionId: section.id })));
}

function getNextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function route() {
  const hash = window.location.hash || "#/";
  closePopup();
  updateCountChip();

  if (hash === "#/" || hash === "") {
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

function updateCountChip() {
  countChip.textContent = `${getAllBlocks().length} blocks`;
}

function createBlockCard(block) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "block-card";
  btn.innerHTML = `
    <h3>${escapeHtml(block.title)}</h3>
    <p>${escapeHtml(block.text.slice(0, 110))}${block.text.length > 110 ? "..." : ""}</p>
  `;
  return btn;
}

function renderHome() {
  let html = `
    <h1>English Reading Platform</h1>
    <p class="subtle">Click a reading card and get Kyrgyz word translations instantly.</p>
  `;
  if (state.sections.length === 0) {
    html += `<p class="empty-message">No sections yet. Add content from Admin.</p>`;
    appRoot.innerHTML = html;
    return;
  }

  html += state.sections
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

  state.sections.forEach((section) => {
    const grid = document.getElementById(`home-grid-${section.id}`);
    section.blocks.forEach((block) => {
      const card = createBlockCard(block);
      card.addEventListener("click", () => {
        window.location.hash = `#/read/${block.id}`;
      });
      grid.appendChild(card);
    });
  });
}

function renderReader(blockId) {
  const allBlocks = getAllBlocks();
  const block = allBlocks.find((item) => item.id === blockId);
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

  tokens.forEach((token) => {
    if (WORD_CLICKABLE_REGEX.test(token)) {
      const wordBtn = document.createElement("button");
      wordBtn.type = "button";
      wordBtn.className = "word-button";
      wordBtn.textContent = token;
      wordBtn.addEventListener("click", (event) => onWordClick(event, token));
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
    const input = document.getElementById("new-section-title");
    const title = input.value.trim();
    if (!title) return;
    state.sections.push({ id: getNextId(state.sections), title, blocks: [] });
    saveData();
    route();
  });

  const sectionsRoot = document.getElementById("admin-sections");
  const blockListRoot = document.getElementById("admin-block-list");

  if (state.sections.length === 0) {
    sectionsRoot.innerHTML = "<p class='empty-message'>No sections yet.</p>";
    return;
  }

  state.sections.forEach((section) => {
    const sectionWrapper = document.createElement("section");
    sectionWrapper.className = "section";
    sectionWrapper.innerHTML = `
      <div class="section-header">
        <h2>${escapeHtml(section.title)}</h2>
        <button type="button" class="danger-text-btn" data-del-section="${section.id}">Delete Section</button>
      </div>
      <div class="block-grid" id="admin-grid-${section.id}"></div>
      <form class="admin-form-inline" data-add-block-form="${section.id}">
        <label>Add block to "${escapeHtml(section.title)}"</label>
        <input type="text" placeholder="Block title" data-add-block-input="${section.id}" />
        <button type="submit">Add Block</button>
      </form>
    `;
    sectionsRoot.appendChild(sectionWrapper);

    const grid = sectionWrapper.querySelector(`#admin-grid-${section.id}`);
    section.blocks.forEach((block) => {
      const card = createBlockCard(block);
      card.addEventListener("click", () => {
        window.location.hash = `#/edit/${block.id}`;
      });
      grid.appendChild(card);

      const row = document.createElement("div");
      row.className = "admin-list-row";
      row.innerHTML = `
        <span>${escapeHtml(section.title)} / ${escapeHtml(block.title)}</span>
        <button type="button" class="danger-text-btn" data-del-block="${section.id}:${block.id}">Delete Block</button>
      `;
      blockListRoot.appendChild(row);
    });
  });

  sectionsRoot.querySelectorAll("[data-del-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sectionId = Number(btn.getAttribute("data-del-section"));
      state.sections = state.sections.filter((s) => s.id !== sectionId);
      saveData();
      route();
    });
  });

  sectionsRoot.querySelectorAll("[data-add-block-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const sectionId = Number(form.getAttribute("data-add-block-form"));
      const input = form.querySelector(`[data-add-block-input="${sectionId}"]`);
      const title = input.value.trim();
      if (!title) return;
      const allBlocks = getAllBlocks();
      const nextId = getNextId(allBlocks);
      const targetSection = state.sections.find((s) => s.id === sectionId);
      if (!targetSection) return;
      targetSection.blocks.push({
        id: nextId,
        title,
        text: "Write your English text here...",
      });
      saveData();
      route();
    });
  });

  blockListRoot.querySelectorAll("[data-del-block]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [sectionIdStr, blockIdStr] = btn.getAttribute("data-del-block").split(":");
      const sectionId = Number(sectionIdStr);
      const blockId = Number(blockIdStr);
      const section = state.sections.find((s) => s.id === sectionId);
      if (!section) return;
      section.blocks = section.blocks.filter((b) => b.id !== blockId);
      saveData();
      route();
    });
  });
}

function renderEditor(blockId) {
  let sectionId = null;
  let block = null;

  for (const section of state.sections) {
    const found = section.blocks.find((item) => item.id === blockId);
    if (found) {
      sectionId = section.id;
      block = found;
      break;
    }
  }

  if (!block || sectionId === null) {
    appRoot.innerHTML = "<h1>Editor</h1><p class='empty-message'>Block not found.</p>";
    return;
  }

  appRoot.innerHTML = `
    <h1>Edit Block</h1>
    <form id="edit-form" class="editor-form">
      <label for="edit-title">Title</label>
      <input id="edit-title" type="text" value="${escapeAttribute(block.title)}" />
      <label for="edit-text">Text</label>
      <textarea id="edit-text" rows="10">${escapeHtml(block.text)}</textarea>
      <div class="editor-actions">
        <button type="submit">Save Changes</button>
        <button id="delete-block-btn" type="button" class="danger-btn">Delete Block</button>
      </div>
    </form>
  `;

  document.getElementById("edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("edit-title").value.trim();
    const text = document.getElementById("edit-text").value;
    if (!title) return;
    const section = state.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const item = section.blocks.find((b) => b.id === blockId);
    if (!item) return;
    item.title = title;
    item.text = text;
    saveData();
    alert("Saved.");
    route();
  });

  document.getElementById("delete-block-btn").addEventListener("click", () => {
    const section = state.sections.find((s) => s.id === sectionId);
    if (!section) return;
    section.blocks = section.blocks.filter((b) => b.id !== blockId);
    saveData();
    window.location.hash = "#/admin";
  });
}

async function onWordClick(event, word) {
  const x = event.clientX + 8;
  const y = event.clientY + 8;
  showPopup(x, y, word, "Translating...");
  try {
    const translation = await translateWord(word);
    showPopup(x, y, word, translation || "No translation found");
  } catch (error) {
    console.error(error);
    showPopup(x, y, word, "Translation unavailable");
  }
}

async function translateWord(word) {
  const response = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: word,
      source: "en",
      target: "ky",
      format: "text",
    }),
  });
  if (!response.ok) throw new Error("Translation request failed");
  const data = await response.json();
  return data.translatedText;
}

function showPopup(x, y, word, translation) {
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.innerHTML = `
    <div class="word-popup-label">Word</div>
    <div class="word-popup-word">${escapeHtml(word)}</div>
    <div class="word-popup-label">Kyrgyz</div>
    <div class="word-popup-translation">${escapeHtml(translation)}</div>
  `;
  popup.classList.remove("hidden");
}

function closePopup() {
  popup.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}

document.addEventListener("click", (event) => {
  if (!popup.contains(event.target) && !event.target.classList.contains("word-button")) {
    closePopup();
  }
});

window.addEventListener("hashchange", route);
if (!window.location.hash) window.location.hash = "#/";
route();
