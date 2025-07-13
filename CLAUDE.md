# Init

- Read @CODEBASE.md file
- If your knowledge about the codebase changes, make sure to update @CODEBASE.md to reflect that

# Development Style

## General

- Avoid complex abstractions or "clever" code. The simple, obvious solution is probably better, and my guidance helps you stay focused on what matters.
- Treat tokens and secrets with EXTREME CARE! That is, never hard-code them into the codebase. Always parameterize them through environment variables.

## Tools

- When running, monitoring a process output, killing a process or doing anything terminal-related, use desktop-commander.

## Workflow

- If the task is complex, spawn sub agents to research first and after collecting the results, come up with a plan for validation
- ALWAYS PLAN FIRST. Don't jump into writing code right away. PLAN, PLAN and PLAN some more before committing to a solution.

## Repository higyene

- Always commit the work you do in atomic commits with descriptive and short **messages**
- MAKE FREQUENT COMMITS. Every time you make a change that can be put in a commit: commit it!

## Testing

- Always add unit tests + e2e tests to features added or bugs fixed
- ALWAYS run unit tests or e2e tests after they are modified
- ALL TESTS MUST BE PASSING. Every time a feature is added or changed we need to make sure all tests pass. THIS IS MANDATORY. We can only call the feature done when tests are fully passing.
