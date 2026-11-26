---
name: webz-news-search
description: Search global news with the Webz.io news_search_by_webz MCP tool. Use for any question about news, current events, or recent developments around a topic, company, person, or place.
metadata:
  webz-tools: news_search_by_webz
---

# Webz.io News Search

Use the `news_search_by_webz` MCP tool to answer news and current-events questions.

## When to use

- The user asks about news, recent events, announcements, or coverage of a topic.
- Fresh, sourced information matters more than general knowledge.

## How to call

- `query`: a natural-language topic or question ("EU AI regulation progress"), not keyword syntax.
- The default window is the last 7 days. For older news pass `days` (up to 30) or `allow_all_dates: true`.
- `k`: articles to return - default 10, max 50. Raise it for broad research, lower it for a quick answer.
- `score_gte`: minimum match score, 0-10. Default 4. Set 0 to disable the floor.
- `score_lte`: optional maximum match score, 0-10.
- `allow_multiple_chunks_per_article`: default false. Set true only when the user wants more than one relevant excerpt from the same article.

## Filters (optional, values are case-insensitive)

- `language`: full names - english, chinese, hebrew, french, spanish, german, arabic, russian, japanese, korean.
- `country`: ISO-2 uppercase codes - "US", "GB", "DE", "IL".
- `sentiment`: positive, negative, neutral.
- `domain`: include only these sources - "cnn.com", "yahoo.com".
- `exclude_domain`: skip these sources - never put the same domain in both lists.
- `category`: one of 17 values - Arts, Culture and Entertainment; Crime, Law and Justice; Disaster and Accident; Economy, Business and Finance; Education; Environment; Health; Human Interest; Labor; Lifestyle and Leisure; Politics; Religion and Belief; Science and Technology; Social Issue; Sport; War, Conflict and Unrest; Weather.
- `topic`, `person`, `organization`, `location`: entity and topic names, e.g. organization: ["apple"], location: ["england"].
- `ticker`: stock tickers, e.g. ["AAPL"].
- `political_bias`: left, center, or right.
- `domain_rank_gte` / `domain_rank_lte`: source domain rank range (integers).

Map the user's topic to the closest category ("stock market crash" -> Economy, Business and Finance). Skip filters the user did not imply. Map source requests too: "only from BBC" -> domain: ["bbc.com"]; "ignore Yahoo" -> exclude_domain: ["yahoo.com"]. "Apple earnings" -> ticker: ["AAPL"] and organization: ["apple"].

## Using results

- Each result has a title, URL, publish date, and text excerpt.
- Cite the article URLs in your answer.
- If results are empty, retry with `days: 30` or `allow_all_dates: true` and fewer filters before reporting nothing found.
