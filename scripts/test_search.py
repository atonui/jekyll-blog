from pathlib import Path

config = Path("_config.yml").read_text(encoding="utf-8")
search = Path("_includes/search.html").read_text(encoding="utf-8")
styles = Path("_sass/_search.scss").read_text(encoding="utf-8")

assert "hide_search: false" in config, "Search must be enabled in _config.yml"
assert 'action="https://duckduckgo.com/"' in search, "Search must remain site-scoped through DuckDuckGo"
assert 'for="search__input"' in search, "Search input needs a programmatic label"
assert 'id="search__input"' in search and 'name="q"' in search, "Search query input is missing"
assert 'autocomplete="off"' in search, "Search autocomplete setting is missing"
assert '"/ autocomplete=' not in search, "Malformed input markup is still present"
assert 'type="submit"' in search and '>Search<' in search, "Visible submit button is required"
assert 'tabindex="-1"' not in search, "Submit button must remain keyboard-focusable"
assert 'display: none' not in styles, "Search submit button must not be hidden"

print("Search UX checks passed")
