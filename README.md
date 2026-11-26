# Webz.io Agent Skills

Skills that teach an AI agent when and how to use Webz.io tools: which tool fits the question, how to fill its
arguments, and how to read and cite the results.

Each skill is one `SKILL.md` in the open [Agent Skills](https://agentskills.io) format, so it works in Cursor, Claude
Code, Codex and other agents that support skills.

## Skills

| Skill | Tool | Use it for |
| --- | --- | --- |
| [`webz-news`](skills/webz-news/SKILL.md) | `search_webz_news` | News articles, filtered by outlet, language, country, sentiment, category, person, company or ticker |
| [`webz-blogs`](skills/webz-blogs/SKILL.md) | `search_webz_blogs` | Blog posts |
| [`webz-forums`](skills/webz-forums/SKILL.md) | `search_webz_discussions` | Forum threads and replies |
| [`webz-seg-news`](skills/webz-seg-news/SKILL.md) | `aggregate_webz_news` | Counts of people, companies, sites or sentiment in news |
| [`webz-seg-blogs`](skills/webz-seg-blogs/SKILL.md) | `aggregate_webz_blogs` | Counts of blogs, authors or companies in blog posts |
| [`webz-seg-forums`](skills/webz-seg-forums/SKILL.md) | `aggregate_webz_forums` | Counts of forums, boards, authors or countries in forum posts |
| [`webz-news-answers`](skills/webz-news-answers/SKILL.md) | `answer_webz_news` | A written, cited answer to one news question |
| [`webz-news-search`](skills/webz-news-search/SKILL.md) | `news_search_by_webz` | News search in natural language |

## Install

With the [skills CLI](https://github.com/vercel-labs/skills), which installs into Cursor, Claude Code, Codex and others:

```bash
npx skills add Webhose/skills                     # choose from the list
npx skills add Webhose/skills --skill webz-news   # one skill
```

Or copy a skill's folder into your agent's skills directory, for example `.cursor/skills/`, `.claude/skills/` or
`.agents/skills/`.

## Connect the tools

A skill only guides the agent. The tools come from the Webz.io MCP server, so the agent needs that connection too:

- `https://mcp.webz.io/mcp` serves every tool above except `news_search_by_webz`.
- `https://mcp.webz.io/news-search/mcp` serves `news_search_by_webz`.

Sign in with your Webz.io API token when asked. Setup for each client is at [mcp.webz.io](https://mcp.webz.io).

## Releases

One version covers the whole repository: a patch changes wording, a minor adds a skill, a major renames or removes one.

Each release carries `skills.json`, an index with the name, description, tools and links of every skill:

```
https://github.com/Webhose/skills/releases/latest/download/skills.json
```

To release, push a `vX.Y.Z` tag on `main`. The Release workflow validates the skills, builds the index and publishes
the release. A published tag cannot be moved or deleted.

## Contributing

- One folder per skill, `skills/<name>/SKILL.md`, where `<name>` equals the `name` in the frontmatter. Markdown only.
- List the MCP tools the skill calls in the frontmatter, separated by spaces:

  ```yaml
  metadata:
    webz-tools: search_webz_news
  ```

- Add the skill to the table above.
- Run the checks before opening a pull request:

  ```bash
  node --test scripts/skills.test.mjs
  node scripts/skills.mjs check
  ```

The check enforces the Agent Skills format and these safety rules:

- no invisible or bidirectional characters, and no raw HTML outside code;
- links only to `webz.io` sites and `github.com/Webhose`;
- nothing that looks like a token or key;
- every tool in `webz-tools` exists in the [Webz.io catalog](https://mcp.webz.io/catalog.json).

Every change needs a pull request, a green check and a review by a code owner.

## Security

A skill is a set of instructions that an agent follows, so treat a change to one like a change to code. To report a
problem with a skill, write to support@webz.io.

## License

[MIT](LICENSE). The license covers the skills in this repository. Access to Webz.io services and to the content they
return is subject to the [Webz.io terms of service](https://webz.io/tos/).
