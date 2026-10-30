from pathlib import Path
import json

config = Path("_config.yml").read_text(encoding="utf-8")
search = Path("_includes/search.html").read_text(encoding="utf-8")
styles = Path("_sass/_search.scss").read_text(encoding="utf-8")
default_layout = Path("_layouts/default.html").read_text(encoding="utf-8")

assert "hide_search: false" in config, "Search must be enabled in _config.yml"
assert 'action="{{ \'/search/\' | relative_url }}"' in search, "Global search must submit to the native /search/ page"
assert 'for="search__input"' in search, "Search input needs a programmatic label"
assert 'id="search__input"' in search and 'name="q"' in search, "Search query input is missing"
assert 'autocomplete="off"' in search, "Search autocomplete setting is missing"
assert 'type="submit"' in search and '>Search<' in search, "Visible submit button is required"
assert 'id="search-suggestions"' in search, "Global search needs a live suggestions container"
assert 'aria-live="polite"' in search, "Live search result count must be announced"
assert "search.js" in default_layout, "Native search JavaScript must load from the default layout"
assert "display: none" not in styles, "Search submit button must not be hidden"

search_page = Path("_site/search/index.html")
search_index = Path("_site/search.json")
search_js = Path("_site/assets/js/search.js")

assert search_page.exists(), "Built site must contain /search/"
assert search_index.exists(), "Built site must contain /search.json"
assert search_js.exists(), "Built site must contain native search JavaScript"

page_html = search_page.read_text(encoding="utf-8")
assert 'id="search-results"' in page_html, "Search page needs a full results container"
assert 'id="search-page-input"' in page_html, "Search page needs a query input"
assert "No results" in page_html, "Search page needs an empty-state message"

index = json.loads(search_index.read_text(encoding="utf-8"))
assert isinstance(index, list) and index, "Search index must be a non-empty JSON array"
required = {"title", "url", "description", "topic", "tags", "content", "date"}
for item in index:
    missing = required.difference(item)
    assert not missing, f"Search index item missing fields: {sorted(missing)}"
    assert item["url"].startswith("/"), "Search index URLs must be site-relative"

js = search_js.read_text(encoding="utf-8")
assert "scoreResult" in js, "Search script needs relevance scoring"
assert "title" in js and "tags" in js and "topic" in js and "description" in js and "content" in js, "Search scoring must consider approved fields"
assert "URLSearchParams" in js, "Search page must read the q query parameter"
assert "ArrowDown" in js and "ArrowUp" in js and "Escape" in js, "Live suggestions need keyboard navigation"

print("Native search checks passed")
