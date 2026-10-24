# LORD Reality Check

Reality Check is an optional mode in LORD Chat. It reuses the configured Tavily
search integration, retrieves a small set of sources for the latest user query,
and appends an evidence report to the answer.

The report:

- Classifies answer excerpts as facts, assumptions, estimates, opinions, or
  unknowns using the selected chat model. A classification is not proof.
- Validates that quoted evidence is an exact substring of the retrieved source
  excerpt and that `[S#]` citations refer to results from that search.
- Evaluates simple arithmetic expressions with a restricted parser and checks
  direct arithmetic questions against the numeric answer.
- Parses JavaScript/TypeScript and JSON code fences for syntax only. It never
  executes generated code.
- Includes the retrieved source URLs and passages, reports unavailable search
  or claim-analysis tools, and explains what could not be verified.

Search is subject to the existing per-account search limit. Claim analysis is
limited to four requests per minute per account. If either tool is unavailable,
chat continues and the report marks the missing evidence instead of indicating
success. URLs are validated as HTTP(S) when search results are accepted; LORD
does not make a second network request to check whether a source link is live.

This chat deployment has no isolated code execution environment. It does not
modify files, run generated tests, or deploy changes. Code repairs require
explicit approval and a supported isolated test runner; those capabilities must
be provided separately before LORD can report a before/after test result.
