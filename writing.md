---
layout: page
title: Writing
permalink: /writing/
description: Essays, technical notes, and experiments by Allan Koech.
---

# Writing

Essays, technical notes, experiments, and things I wanted to understand well enough to explain.

<div class="writing-archive">
{% assign posts_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}
{% for year in posts_by_year %}
  <section class="archive-year">
    <h2>{{ year.name }}</h2>
    <ol>
    {% for post in year.items %}
      {% assign words = post.content | number_of_words %}
      {% assign minutes = words | divided_by: 200 %}
      {% if minutes < 1 %}{% assign minutes = 1 %}{% endif %}
      <li>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
        <span>{{ post.date | date: "%b %-d" }} · {{ minutes }} min</span>
      </li>
    {% endfor %}
    </ol>
  </section>
{% endfor %}
</div>
