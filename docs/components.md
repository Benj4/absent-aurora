# Component & File Map

## Source Tree

```
src/
├── assets/              # Static images and assets
│   ├── astro.svg
│   └── background.svg
├── components/
│   ├── AnalysisBuilder.tsx
│   ├── ApprovedSeriesSelector.tsx
│   ├── AuthSessionBootstrap.tsx
│   ├── Breadcrumbs.tsx
│   ├── Dashboard.astro
│   ├── IndicatorCard.tsx
│   ├── IndicatorChart.tsx
│   ├── IndicatorPostsClient.tsx
│   ├── IndicatorPostsLoader.tsx
│   ├── Navbar.tsx
│   ├── PostCard.tsx
│   ├── PostDetail.tsx
│   ├── PostListClient.tsx
│   ├── PostListFilters.tsx
│   ├── SeriesForm.tsx
│   ├── Welcome.astro
│   ├── analysis-builder/
│   │   ├── analysis-builder.data.ts
│   │   ├── analysis-builder.types.ts
│   │   ├── analysis-builder.utils.ts
│   │   ├── AnalysisChart.tsx
│   │   ├── AnalysisContent.tsx
│   │   ├── AnalysisSidebar.tsx
│   │   ├── IndicatorSelector.tsx
│   │   ├── KPICard.tsx
│   │   ├── PeriodRow.tsx
│   │   ├── SidebarSection.tsx
│   │   └── SourceConflictResolver.tsx
│   ├── macro-events/
│   │   ├── MacroEventForm.tsx
│   │   └── MacroEventsPage.tsx
│   └── user/
│       ├── UserEdit.tsx
│       ├── UserPosts.tsx
│       └── UserReviews.tsx
├── data/
│   ├── indicators.json       # 2119-line indicator catalog
│   ├── names.json
│   └── real__indicators.json
├── layouts/
│   └── Layout.astro
├── lib/
│   ├── analysis.ts
│   ├── auth-session.ts
│   ├── frequency.ts
│   ├── macro-events.ts
│   ├── paths.ts
│   ├── series-form-draft.ts
│   ├── supabase.ts           # Singleton Supabase client — SINGLE SOURCE
│   ├── url-title.ts
│   └── use-auth-session.ts
├── pages/
│   ├── index.astro
│   ├── login.astro
│   ├── post.astro
│   ├── postlist.astro
│   ├── admin/
│   │   └── macro-events.astro
│   ├── analisis/
│   │   ├── editar.astro
│   │   └── nuevo.astro
│   ├── indicators/[id]/
│   │   └── data.astro
│   ├── series/[frequency]/
│   │   └── [id].astro
│   └── user/
│       ├── index.astro
│       └── reviews.astro
├── styles/
│   └── global.css
└── types/
    ├── database.d.ts
    └── jsx.d.ts
```

---

## Component Groups

### Analysis & Series Creation
| File | Purpose |
|------|---------|
| `src/pages/series/[frequency]/[id].astro` | Create post + add serie data |
| `src/components/SeriesForm.tsx` | Series data entry form |
| `src/components/analysis-builder/*` | Advanced analysis builder UI |
| `src/components/ApprovedSeriesSelector.tsx` | Indicator selector |

### Posts & Validation
| File | Purpose |
|------|---------|
| `src/pages/post.astro` | Single post view + validation form |
| `src/pages/postlist.astro` | All posts list |
| `src/components/PostCard.tsx` | Post card display |
| `src/components/PostListClient.tsx` | Post list client component |
| `src/components/PostDetail.tsx` | Post detail view |

### Dashboard & Visualization
| File | Purpose |
|------|---------|
| `src/components/Dashboard.astro` | BentoGrid with SVG sparklines |
| `src/components/IndicatorCard.tsx` | Single indicator card |
| `src/components/IndicatorChart.tsx` | Indicator time-series chart |
| `src/components/IndicatorPostsClient.tsx` | Posts loader client |

### User Management
| File | Purpose |
|------|---------|
| `src/components/user/*` | User profile components |
| `src/pages/user/index.astro` | User posts page |
| `src/pages/user/reviews.astro` | User reviews page |

### Macro Events
| File | Purpose |
|------|---------|
| `src/pages/admin/macro-events.astro` | Macro events management |
| `src/components/macro-events/*` | Macro event forms |

### Utilities (`src/lib/`)
| File | Purpose |
|------|---------|
| `supabase.ts` | Supabase client singleton |
| `auth-session.ts` | Auth session helpers |
| `paths.ts` | URL path helpers |
| `url-title.ts` | Slug generation |
| `frequency.ts` | Frequency utilities |
| `series-form-draft.ts` | Draft persistence |
| `analysis.ts` | Analysis logic |
| `macro-events.ts` | Macro events helpers |
