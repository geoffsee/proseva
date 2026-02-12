# Hot-Swap Prompts

This document describes the hot-swap prompts feature, which allows you to customize the system prompts used by various AI features in proseva without modifying the code.

## Overview

The hot-swap prompts feature allows you to configure custom system prompts for:
- **Chat System Prompt**: The system prompt used by the AI chat assistant
- **Case Summary Prompt**: The prompt template used for generating case summaries in reports
- **Evaluator Prompt**: The prompt template used for deadline evaluation summaries

## Default Prompts

By default, the system uses carefully crafted prompts that are defined in `server/src/prompts.ts`:

- `DEFAULT_CHAT_SYSTEM_PROMPT`: A comprehensive prompt that instructs the AI to act as a knowledgeable legal assistant for pro se litigants in Virginia, writing in the style of Alan Dershowitz.
- `DEFAULT_CASE_SUMMARY_PROMPT`: A template with placeholders for case data that generates strategic case summaries.
- `DEFAULT_EVALUATOR_PROMPT`: A template with placeholders for deadline data that generates actionable deadline summaries.

## Configuring Custom Prompts

### Via API

You can configure custom prompts using the configuration API:

```bash
# Update prompts via PATCH request
curl -X PATCH http://localhost:3001/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": {
      "chatSystemPrompt": "Your custom chat system prompt here...",
      "caseSummaryPrompt": "Your custom case summary prompt with {caseName} placeholder...",
      "evaluatorPrompt": "Your custom evaluator prompt with {overdueText} placeholder..."
    }
  }'
```

### Retrieve Current Configuration

```bash
# Get current configuration
curl http://localhost:3001/api/config
```

The response will include a `prompts` section showing:
- Current prompt values (if customized)
- Source indicators (`database` or `default`) showing whether each prompt is custom or using the default

### Reset to Defaults

To reset all configuration including prompts:

```bash
# Reset all configuration
curl -X POST http://localhost:3001/api/config/reset
```

This will remove all custom configuration overrides, reverting all prompts back to their defaults.

## Prompt Templates

Some prompts support placeholders that are replaced with actual values at runtime:

### Case Summary Prompt Placeholders

- `{caseName}`: The name of the case
- `{caseType}`: The type of case (e.g., custody, divorce)
- `{status}`: The current status of the case
- `{totalDeadlines}`: Total number of deadlines
- `{pendingDeadlines}`: Number of pending deadlines
- `{totalEvidence}`: Total number of evidence items
- `{highRelevanceEvidence}`: Number of high-relevance evidence items
- `{totalFilings}`: Total number of filings

### Evaluator Prompt Placeholders

- `{overdueText}`: Formatted text listing overdue deadlines
- `{upcomingText}`: Formatted text listing upcoming deadlines

## Implementation Details

The hot-swap prompts feature is implemented as follows:

1. **Storage**: Custom prompts are stored in the `prompts` field of the `ServerConfig` in the database (`server/data/db.json`)

2. **Retrieval**: Helper functions in `server/src/prompts.ts` retrieve prompts with automatic fallback to defaults:
   - `getChatSystemPrompt()`
   - `getCaseSummaryPrompt()`
   - `getEvaluatorPrompt()`

3. **Usage**: The prompts are used in:
   - `server/src/index.ts`: Chat endpoint uses `getChatSystemPrompt()`
   - `server/src/reports.ts`: Report generation uses `getCaseSummaryPrompt()`
   - `server/src/evaluator.ts`: Deadline evaluation uses `getEvaluatorPrompt()`

## Testing

Custom prompts take effect immediately after being saved to the database. No server restart is required.

To test a custom prompt:

1. Update the prompt configuration via the API
2. Trigger the feature that uses the prompt (e.g., send a chat message, generate a report, run an evaluation)
3. Observe the AI's behavior with the new prompt
4. Iterate and refine as needed

## Best Practices

1. **Keep context**: When customizing prompts, ensure they include sufficient context about the user's role (pro se litigant) and the purpose of the interaction.

2. **Test thoroughly**: Custom prompts can significantly affect AI behavior. Test extensively before relying on custom prompts in production.

3. **Document changes**: Keep notes about why you customized prompts and what you're trying to achieve.

4. **Backup originals**: The default prompts are carefully crafted. If you customize them, make sure you have a way to restore the defaults if needed (via the reset API).

5. **Use placeholders**: For case summary and evaluator prompts, use the documented placeholders to ensure dynamic data is properly injected.

## Example Custom Prompts

### Simple, Direct Chat Prompt

```
You are a helpful legal assistant. Provide clear, concise information about Virginia law and court procedures. Do not provide legal advice. Always suggest users verify information with their local court clerk.

You have access to tools to look up the user's cases, deadlines, and documents. Use them when relevant.
```

### Detailed Case Summary Prompt

```
Analyze this case and provide a strategic assessment:

Case Information:
- Name: {caseName}
- Type: {caseType}
- Current Status: {status}
- Deadlines: {totalDeadlines} total, {pendingDeadlines} pending
- Evidence: {totalEvidence} items, {highRelevanceEvidence} high-relevance
- Filings: {totalFilings} documents

Please provide:
1. A 3-5 sentence assessment of the case's current position
2. Top 3 priorities based on upcoming deadlines
3. Key evidence gaps or opportunities
4. Recommended next steps

Focus on practical, actionable advice for a self-represented litigant.
```

## Troubleshooting

### Prompt Changes Not Taking Effect

- Verify the configuration was saved: `curl http://localhost:3001/api/config`
- Check the database file: `cat server/data/db.json | grep -A 10 prompts`
- Ensure the feature is actually calling the prompt getter function (check the code)

### Unexpected AI Behavior

- Review your custom prompt for clarity and completeness
- Compare with the default prompt to see what might be missing
- Consider whether the prompt conflicts with other instructions or context
- Try reverting to defaults to isolate the issue

### API Errors

- Ensure the request payload is valid JSON
- Check that you're sending to the correct endpoint
- Verify the server is running and accessible
