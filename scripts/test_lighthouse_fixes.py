from pathlib import Path
import re

post = Path("_includes/post-list-item.html").read_text(encoding="utf-8")
search = Path("_includes/search.html").read_text(encoding="utf-8")
analytics = Path("_includes/analytics.html").read_text(encoding="utf-8")

assert 'aria-label="Search suggestions"' in search, "Suggestions listbox must have a name"
assert post.count('<a ') == post.count('</a>'), "All post list links must close"
assert post.index('</a>') < post.index('class="post-topic"'), "Topic link must not nest inside article link"
assert 'post.title' in post, "Article links must retain visible title"
assert "window.addEventListener('load'" in analytics, "Analytics should start after page load"
assert 'setTimeout' in analytics, "Analytics should defer to give initial rendering time"
assert 'document.createElement("script")' in analytics, "Analytics loading must be dynamic"
assert 'gtag(\'config\'' in analytics, "Google Analytics pageview must remain configured"

print("Lighthouse regression checks passed")
