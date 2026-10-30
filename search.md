---
layout: page
title: Search
permalink: /search/
description: Search essays and notes on KibetKoech.com.
hide_search: true
search_exclude: true
---

# Search

<div class="search-page" data-search-page data-search-index="{{ '/search.json' | relative_url }}">
  <form method="get" action="{{ '/search/' | relative_url }}" role="search">
    <label for="search-page-input" class="search-label">Search articles and notes</label>
    <div class="search-controls">
      <input
        type="search"
        id="search-page-input"
        name="q"
        placeholder="Try AI, Kenya, PHP, learning…"
        autocomplete="off"
      >
      <button type="submit" class="btn btn-bordered search-submit">Search</button>
    </div>
  </form>

  <p id="search-page-status" class="search-status" aria-live="polite"></p>
  <ol id="search-results" class="search-results"></ol>
  <p id="search-empty" class="search-empty" hidden>No results found. Try a broader search.</p>

  <noscript>
    <p>Search requires JavaScript to show results on this page.</p>
  </noscript>
</div>
