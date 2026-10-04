---
layout: page
title: Projects
permalink: /projects/
description: Selected software, data, and engineering projects by Allan Koech.
---

# Projects

I like projects that begin with a real problem rather than a technology looking for somewhere to be used. These are some of the things I am building or experimenting with.

## m-chango

A lightweight fundraising tool designed around how Kenyan communities already organise contributions: names, amounts, running totals, balances, and WhatsApp.

The goal is deliberately simple—make it easier for an organiser to create a fundraiser, keep the ledger accurate, and share an update people can understand immediately.

[Visit m-chango](https://www.m-chango.com/) · [Source](https://github.com/atonui/m-chango)

## Buy or Rent?

A Kenya-focused calculator for comparing the financial consequences of buying a home with a mortgage versus renting a similar property over the same period.

Instead of treating the decision as “rent is wasted money” versus “mortgages build equity”, it makes the assumptions explicit: interest rates, deposits, rent, appreciation, maintenance, transaction costs, and the value of the asset at the end.

[Try Buy or Rent?](https://www.buyorrent.co.ke/) · [Source](https://github.com/atonui/buy_or_rent)

## EdgeMonitor

An engineering prototype for remotely monitoring industrial chiller health.

The system combines an ESP32-based Ethernet/PoE controller, three-phase electrical monitoring, temperature sensors, RS-485 devices, and a small telemetry backend. The broader idea is to move maintenance from “something failed” toward “the data suggests something is changing.”

## Service Intelligence

An experiment in turning signed field-service work orders into useful operational data.

The system extracts structured events from PDFs and uses them to calculate downtime, classify interventions, identify recurring faults, track parts, and generate quarterly service reports. It is also a useful test bed for comparing document-extraction approaches and language models.

## This website

The site itself is intentionally small: Jekyll, Markdown, Sass, Git and static hosting.

That constraint is part of the design. A writing site should remain easy to understand, easy to move, and easy to maintain ten years from now.
