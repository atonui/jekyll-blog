---
layout: page
title: Topics
permalink: /topics/
description: Browse Kibet Koech essays by topic.
---

# Topics

The site is intentionally broad. These topics are a map, not a set of boxes.

<div class="topic-directory">
{% for topic in site.data.topics %}
  {% assign topic_posts = site.posts | where: "topic_slug", topic.slug %}
  <a class="topic-card" href="{{ '/topics/' | append: topic.slug | append: '/' | relative_url }}">
    <strong>{{ topic.name }}</strong>
    <span>{{ topic.description }}</span>
    <small>{{ topic_posts.size }} {% if topic_posts.size == 1 %}article{% else %}articles{% endif %}</small>
  </a>
{% endfor %}
</div>
