---
version: 1
slug: "src-components-analysisbuilder-tsx"
primary_target: "src/components/AnalysisBuilder.tsx"
related_targets: ["src/components/analysis-builder/AnalysisSidebar.tsx","src/components/analysis-builder/AnalysisContent.tsx"]
---

# Analysis editor
Mode: Operate. Scope: new/edit analysis routes and editor components.
Audience: analysts comparing evidence-backed time series. Task: select data, set periods, add context, review and save. Preserve provenance, permissions, statuses and existing chart behavior.

## Direction contract
THESIS: Build the report while guiding configuration through data, periods and context; replace the long accordion sidebar.
OWN-WORLD: Statistical publication palette, navy header, cool blue-gray canvas, white work areas, system UI sans, aligned labels and 44px controls. Restrained color strategy. Light surfaces support sustained daytime desk work.
STORY: Select indicators, define periods and alignment, then add macro events in the Contexto step, expanded by default. Review sources in the report and choose publication state beside Save. Navigation retains draft state.
FIRST VIEWPORT: Compact navy toolbar combining steps and save, without a separate visible editor title or breadcrumb strip; 410px configuration column beside a flexible report containing title, notes, chart and sources. Mobile alternates configuration and preview. Signature interaction: step changes preserve the report alongside the active configuration.
FORM: User chose Informe en construcción, grounded statistical-publication direction, ranked first; seed:b8f9782481b3f585. Code-led. Approved sketch: .impeccable/mocks/decision/informe.html. No outstanding direction decisions.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
