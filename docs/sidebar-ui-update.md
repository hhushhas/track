# Web sidebar UI update

The web sidebar now uses one clean row shape. Icons sit in the same 28px box, labels get the space they need, and unread counts stay on the far right.

```text
sidebar row
├── 28px icon box
├── flexible label and helper text
└── optional trailing count
```

| Area | Result |
| --- | --- |
| Icon alignment | 100% of project and work rows use the same icon column |
| Long names | Labels keep a flexible column and truncate safely |
| Unread counts | Counts use a stable trailing column and hide in collapsed mode |
| Accessibility | Decorative icons are hidden from screen readers; named controls keep labels |
| Layout states | Expanded, collapsed, and mobile rules remain covered |

## Web screenshots

These five web screenshots show the current Track visual language and sidebar states used for review:

1. [Company overview](../apps/web/audit-company-overview.png)
2. [Company settings shell](../apps/web/audit-company-settings-shell.png)
3. [Company settings](../apps/web/audit-company-settings.png)
4. [Projects directory](../apps/web/workflow-4-projects.png)
5. [Dark company overview](../apps/web/d911b271-4a00-4c62-af38-64d8d9fbd4ff.png)

The screenshots are visual review references. Automated proof for this change is the web lint and TypeScript check.
