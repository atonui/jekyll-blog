(() => {
  "use strict";

  let indexPromise;

  function loadIndex(url) {
    if (!indexPromise) {
      indexPromise = fetch(url, { credentials: "same-origin" }).then((response) => {
        if (!response.ok) throw new Error("Unable to load search index");
        return response.json();
      });
    }
    return indexPromise;
  }

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function fieldScore(value, token, weight) {
    const text = normalize(value);
    if (!text.includes(token)) return 0;
    return text === token ? weight * 2 : weight;
  }

  function scoreResult(item, query) {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return 0;

    let score = 0;
    for (const token of tokens) {
      const tokenScore =
        fieldScore(item.title, token, 10) +
        fieldScore((item.tags || []).join(" "), token, 7) +
        fieldScore(item.topic, token, 6) +
        fieldScore(item.description, token, 4) +
        fieldScore(item.content, token, 1);

      if (tokenScore === 0) return 0;
      score += tokenScore;
    }

    if (normalize(item.title).includes(normalize(query).trim())) score += 12;
    return score;
  }

  function searchIndex(index, query) {
    return index
      .map((item) => ({ item, score: scoreResult(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return normalize(b.item.date).localeCompare(normalize(a.item.date));
      })
      .map((entry) => entry.item);
  }

  function resultMeta(item) {
    const pieces = [];
    if (item.topic) pieces.push(item.topic);
    if (item.date) {
      const date = new Date(item.date);
      if (!Number.isNaN(date.getTime())) {
        pieces.push(date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
      }
    }
    return pieces.join(" · ");
  }

  function createSuggestion(item) {
    const link = document.createElement("a");
    link.className = "search-suggestion";
    link.href = item.url;
    link.setAttribute("role", "option");

    const title = document.createElement("strong");
    title.textContent = item.title;
    link.appendChild(title);

    const meta = document.createElement("span");
    meta.textContent = resultMeta(item) || item.description || "";
    link.appendChild(meta);

    return link;
  }

  function setupGlobalSearch(form) {
    const input = form.querySelector("#search__input");
    const suggestions = form.querySelector("#search-suggestions");
    const status = form.querySelector("#search-status");
    const indexUrl = form.dataset.searchIndex;
    if (!input || !suggestions || !status || !indexUrl) return;

    let current = [];
    let activeIndex = -1;

    function clearSuggestions() {
      suggestions.replaceChildren();
      status.textContent = "";
      current = [];
      activeIndex = -1;
    }

    function focusSuggestion(nextIndex) {
      if (!current.length) return;
      activeIndex = (nextIndex + current.length) % current.length;
      current[activeIndex].focus();
    }

    async function updateSuggestions() {
      const query = input.value.trim();
      if (query.length < 2) {
        clearSuggestions();
        return;
      }

      try {
        const index = await loadIndex(indexUrl);
        const matches = searchIndex(index, query).slice(0, 5);
        suggestions.replaceChildren();
        current = [];
        activeIndex = -1;

        for (const item of matches) {
          const link = createSuggestion(item);
          suggestions.appendChild(link);
          current.push(link);
        }

        if (matches.length) {
          const all = document.createElement("a");
          all.className = "search-all";
          all.href = form.action + "?q=" + encodeURIComponent(query);
          all.textContent = "View all results";
          suggestions.appendChild(all);
          status.textContent = matches.length + (matches.length === 1 ? " suggestion" : " suggestions");
        } else {
          status.textContent = "No suggestions. Press Search for full results.";
        }
      } catch (error) {
        clearSuggestions();
        status.textContent = "Search suggestions are unavailable. Press Search to continue.";
      }
    }

    input.addEventListener("input", updateSuggestions);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && current.length) {
        event.preventDefault();
        focusSuggestion(0);
      } else if (event.key === "ArrowUp" && current.length) {
        event.preventDefault();
        focusSuggestion(current.length - 1);
      } else if (event.key === "Escape") {
        clearSuggestions();
      }
    });

    suggestions.addEventListener("keydown", (event) => {
      const targetIndex = current.indexOf(document.activeElement);
      if (targetIndex < 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusSuggestion(targetIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (targetIndex === 0) input.focus();
        else focusSuggestion(targetIndex - 1);
      } else if (event.key === "Escape") {
        clearSuggestions();
        input.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!form.contains(event.target)) clearSuggestions();
    });
  }

  function createResult(item) {
    const li = document.createElement("li");
    li.className = "search-result";

    const heading = document.createElement("h2");
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.title;
    heading.appendChild(link);
    li.appendChild(heading);

    const metaText = resultMeta(item);
    if (metaText) {
      const meta = document.createElement("p");
      meta.className = "search-result__meta";
      meta.textContent = metaText;
      li.appendChild(meta);
    }

    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      li.appendChild(description);
    }

    return li;
  }

  async function setupSearchPage(page) {
    const input = page.querySelector("#search-page-input");
    const results = page.querySelector("#search-results");
    const status = page.querySelector("#search-page-status");
    const empty = page.querySelector("#search-empty");
    const indexUrl = page.dataset.searchIndex;
    if (!input || !results || !status || !empty || !indexUrl) return;

    const params = new URLSearchParams(window.location.search);
    const query = (params.get("q") || "").trim();
    input.value = query;

    if (!query) {
      status.textContent = "Enter a word or phrase to search the writing.";
      return;
    }

    try {
      const index = await loadIndex(indexUrl);
      const matches = searchIndex(index, query);
      results.replaceChildren(...matches.map(createResult));
      empty.hidden = matches.length !== 0;
      status.textContent = matches.length
        ? matches.length + (matches.length === 1 ? " result for “" : " results for “") + query + "”"
        : "No results for “" + query + "”";
    } catch (error) {
      empty.hidden = false;
      empty.textContent = "Search is temporarily unavailable. Please try again.";
      status.textContent = "";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-site-search]").forEach(setupGlobalSearch);
    const page = document.querySelector("[data-search-page]");
    if (page) setupSearchPage(page);
  });

  window.KibetSearch = { scoreResult, searchIndex };
})();
